import { get, post, patch, del } from './client';
import type { Customer, Contact, Address, PaginatedResult } from '@/types';

export interface CustomerCommunication {
	id: string;
	type_id: string;
	date_time: string;
	direction: 'Inbound' | 'Outbound';
	summary: string;
	next_steps?: string;
	participants?: string;
	created_at: string;
}

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
		const payload = mapAddressPayload(data as Record<string, unknown>);
		return post<Address>(`/customers/${customerId}/addresses`, payload)
	},

	updateAddress(
		customerId: string,
		addressId: string,
		data: Partial<Address>,
	): Promise<Address> {
		const payload = mapAddressPayload(data as Record<string, unknown>);
		return patch<Address>(
			`/customers/${customerId}/addresses/${addressId}`,
			payload,
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

	// Communications
	listCommunications(customerId: string): Promise<CustomerCommunication[]> {
		return get(`/customers/${customerId}/communications`)
	},

	createCommunication(
		customerId: string,
		data: {
			typeId: string
			dateTime: string
			direction: 'Inbound' | 'Outbound'
			summary: string
			nextSteps?: string
			participants?: string
			visibilityScope?: 'LegalOnly' | 'FinanceAllowed'
		},
	): Promise<CustomerCommunication> {
		return post(`/customers/${customerId}/communications`, data)
	},
}

function mapAddressPayload(data: Record<string, unknown>) {
	const payload: Record<string, unknown> = {};

	if (data.type !== undefined) payload.type = data.type;
	if (data.address_type !== undefined) payload.type = data.address_type;
	if (data.isPrimary !== undefined) payload.isPrimary = data.isPrimary;
	if (data.is_primary !== undefined) payload.isPrimary = data.is_primary;
	if (data.line1 !== undefined) payload.line1 = data.line1;
	if (data.line2 !== undefined) payload.line2 = data.line2;
	if (data.city !== undefined) payload.city = data.city;
	if (data.state !== undefined) payload.state = data.state;
	if (data.state_province !== undefined) payload.state = data.state_province;
	if (data.postalCode !== undefined) payload.postalCode = data.postalCode;
	if (data.postal_code !== undefined) payload.postalCode = data.postal_code;
	if (data.country !== undefined) payload.country = data.country;

	return payload;
}
