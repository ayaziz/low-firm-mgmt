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

  async create(tenantSlug: string, dto: CreateFolderDto, userId: string) {
    const folderId = uuidv4();

    // Build path from parent
    let path = `/${dto.name}`;
    if (dto.parentId) {
      const parent = await this.getById(tenantSlug, dto.parentId);
      path = `${parent.path}/${dto.name}`;

      // Check for duplicate at same level
      const dupes: any[] = await this.prisma.queryTenant(
        tenantSlug,
        `SELECT id FROM folders WHERE parent_folder_id = $1 AND name = $2`,
        [dto.parentId, dto.name],
      );
      if (dupes.length > 0) throw new ConflictException('Folder with this name already exists at this level');
    } else if (dto.caseId) {
      // Root-level for case — check no duplicate
      const dupes: any[] = await this.prisma.queryTenant(
        tenantSlug,
        `SELECT id FROM folders WHERE scope_id = $1 AND parent_folder_id IS NULL AND name = $2`,
        [dto.caseId, dto.name],
      );
      if (dupes.length > 0) throw new ConflictException('Root folder with this name already exists for this case');
    }

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO folders (id, name, scope_id, parent_folder_id, scope, path, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [folderId, dto.name, dto.caseId || null, dto.parentId || null,
       dto.scope || 'Case', path, userId],
    );

    await this.audit.log({
      tenantSlug, eventType: 'FOLDER_CREATED', actorUserId: userId,
      entityType: 'Folder', entityId: folderId,
      payload: { name: dto.name, caseId: dto.caseId, parentId: dto.parentId, path },
    });

    return this.getById(tenantSlug, folderId);
  }

  async listByCase(tenantSlug: string, caseId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT f.*,
         (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id)::int AS document_count,
         (SELECT COUNT(*) FROM folders c WHERE c.parent_folder_id = f.id)::int AS child_count
       FROM folders f
       WHERE f.scope_id = $1
       ORDER BY f.path ASC`,
      [caseId],
    );
    return rows;
  }

  async getTree(tenantSlug: string, caseId: string) {
    // Return all folders for a case as a flat list with parent_id; frontend builds the tree
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT f.id, f.name, f.parent_folder_id, f.path, f.scope,
         (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id)::int AS document_count
       FROM folders f
       WHERE f.scope_id = $1
       ORDER BY f.path ASC`,
      [caseId],
    );
    return rows;
  }

  async getById(tenantSlug: string, folderId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT f.*,
         (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id)::int AS document_count,
         (SELECT COUNT(*) FROM folders c WHERE c.parent_folder_id = f.id)::int AS child_count
       FROM folders f
       WHERE f.id = $1`,
      [folderId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Folder not found');
    return rows[0];
  }

  async getDocuments(tenantSlug: string, folderId: string, cursor?: string, limit = 20) {
    await this.getById(tenantSlug, folderId);

    let sql = `SELECT d.id, d.title, d.file_name, d.mime_type, d.file_size, d.ocr_status, d.created_at
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

  async update(tenantSlug: string, folderId: string, dto: UpdateFolderDto, userId: string) {
    const folder = await this.getById(tenantSlug, folderId);

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(dto.name);
      // Update path
      const newPath = folder.path.replace(/\/[^/]*$/, `/${dto.name}`);
      setClauses.push(`path = $${idx++}`);
      params.push(newPath);
    }
    params.push(folderId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE folders SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.audit.log({
      tenantSlug, eventType: 'FOLDER_UPDATED', actorUserId: userId,
      entityType: 'Folder', entityId: folderId,
      payload: dto as Record<string, any>,
    });

    return this.getById(tenantSlug, folderId);
  }

  async move(tenantSlug: string, folderId: string, dto: MoveFolderDto, userId: string) {
    const folder = await this.getById(tenantSlug, folderId);

    // Prevent moving into own subtree
    if (dto.newParentId) {
      const parent = await this.getById(tenantSlug, dto.newParentId);
      if (parent.path.startsWith(folder.path)) {
        throw new BadRequestException('Cannot move folder into its own subtree');
      }
      const newPath = `${parent.path}/${folder.name}`;
      await this.prisma.executeTenant(
        tenantSlug,
        `UPDATE folders SET parent_folder_id = $1, path = $2, updated_at = NOW() WHERE id = $3`,
        [dto.newParentId, newPath, folderId],
      );
    } else {
      // Move to root
      const newPath = `/${folder.name}`;
      await this.prisma.executeTenant(
        tenantSlug,
        `UPDATE folders SET parent_folder_id = NULL, path = $1, updated_at = NOW() WHERE id = $2`,
        [newPath, folderId],
      );
    }

    await this.audit.log({
      tenantSlug, eventType: 'FOLDER_MOVED', actorUserId: userId,
      entityType: 'Folder', entityId: folderId,
      payload: { newParentId: dto.newParentId },
    });

    return this.getById(tenantSlug, folderId);
  }

  async moveDocument(tenantSlug: string, dto: MoveDocumentToFolderDto, userId: string) {
    // Verify document exists
    const docs: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT id FROM documents WHERE id = $1`,
      [dto.documentId],
    );
    if (!docs || docs.length === 0) throw new NotFoundException('Document not found');

    if (dto.folderId) {
      await this.getById(tenantSlug, dto.folderId); // verify folder exists
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

  async createDefaultFolders(tenantSlug: string, caseId: string, userId: string) {
    const defaultFolders = [
      'Pleadings',
      'Correspondence',
      'Evidence',
      'Court Orders',
      'Client Documents',
      'Financial',
    ];

    for (const name of defaultFolders) {
      await this.create(tenantSlug, { name, caseId, scope: 'Case' }, userId);
    }
  }

  async delete(tenantSlug: string, folderId: string, userId: string) {
    const folder = await this.getById(tenantSlug, folderId);

    // Check for children or documents
    if (folder.child_count > 0) throw new BadRequestException('Cannot delete folder with subfolders');
    if (folder.document_count > 0) throw new BadRequestException('Cannot delete folder with documents');

    await this.prisma.executeTenant(tenantSlug, `DELETE FROM folders WHERE id = $1`, [folderId]);

    await this.audit.log({
      tenantSlug, eventType: 'FOLDER_DELETED', actorUserId: userId,
      entityType: 'Folder', entityId: folderId,
      payload: { name: folder.name, path: folder.path },
    });

    return { deleted: true };
  }
}
