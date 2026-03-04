import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import {
  CreateUserDto, UpdateUserDto,
  CreateMasterDataDto, UpdateMasterDataDto,
  SaveExpenseWorkflowDto, UpdateTenantSettingsDto,
} from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* ───── Users ───── */

  async createUser(tenantSlug: string, dto: CreateUserDto, actorId: string) {
    // Get tenant
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Check email uniqueness within tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use for this tenant');

    // Validate roles
    const validRoles = ['Lawyer', 'Accountant', 'TenantAdmin'];
    for (const r of dto.roles) {
      if (!validRoles.includes(r)) throw new BadRequestException(`Invalid role: ${r}`);
    }

    const tempPassword = uuidv4().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        email: dto.email,
        displayName: dto.displayName,
        passwordHash,
        roles: dto.roles,
        language: dto.language || 'en',
        isActive: true,
      },
    });

    await this.audit.log({
      tenantSlug,
      eventType: 'USER_CREATED',
      actorUserId: actorId,
      entityType: 'User',
      entityId: user.id,
      payload: { email: dto.email, roles: dto.roles },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      isActive: user.isActive,
      createdAt: user.createdAt,
      tempPassword, // returned once so admin can communicate it
    };
  }

  async updateUser(tenantSlug: string, userId: string, dto: UpdateUserDto, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: tenant.id },
    });
    if (!user) throw new NotFoundException('User not found');

    if (dto.roles) {
      const validRoles = ['Lawyer', 'Accountant', 'TenantAdmin'];
      for (const r of dto.roles) {
        if (!validRoles.includes(r)) throw new BadRequestException(`Invalid role: ${r}`);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.roles ? { roles: dto.roles } : {}),
        ...(dto.displayName ? { displayName: dto.displayName } : {}),
      },
    });

    await this.audit.log({
      tenantSlug,
      eventType: dto.isActive === false ? 'USER_DEACTIVATED' : 'USER_UPDATED',
      actorUserId: actorId,
      entityType: 'User',
      entityId: userId,
      payload: dto,
    });

    return updated;
  }

  async listUsers(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, email: true, displayName: true, roles: true, isActive: true, language: true, createdAt: true },
      orderBy: { displayName: 'asc' },
    });
  }

  /* ───── Master Data ───── */

  private readonly VALID_CATEGORIES = [
    'contactRole', 'participantRole', 'relationshipType',
    'communicationType', 'filingType', 'sessionType',
    'expenseCategory', 'paymentMethod', 'docType',
    'nationalities',
    'currencies'
  ];

  async listMasterData(tenantSlug: string, category: string) {
    if (!this.VALID_CATEGORIES.includes(category)) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT id, category, code, label_en, label_ar, is_active, sort_order, config
       FROM master_data WHERE category = $1 ORDER BY sort_order, label_en`, [category]);
    return rows;
  }

  async createMasterData(tenantSlug: string, category: string, dto: CreateMasterDataDto, actorId: string) {
    if (!this.VALID_CATEGORIES.includes(category)) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }

    // Check code uniqueness
    const existing = await this.prisma.queryTenant(tenantSlug,
      `SELECT id FROM master_data WHERE category = $1 AND code = $2`, [category, dto.code]);
    if (existing.length > 0) throw new ConflictException(`Code "${dto.code}" already exists in ${category}`);

    const id = uuidv4();
    await this.prisma.executeTenant(tenantSlug,
      `INSERT INTO master_data (id, category, code, label_en, label_ar, is_active, sort_order, config)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [id, category, dto.code, dto.labelEn, dto.labelAr || null,  0, null]);

    await this.audit.log({
      tenantSlug,
      eventType: 'MASTER_DATA_CREATED',
      actorUserId: actorId,
      entityType: 'MasterData',
      entityId: id,
      payload: {  ...dto },
    });

    return { id,  ...dto, isActive: true };
  }

  async updateMasterData(tenantSlug: string, category: string, id: string, dto: UpdateMasterDataDto, actorId: string) {
    if (!this.VALID_CATEGORIES.includes(category)) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }

    const existing = await this.prisma.queryTenant(tenantSlug,
      `SELECT id FROM master_data WHERE id = $1 AND category = $2`, [id, category]);
    if (existing.length === 0) throw new NotFoundException('Master data item not found');

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.labelEn !== undefined) { sets.push(`label_en = $${idx++}`); params.push(dto.labelEn); }
    if (dto.labelAr !== undefined) { sets.push(`label_ar = $${idx++}`); params.push(dto.labelAr); }
    if (dto.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(dto.isActive); }
    if (dto.sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(dto.sortOrder); }
    if (dto.config !== undefined) { sets.push(`config = $${idx++}`); params.push(JSON.stringify(dto.config)); }

    if (sets.length === 0) throw new BadRequestException('No fields to update');

    params.push(id);
    await this.prisma.executeTenant(tenantSlug,
      `UPDATE master_data SET ${sets.join(', ')} WHERE id = $${idx}`, params);

    await this.audit.log({
      tenantSlug,
      eventType: 'MASTER_DATA_UPDATED',
      actorUserId: actorId,
      entityType: 'MasterData',
      entityId: id,
      payload: { category, ...dto },
    });

    return { id, category, ...dto };
  }

  /* ───── Case Types ───── */

  async listCaseTypes(tenantSlug: string) {
    return this.prisma.queryTenant(tenantSlug,
      `SELECT id, code, label_en, label_ar, is_active, required_docs_template, default_task_template,
              session_placeholders, participant_placeholders
       FROM case_types ORDER BY label_en`);
  }

  async createCaseType(tenantSlug: string, data: any, actorId: string) {
    const id = uuidv4();
    await this.prisma.executeTenant(tenantSlug,
      `INSERT INTO case_types (id, code, label_en, label_ar, is_active, required_docs_template, default_task_template, session_placeholders, participant_placeholders)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8)`,
      [id, data.code, data.label_en || data.code, data.label_ar || null,
        data.requiredDocsTemplate ? JSON.stringify(data.requiredDocsTemplate) : null,
        data.defaultTaskTemplate ? JSON.stringify(data.defaultTaskTemplate) : null,
        data.sessionPlaceholders ? JSON.stringify(data.sessionPlaceholders) : null,
        data.participantPlaceholders ? JSON.stringify(data.participantPlaceholders) : null,
      ]);

    await this.audit.log({
      tenantSlug,
      eventType: 'CASE_TYPE_CREATED', actorUserId: actorId,
      entityType: 'CaseType', entityId: id, payload: data,
    });

    return { id, ...data, isActive: true };
  }

  async updateCaseType(tenantSlug: string, id: string, data: any, actorId: string) {
    const existing = await this.prisma.queryTenant(tenantSlug,
      `SELECT id FROM case_types WHERE id = $1`, [id]);
    if (existing.length === 0) throw new NotFoundException('Case type not found');

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.code !== undefined) { sets.push(`code = $${idx++}`); params.push(data.code); }
    if (data.label_en !== undefined) { sets.push(`label_en = $${idx++}`); params.push(data.label_en); }
    if (data.label_ar !== undefined) { sets.push(`label_ar = $${idx++}`); params.push(data.label_ar); }
    if (data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(data.isActive); }
    if (data.requiredDocsTemplate !== undefined) { sets.push(`required_docs_template = $${idx++}`); params.push(JSON.stringify(data.requiredDocsTemplate)); }
    if (data.defaultTaskTemplate !== undefined) { sets.push(`default_task_template = $${idx++}`); params.push(JSON.stringify(data.defaultTaskTemplate)); }

    if (sets.length === 0) throw new BadRequestException('No fields to update');

    params.push(id);
    await this.prisma.executeTenant(tenantSlug,
      `UPDATE case_types SET ${sets.join(', ')} WHERE id = $${idx}`, params);

    await this.audit.log({
      tenantSlug,
      eventType: 'CASE_TYPE_UPDATED', actorUserId: actorId,
      entityType: 'CaseType', entityId: id, payload: data,
    });

    return { id, ...data };
  }

  /* ───── Expense Approval Workflow ───── */

  async getExpenseWorkflow(tenantSlug: string) {
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT id, name, steps, is_active FROM expense_approval_workflows WHERE is_active = true LIMIT 1`);
    return rows[0] || null;
  }

  async saveExpenseWorkflow(tenantSlug: string, dto: SaveExpenseWorkflowDto, actorId: string) {
    // Deactivate existing
    await this.prisma.executeTenant(tenantSlug,
      `UPDATE expense_approval_workflows SET is_active = false WHERE is_active = true`);

    const id = uuidv4();
    await this.prisma.executeTenant(tenantSlug,
      `INSERT INTO expense_approval_workflows (id, name, steps, is_active)
       VALUES ($1, $2, $3, true)`,
      [id, dto.name || 'Default', JSON.stringify(dto.steps)]);

    await this.audit.log({
      tenantSlug,
      eventType: 'EXPENSE_WORKFLOW_UPDATED', actorUserId: actorId,
      entityType: 'ExpenseApprovalWorkflow', entityId: id,
      payload: dto,
    });

    return { id, name: dto.name || 'Default', steps: dto.steps, isActive: true };
  }

  /* ───── Tenant Settings ───── */

  async getTenantSettings(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      currency: tenant.currency,
      timezone: tenant.timezone,
      locale: tenant.locale,
      planTier: tenant.planTier,
      lawyerCanDraft: tenant.lawyerCanDraft,
    };
  }

  async updateTenantSettings(tenantSlug: string, dto: UpdateTenantSettingsDto, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.locale ? { locale: dto.locale } : {}),
        ...(dto.planTier ? { planTier: dto.planTier } : {}),
        ...(dto.lawyerCanDraft !== undefined ? { lawyerCanDraft: dto.lawyerCanDraft } : {}),
      },
    });

    await this.audit.log({
      tenantSlug,
      eventType: 'TENANT_SETTINGS_UPDATED', actorUserId: actorId,
      entityType: 'Tenant', entityId: tenant.id, payload: dto,
    });

    return updated;
  }

  /* ───── Retention Policies ───── */

  async listRetentionPolicies(tenantSlug: string) {
    return this.prisma.queryTenant(tenantSlug,
      `SELECT * FROM retention_policies ORDER BY doc_type_code`);
  }

  async upsertRetentionPolicy(tenantSlug: string, docTypeCode: string, retentionDays: number, description: string | undefined, actorId: string) {
    const existing: any[] = await this.prisma.queryTenant(tenantSlug,
      `SELECT id FROM retention_policies WHERE doc_type_code = $1`, [docTypeCode]);

    if (existing?.length) {
      await this.prisma.executeTenant(tenantSlug,
        `UPDATE retention_policies SET retention_days = $1, description = $2 WHERE doc_type_code = $3`,
        [retentionDays, description || null, docTypeCode]);
      await this.audit.log({ tenantSlug, eventType: 'RETENTION_POLICY_UPDATED', actorUserId: actorId, entityType: 'RetentionPolicy', entityId: existing[0].id, payload: { docTypeCode, retentionDays } });
      return { id: existing[0].id, docTypeCode, retentionDays, description };
    }

    const id = uuidv4();
    await this.prisma.executeTenant(tenantSlug,
      `INSERT INTO retention_policies (id, doc_type_code, retention_days, description) VALUES ($1, $2, $3, $4)`,
      [id, docTypeCode, retentionDays, description || null]);
    await this.audit.log({ tenantSlug, eventType: 'RETENTION_POLICY_CREATED', actorUserId: actorId, entityType: 'RetentionPolicy', entityId: id, payload: { docTypeCode, retentionDays } });
    return { id, docTypeCode, retentionDays, description };
  }

  /* ───── Courts ───── */

  async listCourts(tenantSlug: string) {
    return this.prisma.queryTenant(tenantSlug,
      `SELECT * FROM courts ORDER BY name`);
  }

  async createCourt(tenantSlug: string, body: any, actorId: string) {
    const id = uuidv4();
    await this.prisma.executeTenant(tenantSlug,
      `INSERT INTO courts (id, name, notes, address_text, department, circuit, jurisdiction_level, city, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id, body.name, body.notes || null, body.addressText || null,
        body.department || null, body.circuit || null,
        body.jurisdictionLevel || 'District', body.city || null, body.phone || null,
      ]);
    await this.audit.log({ tenantSlug, eventType: 'COURT_CREATED', actorUserId: actorId, entityType: 'Court', entityId: id, payload: body });
    return { id, ...body };
  }

  async updateCourt(tenantSlug: string, courtId: string, body: any, actorId: string) {
    const fieldMap: Record<string, string> = {
      name: 'name', notes: 'notes', addressText: 'address_text',
      department: 'department', circuit: 'circuit',
      jurisdictionLevel: 'jurisdiction_level', city: 'city', phone: 'phone',
    };
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [dtoKey, col] of Object.entries(fieldMap)) {
      if (body[dtoKey] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(body[dtoKey]);
      }
    }

    if (sets.length === 0) throw new BadRequestException('No fields to update');

    sets.push(`updated_at = NOW()`);
    params.push(courtId);
    await this.prisma.executeTenant(tenantSlug,
      `UPDATE courts SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    await this.audit.log({ tenantSlug, eventType: 'COURT_UPDATED', actorUserId: actorId, entityType: 'Court', entityId: courtId, payload: body });
    return { id: courtId, ...body };
  }
}
