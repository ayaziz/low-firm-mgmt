import { get, post, downloadBlob } from './client';
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

  finalizeInvoice(id: string, rowVersion: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/finalize`, { rowVersion });
  },

  sendInvoice(id: string, rowVersion: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/send`, { rowVersion });
  },

  voidInvoice(id: string, reason: string, rowVersion: string): Promise<Invoice> {
    return post<Invoice>(`/invoices/${id}/void`, { reason, rowVersion });
  },

  downloadInvoicePdf(id: string): Promise<void> {
    return downloadBlob(`/invoices/${id}/pdf`, `invoice-${id}.pdf`);
  },

  // Payments
  createPayment(data: {
    invoiceId: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
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
    category: string;
    amount: number;
    description: string;
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
    baseAmount: number;
    bonusAmount?: number;
    deductions?: number;
    notes?: string;
  }): Promise<Wage> {
    return post<Wage>('/wages', data);
  },

  exportWagesCsv(period?: string): Promise<void> {
    const params = period ? `?period=${period}` : '';
    return downloadBlob(`/wages/export${params}`, `wages-${period || 'all'}.csv`);
  },
};
