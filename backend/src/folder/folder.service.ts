import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateFolderDto, UpdateFolderDto, MoveFolderDto, MoveDocumentToFolderDto } from './folder.dto';

@Injectable()
export class FolderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Create ─────────────────────────────────────────────────
  async create(tenantSlug: string, dto: CreateFolderDto, userId: string) {
    const folderId = uuidv4();

    // Duplicate check at same parent level
    const dupeParams: any[] = [dto.scopeType, dto.scopeId, dto.name];
    let dupeSql: string;
    if (dto.parentId) {
      await this.getById(tenantSlug, dto.parentId); // verify parent exists
      dupeSql = `SELECT id FROM folders WHERE scope_type = $1 AND scope_id = $2 AND parent_folder_id = $3 AND name = $4 AND is_deleted = FALSE`;
      dupeParams.splice(2, 0, dto.parentId);
    } else {
      dupeSql = `SELECT id FROM folders WHERE scope_type = $1 AND scope_id = $2 AND parent_folder_id IS NULL AND name = $3 AND is_deleted = FALSE`;
    }
    const dupes: any[] = await this.prisma.queryTenant(tenantSlug, dupeSql, dupeParams);
    if (dupes.length > 0) throw new ConflictException('Folder with this name already exists at this level');

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO folders (id, scope_type, scope_id, parent_folder_id, name, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [folderId, dto.scopeType, dto.scopeId, dto.parentId || null, dto.name, userId],
    );

    await this.audit.log({
      tenantSlug, eventType: 'FOLDER_CREATED', actorUserId: userId,
      entityType: 'Folder', entityId: folderId,
      payload: { name: dto.name, scopeType: dto.scopeType, scopeId: dto.scopeId, parentId: dto.parentId },
    });

    return this.getById(tenantSlug, folderId);
  }

  // ── List by scope ──────────────────────────────────────────
  async listByScope(tenantSlug: string, scopeType: string, scopeId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT f.*,
         (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id)::int AS document_count,
         (SELECT COUNT(*) FROM folders c WHERE c.parent_folder_id = f.id AND c.is_deleted = FALSE)::int AS child_count
       FROM folders f
       WHERE f.scope_type = $1 AND f.scope_id = $2 AND f.is_deleted = FALSE
       ORDER BY f.name ASC`,
      [scopeType, scopeId],
    );
    return rows;
  }

  /** Backward-compatible alias used by controller GET case/:caseId */
  async listByCase(tenantSlug: string, caseId: string) {
    return this.listByScope(tenantSlug, 'case', caseId);
  }

  // ── Tree (flat list, frontend builds tree) ─────────────────
  async getTree(tenantSlug: string, scopeType: string, scopeId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT f.id, f.name, f.parent_folder_id, f.scope_type, f.scope_id,
         (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id)::int AS document_count
       FROM folders f
       WHERE f.scope_type = $1 AND f.scope_id = $2 AND f.is_deleted = FALSE
       ORDER BY f.name ASC`,
      [scopeType, scopeId],
    );
    return rows;
  }

  // ── Get by ID ──────────────────────────────────────────────
  async getById(tenantSlug: string, folderId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT f.*,
         (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id)::int AS document_count,
         (SELECT COUNT(*) FROM folders c WHERE c.parent_folder_id = f.id AND c.is_deleted = FALSE)::int AS child_count
       FROM folders f
       WHERE f.id = $1 AND f.is_deleted = FALSE`,
      [folderId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Folder not found');
    return rows[0];
  }

  // ── List documents in folder ───────────────────────────────
  async getDocuments(tenantSlug: string, folderId: string, cursor?: string, limit = 20) {
    await this.getById(tenantSlug, folderId);

    let sql = `SELECT d.id, d.title, d.file_name, d.mime_type, d.file_size,
                      d.origin_module, d.origin_entity_type, d.origin_entity_id,
                      d.expires_at, d.created_at
               FROM documents d WHERE d.folder_id = $1`;
    const params: any[] = [folderId];
    let idx = 2;

    if (cursor) { sql += ` AND d.created_at < $${idx++}`; params.push(cursor); }

    sql += ` ORDER BY d.created_at DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }

  // ── Update ─────────────────────────────────────────────────
  async update(tenantSlug: string, folderId: string, dto: UpdateFolderDto, userId: string) {
    await this.getById(tenantSlug, folderId);

    if (dto.name !== undefined) {
      await this.prisma.executeTenant(
        tenantSlug,
        `UPDATE folders SET name = $1, updated_at = NOW() WHERE id = $2`,
        [dto.name, folderId],
      );
    }

    await this.audit.log({
      tenantSlug, eventType: 'FOLDER_UPDATED', actorUserId: userId,
      entityType: 'Folder', entityId: folderId,
      payload: dto as Record<string, any>,
    });

    return this.getById(tenantSlug, folderId);
  }

  // ── Move ───────────────────────────────────────────────────
  async move(tenantSlug: string, folderId: string, dto: MoveFolderDto, userId: string) {
    const folder = await this.getById(tenantSlug, folderId);

    // Prevent moving into own subtree via recursive CTE
    if (dto.newParentId) {
      const cycle: any[] = await this.prisma.queryTenant(
        tenantSlug,
        `WITH RECURSIVE descendants AS (
           SELECT id FROM folders WHERE id = $1
           UNION ALL
           SELECT f.id FROM folders f JOIN descendants d ON f.parent_folder_id = d.id
         )
         SELECT id FROM descendants WHERE id = $2`,
        [folderId, dto.newParentId],
      );
      if (cycle.length > 0) throw new BadRequestException('Cannot move folder into its own subtree');

      await this.prisma.executeTenant(
        tenantSlug,
        `UPDATE folders SET parent_folder_id = $1, updated_at = NOW() WHERE id = $2`,
        [dto.newParentId, folderId],
      );
    } else {
      await this.prisma.executeTenant(
        tenantSlug,
        `UPDATE folders SET parent_folder_id = NULL, updated_at = NOW() WHERE id = $1`,
        [folderId],
      );
    }

    await this.audit.log({
      tenantSlug, eventType: 'FOLDER_MOVED', actorUserId: userId,
      entityType: 'Folder', entityId: folderId,
      payload: { newParentId: dto.newParentId },
    });

    return this.getById(tenantSlug, folderId);
  }

  // ── Move document to folder ────────────────────────────────
  async moveDocument(tenantSlug: string, dto: MoveDocumentToFolderDto, userId: string) {
    const docs: any[] = await this.prisma.queryTenant(
      tenantSlug, `SELECT id FROM documents WHERE id = $1`, [dto.documentId],
    );
    if (!docs || docs.length === 0) throw new NotFoundException('Document not found');

    if (dto.folderId) {
      await this.getById(tenantSlug, dto.folderId);
    }

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE documents SET folder_id = $1, updated_at = NOW() WHERE id = $2`,
      [dto.folderId || null, dto.documentId],
    );

    await this.audit.log({
      tenantSlug, eventType: 'DOCUMENT_MOVED', actorUserId: userId,
      entityType: 'Document', entityId: dto.documentId,
      payload: { folderId: dto.folderId },
    });

    return { success: true };
  }

  // ── Create default folders for a case ──────────────────────
  async createDefaultFolders(tenantSlug: string, caseId: string, userId: string) {
    const defaultFolders = [
      'Pleadings', 'Correspondence', 'Evidence',
      'Court Orders', 'Client Documents', 'Financial',
    ];

    for (const name of defaultFolders) {
      await this.create(tenantSlug, { name, scopeType: 'case', scopeId: caseId }, userId);
    }
  }

  // ── Soft delete ────────────────────────────────────────────
  async delete(tenantSlug: string, folderId: string, userId: string) {
    const folder = await this.getById(tenantSlug, folderId);

    if (folder.child_count > 0) throw new BadRequestException('Cannot delete folder with subfolders');
    if (folder.document_count > 0) throw new BadRequestException('Cannot delete folder with documents');

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE folders SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      [folderId],
    );

    await this.audit.log({
      tenantSlug, eventType: 'FOLDER_DELETED', actorUserId: userId,
      entityType: 'Folder', entityId: folderId,
      payload: { name: folder.name },
    });

    return { deleted: true };
  }
}
