import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, UnprocessableEntityException, BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from './storage.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateDocumentDto, CheckinDocumentDto, ShareDocumentDto, BulkDocumentIdsDto, BulkMoveToFolderDto } from './document.dto';

const CHECKOUT_LOCK_HOURS = 4;
const MAX_FILE_SIZE_MB = 50;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'text/plain',
  'text/csv',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.txt', '.csv',
]);

function validateFileUpload(fileName: string, mimeType: string) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BadRequestException(`File type '${mimeType}' is not allowed. Allowed types: ${[...ALLOWED_MIME_TYPES].join(', ')}`);
  }
  const ext = fileName.lastIndexOf('.') >= 0 ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(`File extension '${ext}' is not allowed.`);
  }
}

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @InjectQueue('document-scan') private readonly scanQueue: Queue,
  ) {}

  async create(tenantSlug: string, tenantId: string, dto: CreateDocumentDto, userId: string) {
    validateFileUpload(dto.fileName, dto.mimeType);
    const docId = uuidv4();
    const versionId = uuidv4();
    const rowVersion = uuidv4();

    const storageKey = this.storage.buildKey(tenantId, dto.customerId || null, dto.caseId || null, dto.docTypeId, docId, versionId);

    // Create document record
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO documents (id, title, doc_type_id, customer_id, case_id, confidentiality_level, description, tags, folder_id, origin_module, origin_entity_type, origin_entity_id, expires_at, current_version_id, is_checked_out, is_deleted, has_legal_hold, row_version, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false, false, false, $15, $16, NOW(), NOW())`,
      [docId, dto.title, dto.docTypeId, dto.customerId || null, dto.caseId || null,
       dto.confidentialityLevel || 'Normal', dto.description || null, dto.tags || [], dto.folderId || null,
       dto.originModule || null, dto.originEntityType || null, dto.originEntityId || null,
       dto.expiresAt || null, versionId, rowVersion, userId],
    );

    // Create pending version
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO document_versions (id, document_id, version_number, original_filename, content_type, provider_object_key, scan_status, created_by, created_at)
       VALUES ($1, $2, 1, $3, $4, $5, 'Pending', $6, NOW())`,
      [versionId, docId, dto.fileName, dto.mimeType, storageKey, userId],
    );

    // Generate presigned upload URL
    const uploadUrl = await this.storage.getUploadUrl(storageKey, dto.mimeType);

    // Queue scan job
    await this.scanQueue.add('scan', { tenantSlug, docId, versionId, fileName: dto.fileName, storageKey }, { delay: 2000 });

    await this.audit.log({ tenantSlug, eventType: 'DOC_CREATED', actorUserId: userId, entityType: 'Document', entityId: docId, payload: { title: dto.title } });

    return { id: docId, versionId, uploadUrl };
  }

  async getById(tenantSlug: string, docId: string, userId: string, hasStepUp = false) {
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM documents WHERE id = $1 AND is_deleted = FALSE`, [docId]);
    if (!rows?.length) throw new NotFoundException('Document not found');
    const doc = rows[0];

    // Check access for HighlyConfidential docs
    if (doc.confidentiality_level === 'HighlyConfidential') {
      // Require step-up authentication for HC docs
      if (!hasStepUp) {
        throw new ForbiddenException('Step-up authentication required for highly confidential documents');
      }
      const acl: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM document_acl WHERE document_id = $1 AND principal_type = 'User' AND principal_id = $2 AND (expires_at IS NULL OR expires_at > NOW())`, [docId, userId]);
      if (!acl?.length && doc.created_by !== userId) {
        throw new ForbiddenException('Access denied to highly confidential document');
      }
    }

    // Log document access for audit trail
    await this.audit.log({ tenantSlug, eventType: 'DOC_ACCESSED', actorUserId: userId, entityType: 'Document', entityId: docId });

    const versions: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM document_versions WHERE document_id = $1 ORDER BY version_number DESC`, [docId]);
    return { ...doc, versions: versions || [] };
  }

  async download(tenantSlug: string, docId: string, versionId: string | null, userId: string, hasStepUp = false) {
    const doc = await this.getById(tenantSlug, docId, userId, hasStepUp);

    const targetVersionId = versionId || doc.current_version_id;
    const version = doc.versions?.find((v: any) => v.id === targetVersionId);
    if (!version) throw new NotFoundException('Document version not found');

    if (version.scan_status !== 'Passed') {
      throw new UnprocessableEntityException('Document has not passed scan. Current status: ' + version.scan_status);
    }

    const downloadUrl = await this.storage.getDownloadUrl(version.provider_object_key);
    return { downloadUrl, fileName: version.original_filename, mimeType: version.content_type };
  }

  async checkout(tenantSlug: string, docId: string, userId: string) {
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM documents WHERE id = $1 AND is_deleted = false`, [docId]);
    if (!rows?.length) throw new NotFoundException('Document not found');
    const doc = rows[0];

    if (doc.has_legal_hold) throw new UnprocessableEntityException('Document is under legal hold');
    if (doc.is_checked_out) {
      // Check if lock expired (4 hours)
      const lockTime = new Date(doc.checked_out_at).getTime();
      if (Date.now() - lockTime < CHECKOUT_LOCK_HOURS * 3600000) {
        throw new ConflictException(`Document is checked out by user ${doc.checked_out_by} until lock expires`);
      }
    }

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET is_checked_out = true, checked_out_by = $1, checked_out_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [userId, docId],
    );

    await this.audit.log({ tenantSlug, eventType: 'DOC_CHECKED_OUT', actorUserId: userId, entityType: 'Document', entityId: docId });
    return { message: 'Document checked out successfully' };
  }

  async checkin(tenantSlug: string, tenantId: string, docId: string, dto: CheckinDocumentDto, userId: string) {
    validateFileUpload(dto.fileName, dto.mimeType);
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM documents WHERE id = $1 AND is_deleted = false`, [docId]);
    if (!rows?.length) throw new NotFoundException('Document not found');
    const doc = rows[0];

    if (!doc.is_checked_out) throw new UnprocessableEntityException('Document is not checked out');
    if (doc.checked_out_by !== userId) throw new ForbiddenException('Document is checked out by another user');

    // Get latest version number
    const latestVer: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT MAX(version_number) as max_ver FROM document_versions WHERE document_id = $1`, [docId]);
    const nextVer = (latestVer?.[0]?.max_ver || 0) + 1;
    const versionId = uuidv4();

    const storageKey = this.storage.buildKey(tenantId, doc.customer_id, doc.case_id, doc.doc_type_id, docId, versionId);

    // Create new version
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO document_versions (id, document_id, version_number, original_filename, content_type, provider_object_key, scan_status, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7, NOW())`,
      [versionId, docId, nextVer, dto.fileName, dto.mimeType, storageKey, userId],
    );

    // Update document
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET current_version_id = $1, is_checked_out = false, checked_out_by = NULL, checked_out_at = NULL, row_version = $2, updated_at = NOW() WHERE id = $3`,
      [versionId, uuidv4(), docId],
    );

    const uploadUrl = await this.storage.getUploadUrl(storageKey, dto.mimeType);
    await this.scanQueue.add('scan', { tenantSlug, docId, versionId, fileName: dto.fileName, storageKey }, { delay: 2000 });

    await this.audit.log({ tenantSlug, eventType: 'DOC_CHECKED_IN', actorUserId: userId, entityType: 'Document', entityId: docId, payload: { versionNumber: nextVer } });

    return { versionId, uploadUrl };
  }

  async breakLock(tenantSlug: string, docId: string, userId: string) {
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM documents WHERE id = $1`, [docId]);
    if (!rows?.length) throw new NotFoundException('Document not found');
    if (!rows[0].is_checked_out) throw new UnprocessableEntityException('Document is not checked out');

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET is_checked_out = false, checked_out_by = NULL, checked_out_at = NULL, updated_at = NOW() WHERE id = $1`,
      [docId],
    );

    await this.audit.log({ tenantSlug, eventType: 'DOC_LOCK_BROKEN', actorUserId: userId, entityType: 'Document', entityId: docId, payload: { previousLockedBy: rows[0].checked_out_by } });
    return { message: 'Lock broken' };
  }

  async shareDocument(tenantSlug: string, docId: string, dto: ShareDocumentDto, userId: string) {
    const aclId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO document_acl (id, document_id, principal_type, principal_id, permission, created_by, expires_at, created_at) VALUES ($1, $2, 'User', $3, $4, $5, $6, NOW())`,
      [aclId, docId, dto.userId, dto.permission || 'View', userId, dto.expiresAt || null],
    );
    await this.audit.log({ tenantSlug, eventType: 'DOC_SHARED', actorUserId: userId, entityType: 'Document', entityId: docId, payload: { sharedWith: dto.userId, expiresAt: dto.expiresAt || null } });
    return { id: aclId };
  }

  async setLegalHold(tenantSlug: string, docId: string, userId: string) {
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET has_legal_hold = true, updated_at = NOW() WHERE id = $1`,
      [docId],
    );
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO legal_holds (id, document_id, reason, placed_by, placed_at, is_active) VALUES ($1, $2, 'Legal hold placed', $3, NOW(), true)`,
      [uuidv4(), docId, userId],
    );
    await this.audit.log({ tenantSlug, eventType: 'LEGAL_HOLD_PLACED', actorUserId: userId, entityType: 'Document', entityId: docId });
    return { message: 'Legal hold placed' };
  }

  async removeLegalHold(tenantSlug: string, docId: string, userId: string) {
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET has_legal_hold = false, updated_at = NOW() WHERE id = $1`,
      [docId],
    );
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE legal_holds SET is_active = false, lifted_by = $1, lifted_at = NOW() WHERE document_id = $2 AND is_active = true`,
      [userId, docId],
    );
    await this.audit.log({ tenantSlug, eventType: 'LEGAL_HOLD_LIFTED', actorUserId: userId, entityType: 'Document', entityId: docId });
    return { message: 'Legal hold removed' };
  }

  async softDelete(tenantSlug: string, docId: string, userId: string) {
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM documents WHERE id = $1`, [docId]);
    if (!rows?.length) throw new NotFoundException('Document not found');
    if (rows[0].has_legal_hold) throw new UnprocessableEntityException('Cannot delete document under legal hold');

    await this.prisma.executeTenant(tenantSlug, `UPDATE documents SET is_deleted = true, updated_at = NOW() WHERE id = $1`, [docId]);
    await this.audit.log({ tenantSlug, eventType: 'DOC_DELETED', actorUserId: userId, entityType: 'Document', entityId: docId });
    return { message: 'Document deleted' };
  }

  async restore(tenantSlug: string, docId: string, userId: string) {
    await this.prisma.executeTenant(tenantSlug, `UPDATE documents SET is_deleted = false, updated_at = NOW() WHERE id = $1`, [docId]);
    await this.audit.log({ tenantSlug, eventType: 'DOC_RESTORED', actorUserId: userId, entityType: 'Document', entityId: docId });
    return { message: 'Document restored' };
  }

  /** Case-level legal hold — applies hold to ALL documents linked to a case */
  async setCaseLegalHold(tenantSlug: string, caseId: string, userId: string) {
    // Mark all case documents as held
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET has_legal_hold = true, updated_at = NOW() WHERE case_id = $1 AND is_deleted = false`,
      [caseId],
    );
    // Insert legal_holds record at case level
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO legal_holds (id, case_id, reason, placed_by, placed_at, is_active) VALUES ($1, $2, 'Case legal hold', $3, NOW(), true)`,
      [uuidv4(), caseId, userId],
    );
    await this.audit.log({ tenantSlug, eventType: 'CASE_LEGAL_HOLD_PLACED', actorUserId: userId, entityType: 'Case', entityId: caseId });
    return { message: 'Legal hold placed on all case documents' };
  }

  async removeCaseLegalHold(tenantSlug: string, caseId: string, userId: string) {
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET has_legal_hold = false, updated_at = NOW() WHERE case_id = $1`,
      [caseId],
    );
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE legal_holds SET is_active = false, lifted_by = $1, lifted_at = NOW() WHERE case_id = $2 AND is_active = true`,
      [userId, caseId],
    );
    await this.audit.log({ tenantSlug, eventType: 'CASE_LEGAL_HOLD_LIFTED', actorUserId: userId, entityType: 'Case', entityId: caseId });
    return { message: 'Legal hold removed from all case documents' };
  }

  async list(tenantSlug: string, caseId?: string, customerId?: string, docTypeId?: string, cursor?: string, limit = 20) {
    let sql = `SELECT d.*, COALESCE(dv.original_filename, '') AS file_name, dv.scan_status FROM documents d
               LEFT JOIN document_versions dv ON d.current_version_id = dv.id
           WHERE d.is_deleted = FALSE`;
    const params: any[] = [];
    let idx = 1;

    if (caseId) { sql += ` AND d.case_id = $${idx++}`; params.push(caseId); }
    if (customerId) { sql += ` AND d.customer_id = $${idx++}`; params.push(customerId); }
    if (docTypeId) { sql += ` AND d.doc_type_id = $${idx++}`; params.push(docTypeId); }
    if (cursor) { sql += ` AND d.created_at < $${idx++}`; params.push(cursor); }

    sql += ` ORDER BY d.created_at DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }

  // ── Bulk Operations ──────────────────────────────────────

  async bulkDelete(tenantSlug: string, dto: BulkDocumentIdsDto, userId: string) {
    const placeholders = dto.documentIds.map((_, i) => `$${i + 1}`).join(', ');
    // Only soft-delete docs NOT under legal hold
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET is_deleted = TRUE, updated_at = NOW()
       WHERE id IN (${placeholders}) AND has_legal_hold = FALSE`,
      dto.documentIds,
    );
    await this.audit.log({
      tenantSlug, eventType: 'BULK_DOC_DELETED', actorUserId: userId,
      entityType: 'Document', entityId: dto.documentIds[0],
      payload: { documentIds: dto.documentIds },
    });
    return { deleted: dto.documentIds.length };
  }

  async bulkMoveToFolder(tenantSlug: string, dto: BulkMoveToFolderDto, userId: string) {
    const placeholders = dto.documentIds.map((_, i) => `$${i + 2}`).join(', ');
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET folder_id = $1, updated_at = NOW()
       WHERE id IN (${placeholders})`,
      [dto.folderId || null, ...dto.documentIds],
    );
    await this.audit.log({
      tenantSlug, eventType: 'BULK_DOC_MOVED', actorUserId: userId,
      entityType: 'Document', entityId: dto.documentIds[0],
      payload: { documentIds: dto.documentIds, folderId: dto.folderId },
    });
    return { moved: dto.documentIds.length };
  }

  async bulkRestore(tenantSlug: string, dto: BulkDocumentIdsDto, userId: string) {
    const placeholders = dto.documentIds.map((_, i) => `$${i + 1}`).join(', ');
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET is_deleted = FALSE, updated_at = NOW() WHERE id IN (${placeholders})`,
      dto.documentIds,
    );
    await this.audit.log({
      tenantSlug, eventType: 'BULK_DOC_RESTORED', actorUserId: userId,
      entityType: 'Document', entityId: dto.documentIds[0],
      payload: { documentIds: dto.documentIds },
    });
    return { restored: dto.documentIds.length };
  }

  // ── Origin lookup (for Rich Upload integration) ───────────
  async listByOrigin(tenantSlug: string, originEntityType: string, originEntityId: string, cursor?: string, limit = 20) {
    let sql = `SELECT d.*, COALESCE(dv.original_filename, '') AS file_name, dv.scan_status
               FROM documents d LEFT JOIN document_versions dv ON d.current_version_id = dv.id
               WHERE d.origin_entity_type = $1 AND d.origin_entity_id = $2 AND d.is_deleted = FALSE`;
    const params: any[] = [originEntityType, originEntityId];
    let idx = 3;

    if (cursor) { sql += ` AND d.created_at < $${idx++}`; params.push(cursor); }
    sql += ` ORDER BY d.created_at DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }
}
