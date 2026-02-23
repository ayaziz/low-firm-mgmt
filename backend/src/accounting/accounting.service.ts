import {
  Injectable, NotFoundException, ConflictException,
  UnprocessableEntityException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateInvoiceDto, VoidInvoiceDto,
  CreatePaymentDto, CreateExpenseDto,
  ApproveExpenseDto, RejectExpenseDto, CreateWageDto,
} from './accounting.dto';

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ===================== INVOICES =====================

  async createInvoice(tenantSlug: string, dto: CreateInvoiceDto, userId: string) {
    const invoiceId = uuidv4();

    // Generate invoice number: INV-YYYY-SEQ
    const year = new Date().getFullYear();
    await this.prisma.executeTenant(tenantSlug, `INSERT INTO invoice_sequences (year, last_seq) VALUES ($1, 0) ON CONFLICT (year) DO NOTHING`, [year]);
    await this.prisma.executeTenant(tenantSlug, `UPDATE invoice_sequences SET last_seq = last_seq + 1 WHERE year = $1`, [year]);
    const seqRows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT last_seq FROM invoice_sequences WHERE year = $1`, [year]);
    const invoiceNumber = `INV-${year}-${String(seqRows[0]?.last_seq || 1).padStart(4, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    for (const item of dto.lineItems) {
      const lineTotal = item.quantity * item.unitPrice;
      const lineTax = lineTotal * ((item.taxRate || 0) / 100);
      subtotal += lineTotal;
      totalTax += lineTax;
    }
    const totalAmount = subtotal + totalTax;

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO invoices (id, invoice_number, case_id, customer_id, status, currency, subtotal, tax_amount, total_amount, paid_amount, due_date, notes, row_version, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Draft', $5, $6, $7, $8, 0, $9, $10, $11, $12, NOW(), NOW())`,
      [invoiceId, invoiceNumber, dto.caseId, dto.customerId, dto.currency || 'SAR',
       subtotal, totalTax, totalAmount, dto.dueDate || null, dto.notes || null, uuidv4(), userId],
    );

    // Insert line items
    for (let i = 0; i < dto.lineItems.length; i++) {
      const item = dto.lineItems[i];
      const lineTotal = item.quantity * item.unitPrice;
      const lineTax = lineTotal * ((item.taxRate || 0) / 100);
      await this.prisma.executeTenant(
        tenantSlug,
        `INSERT INTO invoice_line_items (id, invoice_id, line_number, description, quantity, unit_price, tax_rate, line_total, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [uuidv4(), invoiceId, i + 1, item.description, item.quantity, item.unitPrice, item.taxRate || 0, lineTotal + lineTax],
      );
    }

    await this.audit.log({ tenantSlug, eventType: 'INVOICE_CREATED', actorUserId: userId, entityType: 'Invoice', entityId: invoiceId, payload: { invoiceNumber, totalAmount } });
    return this.getInvoiceById(tenantSlug, invoiceId);
  }

  async getInvoiceById(tenantSlug: string, invoiceId: string) {
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM invoices WHERE id = $1`, [invoiceId]);
    if (!rows?.length) throw new NotFoundException('Invoice not found');
    const lineItems: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY line_number`, [invoiceId]);
    const payments: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC`, [invoiceId]);
    return { ...rows[0], lineItems: lineItems || [], payments: payments || [] };
  }

  async finalizeInvoice(tenantSlug: string, invoiceId: string, userId: string) {
    const inv = await this.getInvoiceById(tenantSlug, invoiceId);
    if (inv.status !== 'Draft') throw new UnprocessableEntityException('Only draft invoices can be finalized');

    await this.prisma.executeTenant(tenantSlug, `UPDATE invoices SET status = 'Finalized', finalized_at = NOW(), updated_at = NOW() WHERE id = $1`, [invoiceId]);
    await this.audit.log({ tenantSlug, eventType: 'INVOICE_FINALIZED', actorUserId: userId, entityType: 'Invoice', entityId: invoiceId });
    return this.getInvoiceById(tenantSlug, invoiceId);
  }

  async markInvoiceSent(tenantSlug: string, invoiceId: string, userId: string) {
    const inv = await this.getInvoiceById(tenantSlug, invoiceId);
    if (inv.status !== 'Finalized') throw new UnprocessableEntityException('Invoice must be finalized before sending');

    await this.prisma.executeTenant(tenantSlug, `UPDATE invoices SET status = 'Sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`, [invoiceId]);
    await this.audit.log({ tenantSlug, eventType: 'INVOICE_SENT', actorUserId: userId, entityType: 'Invoice', entityId: invoiceId });
    return this.getInvoiceById(tenantSlug, invoiceId);
  }

  async voidInvoice(tenantSlug: string, invoiceId: string, dto: VoidInvoiceDto, userId: string) {
    const inv = await this.getInvoiceById(tenantSlug, invoiceId);
    if (inv.status === 'Void') throw new UnprocessableEntityException('Invoice is already void');
    if (Number(inv.paid_amount) > 0) throw new UnprocessableEntityException('Cannot void an invoice with payments');

    await this.prisma.executeTenant(tenantSlug, `UPDATE invoices SET status = 'Void', void_reason = $1, updated_at = NOW() WHERE id = $2`, [dto.reason, invoiceId]);
    await this.audit.log({ tenantSlug, eventType: 'INVOICE_VOIDED', actorUserId: userId, entityType: 'Invoice', entityId: invoiceId, payload: { reason: dto.reason } });
    return this.getInvoiceById(tenantSlug, invoiceId);
  }

  async listInvoices(tenantSlug: string, caseId?: string, customerId?: string, status?: string, cursor?: string, limit = 20) {
    let sql = `SELECT * FROM invoices WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (caseId) { sql += ` AND case_id = $${idx++}`; params.push(caseId); }
    if (customerId) { sql += ` AND customer_id = $${idx++}`; params.push(customerId); }
    if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
    if (cursor) { sql += ` AND created_at < $${idx++}`; params.push(cursor); }

    sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }

  async generateInvoicePdf(tenantSlug: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.getInvoiceById(tenantSlug, invoiceId);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Invoice #: ${invoice.invoice_number}`);
      doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`);
      doc.text(`Status: ${invoice.status}`);
      doc.text(`Currency: ${invoice.currency}`);
      if (invoice.due_date) doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`);
      doc.moveDown();

      doc.text('Line Items:', { underline: true });
      doc.moveDown(0.5);
      for (const item of invoice.lineItems) {
        doc.text(`${item.description} — Qty: ${item.quantity} × ${item.unit_price} = ${item.line_total}`);
      }
      doc.moveDown();
      doc.text(`Subtotal: ${invoice.subtotal}`);
      doc.text(`Tax: ${invoice.tax_amount}`);
      doc.fontSize(14).text(`Total: ${invoice.total_amount}`, { bold: true });
      doc.text(`Paid: ${invoice.paid_amount}`);
      doc.text(`Balance: ${Number(invoice.total_amount) - Number(invoice.paid_amount)}`);

      if (invoice.notes) {
        doc.moveDown();
        doc.fontSize(10).text(`Notes: ${invoice.notes}`);
      }

      doc.end();
    });
  }

  // ===================== PAYMENTS =====================

  async createPayment(tenantSlug: string, dto: CreatePaymentDto, userId: string, idempotencyKey?: string) {
    // Idempotency check
    if (idempotencyKey) {
      const existing: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM payments WHERE idempotency_key = $1`, [idempotencyKey]);
      if (existing?.length) return existing[0];
    }

    const invoice = await this.getInvoiceById(tenantSlug, dto.invoiceId);

    if (invoice.status === 'Void') throw new UnprocessableEntityException('Cannot add payment to void invoice');
    if (invoice.status === 'Draft') throw new UnprocessableEntityException('Invoice must be finalized before accepting payments');

    const currentPaid = Number(invoice.paid_amount) || 0;
    const totalDue = Number(invoice.total_amount);
    if (currentPaid + dto.amount > totalDue) {
      throw new UnprocessableEntityException(`Payment would exceed invoice total. Remaining balance: ${totalDue - currentPaid}`);
    }

    const paymentId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO payments (id, invoice_id, amount, method, payment_date, reference, notes, idempotency_key, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [paymentId, dto.invoiceId, dto.amount, dto.method, dto.paymentDate || new Date().toISOString(),
       dto.reference || null, dto.notes || null, idempotencyKey || null, userId],
    );

    // Update invoice paid_amount and status
    const newPaid = currentPaid + dto.amount;
    const newStatus = newPaid >= totalDue ? 'Paid' : invoice.status;

    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE invoices SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3`,
      [newPaid, newStatus, dto.invoiceId],
    );

    await this.audit.log({ tenantSlug, eventType: 'PAYMENT_RECORDED', actorUserId: userId, entityType: 'Payment', entityId: paymentId, payload: { invoiceId: dto.invoiceId, amount: dto.amount } });

    return { id: paymentId, invoiceStatus: newStatus };
  }

  // ===================== EXPENSES =====================

  async createExpense(tenantSlug: string, dto: CreateExpenseDto, userId: string) {
    const expenseId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO expenses (id, case_id, category_id, amount, description, expense_date, receipt_doc_id, status, submitted_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8, NOW(), NOW())`,
      [expenseId, dto.caseId, dto.categoryId, dto.amount, dto.description || null,
       dto.expenseDate || new Date().toISOString(), dto.receiptDocId || null, userId],
    );

    await this.audit.log({ tenantSlug, eventType: 'EXPENSE_SUBMITTED', actorUserId: userId, entityType: 'Expense', entityId: expenseId, payload: { amount: dto.amount } });
    return { id: expenseId };
  }

  async approveExpense(tenantSlug: string, expenseId: string, dto: ApproveExpenseDto, userId: string) {
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM expenses WHERE id = $1`, [expenseId]);
    if (!rows?.length) throw new NotFoundException('Expense not found');
    if (rows[0].status === 'Approved') throw new UnprocessableEntityException('Expense already approved');
    if (rows[0].status === 'Rejected') throw new UnprocessableEntityException('Expense was rejected');

    // Get workflow to determine steps
    const workflows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM expense_approval_workflows ORDER BY step_order`, []);
    const approvals: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM expense_approvals WHERE expense_id = $1 ORDER BY step_order`, [expenseId]);

    const nextStep = (approvals?.length || 0) + 1;
    const isLastStep = !workflows?.length || nextStep >= workflows.length;

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO expense_approvals (id, expense_id, step_order, approver_user_id, decision, comment, decided_at)
       VALUES ($1, $2, $3, $4, 'Approved', $5, NOW())`,
      [uuidv4(), expenseId, nextStep, userId, dto.comment || null],
    );

    if (isLastStep) {
      await this.prisma.executeTenant(tenantSlug, `UPDATE expenses SET status = 'Approved', updated_at = NOW() WHERE id = $1`, [expenseId]);
    }

    await this.audit.log({ tenantSlug, eventType: 'EXPENSE_APPROVED', actorUserId: userId, entityType: 'Expense', entityId: expenseId, payload: { step: nextStep, final: isLastStep } });
    return { approved: isLastStep, step: nextStep };
  }

  async rejectExpense(tenantSlug: string, expenseId: string, dto: RejectExpenseDto, userId: string) {
    const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM expenses WHERE id = $1`, [expenseId]);
    if (!rows?.length) throw new NotFoundException('Expense not found');

    const approvals: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM expense_approvals WHERE expense_id = $1 ORDER BY step_order`, [expenseId]);
    const nextStep = (approvals?.length || 0) + 1;

    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO expense_approvals (id, expense_id, step_order, approver_user_id, decision, comment, decided_at)
       VALUES ($1, $2, $3, $4, 'Rejected', $5, NOW())`,
      [uuidv4(), expenseId, nextStep, userId, dto.reason],
    );

    await this.prisma.executeTenant(tenantSlug, `UPDATE expenses SET status = 'Rejected', updated_at = NOW() WHERE id = $1`, [expenseId]);
    await this.audit.log({ tenantSlug, eventType: 'EXPENSE_REJECTED', actorUserId: userId, entityType: 'Expense', entityId: expenseId, payload: { reason: dto.reason } });
    return { rejected: true };
  }

  async listExpenses(tenantSlug: string, caseId?: string, status?: string, cursor?: string, limit = 20) {
    let sql = `SELECT * FROM expenses WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (caseId) { sql += ` AND case_id = $${idx++}`; params.push(caseId); }
    if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
    if (cursor) { sql += ` AND created_at < $${idx++}`; params.push(cursor); }
    sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null, hasMore };
  }

  // ===================== WAGES =====================

  async createWage(tenantSlug: string, dto: CreateWageDto, userId: string) {
    const wageId = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO wages (id, user_id, amount, period, notes, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [wageId, dto.userId, dto.amount, dto.period, dto.notes || null, userId],
    );
    await this.audit.log({ tenantSlug, eventType: 'WAGE_RECORDED', actorUserId: userId, entityType: 'Wage', entityId: wageId, payload: { amount: dto.amount, period: dto.period } });
    return { id: wageId };
  }

  async listWages(tenantSlug: string, userIdFilter?: string, period?: string) {
    let sql = `SELECT * FROM wages WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (userIdFilter) { sql += ` AND user_id = $${idx++}`; params.push(userIdFilter); }
    if (period) { sql += ` AND period = $${idx++}`; params.push(period); }
    sql += ` ORDER BY created_at DESC`;
    return this.prisma.queryTenant(tenantSlug, sql, params);
  }

  async exportWagesCsv(tenantSlug: string, period?: string): Promise<string> {
    const wages = await this.listWages(tenantSlug, undefined, period);
    const rows = (wages as any[]) || [];
    let csv = 'ID,User ID,Amount,Period,Notes,Created At\n';
    for (const w of rows) {
      csv += `${w.id},${w.user_id},${w.amount},${w.period},"${(w.notes || '').replace(/"/g, '""')}",${w.created_at}\n`;
    }
    return csv;
  }
}
