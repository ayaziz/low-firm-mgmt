import { get, post, patch, del } from './client';
import type { Customer, Contact, Address, PaginatedResult } from '@/types';

export const customerApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Customer>> {
    return get<PaginatedResult<Customer>>('/customers', params);
  },

  getById(id: string): Promise<Customer & { contacts: Contact[]; addresses: Address[] }> {
    return get(`/customers/${id}`);
  },

  create(data: Partial<Customer>): Promise<Customer> {
    return post<Customer>('/customers', data);
  },

  update(id: string, data: Partial<Customer>): Promise<Customer> {
    return patch<Customer>(`/customers/${id}`, data);
  },

  // Contacts
  addContact(customerId: string, data: Partial<Contact>): Promise<Contact> {
    return post<Contact>(`/customers/${customerId}/contacts`, data);
  },

  updateContact(customerId: string, contactId: string, data: Partial<Contact>): Promise<Contact> {
    return patch<Contact>(`/customers/${customerId}/contacts/${contactId}`, data);
  },

  deleteContact(customerId: string, contactId: string): Promise<void> {
    return del(`/customers/${customerId}/contacts/${contactId}`);
  },

  // Addresses
  addAddress(customerId: string, data: Partial<Address>): Promise<Address> {
    return post<Address>(`/customers/${customerId}/addresses`, data);
  },

  updateAddress(customerId: string, addressId: string, data: Partial<Address>): Promise<Address> {
    return patch<Address>(`/customers/${customerId}/addresses/${addressId}`, data);
  },

  deleteAddress(customerId: string, addressId: string): Promise<void> {
    return del(`/customers/${customerId}/addresses/${addressId}`);
  },

  // Financial summary
  getFinancialSummary(customerId: string): Promise<{ totalInvoiced: number; totalPaid: number; outstanding: number }> {
    return get(`/customers/${customerId}/financial-summary`);
  },

  // Compliance checklist
  getChecklist(customerId: string): Promise<{ items: Array<{ id: string; label: string; is_met: boolean }> }> {
    return get(`/customers/${customerId}/compliance-checklist`);
  },

  toggleChecklistItem(customerId: string, itemId: string, isMet: boolean): Promise<void> {
    return patch(`/customers/${customerId}/compliance-checklist/${itemId}`, { isMet });
  },
};
