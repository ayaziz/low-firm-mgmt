import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* ───── Operational Reports ───── */

  async casesByState(tenantSlug: string, filters: { caseTypeId?: string; assignedLawyerUserId?: string }) {
    const conditions = ['1=1'];
    const params: any[] = [];
    let idx = 1;
    if (filters.caseTypeId) { conditions.push(`case_type_id = $${idx++}`); params.push(filters.caseTypeId); }
    if (filters.assignedLawyerUserId) { conditions.push(`assigned_lawyer_user_id = $${idx++}`); params.push(filters.assignedLawyerUserId); }

    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT state AS key, COUNT(*)::int AS count
       FROM cases WHERE ${conditions.join(' AND ')}
       GROUP BY state ORDER BY count DESC`
    , params);
    return { groups: rows };
  }

  async casesByType(tenantSlug: string) {
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT ct.label_en AS key, COUNT(c.id)::int AS count
       FROM cases c JOIN case_types ct ON c.case_type_id = ct.id
        WHERE 1=1
        GROUP BY ct.label_en ORDER BY count DESC`);
    return { groups: rows };
  }

  async casesByOwner(tenantSlug: string) {
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT c.assigned_lawyer_user_id AS key, COUNT(*)::int AS count
       FROM cases c
      WHERE c.assigned_lawyer_user_id IS NOT NULL
       GROUP BY c.assigned_lawyer_user_id ORDER BY count DESC`);
    return { groups: rows };
  }

  async overdueTasks(tenantSlug: string, filters: { assigneeUserId?: string; caseId?: string; priority?: string }) {
    const conditions = ["t.status NOT IN ('Done', 'Cancelled')", 't.due_date < NOW()'];
    const params: any[] = [];
    let idx = 1;
    if (filters.assigneeUserId) { conditions.push(`t.assignee_user_id = $${idx++}`); params.push(filters.assigneeUserId); }
    if (filters.caseId) { conditions.push(`t.case_id = $${idx++}`); params.push(filters.caseId); }
    if (filters.priority) { conditions.push(`t.priority = $${idx++}`); params.push(filters.priority); }

    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT t.id AS task_id, t.title, c.system_case_ref AS case_ref,
              t.assignee_user_id AS assignee, t.due_date,
              EXTRACT(DAY FROM NOW() - t.due_date)::int AS days_overdue,
              t.priority, t.status
       FROM tasks t LEFT JOIN cases c ON t.case_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.due_date ASC LIMIT 100`, params);
    return { tasks: rows };
  }

  async upcomingSessions(tenantSlug: string, days = 7, filters: { caseId?: string; userId?: string }) {
    const conditions = ["s.status IN ('Planned', 'Postponed')", `s.start_date_time <= NOW() + INTERVAL '${days} days'`, 's.start_date_time >= NOW()'];
    const params: any[] = [];
    let idx = 1;
    if (filters.caseId) { conditions.push(`s.case_id = $${idx++}`); params.push(filters.caseId); }

    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT s.id AS session_id, s.title, c.system_case_ref AS case_ref,
              s.start_date_time, s.end_date_time, s.location, s.status
       FROM sessions s LEFT JOIN cases c ON s.case_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.start_date_time ASC LIMIT 100`, params);
    return { sessions: rows };
  }

  async completenessGaps(tenantSlug: string, entityType: string = 'customer', thresholdPct = 80) {
    // Return customers or cases with low completeness
    if (entityType === 'customer') {
      const rows = await this.prisma.queryTenant(tenantSlug,
        `SELECT id, name, completeness_pct FROM customers
         WHERE deleted_at IS NULL AND completeness_pct < $1
         ORDER BY completeness_pct ASC LIMIT 100`, [thresholdPct]);
      return { items: rows.map((r: any) => ({ entityType: 'customer', entityId: r.id, name: r.name, completenessPct: r.completeness_pct })) };
    }
    // For cases, we compute on-the-fly via completeness_pct if stored, or just return all
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT id, title AS name, completeness_pct FROM cases
        WHERE COALESCE(completeness_pct, 0) < $1
       ORDER BY completeness_pct ASC LIMIT 100`, [thresholdPct]);
    return { items: rows.map((r: any) => ({ entityType: 'case', entityId: r.id, name: r.name, completenessPct: r.completeness_pct || 0 })) };
  }

  /* ───── Financial Reports ───── */

  async receivables(tenantSlug: string, filters: { customerId?: string; status?: string }) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (filters.customerId) { conditions.push(`i.customer_id = $${idx++}`); params.push(filters.customerId); }
    if (filters.status) { conditions.push(`i.status = $${idx++}`); params.push(filters.status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT i.customer_id, COUNT(i.id)::int AS invoice_count,
              SUM(i.total_amount)::numeric AS total_amount,
              SUM(i.paid_amount)::numeric AS paid_amount,
              SUM(i.total_amount - i.paid_amount)::numeric AS outstanding_amount
       FROM invoices i ${where}
       GROUP BY i.customer_id`, params);

    const totals = rows.reduce((acc: any, r: any) => ({
      invoiceCount: acc.invoiceCount + r.invoice_count,
      totalAmount: acc.totalAmount + parseFloat(r.total_amount || 0),
      paidAmount: acc.paidAmount + parseFloat(r.paid_amount || 0),
      outstandingAmount: acc.outstandingAmount + parseFloat(r.outstanding_amount || 0),
    }), { invoiceCount: 0, totalAmount: 0, paidAmount: 0, outstandingAmount: 0 });

    return { rows, totals };
  }

  async cashflow(tenantSlug: string, startMonth?: string, endMonth?: string) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (startMonth) { conditions.push(`TO_CHAR(p.payment_date, 'YYYY-MM') >= $${idx++}`); params.push(startMonth); }
    if (endMonth) { conditions.push(`TO_CHAR(p.payment_date, 'YYYY-MM') <= $${idx++}`); params.push(endMonth); }

    const paymentWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const paymentRows = await this.prisma.queryTenant(tenantSlug,
      `SELECT TO_CHAR(p.payment_date, 'YYYY-MM') AS period,
              SUM(p.amount)::numeric AS received
       FROM payments p ${paymentWhere}
       GROUP BY period ORDER BY period`, params);

    const expenseRows = await this.prisma.queryTenant(tenantSlug,
      `SELECT TO_CHAR(e.created_at, 'YYYY-MM') AS period,
              SUM(e.amount)::numeric AS expenses
       FROM expenses e WHERE e.status = 'Approved'
       GROUP BY period ORDER BY period`);

    // Merge into months
    const months = new Map<string, any>();
    for (const p of paymentRows) {
      months.set(p.period, { period: p.period, invoiced: 0, received: parseFloat(p.received), expenses: 0, net: 0 });
    }
    for (const e of expenseRows) {
      const m = months.get(e.period) || { period: e.period, invoiced: 0, received: 0, expenses: 0, net: 0 };
      m.expenses = parseFloat(e.expenses);
      months.set(e.period, m);
    }
    const result = Array.from(months.values()).map(m => ({ ...m, net: m.received - m.expenses }));
    result.sort((a, b) => a.period.localeCompare(b.period));
    return { months: result };
  }

  async expensesByCategory(tenantSlug: string, filters: { status?: string }) {
    const condition = filters.status ? `AND e.status = $1` : '';
    const params = filters.status ? [filters.status] : [];

    const rows = await this.prisma.queryTenant(tenantSlug,
      `SELECT e.category_id AS category, COUNT(e.id)::int AS count, SUM(e.amount)::numeric AS total_amount
       FROM expenses e
       WHERE 1=1 ${condition}
       GROUP BY e.category_id ORDER BY total_amount DESC`, params);

    const total = rows.reduce((acc: number, r: any) => acc + parseFloat(r.total_amount || 0), 0);
    return { categories: rows, total };
  }

  /* ───── KPI Dashboard ───── */

  async kpiDashboard(tenantSlug: string) {
    // Run all queries in parallel for performance
    const [
      caseStats,
      invoiceStats,
      paymentStats,
      expenseStats,
      wageStats,
      overdueTaskCount,
      upcomingSessionCount,
      recentActivity,
    ] = await Promise.all([
      // Cases
      this.prisma.queryTenant(tenantSlug,
        `SELECT
           COUNT(*)::int AS total_cases,
           COUNT(*) FILTER (WHERE state NOT IN ('Closed', 'Archived'))::int AS open_cases,
           COUNT(*) FILTER (WHERE state = 'Closed')::int AS closed_cases,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_cases_30d
         FROM cases`),
      // Invoices
      this.prisma.queryTenant(tenantSlug,
        `SELECT
           COUNT(*)::int AS total_invoices,
           COALESCE(SUM(total_amount), 0)::numeric AS total_invoiced,
           COALESCE(SUM(paid_amount), 0)::numeric AS total_collected,
           COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE status IN ('Sent', 'Finalized', 'Approved')), 0)::numeric AS outstanding,
           COUNT(*) FILTER (WHERE status = 'Draft')::int AS draft_invoices,
           COUNT(*) FILTER (WHERE due_date < NOW() AND status IN ('Sent', 'Finalized', 'Approved') AND paid_amount < total_amount)::int AS overdue_invoices
         FROM invoices`),
      // Payments (last 30 days)
      this.prisma.queryTenant(tenantSlug,
        `SELECT COALESCE(SUM(amount), 0)::numeric AS collected_30d
         FROM payments WHERE payment_date >= NOW() - INTERVAL '30 days'`),
      // Expenses
      this.prisma.queryTenant(tenantSlug,
        `SELECT
           COUNT(*)::int AS total_expenses,
           COALESCE(SUM(amount), 0)::numeric AS total_expense_amount,
           COALESCE(SUM(amount) FILTER (WHERE status = 'Approved'), 0)::numeric AS approved_expense_amount,
           COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_expenses
         FROM expenses`),
      // Wages
      this.prisma.queryTenant(tenantSlug,
        `SELECT
           COUNT(*)::int AS total_wages,
           COALESCE(SUM(net_amount), 0)::numeric AS total_wage_amount,
           COUNT(*) FILTER (WHERE payment_status IN ('Submitted'))::int AS pending_approval_wages,
           COUNT(*) FILTER (WHERE payment_status = 'Approved')::int AS approved_wages
         FROM wages`),
      // Overdue tasks
      this.prisma.queryTenant(tenantSlug,
        `SELECT COUNT(*)::int AS count FROM tasks WHERE status NOT IN ('Done', 'Cancelled') AND due_date < NOW()`),
      // Upcoming sessions (next 7 days)
      this.prisma.queryTenant(tenantSlug,
        `SELECT COUNT(*)::int AS count FROM sessions WHERE status IN ('Planned', 'Postponed') AND start_date_time >= NOW() AND start_date_time <= NOW() + INTERVAL '7 days'`),
      // Recent activity count (last 24h)
      this.prisma.queryTenant(tenantSlug,
        `SELECT COUNT(*)::int AS count FROM audit_events WHERE created_at >= NOW() - INTERVAL '24 hours'`),
    ]);

    const cases = caseStats[0] || {};
    const invoices = invoiceStats[0] || {};
    const payments = paymentStats[0] || {};
    const expenses = expenseStats[0] || {};
    const wages = wageStats[0] || {};

    return {
      cases: {
        total: cases.total_cases || 0,
        open: cases.open_cases || 0,
        closed: cases.closed_cases || 0,
        newLast30Days: cases.new_cases_30d || 0,
      },
      invoices: {
        total: invoices.total_invoices || 0,
        totalInvoiced: parseFloat(invoices.total_invoiced || 0),
        totalCollected: parseFloat(invoices.total_collected || 0),
        outstanding: parseFloat(invoices.outstanding || 0),
        draftCount: invoices.draft_invoices || 0,
        overdueCount: invoices.overdue_invoices || 0,
        collectedLast30Days: parseFloat(payments.collected_30d || 0),
      },
      expenses: {
        total: expenses.total_expenses || 0,
        totalAmount: parseFloat(expenses.total_expense_amount || 0),
        approvedAmount: parseFloat(expenses.approved_expense_amount || 0),
        pendingCount: expenses.pending_expenses || 0,
      },
      wages: {
        total: wages.total_wages || 0,
        totalAmount: parseFloat(wages.total_wage_amount || 0),
        pendingApproval: wages.pending_approval_wages || 0,
        approved: wages.approved_wages || 0,
      },
      tasks: {
        overdueCount: overdueTaskCount[0]?.count || 0,
      },
      sessions: {
        upcomingCount: upcomingSessionCount[0]?.count || 0,
      },
      activity: {
        last24h: recentActivity[0]?.count || 0,
      },
    };
  }

  /* ───── CSV Export ───── */

  async exportCsv(tenantSlug: string, reportType: string, filters: any, actorId: string): Promise<string> {
    let data: any;
    switch (reportType) {
      case 'cases-by-state': data = await this.casesByState(tenantSlug, filters); break;
      case 'cases-by-type': data = await this.casesByType(tenantSlug); break;
      case 'cases-by-owner': data = await this.casesByOwner(tenantSlug); break;
      case 'overdue-tasks': data = await this.overdueTasks(tenantSlug, filters); break;
      case 'upcoming-sessions': data = await this.upcomingSessions(tenantSlug, filters.days, filters); break;
      case 'completeness-gaps': data = await this.completenessGaps(tenantSlug, filters.entityType, filters.thresholdPct); break;
      case 'receivables': data = await this.receivables(tenantSlug, filters); break;
      case 'cashflow': data = await this.cashflow(tenantSlug, filters.startMonth, filters.endMonth); break;
      case 'expenses-by-category': data = await this.expensesByCategory(tenantSlug, filters); break;
      default: return '';
    }

    // Audit the export
    await this.audit.log({
      tenantSlug,
      eventType: 'EXPORT_GENERATED',
      actorUserId: actorId,
      entityType: 'Report',
      entityId: reportType,
      payload: { type: 'reportCsv', reportType, filters },
    });

    return this.toCsv(data);
  }

  private toCsv(data: any): string {
    // Flatten the first array-like property in data
    const arrays = Object.values(data).filter(v => Array.isArray(v)) as any[][];
    const rows = arrays[0] || [];
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','));
    }
    return lines.join('\n');
  }
}
