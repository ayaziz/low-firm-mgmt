import { get, post, patch, downloadBlob } from './client';
import type { Invoice, Payment, Expense, Wage, PaginatedResult } from '@/types';

export const accountingApi = {
  // Invoices
  listInvoices(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Invoice>> {
    return get<PaginatedResult<Invoice>>('/invoices', params);
  },

  getInvoice(id: string): Promise<Invoice> {
    return get(`/invoices/${id}`);
  },

  createInvoice(data: {
    caseId: string;
    customerId: string;
    dueDate: string;
    notes?: string;
    lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
  }): Promise<Invoice> {
    return post<Invoice>('/invoices', data);
  },

  finalizeInvoice(id: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/finalize`);
  },

  sendInvoice(id: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/send`);
  },

  voidInvoice(id: string, reason: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/void`, { reason });
  },

  downloadInvoicePdf(id: string): Promise<void> {
    return downloadBlob(`/invoices/${id}/pdf`, `invoice-${id}.pdf`);
  },

  // Payments
  createPayment(data: {
    invoiceId: string;
    amount: number;
    method: string;
    paymentDate?: string;
    reference?: string;
    notes?: string;
  }): Promise<Payment> {
    const idempotencyKey = crypto.randomUUID();
    return post<Payment>('/payments', data, {
      'Idempotency-Key': idempotencyKey,
    });
  },

  // Expenses
  listExpenses(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Expense>> {
    return get<PaginatedResult<Expense>>('/expenses', params);
  },

  createExpense(data: {
    caseId?: string;
    categoryId: string;
    customerId: string;
    amount: number;
    description?: string;
    expenseDate?: string;
  }): Promise<Expense> {
    return post<Expense>('/expenses', data);
  },

  approveExpense(id: string): Promise<Expense> {
    return post<Expense>(`/expenses/${id}/approve`);
  },

  rejectExpense(id: string, reason: string): Promise<Expense> {
    return post<Expense>(`/expenses/${id}/reject`, { reason });
  },

  // Wages
  listWages(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Wage>> {
    return get<PaginatedResult<Wage>>('/wages', params);
  },

  createWage(data: {
    userId: string;
    period: string;
    amount: number;
    notes?: string;
    staffName?: string;
    deductions?: number;
    grossAmount?: number;
    netAmount?: number;
    paymentStatus?: string;
  }): Promise<Wage> {
    return post<Wage>('/wages', data);
  },

  exportWagesCsv(period?: string): Promise<void> {
    const params = period ? `?period=${period}` : '';
    return downloadBlob(`/wages/export${params}`, `wages-${period || 'all'}.csv`);
  },

  // Wage approval flow
  submitWage(id: string, comment?: string): Promise<Wage> {
    return post<Wage>(`/wages/${id}/submit`, { comment });
  },
  approveWage(id: string, comment?: string): Promise<Wage> {
    return post<Wage>(`/wages/${id}/approve`, { comment });
  },
  rejectWage(id: string, reason: string): Promise<Wage> {
    return post<Wage>(`/wages/${id}/reject`, { reason });
  },
  markWagePaid(id: string, comment?: string): Promise<Wage> {
    return post<Wage>(`/wages/${id}/mark-paid`, { comment });
  },

  // Invoice review flow
  submitInvoiceForReview(id: string, comment?: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/submit-for-review`, { comment });
  },
  approveInvoiceReview(id: string, comment?: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/approve-review`, { comment });
  },
  rejectInvoiceReview(id: string, reason: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/reject-review`, { reason });
  },

  // Update methods
  updateWage(id: string, data: Partial<{
    amount: number; period: string; notes: string;
    staffName: string; deductions: number; grossAmount: number;
    netAmount: number; paymentStatus: string;
  }>): Promise<Wage> {
    return patch<Wage>(`/wages/${id}`, data);
  },

  updateExpense(id: string, data: Partial<{
    caseId: string; categoryId: string; customerId: string;
    amount: number; description: string; expenseDate: string;
  }>): Promise<Expense> {
    return patch<Expense>(`/expenses/${id}`, data);
  },

  updateInvoice(id: string, data: Partial<{
    currency: string; dueDate: string; notes: string; discountRatePct: number;
    lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
  }>): Promise<Invoice> {
    return patch<Invoice>(`/invoices/${id}`, data);
  },

  updatePayment(id: string, data: Partial<{
    amount: number; method: string; paymentDate: string;
    reference: string; notes: string;
  }>): Promise<Payment> {
    return patch<Payment>(`/payments/${id}`, data);
  },
};
