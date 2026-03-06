import {
  Injectable, NotFoundException, ForbiddenException,
  UnprocessableEntityException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class ExternalShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createShareLink(
    tenantSlug: string,
    documentId: string,
    userId: string,
    options: {
      expiresAt?: string;
      password?: string;
      maxDownloads?: number;
    } = {},
  ) {
    // Verify document exists and not deleted
    const docs: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT id FROM documents WHERE id = $1 AND is_deleted = false`,
      [documentId],
    );
    if (!docs?.length) throw new NotFoundException('Document not found');

    const id = uuidv4();
    const token = crypto.randomBytes(48).toString('base64url');
    const passwordHash = options.password
      ? crypto.createHash('sha256').update(options.password).digest('hex')
      : null;

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO external_share_links (id, document_id, token, created_by, expires_at, password_hash, max_downloads, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        id,
        documentId,
        token,
        userId,
        options.expiresAt || null,
        passwordHash,
        options.maxDownloads || null,
      ],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'EXTERNAL_SHARE_CREATED',
      actorUserId: userId,
      entityType: 'Document',
      entityId: documentId,
      payload: { shareLinkId: id, expiresAt: options.expiresAt, hasPassword: !!options.password },
    });

    return { id, token, documentId };
  }

  async listShareLinks(tenantSlug: string, documentId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT id, document_id, token, created_by, expires_at, max_downloads, download_count, is_revoked, created_at
       FROM external_share_links WHERE document_id = $1 ORDER BY created_at DESC`,
      [documentId],
    );
    return rows;
  }

  async revokeShareLink(tenantSlug: string, shareLinkId: string, userId: string) {
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE external_share_links SET is_revoked = true WHERE id = $1`,
      [shareLinkId],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'EXTERNAL_SHARE_REVOKED',
      actorUserId: userId,
      entityType: 'ExternalShareLink',
      entityId: shareLinkId,
    });

    return { revoked: true };
  }

  /**
   * Public access via token — no auth required.
   * Validates expiry, revocation, max downloads, and optional password.
   */
  async accessShareLink(
    tenantSlug: string,
    token: string,
    password?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const links: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM external_share_links WHERE token = $1`,
      [token],
    );
    if (!links?.length) throw new NotFoundException('Share link not found');
    const link = links[0];

    if (link.is_revoked) throw new ForbiddenException('Share link has been revoked');
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      throw new UnprocessableEntityException('Share link has expired');
    }
    if (link.max_downloads && link.download_count >= link.max_downloads) {
      throw new UnprocessableEntityException('Download limit reached');
    }
    if (link.password_hash) {
      if (!password) throw new BadRequestException('Password required');
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      if (hash !== link.password_hash) throw new ForbiddenException('Invalid password');
    }

    // Record access
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO external_share_accesses (id, share_link_id, accessed_at, ip_address, user_agent)
       VALUES ($1, $2, NOW(), $3, $4)`,
      [uuidv4(), link.id, ipAddress || null, userAgent || null],
    );

    // Increment download count
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE external_share_links SET download_count = download_count + 1 WHERE id = $1`,
      [link.id],
    );

    return { documentId: link.document_id, shareLinkId: link.id };
  }
}
