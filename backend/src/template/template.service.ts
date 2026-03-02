import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTemplateDto, UpdateTemplateDto, RenderTemplateDto } from './template.dto';
import * as Handlebars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* ────── CREATE ────── */
  async create(tenantSlug: string, dto: CreateTemplateDto, userId: string) {
    const id = uuidv4();

    // Validate Handlebars syntax
    try {
      Handlebars.compile(dto.template_body);
    } catch (err) {
      throw new BadRequestException(`Invalid template syntax: ${err.message}`);
    }

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO document_templates (id, name, description, category, template_body, variable_schema, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, true, $7, NOW(), NOW())`,
      [id, dto.name, dto.description || null, dto.category, dto.template_body,
       JSON.stringify(dto.variable_schema || {}), userId],
    );

    await this.audit.log({
      tenantSlug, eventType: 'TEMPLATE_CREATED', actorUserId: userId,
      entityType: 'DocumentTemplate', entityId: id, payload: { name: dto.name },
    });

    return { id };
  }

  /* ────── LIST ────── */
  async list(tenantSlug: string, filters: { category?: string; is_active?: boolean; search?: string; cursor?: string; limit?: number }) {
    const limit = Math.min(filters.limit || 20, 100);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.category) {
      conditions.push(`category = $${idx++}`);
      params.push(filters.category);
    }
    if (filters.is_active !== undefined) {
      conditions.push(`is_active = $${idx++}`);
      params.push(filters.is_active);
    }
    if (filters.search) {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }
    if (filters.cursor) {
      conditions.push(`created_at < $${idx++}`);
      params.push(filters.cursor);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT id, name, description, category, is_active, variable_schema, created_at, updated_at
       FROM document_templates ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      [...params, limit + 1],
    );

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, hasMore, nextCursor: hasMore ? data[data.length - 1].created_at : null };
  }

  /* ────── GET BY ID ────── */
  async getById(tenantSlug: string, id: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM document_templates WHERE id = $1`,
      [id],
    );
    if (!rows?.length) throw new NotFoundException('Template not found');
    return rows[0];
  }

  /* ────── UPDATE ────── */
  async update(tenantSlug: string, id: string, dto: UpdateTemplateDto, userId: string) {
    // Verify exists
    await this.getById(tenantSlug, id);

    // Validate template_body if provided
    if (dto.template_body) {
      try {
        Handlebars.compile(dto.template_body);
      } catch (err) {
        throw new BadRequestException(`Invalid template syntax: ${err.message}`);
      }
    }

    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fieldMap: Record<string, any> = {
      name: dto.name,
      description: dto.description,
      category: dto.category,
      template_body: dto.template_body,
      is_active: dto.is_active,
    };

    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push(val);
      }
    }

    if (dto.variable_schema !== undefined) {
      setClauses.push(`variable_schema = $${idx++}::jsonb`);
      params.push(JSON.stringify(dto.variable_schema));
    }

    if (!setClauses.length) throw new BadRequestException('No fields to update');

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE document_templates SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.audit.log({
      tenantSlug, eventType: 'TEMPLATE_UPDATED', actorUserId: userId,
      entityType: 'DocumentTemplate', entityId: id, payload: dto,
    });

    return this.getById(tenantSlug, id);
  }

  /* ────── RENDER (Preview) ────── */
  async render(tenantSlug: string, dto: RenderTemplateDto) {
    const template = await this.getById(tenantSlug, dto.templateId);
    if (!template.is_active) throw new BadRequestException('Template is inactive');

    // Validate required variables
    const schema = template.variable_schema || {};
    const missingVars = Object.keys(schema).filter(k => !(k in dto.data));
    if (missingVars.length) {
      throw new BadRequestException(`Missing required variables: ${missingVars.join(', ')}`);
    }

    try {
      const compiled = Handlebars.compile(template.template_body);
      const rendered = compiled(dto.data);
      return {
        rendered,
        templateName: template.name,
        category: template.category,
      };
    } catch (err) {
      throw new BadRequestException(`Template rendering failed: ${err.message}`);
    }
  }

  /* ────── GENERATE DOCUMENT ────── */
  async generate(tenantSlug: string, dto: RenderTemplateDto, userId: string) {
    if (!dto.caseId) throw new BadRequestException('caseId is required to generate a document');

    const { rendered, templateName } = await this.render(tenantSlug, dto);

    // Create a document record from the rendered template
    const docId = uuidv4();
    const title = dto.title || `${templateName} - ${new Date().toISOString().slice(0, 10)}`;

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO documents (id, title, doc_type_id, case_id, confidentiality_level, is_checked_out, is_deleted, has_legal_hold, created_by, created_at, updated_at)
       VALUES ($1, $2, NULL, $3, 'Normal', false, false, false, $4, NOW(), NOW())`,
      [docId, title, dto.caseId, userId],
    );

    await this.audit.log({
      tenantSlug, eventType: 'DOC_GENERATED_FROM_TEMPLATE', actorUserId: userId,
      entityType: 'Document', entityId: docId,
      payload: { templateId: dto.templateId, templateName, title },
    });

    return { documentId: docId, title, rendered };
  }

  /* ────── DELETE (soft) ────── */
  async deactivate(tenantSlug: string, id: string, userId: string) {
    await this.getById(tenantSlug, id);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE document_templates SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    await this.audit.log({
      tenantSlug, eventType: 'TEMPLATE_DEACTIVATED', actorUserId: userId,
      entityType: 'DocumentTemplate', entityId: id, payload: {},
    });

    return { success: true };
  }
}
