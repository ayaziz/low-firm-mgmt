import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateCustomerDto, UpdateCustomerDto, CreateContactDto, CreateAddressDto, CreateCustomerCommunicationDto } from './customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantSlug: string, dto: CreateCustomerDto, userId: string) {
    // Validate identity requirements
    if (dto.customer_type === 'Organization') {
      if (!dto.registration_id) throw new BadRequestException('registrationId is required for Organization');
      if (!dto.tax_id) throw new BadRequestException('taxId is required for Organization');
    } else {
      if (!dto.national_id && !dto.passport_number) {
        throw new BadRequestException('At least one of nationalId or passportNumber is required for Individual');
      }
    }

    // Check uniqueness of identity fields
    await this.checkIdentityUniqueness(tenantSlug, dto);

    const customerId = uuidv4();

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO customers (id, customer_type, name, status, notes, national_id, passport_number, registration_id, tax_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [customerId, dto.customer_type, dto.name, dto.status || 'Active', dto.notes || null,
       dto.national_id || null, dto.passport_number || null, dto.registration_id || null, dto.tax_id || null],
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
      payload: { customerType: dto.customer_type, name: dto.name },
    });

    return this.getById(tenantSlug, customerId);
  }

  async list(tenantSlug: string, query?: string, customerType?: string, status?: string, cursor?: string, limit = 20) {
    let sql = `SELECT *, updated_at::text AS row_version FROM customers WHERE deleted_at IS NULL`;
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
      `SELECT *, updated_at::text AS row_version FROM customers WHERE id = $1 AND deleted_at IS NULL`,
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
    await this.getById(tenantSlug, customerId);

    // Check identity uniqueness for updated fields
    if (dto.nationalId || dto.passportNumber || dto.registrationId || dto.taxId) {
      await this.checkIdentityUniqueness(tenantSlug, dto as any, customerId);
    }

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

    setClauses.push(`updated_at = NOW()`);

    params.push(customerId);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE customers SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
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
			[
				contactId,
				customerId,
				dto.name,
				dto.email || null,
				dto.phone || null,
				dto.role_id || null,
				dto.isPrimary || false,
			],
		)

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
    if (dto.role_id !== undefined) { setClauses.push(`role_id = $${paramIdx++}`); params.push(dto.role_id); }
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

  async deleteContact(tenantSlug: string, customerId: string, contactId: string, userId: string) {
    await this.prisma.executeTenant(
      tenantSlug,
      `DELETE FROM contacts WHERE id = $1 AND customer_id = $2`,
      [contactId, customerId],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'CONTACT_DELETED',
      actorUserId: userId,
      entityType: 'Contact',
      entityId: contactId,
      payload: { customerId },
    });
  }

  async addAddress(tenantSlug: string, customerId: string, dto: CreateAddressDto, userId: string) {
    const addressId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO addresses (id, customer_id, address_type, is_primary, line1, city, state, postal_code, country, created_at, updated_at)
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

  async updateAddress(tenantSlug: string, customerId: string, addressId: string, dto: Partial<CreateAddressDto>, userId: string) {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (dto.type !== undefined) { setClauses.push(`address_type = $${paramIdx++}`); params.push(dto.type); }
    if (dto.isPrimary !== undefined) { setClauses.push(`is_primary = $${paramIdx++}`); params.push(dto.isPrimary); }
    if (dto.lines !== undefined) { setClauses.push(`line1 = $${paramIdx++}`); params.push(dto.lines); }
    if (dto.city !== undefined) { setClauses.push(`city = $${paramIdx++}`); params.push(dto.city); }
    if (dto.state !== undefined) { setClauses.push(`state = $${paramIdx++}`); params.push(dto.state); }
    if (dto.postalCode !== undefined) { setClauses.push(`postal_code = $${paramIdx++}`); params.push(dto.postalCode); }
    if (dto.country !== undefined) { setClauses.push(`country = $${paramIdx++}`); params.push(dto.country); }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = NOW()`);
    params.push(addressId);
    params.push(customerId);

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE addresses SET ${setClauses.join(', ')} WHERE id = $${paramIdx} AND customer_id = $${paramIdx + 1}`,
      params,
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'ADDRESS_UPDATED',
      actorUserId: userId,
      entityType: 'Address',
      entityId: addressId,
      payload: { customerId, changes: dto },
    });
  }

  async deleteAddress(tenantSlug: string, customerId: string, addressId: string, userId: string) {
    await this.prisma.executeTenant(
      tenantSlug,
      `DELETE FROM addresses WHERE id = $1 AND customer_id = $2`,
      [addressId, customerId],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'ADDRESS_DELETED',
      actorUserId: userId,
      entityType: 'Address',
      entityId: addressId,
      payload: { customerId },
    });
  }

  async getFinancialSummary(tenantSlug: string, customerId: string) {
    const result: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT
         COALESCE(SUM(CASE WHEN i.status IN ('Finalized','Sent') THEN i.total_amount ELSE 0 END), 0) AS outstanding,
         COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.total_amount ELSE 0 END), 0) AS paid,
         COALESCE(SUM(CASE WHEN i.status IN ('Finalized','Sent') AND i.due_date < NOW() THEN i.total_amount ELSE 0 END), 0) AS overdue,
         MAX(p.payment_date) AS last_payment_date
       FROM invoices i
       LEFT JOIN payments p ON p.invoice_id = i.id
       WHERE i.customer_id = $1`,
      [customerId],
    );

    return result && result.length > 0 ? result[0] : { outstanding: 0, paid: 0, overdue: 0, last_payment_date: null };
  }

  async getComplianceChecklist(tenantSlug: string, customerId: string) {
    const docReqs: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM customer_doc_requirements WHERE customer_id = $1 ORDER BY created_at`,
      [customerId],
    );

    const items = (docReqs || []).map((row: any) => ({
      id: row.id,
      label: row.label,
      is_met: row.status === 'Provided',
      status: row.status,
    }));

    return { items, docRequirements: docReqs || [] };
  }

  async updateChecklistItemStatus(tenantSlug: string, customerId: string, itemId: string, isMet: boolean, userId: string) {
    const nextStatus = isMet ? 'Provided' : 'Missing';
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE customer_doc_requirements
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND customer_id = $3`,
      [nextStatus, itemId, customerId],
    );

    await this.audit.log({
      tenantSlug,
      eventType: 'CUSTOMER_CHECKLIST_ITEM_UPDATED',
      actorUserId: userId,
      entityType: 'CustomerDocRequirement',
      entityId: itemId,
      payload: { customerId, status: nextStatus },
    });

    return { success: true };
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
      let sql = `SELECT id FROM customers WHERE ${col} = $1 AND deleted_at IS NULL`;
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

  // --- Customer-level Communications ---
  async createCommunication(tenantSlug: string, customerId: string, dto: CreateCustomerCommunicationDto, userId: string) {
    await this.getById(tenantSlug, customerId); // ensure customer exists
    const commId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO communications (id, case_id, customer_id, type_id, date_time, direction, participants, summary, next_steps, visibility_scope, created_by, created_at, updated_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [commId, customerId, dto.typeId, dto.dateTime, dto.direction,
       dto.participants || null, dto.summary || null, dto.nextSteps || null,
       dto.visibilityScope || 'LegalOnly', userId],
    );
    await this.audit.log({ tenantSlug, eventType: 'COMM_CREATED', actorUserId: userId, entityType: 'Communication', entityId: commId, payload: { customerId } });
    return { id: commId };
  }

  async listCommunications(tenantSlug: string, customerId: string) {
    return this.prisma.queryTenant(
      tenantSlug,
      `SELECT * FROM communications WHERE customer_id = $1 ORDER BY date_time DESC`,
      [customerId],
    );
  }

  private async applyDefaultTemplates(tenantSlug: string, customerId: string) {
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
        for (const item of items) {
          await this.prisma.executeTenant(
            tenantSlug,
            `INSERT INTO customer_doc_requirements (id, customer_id, doc_type_code, label, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'Missing', NOW(), NOW())`,
            [uuidv4(), customerId, item.docTypeCode, item.label_en || item.docTypeCode || 'Required Document'],
          );
        }
      }
    }
  }
}
