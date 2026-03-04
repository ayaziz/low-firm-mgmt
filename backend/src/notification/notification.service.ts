import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async create(tenantSlug: string, data: {
    userId: string;
    title: string;
    body?: string;
    type: 'task' | 'session' | 'approval' | 'system';
    entityType?: string;
    entityId?: string;
    /** Set true to also send an email notification. Requires user email lookup. */
    sendEmail?: boolean;
  }) {
    const id = uuidv4();
    await this.prisma.executeTenant(tenantSlug,
      `INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())`,
      [id, data.userId, data.title, data.body || null, data.type, data.entityType || null, data.entityId || null]);

    // Optionally send email
    if (data.sendEmail) {
      this.sendEmailForUser(tenantSlug, data.userId, data.title, data.body || data.title).catch((err) =>
        this.logger.warn(`Email send failed for notification ${id}: ${err.message}`),
      );
    }

    return { id, ...data, isRead: false };
  }

  async listForUser(tenantSlug: string, userId: string, isRead?: boolean, cursor?: string, limit = 20) {
    const safeLimit = Math.min(limit, 50);
    const conditions = ['user_id = $1'];
    const params: any[] = [userId];
    let idx = 2;

    if (isRead !== undefined) {
      conditions.push(`is_read = $${idx++}`);
      params.push(isRead);
    }
    if (cursor) {
      conditions.push(`id < $${idx++}`);
      params.push(cursor);
    }

    params.push(safeLimit);
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT id, title, body, type, entity_type, entity_id, is_read, created_at
       FROM notifications WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${idx}`, params);

    const nextCursor = rows.length >= safeLimit ? rows[rows.length - 1].id : null;
    return { data: rows, cursor: nextCursor };
  }

  async getUnreadCount(tenantSlug: string, userId: string): Promise<number> {
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`, [userId]);
    return rows[0]?.count || 0;
  }

  async markAsRead(tenantSlug: string, notificationId: string, userId: string) {
    await this.prisma.executeTenant(tenantSlug,
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
    return { id: notificationId, isRead: true };
  }

  async markAllRead(tenantSlug: string, userId: string) {
    const result = await this.prisma.executeTenant(tenantSlug,
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [userId]);
    return { updated: true };
  }

  // ── Email helper ──────────────────────────────────────────

  private async sendEmailForUser(tenantSlug: string, userId: string, title: string, body: string): Promise<void> {
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT email FROM users WHERE id = $1`, [userId]);
    if (rows.length === 0 || !rows[0].email) {
      this.logger.warn(`Cannot send email — user ${userId} has no email`);
      return;
    }
    await this.email.sendNotificationEmail(rows[0].email, title, body);
  }
}
