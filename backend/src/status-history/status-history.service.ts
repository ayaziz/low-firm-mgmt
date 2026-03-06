import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

export interface StatusTransition {
  tenantSlug: string;
  entityType: string;   // 'case' | 'invoice' | 'wage' | 'document' | 'expense' | 'customer' etc.
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string;
  comment?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class StatusHistoryService {
  private readonly logger = new Logger(StatusHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a status transition. Fire-and-forget safe — callers can await
   * or let it resolve in the background.
   */
  async record(t: StatusTransition): Promise<string> {
    const id = uuidv4();
    await this.prisma.executeTenant(
      t.tenantSlug,
      `INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, actor_user_id, comment, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      [
        id,
        t.entityType,
        t.entityId,
        t.fromStatus,
        t.toStatus,
        t.actorUserId,
        t.comment || null,
        JSON.stringify(t.metadata || {}),
      ],
    );
    return id;
  }

  /**
   * Retrieve the full timeline for an entity, newest first.
   */
  async getTimeline(
    tenantSlug: string,
    entityType: string,
    entityId: string,
    cursor?: string,
    limit = 50,
  ) {
    let sql = `SELECT * FROM status_history WHERE entity_type = $1 AND entity_id = $2`;
    const params: any[] = [entityType, entityId];
    let idx = 3;

    if (cursor) {
      sql += ` AND created_at < $${idx++}`;
      params.push(cursor);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return {
      data,
      nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null,
      hasMore,
    };
  }
}
