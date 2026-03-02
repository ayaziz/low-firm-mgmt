// Common types and interfaces used across the application

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
}

export interface JwtPayload {
  sub: string;        // userId
  email: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  displayName: string;
  stepUp?: boolean;
  iat?: number;
  exp?: number;
}

export interface PaginationQuery {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type Role = 'Lawyer' | 'Accountant' | 'TenantAdmin' | 'SystemAdmin';
export type CaseMembershipRole = 'CaseOwner' | 'CaseMember' | 'ReadOnly';
export type CaseState = 'Intake' | 'Open' | 'Active' | 'Pending' | 'Closed' | 'Archived';
export type CustomerType = 'Individual' | 'Organization';
export type CustomerStatus = 'Active' | 'Inactive' | 'Prospect';
export type ConfidentialityLevel = 'Normal' | 'Confidential' | 'HighlyConfidential';
export type ScanStatus = 'Pending' | 'Passed' | 'Failed';
export type InvoiceStatus = 'Draft' | 'Final' | 'Sent' | 'Paid' | 'Voided';
export type ExpenseStatus = 'Draft' | 'Submitted' | 'PendingApproval' | 'Approved' | 'Rejected';
export type PaymentMethod = 'Cash' | 'BankTransfer' | 'Cheque' | 'Card' | 'Other';
export type TaskStatus = 'Open' | 'InProgress' | 'Blocked' | 'Done' | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type FilingStatus = 'Draft' | 'Filed' | 'Accepted' | 'Rejected' | 'Withdrawn';
export type SessionStatus = 'Planned' | 'Completed' | 'Postponed' | 'Cancelled';
export type VisibilityScope = 'LegalOnly' | 'FinanceAllowed';
export type CasePartyRoleType = 'Customer' | 'Opposing' | 'ExternalCounsel' | 'Other';

// ── Phase 2 Types ──────────────────────────────────────────────

export type JurisdictionLevel = 'District' | 'Appeal' | 'Supreme' | 'Specialized';
export type HearingType = 'Initial' | 'Continuation' | 'Ruling' | 'Appeal' | 'Procedural';
export type HearingStatus = 'Scheduled' | 'Completed' | 'Postponed' | 'Cancelled';
export type CalendarEventType = 'Hearing' | 'Meeting' | 'Deadline' | 'Task' | 'Reminder' | 'Other';
export type CalendarEventStatus = 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled';
export type CalendarRecurrence = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
export type RsvpStatus = 'Pending' | 'Accepted' | 'Declined' | 'Tentative';
export type ReminderChannel = 'InApp' | 'Email';
export type FolderScope = 'Customer' | 'Case' | 'Tenant';
export type OcrStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Skipped';
export type DocumentTemplateCategory = 'Contract' | 'Letter' | 'Petition' | 'Motion' | 'Filing' | 'Other';
export type TimeEntryStatus = 'Draft' | 'Submitted' | 'Approved' | 'Billed' | 'WriteOff';
export type NotificationChannel = 'InApp' | 'Email' | 'Both';

export const VALID_HEARING_TRANSITIONS: Record<HearingStatus, HearingStatus[]> = {
  Scheduled: ['Completed', 'Postponed', 'Cancelled'],
  Postponed: ['Scheduled', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

export const VALID_TIME_ENTRY_TRANSITIONS: Record<TimeEntryStatus, TimeEntryStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['Approved', 'Draft'],
  Approved: ['Billed', 'WriteOff'],
  Billed: [],
  WriteOff: [],
};

export const VALID_STATE_TRANSITIONS: Record<CaseState, CaseState[]> = {
  Intake: ['Open'],
  Open: ['Active'],
  Active: ['Pending', 'Closed'],
  Pending: ['Active', 'Closed'],
  Closed: ['Archived'],
  Archived: [],
};
