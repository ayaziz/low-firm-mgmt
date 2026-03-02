import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { v4 as uuidv4 } from 'uuid';
import { VALID_HEARING_TRANSITIONS } from '../common/types';
import { CreateHearingDto, UpdateHearingDto, TransitionHearingDto } from './hearing.dto';

@Injectable()
export class HearingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async create(tenantSlug: string, dto: CreateHearingDto, userId: string) {
    const hearingId = uuidv4();
    const calendarEventId = uuidv4();

    // Verify case exists
    const caseRows: any[] = await this.prisma.queryTenant(
      tenantSlug, `SELECT id, title, assigned_lawyer_user_id FROM cases WHERE id = $1`, [dto.caseId],
    );
    if (!caseRows || caseRows.length === 0) throw new NotFoundException('Case not found');

    // Create associated calendar event
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO calendar_events (id, title, start_at, end_at, event_type, case_id, hearing_id, location, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $3 + INTERVAL '1 hour', 'Hearing', $4, $5, $6, 'Scheduled', $7, NOW(), NOW())`,
      [calendarEventId, `Hearing: ${caseRows[0].title}`, dto.hearingDate, dto.caseId, hearingId, dto.location || null, userId],
    );

    // Create hearing
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO hearings (id, case_id, court_id, judge_id, hearing_date, location, hearing_type, status, notes, calendar_event_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Scheduled', $8, $9, $10, NOW(), NOW())`,
      [hearingId, dto.caseId, dto.courtId || null, dto.judgeId || null,
       dto.hearingDate, dto.location || null, dto.hearingType || 'Initial',
       dto.notes || null, calendarEventId, userId],
    );

    // Add creator as calendar attendee
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO calendar_event_attendees (id, calendar_event_id, user_id, rsvp, created_at) VALUES ($1, $2, $3, 'Accepted', NOW())`,
      [uuidv4(), calendarEventId, userId],
    );

    // Add assigned lawyer as attendee (if different from creator)
    const assignedLawyer = caseRows[0].assigned_lawyer_user_id;
    if (assignedLawyer && assignedLawyer !== userId) {
      await this.prisma.executeTenant(
        tenantSlug,
        `INSERT INTO calendar_event_attendees (id, calendar_event_id, user_id, rsvp, created_at) VALUES ($1, $2, $3, 'Pending', NOW())`,
        [uuidv4(), calendarEventId, assignedLawyer],
      );

      await this.notifications.create(tenantSlug, {
        userId: assignedLawyer,
        title: 'New Hearing Scheduled',
        body: `A hearing has been scheduled for case "${caseRows[0].title}" on ${dto.hearingDate}.`,
        type: 'session',
        entityType: 'Hearing',
        entityId: hearingId,
      });
    }

    // Add a default 30-minute reminder
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO calendar_reminders (id, calendar_event_id, minutes_before, channel, trigger_at, created_at)
       VALUES ($1, $2, 30, 'InApp', $3::timestamptz - INTERVAL '30 minutes', NOW())`,
      [uuidv4(), calendarEventId, dto.hearingDate],
    );

    await this.audit.log({
      tenantSlug, eventType: 'HEARING_CREATED', actorUserId: userId,
      entityType: 'Hearing', entityId: hearingId,
      payload: { caseId: dto.caseId, hearingDate: dto.hearingDate, hearingType: dto.hearingType || 'Initial' },
    });

    return this.getById(tenantSlug, hearingId);
  }

  async list(tenantSlug: string, caseId?: string, status?: string, courtId?: string, judgeId?: string, cursor?: string, limit = 20) {
    let sql = `SELECT h.*, c.title AS case_title, co.name AS court_name, j.full_name AS judge_name
               FROM hearings h
               LEFT JOIN cases c ON h.case_id = c.id
               LEFT JOIN courts co ON h.court_id = co.id
               LEFT JOIN judges j ON h.judge_id = j.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (caseId) { sql += ` AND h.case_id = $${idx++}`; params.push(caseId); }
    if (status) { sql += ` AND h.status = $${idx++}`; params.push(status); }
    if (courtId) { sql += ` AND h.court_id = $${idx++}`; params.push(courtId); }
    if (judgeId) { sql += ` AND h.judge_id = $${idx++}`; params.push(judgeId); }
    if (cursor) { sql += ` AND h.hearing_date < $${idx++}`; params.push(cursor); }

    sql += ` ORDER BY h.hearing_date DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].hearing_date : null, hasMore };
  }

  async getById(tenantSlug: string, hearingId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT h.*, c.title AS case_title, co.name AS court_name, j.full_name AS judge_name
       FROM hearings h
       LEFT JOIN cases c ON h.case_id = c.id
       LEFT JOIN courts co ON h.court_id = co.id
       LEFT JOIN judges j ON h.judge_id = j.id
       WHERE h.id = $1`,
      [hearingId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Hearing not found');
    return rows[0];
  }

  async update(tenantSlug: string, hearingId: string, dto: UpdateHearingDto, userId: string) {
    const hearing = await this.getById(tenantSlug, hearingId);
    if (hearing.status !== 'Scheduled') {
      throw new UnprocessableEntityException('Only scheduled hearings can be updated');
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.courtId !== undefined) { setClauses.push(`court_id = $${idx++}`); params.push(dto.courtId); }
    if (dto.judgeId !== undefined) { setClauses.push(`judge_id = $${idx++}`); params.push(dto.judgeId); }
    if (dto.hearingDate !== undefined) { setClauses.push(`hearing_date = $${idx++}`); params.push(dto.hearingDate); }
    if (dto.location !== undefined) { setClauses.push(`location = $${idx++}`); params.push(dto.location); }
    if (dto.hearingType !== undefined) { setClauses.push(`hearing_type = $${idx++}`); params.push(dto.hearingType); }
    if (dto.notes !== undefined) { setClauses.push(`notes = $${idx++}`); params.push(dto.notes); }

    params.push(hearingId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE hearings SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    // Sync calendar event if date changed
    if (dto.hearingDate && hearing.calendar_event_id) {
      await this.prisma.executeTenant(
        tenantSlug,
        `UPDATE calendar_events SET start_at = $1, end_at = $1::timestamptz + INTERVAL '1 hour', updated_at = NOW() WHERE id = $2`,
        [dto.hearingDate, hearing.calendar_event_id],
      );
    }

    await this.audit.log({
      tenantSlug, eventType: 'HEARING_UPDATED', actorUserId: userId,
      entityType: 'Hearing', entityId: hearingId,
      payload: dto as Record<string, any>,
    });

    return this.getById(tenantSlug, hearingId);
  }

  async transition(tenantSlug: string, hearingId: string, dto: TransitionHearingDto, userId: string) {
    const hearing = await this.getById(tenantSlug, hearingId);
    const current = hearing.status as keyof typeof VALID_HEARING_TRANSITIONS;
    const allowed = VALID_HEARING_TRANSITIONS[current] || [];

    if (!allowed.includes(dto.toStatus as any)) {
      throw new UnprocessableEntityException(`Cannot transition hearing from ${current} to ${dto.toStatus}`);
    }

    const setClauses: string[] = [`status = $1`, `updated_at = NOW()`];
    const params: any[] = [dto.toStatus];
    let idx = 2;

    if (dto.outcome) { setClauses.push(`outcome = $${idx++}`); params.push(dto.outcome); }
    if (dto.reason) { setClauses.push(`notes = COALESCE(notes, '') || E'\\n--- ' || $${idx++}`); params.push(dto.reason); }

    // If postponing to a new date, update hearing_date
    if (dto.toStatus === 'Postponed' && dto.newDate) {
      setClauses.push(`hearing_date = $${idx++}`);
      params.push(dto.newDate);
    }

    params.push(hearingId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE hearings SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    // Sync calendar event status
    if (hearing.calendar_event_id) {
      const calStatus = dto.toStatus === 'Completed' ? 'Completed' : dto.toStatus === 'Cancelled' ? 'Cancelled' : 'Scheduled';
      await this.prisma.executeTenant(
        tenantSlug,
        `UPDATE calendar_events SET status = $1, updated_at = NOW() WHERE id = $2`,
        [calStatus, hearing.calendar_event_id],
      );
      // If postponed with new date, update calendar event date
      if (dto.toStatus === 'Postponed' && dto.newDate) {
        await this.prisma.executeTenant(
          tenantSlug,
          `UPDATE calendar_events SET start_at = $1, end_at = $1::timestamptz + INTERVAL '1 hour', updated_at = NOW() WHERE id = $2`,
          [dto.newDate, hearing.calendar_event_id],
        );
      }
    }

    await this.audit.log({
      tenantSlug, eventType: 'HEARING_STATUS_CHANGED', actorUserId: userId,
      entityType: 'Hearing', entityId: hearingId,
      payload: { from: current, to: dto.toStatus, outcome: dto.outcome, reason: dto.reason },
    });

    return this.getById(tenantSlug, hearingId);
  }
}
