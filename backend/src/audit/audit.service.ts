import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogParams {
  tenantSlug: string;
  eventType: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, any>;
  correlationId?: string;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    const { tenantSlug, eventType, actorUserId, entityType, entityId, payload, correlationId, ipAddress } = params;
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO audit_events (id, event_type, actor_user_id, entity_type, entity_id, payload, correlation_id, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())`,
      [uuidv4(), eventType, actorUserId, entityType, entityId, JSON.stringify(payload || {}), correlationId || uuidv4(), ipAddress || null],
    );
  }

  async getByEntity(tenantSlug: string, entityType: string, entityId: string, cursor?: string, limit = 20) {
    let sql = `SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2`;
    const params: any[] = [entityType, entityId];

    if (cursor) {
      sql += ` AND created_at < $3`;
      params.push(cursor);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].created_at : null,
      hasMore,
    };
  }

  async getByTenant(tenantSlug: string, cursor?: string, limit = 20) {
    let sql = `SELECT * FROM audit_events`;
    const params: any[] = [];

    if (cursor) {
      sql += ` WHERE created_at < $1`;
      params.push(cursor);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].created_at : null,
      hasMore,
    };
  }
}
