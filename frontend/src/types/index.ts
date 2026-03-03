/* ──────────────────────────────────────────
   Shared types mirroring backend contracts
   ────────────────────────────────────────── */

// ── Enums ──
export type Role = 'Lawyer' | 'Accountant' | 'TenantAdmin' | 'SystemAdmin';

export type CaseState = 'Intake' | 'Open' | 'Active' | 'Pending' | 'Closed' | 'Archived';

export type CustomerType = 'Individual' | 'Organization'
export type CustomerStatus = 'Active' | 'Inactive' | 'Prospect';

export type ConfidentialityLevel = 'Public' | 'Internal' | 'Confidential' | 'HighlyConfidential';
export type ScanStatus = 'Pending' | 'Passed' | 'Failed';

export type InvoiceStatus = 'Draft' | 'Finalized' | 'Sent' | 'Paid' | 'PartiallyPaid' | 'Voided';
export type ExpenseStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

export type TaskStatus = 'ToDo' | 'InProgress' | 'Done' | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type SessionStatus = 'Scheduled' | 'Rescheduled' | 'Completed' | 'Cancelled';
export type FilingStatus = 'Planned' | 'Filed' | 'Accepted' | 'Rejected';

export type PaymentMethod = 'Cash' | 'BankTransfer' | 'Check' | 'CreditCard' | 'Online';

export type NotificationType = 'task' | 'session' | 'approval' | 'system';

// ── API Responses ──
export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface AuthResponse {
  accessToken?: string;
  access_token?: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  tenantSlug: string;
  language: string;
}

// ── Customer ──
export interface Customer {
	id: string
	name: string
	customer_type: CustomerType
	status: CustomerStatus
	national_id?: string
	registration_id?: string
	tax_id?: string
	notes?: string
	created_at: string
	updated_at: string
	row_version: string
}

export interface Contact {
  id: string;
  customer_id: string;
  role_id: string;
  name: string;
  phone?: string;
  email?: string;
  is_primary: boolean;
}

export interface Address {
  id: string;
  customer_id: string;
  address_type: string;
  line1: string;
  line2?: string;
  city: string;
  state_province?: string;
  postal_code?: string;
  country: string;
  is_primary: boolean;
}

// ── Case ──
export interface Case {
  id: string;
  customer_id: string;
  case_type_id: string;
  system_case_ref: string;
  court_case_number?: string;
  title: string;
  description?: string;
  state: CaseState;
  is_on_hold: boolean;
  on_hold_reason?: string;
  assigned_lawyer: string;
  created_at: string;
  updated_at: string;
  row_version: string;
  // Computed
  completeness?: number;
  overdue_tasks?: number;
  next_session?: string;
  case_type_name?: string;
  customer_name?: string;
  lawyer_name?: string;
}

export interface Task {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  assigned_to: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

export interface Session {
  id: string;
  case_id: string;
  session_date: string;
  session_type: string;
  location?: string;
  status: SessionStatus;
  notes?: string;
  created_at: string;
}

export interface Filing {
  id: string;
  case_id: string;
  title: string;
  filing_type: string;
  status: FilingStatus;
  filed_date?: string;
  deadline?: string;
  notes?: string;
  created_at: string;
}

export interface Note {
  id: string;
  case_id: string;
  content: string;
  created_by: string;
  created_at: string;
  author_name?: string;
}

export interface Communication {
  id: string;
  case_id: string;
  comm_type: string;
  direction: 'Inbound' | 'Outbound';
  summary: string;
  contact_name?: string;
  comm_date: string;
  created_at: string;
}

// ── Document ──
export interface Document {
  id: string;
  case_id: string;
  customer_id: string;
  title: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  doc_type: string;
  confidentiality: ConfidentialityLevel;
  scan_status: ScanStatus;
  is_checked_out: boolean;
  checked_out_by?: string;
  checkout_expires_at?: string;
  legal_hold: boolean;
  is_deleted: boolean;
  current_version_id?: string;
  uploaded_by: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  row_version: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  scan_status: ScanStatus;
  created_at: string;
}

// ── Accounting ──
export interface Invoice {
	id: string
	case_id: string
	customer_id: string
	invoice_number: string
	total_amount: number
	paid_amount: number
	currency: string
	status: InvoiceStatus
	due_date: string
	finalized_at?: string
	sent_at?: string
	voided_at?: string
	notes?: string
	lineItems?: InvoiceLineItem[]
	payments?: Payment[]
	created_at: string
	updated_at: string
	row_version: string
	customer_name?: string
	case_title?: string
}

export interface InvoiceLineItem {
	id?: string
	description: string
	quantity: number
	unit_price: number
	line_total: number
  tax_rate: number
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

export interface Expense {
  id: string;
  case_id?: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  status: ExpenseStatus;
  submitted_by: string;
  created_at: string;
  updated_at: string;
}

export interface Wage {
  id: string;
  user_id: string;
  period: string;
  base_amount: number;
  bonus_amount: number;
  deductions: number;
  net_amount: number;
  currency: string;
  notes?: string;
  created_at: string;
}

// ── Admin ──
export interface MasterDataItem {
  id: string;
  category: string;
  code: string;
  label_en: string;
  label_ar: string;
  is_active: boolean;
  sort_order: number;
}

export interface CaseType {
  id: string;
  code: string;
  label_en: string;
  label_ar: string;
  is_active: boolean;
  task_templates?: unknown;
  doc_requirement_templates?: unknown;
}

export interface TenantSettings {
  firmName?: string;
  currency: string;
  defaultCurrency?: string;
  timezone: string;
  locale: string;
  planTier: string;
  lawyerCanDraft: boolean;
  invoicePrefix?: string;
  invoiceFooter?: string;
  autoScan?: boolean;
}

// ── Notification ──
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

// ── Search ──
export interface SearchResult {
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
  matchField: string;
}

// ── Audit ──
export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  actor_name?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

// ── Report ──
export interface ReportResult {
  data: Record<string, unknown>[];
  metadata: {
    report: string;
    generatedAt: string;
    filters: Record<string, unknown>;
  };
}

// ── Phase 2: Courts & Judges ──
export type CourtType = 'Civil' | 'Criminal' | 'Family' | 'Commercial' | 'Administrative' | 'Labor' | 'Constitutional' | 'Appeal' | 'Cassation' | 'Other';

export interface Court {
  id: string;
  name: string;
  court_type: CourtType;
  jurisdiction?: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Judge {
  id: string;
  court_id: string;
  name: string;
  title?: string;
  chamber?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  court_name?: string;
}

// ── Phase 2: Hearings ──
export type HearingStatus = 'Scheduled' | 'Postponed' | 'Completed' | 'Cancelled';

export interface Hearing {
  id: string;
  case_id: string;
  court_id: string;
  judge_id?: string;
  hearing_date: string;
  hearing_type: string;
  status: HearingStatus;
  location?: string;
  room_number?: string;
  notes?: string;
  outcome?: string;
  next_hearing_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  case_title?: string;
  court_name?: string;
  judge_name?: string;
}

// ── Phase 2: Calendar ──
export type CalendarEventType = 'Hearing' | 'Meeting' | 'Deadline' | 'Task' | 'Reminder' | 'Other';
export type CalendarEventStatus = 'Scheduled' | 'Confirmed' | 'Cancelled' | 'Completed';
export type RsvpStatus = 'Pending' | 'Accepted' | 'Declined' | 'Tentative';

export interface CalendarEvent {
  id: string;
  case_id?: string;
  hearing_id?: string;
  title: string;
  description?: string;
  event_type: CalendarEventType;
  status: CalendarEventStatus;
  start_at: string;
  end_at: string;
  location?: string;
  is_all_day: boolean;
  recurrence?: string;
  recurrence_end_date?: string;
  created_at: string;
  updated_at: string;
  case_title?: string;
  attendees?: CalendarAttendee[];
  reminders?: CalendarReminder[];
}

export interface CalendarAttendee {
  id: string;
  event_id: string;
  user_id: string;
  rsvp_status: RsvpStatus;
  display_name?: string;
}

export interface CalendarReminder {
  id: string;
  event_id: string;
  remind_at: string;
  method: string;
}

// ── Phase 2: Folders ──
export type FolderScope = 'Case' | 'Customer' | 'General';

export interface Folder {
  id: string;
  case_id?: string;
  parent_id?: string;
  name: string;
  scope: FolderScope;
  path: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  children?: Folder[];
  document_count?: number;
}

// ── Phase 2: Document Templates ──
export type DocumentTemplateCategory = 'Contract' | 'Motion' | 'Letter' | 'Filing' | 'Report' | 'Other';

export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  category: DocumentTemplateCategory;
  template_body: string;
  variable_schema?: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ── Phase 2: Time Entries ──
export type TimeEntryStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

export interface TimeEntry {
  id: string;
  case_id: string;
  user_id: string;
  hearing_id?: string;
  entry_date: string;
  hours: number;
  rate_per_hour: number;
  total_amount: number;
  description: string;
  activity_type: string;
  billable: boolean;
  status: TimeEntryStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  case_title?: string;
}

export interface TimeEntrySummary {
  total_entries: number;
  total_hours: number;
  total_amount: number;
  billable_hours: number;
  billable_amount: number;
  non_billable_hours: number;
}

// ── Phase 2: OCR/Full-text ──
export type OcrStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Skipped';

export interface FulltextSearchResult {
  id: string;
  title: string;
  file_name: string;
  case_id: string;
  snippet: string;
  rank: number;
}

// ── Completeness ──
export interface CompletenessResult {
  score: number;
  breakdown: {
    fields: { score: number; weight: number; missing: string[] };
    documents: { score: number; weight: number; missing: string[] };
    participants: { score: number; weight: number; missing: string[] };
  };
}
