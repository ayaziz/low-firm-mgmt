/** @format */

import {
	Injectable,
	NotFoundException,
	ConflictException,
	UnprocessableEntityException,
	BadRequestException,
	ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { v4 as uuidv4 } from 'uuid'
import {
	CreateInvoiceDto,
	VoidInvoiceDto,
	CreatePaymentDto,
	CreateExpenseDto,
	ApproveExpenseDto,
	RejectExpenseDto,
	CreateWageDto,
	UpdateWageDto,
	UpdateExpenseDto,
	UpdateInvoiceDto,
	UpdatePaymentDto,
} from './accounting.dto'

@Injectable()
export class AccountingService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly audit: AuditService,
	) {}

	// ===================== INVOICES =====================

	async createInvoice(
		tenantSlug: string,
		dto: CreateInvoiceDto,
		userId: string,
		userRoles: string[] = [],
	) {
		// Lawyer draft gate: check tenant setting
		if (
			userRoles.includes('Lawyer') &&
			!userRoles.includes('TenantAdmin') &&
			!userRoles.includes('SystemAdmin')
		) {
			const tenant = await this.prisma.tenant.findUnique({
				where: { slug: tenantSlug },
			})
			if (!tenant?.lawyerCanDraft) {
				throw new ForbiddenException(
					'Lawyers are not allowed to create draft invoices in this tenant',
				)
			}
		}

		const invoiceId = uuidv4()

		// Generate invoice number: INV-YYYY-SEQ
		const year = new Date().getFullYear()
		await this.prisma.executeTenant(
			tenantSlug,
			`INSERT INTO invoice_sequences (year, last_seq) VALUES ($1, 0) ON CONFLICT (year) DO NOTHING`,
			[year],
		)
		await this.prisma.executeTenant(
			tenantSlug,
			`UPDATE invoice_sequences SET last_seq = last_seq + 1 WHERE year = $1`,
			[year],
		)
		const seqRows: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT last_seq FROM invoice_sequences WHERE year = $1`,
			[year],
		)
		const invoiceNumber = `INV-${year}-${String(seqRows[0]?.last_seq || 1).padStart(4, '0')}`

		// Calculate totals with discount support
		let subtotal = 0
		let totalTax = 0
		for (const item of dto.lineItems) {
			const lineTotal = item.quantity * item.unitPrice
			const lineTax = lineTotal * ((item.taxRate || 0) / 100)
			subtotal += lineTotal
			totalTax += lineTax
		}
		const discountRatePct = dto.discountRatePct ?? 0
		const discountAmount = subtotal * (discountRatePct / 100)
		const totalAmount = subtotal - discountAmount + totalTax

		await this.prisma.executeTenant(
			tenantSlug,
			`INSERT INTO invoices (id, invoice_number, case_id, customer_id, status, currency, subtotal, tax_amount, discount_rate_pct, discount_amount, total_amount, paid_amount, due_date, notes, row_version, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Draft', $5, $6, $7, $8, $9, $10, 0, $11, $12, $13, $14, NOW(), NOW())`,
			[
				invoiceId,
				invoiceNumber,
				dto.caseId,
				dto.customerId,
				dto.currency || 'SAR',
				subtotal,
				totalTax,
				discountRatePct,
				discountAmount,
				totalAmount,
				dto.dueDate || null,
				dto.notes || null,
				uuidv4(),
				userId,
			],
		)

		// Insert line items
		for (let i = 0; i < dto.lineItems.length; i++) {
			const item = dto.lineItems[i]
			const lineTotal = item.quantity * item.unitPrice
			const lineTax = lineTotal * ((item.taxRate || 0) / 100)
			await this.prisma.executeTenant(
				tenantSlug,
				`INSERT INTO invoice_line_items (id, invoice_id, line_number, description, quantity, unit_price, tax_rate, line_total, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
				[
					uuidv4(),
					invoiceId,
					i + 1,
					item.description,
					item.quantity,
					item.unitPrice,
					item.taxRate || 0,
					lineTotal + lineTax,
				],
			)
		}

		await this.audit.log({
			tenantSlug,
			eventType: 'INVOICE_CREATED',
			actorUserId: userId,
			entityType: 'Invoice',
			entityId: invoiceId,
			payload: { invoiceNumber, totalAmount },
		})
		return this.getInvoiceById(tenantSlug, invoiceId)
	}

	async getInvoiceById(tenantSlug: string, invoiceId: string) {
		const rows: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT * FROM invoices WHERE id = $1`,
			[invoiceId],
		)
		if (!rows?.length) throw new NotFoundException('Invoice not found')
		const lineItems: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY line_number`,
			[invoiceId],
		)
		const payments: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC`,
			[invoiceId],
		)
		return { ...rows[0], lineItems: lineItems || [], payments: payments || [] }
	}

	async finalizeInvoice(tenantSlug: string, invoiceId: string, userId: string) {
		const inv = await this.getInvoiceById(tenantSlug, invoiceId)
		if (inv.status !== 'Draft')
			throw new UnprocessableEntityException(
				'Only draft invoices can be finalized',
			)

		await this.prisma.executeTenant(
			tenantSlug,
			`UPDATE invoices SET status = 'Finalized', finalized_at = NOW(), updated_at = NOW() WHERE id = $1`,
			[invoiceId],
		)
		await this.audit.log({
			tenantSlug,
			eventType: 'INVOICE_FINALIZED',
			actorUserId: userId,
			entityType: 'Invoice',
			entityId: invoiceId,
		})
		return this.getInvoiceById(tenantSlug, invoiceId)
	}

	async markInvoiceSent(tenantSlug: string, invoiceId: string, userId: string) {
		const inv = await this.getInvoiceById(tenantSlug, invoiceId)
		if (inv.status !== 'Finalized')
			throw new UnprocessableEntityException(
				'Invoice must be finalized before sending',
			)

		await this.prisma.executeTenant(
			tenantSlug,
			`UPDATE invoices SET status = 'Sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
			[invoiceId],
		)
		await this.audit.log({
			tenantSlug,
			eventType: 'INVOICE_SENT',
			actorUserId: userId,
			entityType: 'Invoice',
			entityId: invoiceId,
		})
		return this.getInvoiceById(tenantSlug, invoiceId)
	}

	async voidInvoice(
		tenantSlug: string,
		invoiceId: string,
		dto: VoidInvoiceDto,
		userId: string,
	) {
		const inv = await this.getInvoiceById(tenantSlug, invoiceId)
		if (inv.status === 'Void')
			throw new UnprocessableEntityException('Invoice is already void')
		if (Number(inv.paid_amount) > 0)
			throw new UnprocessableEntityException(
				'Cannot void an invoice with payments',
			)

		await this.prisma.executeTenant(
			tenantSlug,
			`UPDATE invoices SET status = 'Void', void_reason = $1, updated_at = NOW() WHERE id = $2`,
			[dto.reason, invoiceId],
		)
		await this.audit.log({
			tenantSlug,
			eventType: 'INVOICE_VOIDED',
			actorUserId: userId,
			entityType: 'Invoice',
			entityId: invoiceId,
			payload: { reason: dto.reason },
		})
		return this.getInvoiceById(tenantSlug, invoiceId)
	}

	async listInvoices(
		tenantSlug: string,
		caseId?: string,
		customerId?: string,
		status?: string,
		cursor?: string,
		limit = 20,
	) {
		let sql = `SELECT * FROM invoices WHERE 1=1`
		const params: any[] = []
		let idx = 1

		if (caseId) {
			sql += ` AND case_id = $${idx++}`
			params.push(caseId)
		}
		if (customerId) {
			sql += ` AND customer_id = $${idx++}`
			params.push(customerId)
		}
		if (status) {
			sql += ` AND status = $${idx++}`
			params.push(status)
		}
		if (cursor) {
			sql += ` AND created_at < $${idx++}`
			params.push(cursor)
		}

		sql += ` ORDER BY created_at DESC LIMIT $${idx}`
		params.push(limit + 1)

		const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params)
		const hasMore = rows.length > limit
		const data = hasMore ? rows.slice(0, limit) : rows
		return {
			data,
			nextCursor:
				hasMore && data.length > 0 ? data[data.length - 1].created_at : null,
			hasMore,
		}
	}

	async generateInvoicePdf(
		tenantSlug: string,
		invoiceId: string,
	): Promise<Buffer> {
		const invoice = await this.getInvoiceById(tenantSlug, invoiceId)
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const PDFDocument = require('pdfkit')
		return new Promise((resolve) => {
			const doc = new PDFDocument({ size: 'A4', margin: 50 })
			const chunks: Buffer[] = []
			doc.on('data', (chunk: Buffer) => chunks.push(chunk))
			doc.on('end', () => resolve(Buffer.concat(chunks)))

			doc.fontSize(20).text('INVOICE', { align: 'center' })
			doc.moveDown()
			doc.fontSize(12).text(`Invoice #: ${invoice.invoice_number}`)
			doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`)
			doc.text(`Status: ${invoice.status}`)
			doc.text(`Currency: ${invoice.currency}`)
			if (invoice.due_date)
				doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`)
			doc.moveDown()

			doc.text('Line Items:', { underline: true })
			doc.moveDown(0.5)
			for (const item of invoice.lineItems) {
				doc.text(
					`${item.description} — Qty: ${item.quantity} × ${item.unit_price} = ${item.line_total}`,
				)
			}
			doc.moveDown()
			doc.text(`Subtotal: ${invoice.subtotal}`)
			doc.text(`Tax: ${invoice.tax_amount}`)
			doc.fontSize(14).text(`Total: ${invoice.total_amount}`, { bold: true })
			doc.text(`Paid: ${invoice.paid_amount}`)
			doc.text(
				`Balance: ${Number(invoice.total_amount) - Number(invoice.paid_amount)}`,
			)

			if (invoice.notes) {
				doc.moveDown()
				doc.fontSize(10).text(`Notes: ${invoice.notes}`)
			}

			doc.end()
		})
	}

	// ===================== PAYMENTS =====================

	async createPayment(
		tenantSlug: string,
		dto: CreatePaymentDto,
		userId: string,
		idempotencyKey?: string,
	) {
		// Idempotency check
		if (idempotencyKey) {
			const existing: any[] = await this.prisma.queryTenant(
				tenantSlug,
				`SELECT * FROM payments WHERE idempotency_key = $1`,
				[idempotencyKey],
			)
			if (existing?.length) return existing[0]
		}

		const invoice = await this.getInvoiceById(tenantSlug, dto.invoiceId)

		if (invoice.status === 'Void')
			throw new UnprocessableEntityException(
				'Cannot add payment to void invoice',
			)
		if (invoice.status === 'Draft')
			throw new UnprocessableEntityException(
				'Invoice must be finalized before accepting payments',
			)

		const currentPaid = Number(invoice.paid_amount) || 0
		const totalDue = Number(invoice.total_amount)
		if (currentPaid + dto.amount > totalDue) {
			throw new UnprocessableEntityException(
				`Payment would exceed invoice total. Remaining balance: ${totalDue - currentPaid}`,
			)
		}

		const paymentId = uuidv4()
		await this.prisma.executeTenant(
			tenantSlug,
			`INSERT INTO payments (id, invoice_id, amount, method, payment_date, reference, notes, idempotency_key, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
			[
				paymentId,
				dto.invoiceId,
				dto.amount,
				dto.method,
				dto.paymentDate || new Date().toISOString(),
				dto.reference || null,
				dto.notes || null,
				idempotencyKey || null,
				userId,
			],
		)

		// Update invoice paid_amount and status
		const newPaid = currentPaid + dto.amount
		const newStatus = newPaid >= totalDue ? 'Paid' : invoice.status

		await this.prisma.executeTenant(
			tenantSlug,
			`UPDATE invoices SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3`,
			[newPaid, newStatus, dto.invoiceId],
		)

		await this.audit.log({
			tenantSlug,
			eventType: 'PAYMENT_RECORDED',
			actorUserId: userId,
			entityType: 'Payment',
			entityId: paymentId,
			payload: { invoiceId: dto.invoiceId, amount: dto.amount },
		})

		return { id: paymentId, invoiceStatus: newStatus }
	}

	// ===================== EXPENSES =====================

	async createExpense(
		tenantSlug: string,
		dto: CreateExpenseDto,
		userId: string,
	) {
		const expenseId = uuidv4()
		await this.prisma.executeTenant(
			tenantSlug,
			`INSERT INTO expenses (id, case_id, category_id, amount, description, expense_date, receipt_doc_id, status, submitted_by, created_at, updated_at, customer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8, NOW(), NOW(), $9)`,
			[
				expenseId,
				dto.caseId,
				dto.categoryId,
				dto.amount,
				dto.description || null,
				dto.expenseDate || new Date().toISOString(),
				dto.receiptDocId || null,
				userId,
				dto.customerId,
			],
		)

		await this.audit.log({
			tenantSlug,
			eventType: 'EXPENSE_SUBMITTED',
			actorUserId: userId,
			entityType: 'Expense',
			entityId: expenseId,
			payload: { amount: dto.amount },
		})
		return { id: expenseId }
	}

	async approveExpense(
		tenantSlug: string,
		expenseId: string,
		dto: ApproveExpenseDto,
		userId: string,
		userRoles: string[] = [],
	) {
		const rows: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT * FROM expenses WHERE id = $1`,
			[expenseId],
		)
		if (!rows?.length) throw new NotFoundException('Expense not found')
		if (rows[0].status === 'Approved')
			throw new UnprocessableEntityException('Expense already approved')
		if (rows[0].status === 'Rejected')
			throw new UnprocessableEntityException('Expense was rejected')

		// Get active workflow to determine steps & required approver roles
		const workflows: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT * FROM expense_approval_workflows WHERE is_active = true LIMIT 1`,
			[],
		)
		const approvals: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT * FROM expense_approvals WHERE expense_id = $1 ORDER BY step_order`,
			[expenseId],
		)

		const nextStep = (approvals?.length || 0) + 1
		const workflowSteps = workflows?.length
			? typeof workflows[0].steps === 'string'
				? JSON.parse(workflows[0].steps)
				: workflows[0].steps
			: []
		const isLastStep = !workflowSteps.length || nextStep >= workflowSteps.length

		// Validate approver role matches workflow step config
		if (workflowSteps.length > 0) {
			const stepConfig = workflowSteps.find(
				(s: any) => s.stepOrder === nextStep,
			)
			if (
				stepConfig?.approverRole &&
				!userRoles.includes(stepConfig.approverRole)
			) {
				throw new ForbiddenException(
					`Step ${nextStep} requires role '${stepConfig.approverRole}'. Your roles: ${userRoles.join(', ')}`,
				)
			}
		}

		await this.prisma.executeTenant(
			tenantSlug,
			`INSERT INTO expense_approvals (id, expense_id, step_order, approver_user_id, approver_role, decision, comment, decided_at)
       VALUES ($1, $2, $3, $4, $5, 'Approved', $6, NOW())`,
			[
				uuidv4(),
				expenseId,
				nextStep,
				userId,
				userRoles[0] || null,
				dto.comment || null,
			],
		)

		if (isLastStep) {
			await this.prisma.executeTenant(
				tenantSlug,
				`UPDATE expenses SET status = 'Approved', updated_at = NOW() WHERE id = $1`,
				[expenseId],
			)
		}

		await this.audit.log({
			tenantSlug,
			eventType: 'EXPENSE_APPROVED',
			actorUserId: userId,
			entityType: 'Expense',
			entityId: expenseId,
			payload: { step: nextStep, final: isLastStep },
		})
		return { approved: isLastStep, step: nextStep }
	}

	async rejectExpense(
		tenantSlug: string,
		expenseId: string,
		dto: RejectExpenseDto,
		userId: string,
	) {
		const rows: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT * FROM expenses WHERE id = $1`,
			[expenseId],
		)
		if (!rows?.length) throw new NotFoundException('Expense not found')

		const approvals: any[] = await this.prisma.queryTenant(
			tenantSlug,
			`SELECT * FROM expense_approvals WHERE expense_id = $1 ORDER BY step_order`,
			[expenseId],
		)
		const nextStep = (approvals?.length || 0) + 1

		await this.prisma.executeTenant(
			tenantSlug,
			`INSERT INTO expense_approvals (id, expense_id, step_order, approver_user_id, decision, comment, decided_at)
       VALUES ($1, $2, $3, $4, 'Rejected', $5, NOW())`,
			[uuidv4(), expenseId, nextStep, userId, dto.reason],
		)

		await this.prisma.executeTenant(
			tenantSlug,
			`UPDATE expenses SET status = 'Rejected', updated_at = NOW() WHERE id = $1`,
			[expenseId],
		)
		await this.audit.log({
			tenantSlug,
			eventType: 'EXPENSE_REJECTED',
			actorUserId: userId,
			entityType: 'Expense',
			entityId: expenseId,
			payload: { reason: dto.reason },
		})
		return { rejected: true }
	}

	async listExpenses(
		tenantSlug: string,
		caseId?: string,
		status?: string,
		cursor?: string,
		limit = 20,
	) {
		let sql = `SELECT * FROM expenses WHERE 1=1`
		const params: any[] = []
		let idx = 1
		if (caseId) {
			sql += ` AND case_id = $${idx++}`
			params.push(caseId)
		}
		if (status) {
			sql += ` AND status = $${idx++}`
			params.push(status)
		}
		if (cursor) {
			sql += ` AND created_at < $${idx++}`
			params.push(cursor)
		}
		sql += ` ORDER BY created_at DESC LIMIT $${idx}`
		params.push(limit + 1)

		const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params)
		const hasMore = rows.length > limit
		const data = hasMore ? rows.slice(0, limit) : rows
		return {
			data,
			nextCursor:
				hasMore && data.length > 0 ? data[data.length - 1].created_at : null,
			hasMore,
		}
	}

	// ===================== WAGES =====================

	async createWage(tenantSlug: string, dto: CreateWageDto, userId: string) {
		const wageId = uuidv4()
		const grossAmount = dto.grossAmount ?? dto.amount;
		const deductions = dto.deductions ?? 0;
		const netAmount = dto.netAmount ?? (grossAmount - deductions);
		await this.prisma.executeTenant(
			tenantSlug,
			`INSERT INTO wages (id, user_id, amount, period, notes, staff_name, deductions, gross_amount, net_amount, payment_status, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
			[wageId, dto.userId, dto.amount, dto.period, dto.notes || null,
			 dto.staffName || null, deductions, grossAmount, netAmount, dto.paymentStatus || 'Pending', userId],
		)
		await this.audit.log({
			tenantSlug,
			eventType: 'WAGE_RECORDED',
			actorUserId: userId,
			entityType: 'Wage',
			entityId: wageId,
			payload: { amount: dto.amount, period: dto.period },
		})
		return { id: wageId }
	}

	async listWages(tenantSlug: string, userIdFilter?: string, period?: string) {
		let sql = `SELECT * FROM wages WHERE 1=1`
		const params: any[] = []
		let idx = 1
		if (userIdFilter) {
			sql += ` AND user_id = $${idx++}`
			params.push(userIdFilter)
		}
		if (period) {
			sql += ` AND period = $${idx++}`
			params.push(period)
		}
		sql += ` ORDER BY created_at DESC`
		return this.prisma.queryTenant(tenantSlug, sql, params)
	}

	async exportWagesCsv(tenantSlug: string, period?: string): Promise<string> {
		const wages = await this.listWages(tenantSlug, undefined, period)
		const rows = (wages as any[]) || []
		let csv = 'ID,User ID,Amount,Period,Notes,Created At\n'
		for (const w of rows) {
			csv += `${w.id},${w.user_id},${w.amount},${w.period},"${(w.notes || '').replace(/"/g, '""')}",${w.created_at}\n`
		}
		return csv
	}

	// ===================== UPDATE METHODS =====================

	async updateWage(tenantSlug: string, wageId: string, dto: UpdateWageDto, userId: string) {
		const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM wages WHERE id = $1`, [wageId])
		if (!rows?.length) throw new NotFoundException('Wage not found')

		const sets: string[] = []
		const params: any[] = []
		let idx = 1
		if (dto.amount !== undefined) { sets.push(`amount = $${idx++}`); params.push(dto.amount) }
		if (dto.period !== undefined) { sets.push(`period = $${idx++}`); params.push(dto.period) }
		if (dto.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(dto.notes) }
		if (dto.staffName !== undefined) { sets.push(`staff_name = $${idx++}`); params.push(dto.staffName) }
		if (dto.deductions !== undefined) { sets.push(`deductions = $${idx++}`); params.push(dto.deductions) }
		if (dto.grossAmount !== undefined) { sets.push(`gross_amount = $${idx++}`); params.push(dto.grossAmount) }
		if (dto.netAmount !== undefined) { sets.push(`net_amount = $${idx++}`); params.push(dto.netAmount) }
		if (dto.paymentStatus !== undefined) { sets.push(`payment_status = $${idx++}`); params.push(dto.paymentStatus) }
		if (sets.length === 0) return rows[0]

		params.push(wageId)
		await this.prisma.executeTenant(tenantSlug, `UPDATE wages SET ${sets.join(', ')} WHERE id = $${idx}`, params)
		await this.audit.log({ tenantSlug, eventType: 'WAGE_UPDATED', actorUserId: userId, entityType: 'Wage', entityId: wageId, payload: dto })
		const updated = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM wages WHERE id = $1`, [wageId])
		return updated[0]
	}

	async updateExpense(tenantSlug: string, expenseId: string, dto: UpdateExpenseDto, userId: string) {
		const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM expenses WHERE id = $1`, [expenseId])
		if (!rows?.length) throw new NotFoundException('Expense not found')
		if (rows[0].status !== 'Pending') throw new UnprocessableEntityException('Only pending expenses can be edited')

		const sets: string[] = ['updated_at = NOW()']
		const params: any[] = []
		let idx = 1
		if (dto.caseId !== undefined) { sets.push(`case_id = $${idx++}`); params.push(dto.caseId) }
		if (dto.categoryId !== undefined) { sets.push(`category_id = $${idx++}`); params.push(dto.categoryId) }
		if (dto.customerId !== undefined) { sets.push(`customer_id = $${idx++}`); params.push(dto.customerId) }
		if (dto.amount !== undefined) { sets.push(`amount = $${idx++}`); params.push(dto.amount) }
		if (dto.description !== undefined) { sets.push(`description = $${idx++}`); params.push(dto.description) }
		if (dto.expenseDate !== undefined) { sets.push(`expense_date = $${idx++}`); params.push(dto.expenseDate) }
		if (dto.receiptDocId !== undefined) { sets.push(`receipt_doc_id = $${idx++}`); params.push(dto.receiptDocId) }

		params.push(expenseId)
		await this.prisma.executeTenant(tenantSlug, `UPDATE expenses SET ${sets.join(', ')} WHERE id = $${idx}`, params)
		await this.audit.log({ tenantSlug, eventType: 'EXPENSE_UPDATED', actorUserId: userId, entityType: 'Expense', entityId: expenseId, payload: dto })
		const updated = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM expenses WHERE id = $1`, [expenseId])
		return updated[0]
	}

	async updateInvoice(tenantSlug: string, invoiceId: string, dto: UpdateInvoiceDto, userId: string) {
		const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM invoices WHERE id = $1`, [invoiceId])
		if (!rows?.length) throw new NotFoundException('Invoice not found')
		if (rows[0].status !== 'Draft') throw new UnprocessableEntityException('Only draft invoices can be edited')

		const sets: string[] = ['updated_at = NOW()']
		const params: any[] = []
		let idx = 1
		if (dto.currency !== undefined) { sets.push(`currency = $${idx++}`); params.push(dto.currency) }
		if (dto.dueDate !== undefined) { sets.push(`due_date = $${idx++}`); params.push(dto.dueDate) }
		if (dto.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(dto.notes) }
		if (dto.discountRatePct !== undefined) { sets.push(`discount_rate_pct = $${idx++}`); params.push(dto.discountRatePct) }

		params.push(invoiceId)
		await this.prisma.executeTenant(tenantSlug, `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${idx}`, params)

		// Update line items if provided
		if (dto.lineItems) {
			await this.prisma.executeTenant(tenantSlug, `DELETE FROM invoice_line_items WHERE invoice_id = $1`, [invoiceId])
			for (const li of dto.lineItems) {
				await this.prisma.executeTenant(
					tenantSlug,
					`INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price, tax_rate) VALUES ($1, $2, $3, $4, $5, $6)`,
					[uuidv4(), invoiceId, li.description, li.quantity, li.unitPrice, li.taxRate || 0],
				)
			}
			// Recalculate totals
			const items: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM invoice_line_items WHERE invoice_id = $1`, [invoiceId])
			const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
			const discount = dto.discountRatePct ?? rows[0].discount_rate_pct ?? 0
			const taxTotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price * (i.tax_rate / 100), 0)
			const totalAmount = subtotal - (subtotal * discount / 100) + taxTotal
			await this.prisma.executeTenant(tenantSlug, `UPDATE invoices SET subtotal = $1, tax_total = $2, total_amount = $3, updated_at = NOW() WHERE id = $4`, [subtotal, taxTotal, totalAmount, invoiceId])
		}

		await this.audit.log({ tenantSlug, eventType: 'INVOICE_UPDATED', actorUserId: userId, entityType: 'Invoice', entityId: invoiceId, payload: dto })
		return this.getInvoiceById(tenantSlug, invoiceId)
	}

	async updatePayment(tenantSlug: string, paymentId: string, dto: UpdatePaymentDto, userId: string) {
		const rows: any[] = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM payments WHERE id = $1`, [paymentId])
		if (!rows?.length) throw new NotFoundException('Payment not found')

		const sets: string[] = ['updated_at = NOW()']
		const params: any[] = []
		let idx = 1
		if (dto.amount !== undefined) { sets.push(`amount = $${idx++}`); params.push(dto.amount) }
		if (dto.method !== undefined) { sets.push(`method = $${idx++}`); params.push(dto.method) }
		if (dto.paymentDate !== undefined) { sets.push(`payment_date = $${idx++}`); params.push(dto.paymentDate) }
		if (dto.reference !== undefined) { sets.push(`reference = $${idx++}`); params.push(dto.reference) }
		if (dto.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(dto.notes) }

		params.push(paymentId)
		await this.prisma.executeTenant(tenantSlug, `UPDATE payments SET ${sets.join(', ')} WHERE id = $${idx}`, params)
		await this.audit.log({ tenantSlug, eventType: 'PAYMENT_UPDATED', actorUserId: userId, entityType: 'Payment', entityId: paymentId, payload: dto })
		const updated = await this.prisma.queryTenant(tenantSlug, `SELECT * FROM payments WHERE id = $1`, [paymentId])
		return updated[0]
	}
}
