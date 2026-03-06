import { get, post, patch, del } from './client';
import type { Customer, Contact, Address, PaginatedResult } from '@/types';

export const customerApi = {
	list(
		params?: Record<string, string | number | boolean | undefined>,
	): Promise<PaginatedResult<Customer>> {
		return get<PaginatedResult<Customer>>('/customers', params)
	},

	getById(
		id: string,
	): Promise<Customer & { contacts: Contact[]; addresses: Address[] }> {
		return get(`/customers/${id}`)
	},

	create(data: Partial<Customer>): Promise<Customer> {
		// Map snake_case Customer fields → camelCase CreateCustomerDto
		const { customer_type, national_id, passport_number, registration_id, tax_id, ...rest } = data as any;
		const payload: Record<string, unknown> = { ...rest };
		if (customer_type !== undefined) payload.customerType = customer_type;
		if (national_id !== undefined) payload.nationalId = national_id;
		if (passport_number !== undefined) payload.passportNumber = passport_number;
		if (registration_id !== undefined) payload.registrationId = registration_id;
		if (tax_id !== undefined) payload.taxId = tax_id;
		return post<Customer>('/customers', payload)
	},

	update(id: string, data: Partial<Customer>): Promise<Customer> {
		// Map snake_case Customer fields → camelCase UpdateCustomerDto
		// Strip fields not accepted by UpdateCustomerDto (forbidNonWhitelisted=true)
		const { national_id, passport_number, registration_id, tax_id,
				row_version, contacts, addresses, id: _id,
				created_at, updated_at, customer_type, ...rest } = data as any;
		const payload: Record<string, unknown> = { ...rest };
		if (national_id !== undefined) payload.nationalId = national_id;
		if (passport_number !== undefined) payload.passportNumber = passport_number;
		if (registration_id !== undefined) payload.registrationId = registration_id;
		if (tax_id !== undefined) payload.taxId = tax_id;
		if (row_version !== undefined) payload.rowVersion = row_version;
		return patch<Customer>(`/customers/${id}`, payload)
	},

	// Contacts
	addContact(customerId: string, data: Partial<Contact>): Promise<Contact> {
		return post<Contact>(`/customers/${customerId}/contacts`, data)
	},

	updateContact(
		customerId: string,
		contactId: string,
		data: Partial<Contact>,
	): Promise<Contact> {
		return patch<Contact>(
			`/customers/${customerId}/contacts/${contactId}`,
			data,
		)
	},

	deleteContact(customerId: string, contactId: string): Promise<void> {
		return del(`/customers/${customerId}/contacts/${contactId}`)
	},

	// Addresses
	addAddress(customerId: string, data: Partial<Address>): Promise<Address> {
		return post<Address>(`/customers/${customerId}/addresses`, data)
	},

	updateAddress(
		customerId: string,
		addressId: string,
		data: Partial<Address>,
	): Promise<Address> {
		return patch<Address>(
			`/customers/${customerId}/addresses/${addressId}`,
			data,
		)
	},

	deleteAddress(customerId: string, addressId: string): Promise<void> {
		return del(`/customers/${customerId}/addresses/${addressId}`)
	},

	// Financial summary
	getFinancialSummary(customerId: string): Promise<{
		last_payment_date: string | null
		overdue: number
		paid: number
		outstanding: number
	}> {
		return get(`/customers/${customerId}/financial-summary`)
	},

	// Compliance checklist
	getChecklist(
		customerId: string,
	): Promise<{ items: Array<{ id: string; label: string; is_met: boolean }> }> {
		return get(`/customers/${customerId}/compliance-checklist`)
	},

	toggleChecklistItem(
		customerId: string,
		itemId: string,
		isMet: boolean,
	): Promise<void> {
		return patch(`/customers/${customerId}/compliance-checklist/${itemId}`, {
			isMet,
		})
	},
}
