import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateCourtDto, UpdateCourtDto, CreateJudgeDto, UpdateJudgeDto } from './court.dto';

@Injectable()
export class CourtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Courts ─────────────────────────────────────────────────────

  async createCourt(tenantSlug: string, dto: CreateCourtDto, userId: string) {
    const courtId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO courts (id, name, department, circuit, jurisdiction_level, city, phone, address_text, notes, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())`,
      [courtId, dto.name, dto.department || null, dto.circuit || null,
       dto.jurisdictionLevel || 'District', dto.city || null, dto.phone || null,
       dto.addressText || null, dto.notes || null],
    );

    await this.audit.log({
      tenantSlug, eventType: 'COURT_CREATED', actorUserId: userId,
      entityType: 'Court', entityId: courtId,
      payload: { name: dto.name },
    });

    return this.getCourtById(tenantSlug, courtId);
  }

  async listCourts(tenantSlug: string, isActive?: boolean, city?: string, jurisdictionLevel?: string, cursor?: string, limit = 20) {
    let sql = `SELECT * FROM courts WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (isActive !== undefined) { sql += ` AND is_active = $${idx++}`; params.push(isActive); }
    if (city) { sql += ` AND city ILIKE $${idx++}`; params.push(`%${city}%`); }
    if (jurisdictionLevel) { sql += ` AND jurisdiction_level = $${idx++}`; params.push(jurisdictionLevel); }
    if (cursor) { sql += ` AND created_at < $${idx++}`; params.push(cursor); }

    sql += ` ORDER BY name ASC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }

  async getCourtById(tenantSlug: string, courtId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM courts WHERE id = $1`,
      [courtId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Court not found');

    // Include judges count
    const judgeCount: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT COUNT(*)::int AS count FROM judges WHERE court_id = $1 AND is_active = true`,
      [courtId],
    );

    return { ...rows[0], activeJudgeCount: judgeCount[0]?.count || 0 };
  }

  async updateCourt(tenantSlug: string, courtId: string, dto: UpdateCourtDto, userId: string) {
    await this.getCourtById(tenantSlug, courtId); // verify existence

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.department !== undefined) { setClauses.push(`department = $${idx++}`); params.push(dto.department); }
    if (dto.circuit !== undefined) { setClauses.push(`circuit = $${idx++}`); params.push(dto.circuit); }
    if (dto.jurisdictionLevel !== undefined) { setClauses.push(`jurisdiction_level = $${idx++}`); params.push(dto.jurisdictionLevel); }
    if (dto.city !== undefined) { setClauses.push(`city = $${idx++}`); params.push(dto.city); }
    if (dto.phone !== undefined) { setClauses.push(`phone = $${idx++}`); params.push(dto.phone); }
    if (dto.addressText !== undefined) { setClauses.push(`address_text = $${idx++}`); params.push(dto.addressText); }
    if (dto.notes !== undefined) { setClauses.push(`notes = $${idx++}`); params.push(dto.notes); }
    if (dto.isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); params.push(dto.isActive); }

    params.push(courtId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE courts SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.audit.log({
      tenantSlug, eventType: 'COURT_UPDATED', actorUserId: userId,
      entityType: 'Court', entityId: courtId,
      payload: dto as Record<string, any>,
    });

    return this.getCourtById(tenantSlug, courtId);
  }

  // ── Judges ─────────────────────────────────────────────────────

  async createJudge(tenantSlug: string, dto: CreateJudgeDto, userId: string) {
    // Verify court exists
    await this.getCourtById(tenantSlug, dto.courtId);

    const judgeId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO judges (id, court_id, full_name, title, specialization, phone, email, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
      [judgeId, dto.courtId, dto.fullName, dto.title || null,
       dto.specialization || null, dto.phone || null, dto.email || null],
    );

    await this.audit.log({
      tenantSlug, eventType: 'JUDGE_CREATED', actorUserId: userId,
      entityType: 'Judge', entityId: judgeId,
      payload: { fullName: dto.fullName, courtId: dto.courtId },
    });

    return this.getJudgeById(tenantSlug, judgeId);
  }

  async listJudges(tenantSlug: string, courtId?: string, isActive?: boolean, cursor?: string, limit = 20) {
    let sql = `SELECT j.*, c.name AS court_name FROM judges j LEFT JOIN courts c ON j.court_id = c.id WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (courtId) { sql += ` AND j.court_id = $${idx++}`; params.push(courtId); }
    if (isActive !== undefined) { sql += ` AND j.is_active = $${idx++}`; params.push(isActive); }
    if (cursor) { sql += ` AND j.created_at < $${idx++}`; params.push(cursor); }

    sql += ` ORDER BY j.full_name ASC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }

  async getJudgeById(tenantSlug: string, judgeId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT j.*, c.name AS court_name FROM judges j LEFT JOIN courts c ON j.court_id = c.id WHERE j.id = $1`,
      [judgeId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Judge not found');
    return rows[0];
  }

  async updateJudge(tenantSlug: string, judgeId: string, dto: UpdateJudgeDto, userId: string) {
    await this.getJudgeById(tenantSlug, judgeId); // verify existence

    if (dto.courtId) {
      await this.getCourtById(tenantSlug, dto.courtId); // verify court
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.courtId !== undefined) { setClauses.push(`court_id = $${idx++}`); params.push(dto.courtId); }
    if (dto.fullName !== undefined) { setClauses.push(`full_name = $${idx++}`); params.push(dto.fullName); }
    if (dto.title !== undefined) { setClauses.push(`title = $${idx++}`); params.push(dto.title); }
    if (dto.specialization !== undefined) { setClauses.push(`specialization = $${idx++}`); params.push(dto.specialization); }
    if (dto.phone !== undefined) { setClauses.push(`phone = $${idx++}`); params.push(dto.phone); }
    if (dto.email !== undefined) { setClauses.push(`email = $${idx++}`); params.push(dto.email); }
    if (dto.isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); params.push(dto.isActive); }

    params.push(judgeId);
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE judges SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.audit.log({
      tenantSlug, eventType: 'JUDGE_UPDATED', actorUserId: userId,
      entityType: 'Judge', entityId: judgeId,
      payload: dto as Record<string, any>,
    });

    return this.getJudgeById(tenantSlug, judgeId);
  }
}
