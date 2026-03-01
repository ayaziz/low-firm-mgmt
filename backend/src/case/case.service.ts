import { Injectable, NotFoundException, ConflictException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { v4 as uuidv4 } from 'uuid';
import { VALID_STATE_TRANSITIONS } from '../common/types';
import {
  CreateCaseDto, TransitionCaseDto, SetOnHoldDto, ReopenCaseDto,
  CreateMembershipDto, CreateTaskDto, UpdateTaskDto,
  CreateSessionDto, UpdateSessionDto, RescheduleSessionDto,
  CreateNoteDto, CreateFilingDto, UpdateFilingDto,
  CreateCommunicationDto, AddCasePartyDto,
} from './case.dto';

@Injectable()
export class CaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async create(tenantSlug: string, dto: CreateCaseDto, userId: string) {
    const caseId = uuidv4();
    const rowVersion = uuidv4();

    // Generate case reference: CASE-YYYY-SEQ
    const year = new Date().getFullYear();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO case_sequences (year, last_seq) VALUES ($1, 0) ON CONFLICT (year) DO NOTHING`,
      [year],
    );
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE case_sequences SET last_seq = last_seq + 1 WHERE year = $1`,
      [year],
    );
    const seqRows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT last_seq FROM case_sequences WHERE year = $1`,
      [year],
    );
    const seq = seqRows[0]?.last_seq || 1;
    const systemCaseRef = `CASE-${year}-${String(seq).padStart(4, '0')}`;

    const assignedLawyer = dto.assignedLawyerUserId || userId;

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO cases (id, system_case_ref, court_case_number, title, description, case_type_id, state, is_on_hold, assigned_lawyer_user_id, row_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Intake', false, $7, $8, NOW(), NOW())`,
      [caseId, systemCaseRef, dto.courtCaseNumber || null, dto.title, dto.description || null, dto.caseTypeId, assignedLawyer, rowVersion],
    );

    // Link customers
    for (const custId of dto.customerIds) {
      await this.prisma.executeTenant(
        tenantSlug,
        `INSERT INTO case_customers (id, case_id, customer_id, created_at) VALUES ($1, $2, $3, NOW())`,
        [uuidv4(), caseId, custId],
      );
    }

    // Add creator as CaseOwner membership
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO case_memberships (id, case_id, user_id, role, created_at) VALUES ($1, $2, $3, 'CaseOwner', NOW())`,
      [uuidv4(), caseId, assignedLawyer],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'CASE_CREATED',
      actorUserId: userId,
      entityType: 'Case',
      entityId: caseId,
      payload: { title: dto.title, systemCaseRef, customerIds: dto.customerIds },
    });

    return this.getById(tenantSlug, caseId);
  }

  async list(tenantSlug: string, state?: string, caseTypeId?: string, assignedLawyer?: string, cursor?: string, limit = 20) {
    let sql = `SELECT c.*, ct.label_en as case_type_label FROM cases c LEFT JOIN case_types ct ON c.case_type_id = ct.id WHERE 1=1`;
    const params: any[] = [];
    let paramIdx = 1;

    if (state) { sql += ` AND c.state = $${paramIdx++}`; params.push(state); }
    if (caseTypeId) { sql += ` AND c.case_type_id = $${paramIdx++}`; params.push(caseTypeId); }
    if (assignedLawyer) { sql += ` AND c.assigned_lawyer_user_id = $${paramIdx++}`; params.push(assignedLawyer); }
    if (cursor) { sql += ` AND c.created_at < $${paramIdx++}`; params.push(cursor); }

    sql += ` ORDER BY c.created_at DESC LIMIT $${paramIdx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }

  async getById(tenantSlug: string, caseId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT c.*, ct.label_en as case_type_label FROM cases c LEFT JOIN case_types ct ON c.case_type_id = ct.id WHERE c.id = $1`,
      [caseId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Case not found');

    const memberships: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM case_memberships WHERE case_id = $1`, [caseId]);
    const customers: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT cc.*, c.name, c.customer_type FROM case_customers cc JOIN customers c ON cc.customer_id = c.id WHERE cc.case_id = $1`,
      [caseId],
    );
    const parties: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM case_parties WHERE case_id = $1`, [caseId]);

    return { ...rows[0], memberships: memberships || [], customers: customers || [], parties: parties || [] };
  }

  async transition(tenantSlug: string, caseId: string, dto: TransitionCaseDto, userId: string) {
    const caseData = await this.getById(tenantSlug, caseId);
    const currentState = caseData.state;
    const allowedTransitions = VALID_STATE_TRANSITIONS[currentState as keyof typeof VALID_STATE_TRANSITIONS] || [];

    if (!allowedTransitions.includes(dto.toState as any)) {
      throw new UnprocessableEntityException(`Cannot transition from ${currentState} to ${dto.toState}`);
    }

    if (dto.toState === 'Archived' && !['TenantAdmin', 'SystemAdmin'].some(r => true)) {
      // Additional check could be done by guard  
    }

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE cases SET state = $1, updated_at = NOW(), row_version = $2 WHERE id = $3`,
      [dto.toState, uuidv4(), caseId],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'CASE_STATE_CHANGED',
      actorUserId: userId,
      entityType: 'Case',
      entityId: caseId,
      payload: { from: currentState, to: dto.toState, reason: dto.reason },
    });

    return this.getById(tenantSlug, caseId);
  }

  async setOnHold(tenantSlug: string, caseId: string, dto: SetOnHoldDto, userId: string) {
    const caseData = await this.getById(tenantSlug, caseId);
    if (caseData.state === 'Archived') throw new UnprocessableEntityException('Cannot set on-hold for archived case');
    if (caseData.is_on_hold) throw new UnprocessableEntityException('Case is already on hold');

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE cases SET is_on_hold = true, on_hold_reason = $1, on_hold_started_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [dto.reason, caseId],
    );

    await this.audit.log({ tenantSlug, eventType: 'CASE_ON_HOLD_SET', actorUserId: userId, entityType: 'Case', entityId: caseId, payload: { reason: dto.reason } });
    return this.getById(tenantSlug, caseId);
  }

  async clearOnHold(tenantSlug: string, caseId: string, userId: string) {
    const caseData = await this.getById(tenantSlug, caseId);
    if (!caseData.is_on_hold) throw new UnprocessableEntityException('Case is not on hold');

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE cases SET is_on_hold = false, on_hold_reason = NULL, on_hold_ended_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [caseId],
    );

    await this.audit.log({ tenantSlug, eventType: 'CASE_ON_HOLD_CLEARED', actorUserId: userId, entityType: 'Case', entityId: caseId });
    return this.getById(tenantSlug, caseId);
  }

  async reopen(tenantSlug: string, caseId: string, dto: ReopenCaseDto, userId: string) {
    const caseData = await this.getById(tenantSlug, caseId);
    if (caseData.state !== 'Closed') throw new UnprocessableEntityException('Only closed cases can be reopened');

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE cases SET state = 'Active', updated_at = NOW(), row_version = $1 WHERE id = $2`,
      [uuidv4(), caseId],
    );

    await this.audit.log({ tenantSlug, eventType: 'CASE_REOPENED', actorUserId: userId, entityType: 'Case', entityId: caseId, payload: { reason: dto.reason } });
    return this.getById(tenantSlug, caseId);
  }

  async addMembership(tenantSlug: string, caseId: string, dto: CreateMembershipDto, userId: string) {
    const membershipId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO case_memberships (id, case_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [membershipId, caseId, dto.userId, dto.role],
    );
    await this.audit.log({ tenantSlug, eventType: 'CASE_MEMBERSHIP_ADDED', actorUserId: userId, entityType: 'CaseMembership', entityId: membershipId, payload: { caseId, targetUserId: dto.userId, role: dto.role } });
    return { id: membershipId };
  }

  async listMemberships(tenantSlug: string, caseId: string) {
    return this.prisma.queryTenant(
      tenantSlug,
      `SELECT id, case_id, user_id, role, created_at FROM case_memberships WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
  }

  async removeMembershipByUser(tenantSlug: string, caseId: string, membershipUserId: string, actorUserId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT id FROM case_memberships WHERE case_id = $1 AND user_id = $2 LIMIT 1`,
      [caseId, membershipUserId],
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException('Case membership not found');
    }

    const membershipId = rows[0].id;
    await this.prisma.executeTenant(
      tenantSlug,
      `DELETE FROM case_memberships WHERE id = $1`,
      [membershipId],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'CASE_MEMBERSHIP_REMOVED',
      actorUserId,
      entityType: 'CaseMembership',
      entityId: membershipId,
      payload: { caseId, targetUserId: membershipUserId },
    });

    return { success: true };
  }

  async updateMembership(tenantSlug: string, caseId: string, membershipId: string, role: string, userId: string) {
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE case_memberships SET role = $1 WHERE id = $2 AND case_id = $3`,
      [role, membershipId, caseId],
    );
    await this.audit.log({ tenantSlug, eventType: 'CASE_MEMBERSHIP_ROLE_CHANGED', actorUserId: userId, entityType: 'CaseMembership', entityId: membershipId, payload: { caseId, newRole: role } });
  }

  // --- Tasks ---
  async createTask(tenantSlug: string, caseId: string, dto: CreateTaskDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    const taskId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO tasks (id, case_id, customer_id, title, description, assignee_user_id, reviewer_user_id, priority, status, due_date, start_date, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Open', $9, $10, $11, NOW(), NOW())`,
      [taskId, caseId, dto.customerId || null, dto.title, dto.description || null, dto.assigneeUserId, dto.reviewerUserId || null,
       dto.priority || 'Medium', dto.dueDate || null, dto.startDate || null, dto.tags || []],
    );
    await this.audit.log({ tenantSlug, eventType: 'TASK_CREATED', actorUserId: userId, entityType: 'Task', entityId: taskId, payload: { caseId, title: dto.title } });

    // Notify assignee (skip if self-assigned)
    if (dto.assigneeUserId && dto.assigneeUserId !== userId) {
      await this.notifications.create(tenantSlug, {
        userId: dto.assigneeUserId,
        title: 'New task assigned to you',
        body: `Task "${dto.title}" has been assigned to you.`,
        type: 'task',
        entityType: 'Task',
        entityId: taskId,
      });
    }
    // Notify reviewer if set
    if (dto.reviewerUserId && dto.reviewerUserId !== userId) {
      await this.notifications.create(tenantSlug, {
        userId: dto.reviewerUserId,
        title: 'You are reviewer on a new task',
        body: `You have been assigned as reviewer for task "${dto.title}".`,
        type: 'task',
        entityType: 'Task',
        entityId: taskId,
      });
    }

    return { id: taskId };
  }

  async updateTask(tenantSlug: string, caseId: string, taskId: string, dto: UpdateTaskDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.title) { setClauses.push(`title = $${idx++}`); params.push(dto.title); }
    if (dto.description !== undefined) { setClauses.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.assigneeUserId) {
      setClauses.push(`assignee_user_id = $${idx++}`);
      params.push(dto.assigneeUserId);
    }
    if (dto.reviewerUserId !== undefined) { setClauses.push(`reviewer_user_id = $${idx++}`); params.push(dto.reviewerUserId); }
    if (dto.priority) { setClauses.push(`priority = $${idx++}`); params.push(dto.priority); }
    if (dto.status) { setClauses.push(`status = $${idx++}`); params.push(dto.status); }
    if (dto.dueDate) { setClauses.push(`due_date = $${idx++}`); params.push(dto.dueDate); }

    if (setClauses.length === 0) return;
    setClauses.push(`updated_at = NOW()`);

    params.push(taskId);
    params.push(caseId);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${idx} AND case_id = $${idx + 1}`,
      params,
    );

    const eventType = dto.status ? 'TASK_STATUS_CHANGED' : dto.assigneeUserId ? 'TASK_REASSIGNED' : 'TASK_UPDATED';
    await this.audit.log({ tenantSlug, eventType, actorUserId: userId, entityType: 'Task', entityId: taskId, payload: { caseId, changes: dto } });
  }

  async listTasks(tenantSlug: string, caseId: string) {
    return this.prisma.queryTenant(tenantSlug, `SELECT * FROM tasks WHERE case_id = $1 ORDER BY created_at DESC`, [caseId]);
  }

  // --- Sessions ---
  async createSession(tenantSlug: string, caseId: string, dto: CreateSessionDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    const sessionId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO sessions (id, case_id, type_id, title, start_date_time, end_date_time, location, court_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Planned', NOW(), NOW())`,
      [sessionId, caseId, dto.typeId, dto.title, dto.startDateTime, dto.endDateTime, dto.location || null, dto.courtId || null],
    );
    await this.audit.log({ tenantSlug, eventType: 'SESSION_CREATED', actorUserId: userId, entityType: 'Session', entityId: sessionId, payload: { caseId, title: dto.title } });

    // Notify all case members about the new session
    const members: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT user_id FROM case_memberships WHERE case_id = $1`,
      [caseId],
    );
    for (const m of members) {
      if (m.user_id === userId) continue; // skip creator
      await this.notifications.create(tenantSlug, {
        userId: m.user_id,
        title: 'New session scheduled',
        body: `Session "${dto.title}" has been scheduled for ${dto.startDateTime}.`,
        type: 'session',
        entityType: 'Session',
        entityId: sessionId,
      });
    }

    return { id: sessionId };
  }

  async updateSession(tenantSlug: string, caseId: string, sessionId: string, dto: UpdateSessionDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    if (dto.status === 'Completed' && !dto.outcomeNotes) {
      throw new BadRequestException('outcomeNotes is required when completing a session');
    }

    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.title) { setClauses.push(`title = $${idx++}`); params.push(dto.title); }
    if (dto.status) { setClauses.push(`status = $${idx++}`); params.push(dto.status); }
    if (dto.outcomeNotes) { setClauses.push(`outcome_notes = $${idx++}`); params.push(dto.outcomeNotes); }
    if (dto.location) { setClauses.push(`location = $${idx++}`); params.push(dto.location); }

    if (setClauses.length === 0) return;
    setClauses.push(`updated_at = NOW()`);

    params.push(sessionId);
    params.push(caseId);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = $${idx} AND case_id = $${idx + 1}`,
      params,
    );

    const eventType = dto.status === 'Completed' ? 'SESSION_COMPLETED' : dto.status === 'Cancelled' ? 'SESSION_CANCELLED' : 'SESSION_UPDATED';
    await this.audit.log({ tenantSlug, eventType, actorUserId: userId, entityType: 'Session', entityId: sessionId, payload: { caseId, changes: dto } });
  }

  async rescheduleSession(tenantSlug: string, caseId: string, sessionId: string, dto: RescheduleSessionDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    // Get current session time
    const sessions: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT start_date_time FROM sessions WHERE id = $1 AND case_id = $2`, [sessionId, caseId]);
    if (!sessions || sessions.length === 0) throw new NotFoundException('Session not found');

    const originalDateTime = sessions[0].start_date_time;

    // Record reschedule history
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO session_reschedules (id, session_id, original_date_time, new_date_time, reason, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidv4(), sessionId, originalDateTime, dto.newDateTime, dto.reason, userId],
    );

    // Update session
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE sessions SET start_date_time = $1, status = 'Postponed', updated_at = NOW() WHERE id = $2`,
      [dto.newDateTime, sessionId],
    );

    await this.audit.log({ tenantSlug, eventType: 'SESSION_RESCHEDULED', actorUserId: userId, entityType: 'Session', entityId: sessionId, payload: { caseId, originalDateTime, newDateTime: dto.newDateTime, reason: dto.reason } });
  }

  async listSessions(tenantSlug: string, caseId: string) {
    return this.prisma.queryTenant(tenantSlug, `SELECT * FROM sessions WHERE case_id = $1 ORDER BY start_date_time DESC`, [caseId]);
  }

  // --- Notes (append-only) ---
  async createNote(tenantSlug: string, caseId: string, dto: CreateNoteDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    const noteId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO notes (id, case_id, title, body, tags, visibility_scope, referenced_note_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [noteId, caseId, dto.title || null, dto.body, dto.tags || [],
       dto.visibilityScope || 'LegalOnly', dto.referencedNoteId || null, userId],
    );
    await this.audit.log({ tenantSlug, eventType: 'NOTE_CREATED', actorUserId: userId, entityType: 'Note', entityId: noteId, payload: { caseId } });
    return { id: noteId };
  }

  async listNotes(tenantSlug: string, caseId: string) {
    return this.prisma.queryTenant(tenantSlug, `SELECT * FROM notes WHERE case_id = $1 ORDER BY created_at DESC`, [caseId]);
  }

  // --- Filings ---
  async createFiling(tenantSlug: string, caseId: string, dto: CreateFilingDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    const filingId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO filings (id, case_id, type_id, status, filed_date, court_case_number, reference_number, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [filingId, caseId, dto.typeId, dto.status || 'Draft', dto.filedDate || null,
       dto.courtCaseNumber || null, dto.referenceNumber || null, dto.notes || null, userId],
    );
    await this.audit.log({ tenantSlug, eventType: 'FILING_CREATED', actorUserId: userId, entityType: 'Filing', entityId: filingId, payload: { caseId } });
    return { id: filingId };
  }

  async updateFiling(tenantSlug: string, caseId: string, filingId: string, dto: UpdateFilingDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.status) { setClauses.push(`status = $${idx++}`); params.push(dto.status); }
    if (dto.notes !== undefined) { setClauses.push(`notes = $${idx++}`); params.push(dto.notes); }
    if (dto.referenceNumber !== undefined) { setClauses.push(`reference_number = $${idx++}`); params.push(dto.referenceNumber); }

    if (setClauses.length === 0) return;
    setClauses.push(`updated_at = NOW()`);

    params.push(filingId);
    params.push(caseId);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE filings SET ${setClauses.join(', ')} WHERE id = $${idx} AND case_id = $${idx + 1}`,
      params,
    );

    const eventType = dto.status ? 'FILING_STATUS_CHANGED' : 'FILING_UPDATED';
    await this.audit.log({ tenantSlug, eventType, actorUserId: userId, entityType: 'Filing', entityId: filingId, payload: { caseId, changes: dto } });
  }

  async listFilings(tenantSlug: string, caseId: string) {
    return this.prisma.queryTenant(tenantSlug, `SELECT * FROM filings WHERE case_id = $1 ORDER BY created_at DESC`, [caseId]);
  }

  // --- Communications ---
  async createCommunication(tenantSlug: string, caseId: string, dto: CreateCommunicationDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    const commId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO communications (id, case_id, customer_id, type_id, date_time, direction, participants, summary, next_steps, visibility_scope, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [commId, caseId, dto.customerId || null, dto.typeId, dto.dateTime, dto.direction,
       dto.participants || null, dto.summary || null, dto.nextSteps || null,
       dto.visibilityScope || 'LegalOnly', userId],
    );
    await this.audit.log({ tenantSlug, eventType: 'COMM_CREATED', actorUserId: userId, entityType: 'Communication', entityId: commId, payload: { caseId } });
    return { id: commId };
  }

  async listCommunications(tenantSlug: string, caseId: string) {
    return this.prisma.queryTenant(tenantSlug, `SELECT * FROM communications WHERE case_id = $1 ORDER BY date_time DESC`, [caseId]);
  }

  // --- Case Parties ---
  async addCaseParty(tenantSlug: string, caseId: string, dto: AddCasePartyDto, userId: string) {
    await this.ensureNotArchived(tenantSlug, caseId);
    const id = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO case_parties (id, case_id, party_id, party_role_type, participant_role_id, visibility_scope, notes, start_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [id, caseId, dto.partyId, dto.partyRoleType, dto.participantRoleId || null,
       dto.visibilityScope || 'LegalOnly', dto.notes || null],
    );
    return { id };
  }

  async listCaseParties(tenantSlug: string, caseId: string) {
    return this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM case_parties WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
  }

  private async ensureNotArchived(tenantSlug: string, caseId: string) {
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT state FROM cases WHERE id = $1`, [caseId]);
    if (!rows || rows.length === 0) throw new NotFoundException('Case not found');
    if (rows[0].state === 'Archived') {
      throw new UnprocessableEntityException('Archived cases are read-only');
    }
  }

  async checkMembership(tenantSlug: string, caseId: string, userId: string): Promise<string | null> {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT role FROM case_memberships WHERE case_id = $1 AND user_id = $2`,
      [caseId, userId],
    );
    return rows && rows.length > 0 ? rows[0].role : null;
  }
}
