import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateCalendarEventDto, UpdateCalendarEventDto, AddAttendeeDto, AddReminderDto } from './calendar.dto';

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async create(tenantSlug: string, dto: CreateCalendarEventDto, userId: string) {
    const eventId = uuidv4();

    // Check for time conflicts for the creator
    const conflicts: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT id, title, start_at, end_at FROM calendar_events
       WHERE status IN ('Scheduled', 'Confirmed')
       AND start_at < $2 AND end_at > $1
       AND id IN (SELECT calendar_event_id FROM calendar_event_attendees WHERE user_id = $3)`,
      [dto.startAt, dto.endAt, userId],
    );
    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Time conflict with existing event(s)',
        conflicts: conflicts.map(c => ({ id: c.id, title: c.title, startAt: c.start_at, endAt: c.end_at })),
      });
    }

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO calendar_events (id, title, start_at, end_at, event_type, case_id, hearing_id, location, description, status, recurrence, recurrence_end_date, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Scheduled', $10, $11, $12, NOW(), NOW())`,
      [eventId, dto.title, dto.startAt, dto.endAt, dto.eventType,
       dto.caseId || null, dto.hearingId || null, dto.location || null,
       dto.description || null, dto.recurrence || 'None',
       dto.recurrenceEndDate || null, userId],
    );

    // Add creator as attendee (auto-accepted)
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO calendar_event_attendees (id, calendar_event_id, user_id, rsvp, created_at) VALUES ($1, $2, $3, 'Accepted', NOW())`,
      [uuidv4(), eventId, userId],
    );

    // Add additional attendees
    if (dto.attendeeUserIds && dto.attendeeUserIds.length > 0) {
      for (const uid of dto.attendeeUserIds) {
        if (uid === userId) continue;
        await this.prisma.executeTenant(
          tenantSlug,
          `INSERT INTO calendar_event_attendees (id, calendar_event_id, user_id, rsvp, created_at) VALUES ($1, $2, $3, 'Pending', NOW())`,
          [uuidv4(), eventId, uid],
        );
        await this.notifications.create(tenantSlug, {
          userId: uid,
          title: 'Calendar Invitation',
          body: `You have been invited to "${dto.title}".`,
          type: 'session',
          entityType: 'CalendarEvent',
          entityId: eventId,
        });
      }
    }

    // Add reminders
    if (dto.reminders && dto.reminders.length > 0) {
      for (const rem of dto.reminders) {
        await this.prisma.executeTenant(
          tenantSlug,
          `INSERT INTO calendar_reminders (id, calendar_event_id, minutes_before, channel, trigger_at, created_at)
           VALUES ($1, $2, $3, $4, $5::timestamptz - ($3 || ' minutes')::INTERVAL, NOW())`,
          [uuidv4(), eventId, rem.minutesBefore, rem.channel || 'InApp', dto.startAt],
        );
      }
    }

    await this.audit.log({
      tenantSlug, eventType: 'CALENDAR_EVENT_CREATED', actorUserId: userId,
      entityType: 'CalendarEvent', entityId: eventId,
      payload: { title: dto.title, eventType: dto.eventType, startAt: dto.startAt, endAt: dto.endAt },
    });

    return this.getById(tenantSlug, eventId);
  }

  async list(tenantSlug: string, userId: string, startDate?: string, endDate?: string, caseId?: string, eventType?: string, cursor?: string, limit = 20) {
    let sql = `SELECT ce.*, c.title AS case_title,
                 (SELECT json_agg(json_build_object('userId', a.user_id, 'rsvp', a.rsvp))
                  FROM calendar_event_attendees a WHERE a.calendar_event_id = ce.id) AS attendees
               FROM calendar_events ce
               LEFT JOIN cases c ON ce.case_id = c.id
               WHERE ce.status != 'Cancelled'`;
    const params: any[] = [];
    let idx = 1;

    if (startDate) { sql += ` AND ce.end_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { sql += ` AND ce.start_at <= $${idx++}`; params.push(endDate); }
    if (caseId) { sql += ` AND ce.case_id = $${idx++}`; params.push(caseId); }
    if (eventType) { sql += ` AND ce.event_type = $${idx++}`; params.push(eventType); }
    if (cursor) { sql += ` AND ce.start_at > $${idx++}`; params.push(cursor); }

    sql += ` ORDER BY ce.start_at ASC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].start_at : null, hasMore };
  }

  async getMyEvents(tenantSlug: string, userId: string, startDate?: string, endDate?: string, limit = 50) {
    let sql = `SELECT ce.*, c.title AS case_title
               FROM calendar_events ce
               LEFT JOIN cases c ON ce.case_id = c.id
               WHERE ce.status IN ('Scheduled', 'Confirmed')
               AND ce.id IN (SELECT calendar_event_id FROM calendar_event_attendees WHERE user_id = $1)`;
    const params: any[] = [userId];
    let idx = 2;

    if (startDate) { sql += ` AND ce.end_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { sql += ` AND ce.start_at <= $${idx++}`; params.push(endDate); }

    sql += ` ORDER BY ce.start_at ASC LIMIT $${idx}`;
    params.push(limit);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    return rows;
  }

  async getById(tenantSlug: string, eventId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT ce.*, c.title AS case_title,
         (SELECT json_agg(json_build_object('userId', a.user_id, 'rsvp', a.rsvp))
          FROM calendar_event_attendees a WHERE a.calendar_event_id = ce.id) AS attendees,
         (SELECT json_agg(json_build_object('id', r.id, 'minutesBefore', r.minutes_before, 'channel', r.channel, 'triggerAt', r.trigger_at))
          FROM calendar_reminders r WHERE r.calendar_event_id = ce.id) AS reminders
       FROM calendar_events ce
       LEFT JOIN cases c ON ce.case_id = c.id
       WHERE ce.id = $1`,
      [eventId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Calendar event not found');
    return rows[0];
  }

  async update(tenantSlug: string, eventId: string, dto: UpdateCalendarEventDto, userId: string) {
    await this.getById(tenantSlug, eventId); // ensure exists

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.title !== undefined) { setClauses.push(`title = $${idx++}`); params.push(dto.title); }
    if (dto.startAt !== undefined) { setClauses.push(`start_at = $${idx++}`); params.push(dto.startAt); }
    if (dto.endAt !== undefined) { setClauses.push(`end_at = $${idx++}`); params.push(dto.endAt); }
    if (dto.eventType !== undefined) { setClauses.push(`event_type = $${idx++}`); params.push(dto.eventType); }
    if (dto.location !== undefined) { setClauses.push(`location = $${idx++}`); params.push(dto.location); }
    if (dto.description !== undefined) { setClauses.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.status !== undefined) { setClauses.push(`status = $${idx++}`); params.push(dto.status); }
    if (dto.recurrence !== undefined) { setClauses.push(`recurrence = $${idx++}`); params.push(dto.recurrence); }
    if (dto.recurrenceEndDate !== undefined) { setClauses.push(`recurrence_end_date = $${idx++}`); params.push(dto.recurrenceEndDate); }

    params.push(eventId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE calendar_events SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.audit.log({
      tenantSlug, eventType: 'CALENDAR_EVENT_UPDATED', actorUserId: userId,
      entityType: 'CalendarEvent', entityId: eventId,
      payload: dto as Record<string, any>,
    });

    return this.getById(tenantSlug, eventId);
  }

  async addAttendee(tenantSlug: string, eventId: string, dto: AddAttendeeDto, userId: string) {
    await this.getById(tenantSlug, eventId);

    // Check if not already attendee
    const existing: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT id FROM calendar_event_attendees WHERE calendar_event_id = $1 AND user_id = $2`,
      [eventId, dto.userId],
    );
    if (existing.length > 0) {
      throw new ConflictException('User is already an attendee');
    }

    const attendeeId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO calendar_event_attendees (id, calendar_event_id, user_id, rsvp, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [attendeeId, eventId, dto.userId, dto.rsvp || 'Pending'],
    );

    await this.notifications.create(tenantSlug, {
      userId: dto.userId,
      title: 'Calendar Invitation',
      body: 'You have been added to a calendar event.',
      type: 'session',
      entityType: 'CalendarEvent',
      entityId: eventId,
    });

    return this.getById(tenantSlug, eventId);
  }

  async updateRsvp(tenantSlug: string, eventId: string, userId: string, rsvp: string) {
    const result: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `UPDATE calendar_event_attendees SET rsvp = $1 WHERE calendar_event_id = $2 AND user_id = $3 RETURNING id`,
      [rsvp, eventId, userId],
    );
    if (!result || result.length === 0) throw new NotFoundException('Attendee not found');
    return this.getById(tenantSlug, eventId);
  }

  async addReminder(tenantSlug: string, eventId: string, dto: AddReminderDto, userId: string) {
    const event = await this.getById(tenantSlug, eventId);
    const reminderId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO calendar_reminders (id, calendar_event_id, minutes_before, channel, trigger_at, created_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz - ($3 || ' minutes')::INTERVAL, NOW())`,
      [reminderId, eventId, dto.minutesBefore, dto.channel || 'InApp', event.start_at],
    );
    return this.getById(tenantSlug, eventId);
  }

  async deleteEvent(tenantSlug: string, eventId: string, userId: string) {
    await this.getById(tenantSlug, eventId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE calendar_events SET status = 'Cancelled', updated_at = NOW() WHERE id = $1`,
      [eventId],
    );
    await this.audit.log({
      tenantSlug, eventType: 'CALENDAR_EVENT_CANCELLED', actorUserId: userId,
      entityType: 'CalendarEvent', entityId: eventId,
      payload: {},
    });
    return { deleted: true };
  }
}
