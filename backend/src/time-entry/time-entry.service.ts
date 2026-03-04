import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { v4 as uuidv4 } from 'uuid';
import { VALID_TIME_ENTRY_TRANSITIONS } from '../common/types';
import { CreateTimeEntryDto, UpdateTimeEntryDto, TransitionTimeEntryDto } from './time-entry.dto';

@Injectable()
export class TimeEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async create(tenantSlug: string, dto: CreateTimeEntryDto, userId: string) {
    const entryId = uuidv4();

    // Verify case exists
    const caseRows: any[] = await this.prisma.queryTenant(
      tenantSlug, `SELECT id, title FROM cases WHERE id = $1`, [dto.caseId],
    );
    if (!caseRows || caseRows.length === 0) throw new NotFoundException('Case not found');

    const ratePerHour = dto.ratePerHour || 0;
    const totalAmount = dto.hours * ratePerHour;

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO time_entries (id, case_id, user_id, entry_date, hours, description, activity_type, rate_per_hour, total_amount, hearing_id, task_id, billable, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Draft', NOW(), NOW())`,
      [entryId, dto.caseId, userId, dto.entryDate, dto.hours, dto.description,
       dto.activityType || null, ratePerHour, totalAmount, dto.hearingId || null, dto.taskId || null, dto.billable !== false],
    );

    await this.audit.log({
      tenantSlug, eventType: 'TIME_ENTRY_CREATED', actorUserId: userId,
      entityType: 'TimeEntry', entityId: entryId,
      payload: { caseId: dto.caseId, hours: dto.hours, entryDate: dto.entryDate },
    });

    return this.getById(tenantSlug, entryId);
  }

  async list(tenantSlug: string, caseId?: string, userId?: string, status?: string, startDate?: string, endDate?: string, cursor?: string, limit = 20) {
    let sql = `SELECT te.*, c.title AS case_title, u.email AS user_email, u."displayName" AS user_name
               FROM time_entries te
               LEFT JOIN cases c ON te.case_id = c.id
               LEFT JOIN public.users u ON te.user_id::text = u.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (caseId) { sql += ` AND te.case_id = $${idx++}`; params.push(caseId); }
    if (userId) { sql += ` AND te.user_id = $${idx++}`; params.push(userId); }
    if (status) { sql += ` AND te.status = $${idx++}`; params.push(status); }
    if (startDate) { sql += ` AND te.entry_date >= $${idx++}`; params.push(startDate); }
    if (endDate) { sql += ` AND te.entry_date <= $${idx++}`; params.push(endDate); }
    if (cursor) { sql += ` AND te.created_at < $${idx++}`; params.push(cursor); }

    sql += ` ORDER BY te.entry_date DESC, te.created_at DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }

  async summary(tenantSlug: string, caseId?: string, userId?: string, startDate?: string, endDate?: string) {
    let sql = `SELECT
                 COUNT(*)::int AS total_entries,
                 COALESCE(SUM(hours), 0)::float AS total_hours,
                 COALESCE(SUM(hours * rate_per_hour), 0)::float AS total_amount,
                 COALESCE(SUM(CASE WHEN billable THEN hours ELSE 0 END), 0)::float AS billable_hours,
                 COALESCE(SUM(CASE WHEN billable THEN hours * rate_per_hour ELSE 0 END), 0)::float AS billable_amount,
                 COALESCE(SUM(CASE WHEN NOT billable THEN hours ELSE 0 END), 0)::float AS non_billable_hours
               FROM time_entries WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (caseId) { sql += ` AND case_id = $${idx++}`; params.push(caseId); }
    if (userId) { sql += ` AND user_id = $${idx++}`; params.push(userId); }
    if (startDate) { sql += ` AND entry_date >= $${idx++}`; params.push(startDate); }
    if (endDate) { sql += ` AND entry_date <= $${idx++}`; params.push(endDate); }

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    return rows[0];
  }

  async getById(tenantSlug: string, entryId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT te.*, c.title AS case_title
       FROM time_entries te
       LEFT JOIN cases c ON te.case_id = c.id
       WHERE te.id = $1`,
      [entryId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Time entry not found');
    return rows[0];
  }

  async update(tenantSlug: string, entryId: string, dto: UpdateTimeEntryDto, userId: string) {
    const entry = await this.getById(tenantSlug, entryId);

    if (entry.status !== 'Draft') {
      throw new UnprocessableEntityException('Only draft time entries can be edited');
    }
    if (entry.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own time entries');
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.entryDate !== undefined) { setClauses.push(`entry_date = $${idx++}`); params.push(dto.entryDate); }
    if (dto.hours !== undefined) { setClauses.push(`hours = $${idx++}`); params.push(dto.hours); }
    if (dto.description !== undefined) { setClauses.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.ratePerHour !== undefined) { setClauses.push(`rate_per_hour = $${idx++}`); params.push(dto.ratePerHour); }
    if (dto.billable !== undefined) { setClauses.push(`billable = $${idx++}`); params.push(dto.billable); }
    if (dto.activityType !== undefined) { setClauses.push(`activity_type = $${idx++}`); params.push(dto.activityType); }
    if (dto.taskId !== undefined) { setClauses.push(`task_id = $${idx++}`); params.push(dto.taskId); }

    // Recompute total_amount if hours or rate changed
    const newHours = dto.hours ?? entry.hours;
    const newRate = dto.ratePerHour ?? entry.rate_per_hour ?? 0;
    setClauses.push(`total_amount = $${idx++}`); params.push(newHours * newRate);

    params.push(entryId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE time_entries SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.audit.log({
      tenantSlug, eventType: 'TIME_ENTRY_UPDATED', actorUserId: userId,
      entityType: 'TimeEntry', entityId: entryId,
      payload: dto as Record<string, any>,
    });

    return this.getById(tenantSlug, entryId);
  }

  async transition(tenantSlug: string, entryId: string, dto: TransitionTimeEntryDto, userId: string, userRoles: string[]) {
    const entry = await this.getById(tenantSlug, entryId);
    const current = entry.status as keyof typeof VALID_TIME_ENTRY_TRANSITIONS;
    const allowed = VALID_TIME_ENTRY_TRANSITIONS[current] || [];

    if (!allowed.includes(dto.toStatus as any)) {
      throw new UnprocessableEntityException(`Cannot transition time entry from ${current} to ${dto.toStatus}`);
    }

    // Only owner can submit; only TenantAdmin/SystemAdmin can approve/bill/writeoff
    if (dto.toStatus === 'Submitted' && entry.user_id !== userId) {
      throw new ForbiddenException('Only the owner can submit a time entry');
    }
    if (['Approved', 'Billed', 'WriteOff'].includes(dto.toStatus)) {
      if (!userRoles.some(r => ['TenantAdmin', 'SystemAdmin', 'Accountant'].includes(r))) {
        throw new ForbiddenException('Only TenantAdmin, SystemAdmin, or Accountant can approve/bill time entries');
      }
    }

    const setClauses: string[] = [`status = $1`, `updated_at = NOW()`];
    const params: any[] = [dto.toStatus];
    let idx = 2;

    if (dto.toStatus === 'Approved') {
      setClauses.push(`approved_by = $${idx++}`);
      params.push(userId);
      setClauses.push(`approved_at = NOW()`);
    }

    params.push(entryId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE time_entries SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.audit.log({
      tenantSlug, eventType: 'TIME_ENTRY_STATUS_CHANGED', actorUserId: userId,
      entityType: 'TimeEntry', entityId: entryId,
      payload: { from: current, to: dto.toStatus, reason: dto.reason },
    });

    // Notify owner when approved/written off
    if (['Approved', 'WriteOff'].includes(dto.toStatus) && entry.user_id !== userId) {
      await this.notifications.create(tenantSlug, {
        userId: entry.user_id,
        title: `Time Entry ${dto.toStatus}`,
        body: `Your time entry for ${entry.hours}h on ${entry.entry_date} has been ${dto.toStatus.toLowerCase()}.`,
        type: 'approval',
        entityType: 'TimeEntry',
        entityId: entryId,
      });
    }

    return this.getById(tenantSlug, entryId);
  }

  async delete(tenantSlug: string, entryId: string, userId: string) {
    const entry = await this.getById(tenantSlug, entryId);

    if (entry.status !== 'Draft') {
      throw new UnprocessableEntityException('Only draft time entries can be deleted');
    }
    if (entry.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own time entries');
    }

    await this.prisma.executeTenant(tenantSlug, `DELETE FROM time_entries WHERE id = $1`, [entryId]);

    await this.audit.log({
      tenantSlug, eventType: 'TIME_ENTRY_DELETED', actorUserId: userId,
      entityType: 'TimeEntry', entityId: entryId,
      payload: { hours: entry.hours, entryDate: entry.entry_date },
    });

    return { deleted: true };
  }
}
