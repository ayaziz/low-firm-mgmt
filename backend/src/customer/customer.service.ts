import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateCustomerDto, UpdateCustomerDto, CreateContactDto, CreateAddressDto } from './customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantSlug: string, dto: CreateCustomerDto, userId: string) {
    // Validate identity requirements
    if (dto.customerType === 'Organization') {
      if (!dto.registrationId) throw new BadRequestException('registrationId is required for Organization');
      if (!dto.taxId) throw new BadRequestException('taxId is required for Organization');
    } else {
      if (!dto.nationalId && !dto.passportNumber) {
        throw new BadRequestException('At least one of nationalId or passportNumber is required for Individual');
      }
    }

    // Check uniqueness of identity fields
    await this.checkIdentityUniqueness(tenantSlug, dto);

    const customerId = uuidv4();
    const rowVersion = uuidv4();

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO customers (id, customer_type, name, status, notes, national_id, passport_number, registration_id, tax_id, row_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [customerId, dto.customerType, dto.name, dto.status || 'Active', dto.notes || null,
       dto.nationalId || null, dto.passportNumber || null, dto.registrationId || null, dto.taxId || null, rowVersion],
    );

    // Create contacts if provided
    if (dto.contacts) {
      for (const contact of dto.contacts) {
        await this.addContact(tenantSlug, customerId, contact, userId);
      }
    }

    // Create addresses if provided
    if (dto.addresses) {
      for (const address of dto.addresses) {
        await this.addAddress(tenantSlug, customerId, address, userId);
      }
    }

    // Apply default checklist and doc requirements
    await this.applyDefaultTemplates(tenantSlug, customerId);

    await this.audit.log({
      tenantSlug,
      eventType: 'CUSTOMER_CREATED',
      actorUserId: userId,
      entityType: 'Customer',
      entityId: customerId,
      payload: { customerType: dto.customerType, name: dto.name },
    });

    return this.getById(tenantSlug, customerId);
  }

  async list(tenantSlug: string, query?: string, customerType?: string, status?: string, cursor?: string, limit = 20) {
    let sql = `SELECT * FROM customers WHERE 1=1`;
    const params: any[] = [];
    let paramIdx = 1;

    if (query) {
      sql += ` AND (name ILIKE $${paramIdx} OR national_id ILIKE $${paramIdx} OR passport_number ILIKE $${paramIdx} OR registration_id ILIKE $${paramIdx} OR tax_id ILIKE $${paramIdx})`;
      params.push(`%${query}%`);
      paramIdx++;
    }

    if (customerType) {
      sql += ` AND customer_type = $${paramIdx}`;
      params.push(customerType);
      paramIdx++;
    }

    if (status) {
      sql += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (cursor) {
      sql += ` AND created_at < $${paramIdx}`;
      params.push(cursor);
      paramIdx++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIdx}`;
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

  async getById(tenantSlug: string, customerId: string) {
    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM customers WHERE id = $1`,
      [customerId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Customer not found');
    const customer = rows[0];

    // Fetch contacts
    const contacts: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM contacts WHERE customer_id = $1 ORDER BY is_primary DESC, name`,
      [customerId],
    );

    // Fetch addresses
    const addresses: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM addresses WHERE customer_id = $1 ORDER BY is_primary DESC`,
      [customerId],
    );

    return { ...customer, contacts: contacts || [], addresses: addresses || [] };
  }

  async update(tenantSlug: string, customerId: string, dto: UpdateCustomerDto, userId: string) {
    const existing = await this.getById(tenantSlug, customerId);
    if (existing.row_version !== dto.rowVersion) {
      throw new ConflictException('Stale data - customer has been modified');
    }

    // Check identity uniqueness for updated fields
    if (dto.nationalId || dto.passportNumber || dto.registrationId || dto.taxId) {
      await this.checkIdentityUniqueness(tenantSlug, dto as any, customerId);
    }

    const newVersion = uuidv4();
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const fields: Array<[string, any]> = [
      ['name', dto.name],
      ['status', dto.status],
      ['notes', dto.notes],
      ['national_id', dto.nationalId],
      ['passport_number', dto.passportNumber],
      ['registration_id', dto.registrationId],
      ['tax_id', dto.taxId],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        setClauses.push(`${col} = $${paramIdx}`);
        params.push(val);
        paramIdx++;
      }
    }

    setClauses.push(`row_version = $${paramIdx}`);
    params.push(newVersion);
    paramIdx++;

    setClauses.push(`updated_at = NOW()`);

    params.push(customerId);
    params.push(dto.rowVersion);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE customers SET ${setClauses.join(', ')} WHERE id = $${paramIdx - 1} AND row_version = $${paramIdx}`,
      params,
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'CUSTOMER_UPDATED',
      actorUserId: userId,
      entityType: 'Customer',
      entityId: customerId,
      payload: { changes: dto },
    });

    return this.getById(tenantSlug, customerId);
  }

  async addContact(tenantSlug: string, customerId: string, dto: CreateContactDto, userId: string) {
    const contactId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO contacts (id, customer_id, name, email, phone, role_id, is_primary, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [contactId, customerId, dto.name, dto.email || null, dto.phone || null, dto.roleId || null, dto.isPrimary || false],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'CONTACT_CREATED',
      actorUserId: userId,
      entityType: 'Contact',
      entityId: contactId,
      payload: { customerId, name: dto.name },
    });

    return { id: contactId };
  }

  async updateContact(tenantSlug: string, customerId: string, contactId: string, dto: Partial<CreateContactDto>, userId: string) {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (dto.name !== undefined) { setClauses.push(`name = $${paramIdx++}`); params.push(dto.name); }
    if (dto.email !== undefined) { setClauses.push(`email = $${paramIdx++}`); params.push(dto.email); }
    if (dto.phone !== undefined) { setClauses.push(`phone = $${paramIdx++}`); params.push(dto.phone); }
    if (dto.roleId !== undefined) { setClauses.push(`role_id = $${paramIdx++}`); params.push(dto.roleId); }
    if (dto.isPrimary !== undefined) { setClauses.push(`is_primary = $${paramIdx++}`); params.push(dto.isPrimary); }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = NOW()`);
    params.push(contactId);
    params.push(customerId);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE contacts SET ${setClauses.join(', ')} WHERE id = $${paramIdx} AND customer_id = $${paramIdx + 1}`,
      params,
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'CONTACT_UPDATED',
      actorUserId: userId,
      entityType: 'Contact',
      entityId: contactId,
      payload: { customerId, changes: dto },
    });
  }

  async addAddress(tenantSlug: string, customerId: string, dto: CreateAddressDto, userId: string) {
    const addressId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO addresses (id, customer_id, type, is_primary, lines, city, state, postal_code, country, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [addressId, customerId, dto.type || 'Other', dto.isPrimary || false,
       dto.lines || null, dto.city || null, dto.state || null, dto.postalCode || null, dto.country || null],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'ADDRESS_CREATED',
      actorUserId: userId,
      entityType: 'Address',
      entityId: addressId,
      payload: { customerId },
    });

    return { id: addressId };
  }

  async getFinancialSummary(tenantSlug: string, customerId: string) {
    const result: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT
         COALESCE(SUM(CASE WHEN i.status IN ('Final','Sent') THEN i.total ELSE 0 END), 0) AS outstanding,
         COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.total ELSE 0 END), 0) AS paid,
         COALESCE(SUM(CASE WHEN i.status IN ('Final','Sent') AND i.due_date < NOW() THEN i.total ELSE 0 END), 0) AS overdue,
         MAX(p.paid_at) AS last_payment_date
       FROM invoices i
       LEFT JOIN payments p ON p.invoice_id = i.id
       WHERE i.customer_id = $1`,
      [customerId],
    );

    return result && result.length > 0 ? result[0] : { outstanding: 0, paid: 0, overdue: 0, last_payment_date: null };
  }

  async getComplianceChecklist(tenantSlug: string, customerId: string) {
    const checklists: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT cc.*, ci.id as item_id, ci.label_en, ci.label_ar, ci.status as item_status, ci.is_required
       FROM customer_checklists cc
       LEFT JOIN customer_checklist_items ci ON ci.checklist_id = cc.id
       WHERE cc.customer_id = $1
       ORDER BY cc.created_at, ci.sort_order`,
      [customerId],
    );

    const docReqs: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM customer_doc_requirements WHERE customer_id = $1 ORDER BY sort_order`,
      [customerId],
    );

    return { checklists: checklists || [], docRequirements: docReqs || [] };
  }

  private async checkIdentityUniqueness(tenantSlug: string, dto: any, excludeId?: string) {
    const checks: Array<[string, any, string]> = [
      ['national_id', dto.nationalId, 'National ID already exists'],
      ['passport_number', dto.passportNumber, 'Passport number already exists'],
      ['registration_id', dto.registrationId, 'Registration ID already exists'],
      ['tax_id', dto.taxId, 'Tax ID already exists'],
    ];

    for (const [col, val, msg] of checks) {
      if (!val) continue;
      let sql = `SELECT id FROM customers WHERE ${col} = $1`;
      const params: any[] = [val];
      if (excludeId) {
        sql += ` AND id != $2`;
        params.push(excludeId);
      }
      sql += ` LIMIT 1`;
      const existing: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
      if (existing && existing.length > 0) {
        throw new ConflictException(msg);
      }
    }
  }

  private async applyDefaultTemplates(tenantSlug: string, customerId: string) {
    // Apply compliance checklist template
    const templates: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM checklist_templates WHERE scope = 'customer' LIMIT 1`,
      [],
    );

    if (templates && templates.length > 0) {
      const template = templates[0];
      const checklistId = uuidv4();
      await this.prisma.executeTenant(
        tenantSlug,
        `INSERT INTO customer_checklists (id, customer_id, template_id, name, created_at) VALUES ($1, $2, $3, $4, NOW())`,
        [checklistId, customerId, template.id, template.name],
      );

      const items = typeof template.items === 'string' ? JSON.parse(template.items) : template.items;
      if (Array.isArray(items)) {
        let sortOrder = 0;
        for (const item of items) {
          await this.prisma.executeTenant(
            tenantSlug,
            `INSERT INTO customer_checklist_items (id, checklist_id, label_en, label_ar, is_required, status, sort_order, created_at)
             VALUES ($1, $2, $3, $4, $5, 'Pending', $6, NOW())`,
            [uuidv4(), checklistId, item.label_en, item.label_ar || '', item.required || false, sortOrder++],
          );
        }
      }
    }

    // Apply doc requirement template
    const docTemplates: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM doc_requirement_templates WHERE scope = 'customer' LIMIT 1`,
      [],
    );

    if (docTemplates && docTemplates.length > 0) {
      const docTemplate = docTemplates[0];
      const items = typeof docTemplate.items === 'string' ? JSON.parse(docTemplate.items) : docTemplate.items;
      if (Array.isArray(items)) {
        let sortOrder = 0;
        for (const item of items) {
          await this.prisma.executeTenant(
            tenantSlug,
            `INSERT INTO customer_doc_requirements (id, customer_id, template_id, doc_type_code, label_en, label_ar, is_required, status, sort_order, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Missing', $8, NOW())`,
            [uuidv4(), customerId, docTemplate.id, item.docTypeCode, item.label_en, item.label_ar || '', item.required || false, sortOrder++],
          );
        }
      }
    }
  }
}
