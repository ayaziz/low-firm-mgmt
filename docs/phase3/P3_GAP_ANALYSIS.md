# LOMA — Phase 3 Gap Analysis

> **Version**: 3.0  
> **Status**: Complete  
> **Scope**: Current (Phase 1 + Phase 2) implementation vs. Phase 3 requirements.  
> **Baseline**: `backend/prisma/tenant-schema.sql` · 18 backend modules · 20+ frontend pages · 70/70 P1+P2 GAP_BACKLOG items resolved.  
> **Methodology**: Schema inspection · API route review · Frontend page audit · BRD/PRD cross-check.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Schema Gaps — Thin Entities](#2-schema-gaps--thin-entities)
3. [Approval Workflow Gaps](#3-approval-workflow-gaps)
4. [Status History Gaps](#4-status-history-gaps)
5. [Document Management Gaps](#5-document-management-gaps)
6. [Calendar & Scheduling Gaps](#6-calendar--scheduling-gaps)
7. [Reporting & Analytics Gaps](#7-reporting--analytics-gaps)
8. [Notification System Gaps](#8-notification-system-gaps)
9. [UX / Accessibility Gaps](#9-ux--accessibility-gaps)
10. [Security Gaps](#10-security-gaps)
11. [Appendix: Entity Field Map — Gaps Highlighted](#11-appendix-entity-field-map--gaps-highlighted)

---

## 1. Executive Summary

| Priority | Count | Category |
|----------|-------|----------|
| **P0** | **3** | Blocking functional gaps (missing workflow states will cause data integrity violations) |
| **P1** | **22** | High-value missing features with direct user impact |
| **P2** | **18** | Schema enrichment and UX improvements |
| **P3** | **12** | Infrastructure and developer-experience improvements |
| **Total** | **55** | Tracked in P3_GAP_BACKLOG.md |

### Top P0 Gaps

| # | Entity | Gap | Risk |
|---|--------|-----|------|
| P0-1 | `wages` | No approval step between Draft and Paid.  Wages go directly from `Planned` to `Paid` with zero review.  Financial disbursement without governance. | Financial control failure |
| P0-2 | `folders` | Table exists in schema but is completely non-functional: wrong column names, wrong scope model.  All folder operations crash. | DMS folders unusable |
| P0-3 | `status_history` | Status changes on cases, invoices, and expenses have no persistent history.  Audit trail exists in `audit_events` but is not surfaced to users; there is no structured from/to status model. | Audit and legal compliance |

---

## 2. Schema Gaps — Thin Entities

### 2.1 Customer Table — Missing Fields

**Current schema** (relevant columns only):

```sql
customer_type, name, status, national_id, passport_number,
registration_id, tax_id, notes, completeness_pct
```

**Missing for Phase 3:**

| Field | Type | Reason Required |
|-------|------|-----------------|
| `kyc_status` | `VARCHAR(20)` | KYC is a BRD/legal requirement for law firms; currently untraceable. |
| `kyc_verified_at` | `TIMESTAMPTZ` | Verified timestamp needed for compliance reporting. |
| `credit_rating` | `VARCHAR(10)` | Accountant needs this for invoice and collection risk decisions. |
| `preferred_language` | `VARCHAR(5)` | Determines which language templates and notifications to use per customer. |
| `preferred_comm_channel` | `VARCHAR(20)` | Required for notification routing. |
| `relationship_manager_user_id` | `UUID` | Assigned lawyer/accountant owning customer relationship; needed for utilization reports. |
| `industry_sector` | `VARCHAR(200)` | Needed for case categorization and reporting. |
| `risk_profile` | `VARCHAR(10)` | Legal and financial risk triage; missing entirely. |
| `date_of_birth` / `incorporation_date` | `DATE` | Standard legal identity data; blank for all customers. |
| `gender` | `VARCHAR(15)` | Required for individual customer forms and legal documents. |
| `annual_revenue_band` | `VARCHAR(20)` | Organization customer context for billing decisions. |

**Impact**: Customer detail form has ≈ 11 unpopulated fields that lawyers and accountants need daily.  The "completeness_pct" score is therefore systematically understated.

---

### 2.2 Case Table — Missing Fields

**Current schema** (relevant columns only):

```sql
system_case_ref, court_case_number, case_type_id, title, description, state,
is_on_hold, assigned_lawyer_user_id, completeness_pct
```

**Missing for Phase 3:**

| Field | Type | Reason Required |
|-------|------|-----------------|
| `risk_level` | `VARCHAR(10)` | Partners need risk visibility at a glance; currently absent. |
| `priority` | `VARCHAR(10)` | Urgent/Emergency cases have no triage marker. |
| `source` | `VARCHAR(20)` | Business development tracking (referrals vs. direct). |
| `estimated_value` | `DECIMAL(18,2)` | Case value drives priority; absent entirely. |
| `legal_acts` | `JSONB` | Legal act references (article, jurisdiction) required on every case in GCC jurisdictions. |
| `judgment_date` | `DATE` | Final judgment not captured; outcomes are invisible. |
| `judgment_outcome` | `TEXT` | Win/lose/settlement text — critical for case retrospective. |
| `judgment_reference` | `VARCHAR(200)` | Court judgment reference number. |
| `appeal_deadline` | `DATE` | Missed appeal deadlines are malpractice risk. |
| `lead_lawyer_user_id` | `UUID` | Separate from `assigned_lawyer_user_id`; structured team model. |
| `junior_lawyers` | `UUID[]` | Multi-lawyer teams unrepresented in current schema. |

**Additional gap** — `case_parties` table:

| Field Added To | Field | Type | Reason |
|----------------|-------|------|--------|
| `case_parties` | `opposing_counsel_name` | `VARCHAR(300)` | Opposing counsel identity is critical for conflict-of-interest checks and correspondence. |
| `case_parties` | `opposing_counsel_firm` | `VARCHAR(300)` | Firm name for legal communications. |
| `case_parties` | `opposing_counsel_email` | `VARCHAR(300)` | Direct contact for procedural communications. |
| `case_parties` | `opposing_counsel_phone` | `VARCHAR(100)` | Required for hearing logistics. |
| `case_parties` | `opposing_counsel_bar_no` | `VARCHAR(100)` | Bar registration verification. |

---

### 2.3 Session / Hearing Table — Missing Fields

**Current schema:**

```sql
case_id, type_id, title, start_date_time, end_date_time, location,
court_id, status, outcome_notes, linked_document_ids, created_by
```

**Missing for Phase 3:**

| Field | Type | Reason Required |
|-------|------|-----------------|
| `judge_id` | `UUID` | Judge assignment is core hearing metadata; FK to `judges` master table. |
| `witness_list` | `JSONB` | Witness management is a core hearing management function. |
| `actual_outcome` | `TEXT` | `outcome_notes` conflates pre-hearing planning with post-hearing result.  Needs separation. |
| `actual_start_time` | `TIMESTAMPTZ` | Hearings frequently start late; recording actual time is needed for billing and reporting. |
| `actual_end_time` | `TIMESTAMPTZ` | Duration for billable time calculation. |
| `is_billable` | `BOOLEAN` | Not all hearings are billable; currently no flag exists. |
| `billable_duration_minutes` | `INT` | Required for Lawyer Utilization report (currently impossible to build). |
| `postponed_from_session_id` | `UUID` | Postponement chain is not linked; previous/next sessions are unrelated records. |

---

### 2.4 Wage Table — State Machine Gap

**Current `payment_status`:** `('Planned', 'Paid')` — 2 states, no approval.

**Required states:** `('Draft', 'Submitted', 'Approved', 'Paid')` — 4 states with governance.

**Missing columns:**

| Column | Type | Purpose |
|--------|------|---------|
| `submitted_at` | `TIMESTAMPTZ` | Timestamp of submission. |
| `submitted_by` | `UUID` | Author of submission. |
| `approved_at` | `TIMESTAMPTZ` | Timestamp of approval. |
| `approved_by` | `UUID` | Approver identity. |
| `paid_at` | `TIMESTAMPTZ` | Actual payment date (vs. the `period` field which is the pay month). |
| `paid_by` | `UUID` | Who recorded the payment. |
| `payment_method` | `VARCHAR(30)` | How the wage was disbursed. |
| `payment_ref` | `VARCHAR(300)` | Bank transfer reference. |

---

### 2.5 Invoice Table — Review Step Gap

**Current `status`:** `('Draft', 'Finalized', 'Sent', 'Paid', 'Void')`.

**Required states:** `('Draft', 'Review', 'Approved', 'Finalized', 'Sent', 'Paid', 'Void')` — `Review` is toggleable.

**Missing columns:**

| Column | Type | Purpose |
|--------|------|---------|
| `reviewed_by` | `UUID` | Reviewer identity. |
| `reviewed_at` | `TIMESTAMPTZ` | Review timestamp. |
| `review_comment` | `TEXT` | Approval/rejection comment from reviewer. |

---

## 3. Approval Workflow Gaps

### 3.1 Wages — No Approval Workflow

- **Current state**: Wages are created and marked paid in two clicks.  Any user with Accountant role can do both actions.
- **Gap**: No separation of duties; no review trail; no comment history.
- **Phase 3 fix**: Full 4-step state machine with `ApprovalService` (see TDD §3.1).

### 3.2 Invoices — No Second-Eye Review Option

- **Current state**: Accountant finalizes invoice unilaterally.  Tenant has no way to configure a review step.
- **Gap**: High-value invoices (legal retainers, milestone billing) go out without senior review.
- **Phase 3 fix**: Optional `invoiceApprovalRequired` toggle adding a `Review` step.

### 3.3 Hearing Postponements — No Approval Gate

- **Current state**: Any case member can reschedule a hearing; the `session_reschedules` table records history but there is no approval step or notification.
- **Gap**: Court hearings are formally postponed; rescheduling should require CaseOwner sign-off.
- **Phase 3 fix**: Postponement request flow with approval state on `session_reschedules`.

### 3.4 Expenses — History Not Surfaced in UI

- **Current state**: `expense_approvals` table exists and is populated; the multi-step chain is implemented in backend.  However, the frontend Expenses page does not render the approval history, only the current status badge.
- **Gap**: Users cannot see who approved/rejected at each step or read the comments.
- **Phase 3 fix**: `StatusTimeline` component on Expense Detail; backend `/status-history` endpoint for expenses.

---

## 4. Status History Gaps

### 4.1 No Generic `status_history` Table

- **Current state**: Status changes are captured in `audit_events` (generic JSONB payload) but not in a structured from/to format.
- **Gap**: 
  - No API endpoint returns "status journey" for any entity.
  - Frontend cannot render a timeline without implementing entity-specific queries.
  - Audit log is append-only and unindexed for status-history access patterns.
- **Phase 3 fix**: New `status_history` table; `StatusHistoryService.emit()` called from all transition handlers.

### 4.2 Case Detail — "Timeline" Tab is Empty

- **Current state**: Case Detail has a "Timeline" tab in the PRD wireframes.  In Phase 2, this tab either does not exist or shows a placeholder.
- **Gap**: The primary navigation entry point for case history has no data.
- **Phase 3 fix**: Case activity feed combining status changes, session additions, task completions, document uploads — all from `status_history` + lightweight event records.

### 4.3 Filing Status Changes Not Audited Structurally

- **Current state**: Filing status (Draft/Filed/Accepted/Rejected/Withdrawn) changes are recorded in `audit_events` but the filing detail has no history display.
- **Gap**: Court filing acceptance/rejection history is legally significant and must be displayed.
- **Phase 3 fix**: Include Filing in `status_history` emission; `StatusTimeline` on Filing panel.

---

## 5. Document Management Gaps

### 5.1 Folder Hierarchy — Broken Implementation

- **Current state**: `folders` table defined in schema but:
  - Wrong column `parent_id` (should be `parent_folder_id`).
  - Wrong column `case_id` (should be generic `scope_type + scope_id`).
  - Non-existent column `description`.
  - Frontend uses hardcoded text inputs for folder creation.
  - Every folder API call returns a 500.
- **Gap**: DMS has no organizational structure; all documents are flat lists.
- **Phase 3 fix**: Drop and recreate `folders` table on correct schema; full UI implementation.

### 5.2 No Version Comparison UI

- **Current state**: `document_versions` table stores multiple versions; version list is shown in Document Detail.
- **Gap**: No way to compare two versions (metadata diff or content diff).  User cannot tell what changed between v1 and v2.
- **Phase 3 fix**: Metadata comparison panel; "Compare with Previous" button.

### 5.3 No Bulk Document Operations

- **Current state**: Documents can only be acted on one at a time.
- **Gap**: Large cases (50+ documents) require dozens of individual actions for common tasks (e.g. tagging all discovery docs, moving all emails to an "Email" folder).
- **Phase 3 fix**: Multi-select with bulk action bar.

### 5.4 No Document Expiry

- **Current state**: `retention_policies` table exists (seeded, read-only).  No `expires_at` on `documents`.
- **Gap**: Expiring legal documents (ID copies, power of attorney) are not tracked or alerted.
- **Phase 3 fix**: `expires_at` column + expiry alert mechanism + list view indicators.

### 5.5 No full-text / OCR Search

- **Current state**: Document list search queries `title ILIKE '%{term}%'` only.
- **Gap**: Users cannot search inside document content.  A 200-page contract with "force majeure" is unsearchable.
- **Phase 3 fix**: Tesseract OCR job + `tsvector` index + full-text search in document library.

### 5.6 No External Sharing

- **Current state**: Internal time-bound sharing via `document_shares` table exists.  No external (unauthenticated) sharing.
- **Gap**: Lawyers frequently need to share documents with clients, opposing counsel, or courts who do not have LOMA accounts.
- **Phase 3 fix**: Tokenized external share links with expiry, optional password, and max-download controls.

---

## 6. Calendar & Scheduling Gaps

### 6.1 No iCal Export

- **Current state**: Calendar shows sessions visually; no export mechanism.
- **Gap**: Users cannot add court dates to Outlook/Google Calendar.
- **Phase 3 fix**: `GET /sessions/{id}/ical` and "Export Calendar" from session list.

### 6.2 No Conflict Detection

- **Current state**: Creating a hearing with the same lawyer on the same day as another hearing succeeds silently.
- **Gap**: Double-booking creates malpractice risk.
- **Phase 3 fix**: Backend check on session create/reschedule; frontend warning dialog.

### 6.3 No rrule Builder UI

- **Current state**: rrule is implemented server-side (Phase 2 G-070) but the frontend accepts a raw RRULE string which users cannot construct manually.
- **Gap**: Recurrence is effectively unusable for non-technical users.
- **Phase 3 fix**: Visual recurrence rule builder (frequency/day/end pickers).

---

## 7. Reporting & Analytics Gaps

### 7.1 No Dashboard KPIs

- **Current state**: Home page is blank or shows a generic welcome card.
- **Gap**: Tenant Admin and senior partners have no at-a-glance operational overview.
- **Phase 3 fix**: KPI Dashboard with 4 widget types.

### 7.2 No Case Aging Report

- **Current state**: Case list can be filtered by state but does not show time-in-state.
- **Gap**: Cases stuck in "Pending" for months are invisible until manually checked.
- **Phase 3 fix**: Case Aging report with configurable bands.

### 7.3 No Receivables Aging

- **Current state**: Invoice list shows due dates; there is no aging bucket grouping with totals.
- **Gap**: Accountant cannot quickly see overdue exposure split by 30/60/90+ days.
- **Phase 3 fix**: Receivables Aging report with customer-level drilldown.

### 7.4 No Lawyer Utilization

- **Current state**: Session records exist; nothing aggregates billable time per lawyer.
- **Gap**: Partners cannot assess team utilization or client billing coverage.
- **Phase 3 fix**: Lawyer Utilization report (requires session `is_billable` and `billable_duration_minutes`).

### 7.5 Excel Export Not Available

- **Current state**: CSV export implemented for wages and reports.
- **Gap**: Law firms work in Excel; CSV requires manual reformatting.
- **Phase 3 fix**: `.xlsx` export via `exceljs` for all tabular report endpoints.

---

## 8. Notification System Gaps

### 8.1 `notifications` Table Exists but Nothing Delivers Them

- **Current state**: `notifications` table is seeded and schema-complete.  `notifications.service.ts` may create rows.  But there is no SSE endpoint, no polling mechanism, no bell icon in the frontend.
- **Gap**: All notifications created by backend jobs are invisible to users.
- **Phase 3 fix**: SSE stream + NotificationCenter UI component + bell badge.

### 8.2 No Email Notifications

- **Current state**: No SMTP integration; no email sent on any event.
- **Gap**: Lawyers miss hearing alerts, task deadlines, and approval requests when not logged in.
- **Phase 3 fix**: Nodemailer SMTP integration; email templates for hearing alert, approval request, digest.

### 8.3 No Deadline Reminder Jobs

- **Current state**: Calendar shows upcoming sessions; no proactive reminders.
- **Gap**: Tasks with due dates and documents approaching expiry generate no alerts.
- **Phase 3 fix**: `@nestjs/schedule` cron + hearing-day alert + task/doc deadline reminders.

---

## 9. UX / Accessibility Gaps

### 9.1 No Dark Mode

- **Current state**: MUI theme is light-only.
- **Gap**: User preference; standard for modern enterprise apps.
- **Phase 3 fix**: MUI theme toggle stored in user profile; persisted across sessions.

### 9.2 No Print / PDF Views

- **Current state**: Invoice PDF export exists via backend.  No print-friendly CSS for other pages.
- **Gap**: Wage slips, case summaries, and session records cannot be printed without exporting CSV.
- **Phase 3 fix**: `@media print` CSS + "Print" button on Case Detail, Invoice, Wage Detail.

### 9.3 Keyboard Navigation Incomplete

- **Current state**: MUI DataGrid has partial keyboard support.  Many custom DrawerForms are not keyboard-navigable.
- **Gap**: Accessibility compliance and power-user efficiency.
- **Phase 3 fix**: Audit + fixes on all DrawerForm and DataGrid components.

---

## 10. Security Gaps

### 10.1 No External Share Link Security Model

- **Current state**: No external share links exist yet.
- **Gap**: When introduced, tokens must be high-entropy, stored hashed, and audited on every access.
- **Phase 3 fix**: 32-byte random token, SHA-256 storage, per-access audit log.

### 10.2 Self-Approval Not Blocked

- **Current state**: Expense approval chain exists but there is no validation preventing the submitter from being the same user as the approver (when user has multiple roles).
- **Gap**: Integrity of financial approval workflow; separation-of-duties violation.
- **Phase 3 fix**: `ApprovalService.validateApprover()` checks `submittedBy !== actorUserId`.

---

## 11. Appendix: Entity Field Map — Gaps Highlighted

### Customer Fields

| Field | In Schema | Gap Priority |
|-------|-----------|--------------|
| `kyc_status` | ❌ | P1 |
| `kyc_verified_at` | ❌ | P1 |
| `credit_rating` | ❌ | P2 |
| `preferred_language` | ❌ | P2 |
| `preferred_comm_channel` | ❌ | P2 |
| `relationship_manager_user_id` | ❌ | P1 |
| `industry_sector` | ❌ | P2 |
| `risk_profile` | ❌ | P1 |
| `date_of_birth` / `incorporation_date` | ❌ | P2 |
| `gender` | ❌ | P2 |
| `annual_revenue_band` | ❌ | P2 |

### Case Fields

| Field | In Schema | Gap Priority |
|-------|-----------|--------------|
| `risk_level` | ❌ | P1 |
| `priority` | ❌ | P1 |
| `source` | ❌ | P2 |
| `estimated_value` | ❌ | P2 |
| `legal_acts` (JSONB) | ❌ | P1 |
| `judgment_date` | ❌ | P1 |
| `judgment_outcome` | ❌ | P1 |
| `judgment_reference` | ❌ | P2 |
| `appeal_deadline` | ❌ | P0 (malpractice risk) |
| `lead_lawyer_user_id` | ❌ | P1 |
| `junior_lawyers[]` | ❌ | P2 |

### Session Fields

| Field | In Schema | Gap Priority |
|-------|-----------|--------------|
| `judge_id` | ❌ | P1 |
| `witness_list` (JSONB) | ❌ | P1 |
| `actual_outcome` | ❌ | P1 |
| `actual_start_time` | ❌ | P2 |
| `actual_end_time` | ❌ | P2 |
| `is_billable` | ❌ | P1 |
| `billable_duration_minutes` | ❌ | P1 |
| `postponed_from_session_id` | ❌ | P2 |

### Wage Fields

| Field | In Schema | Gap Priority |
|-------|-----------|--------------|
| 4-step approval states | ❌ (only 2 states: Planned/Paid) | P0 |
| `submitted_at` / `submitted_by` | ❌ | P0 |
| `approved_at` / `approved_by` | ❌ | P0 |
| `paid_at` / `payment_method` / `payment_ref` | ❌ | P1 |

### Document Fields

| Field | In Schema | Gap Priority |
|-------|-----------|--------------|
| `folder_id` | ❌ | P1 (folders broken) |
| `expires_at` | ❌ | P1 |
| OCR text table | ❌ | P2 |
| External share table | ❌ | P2 |
| Version compare UI | ❌ | P2 |
| Bulk operations | ❌ | P2 |

### Infrastructure

| Item | In Place | Gap Priority |
|------|----------|--------------|
| `status_history` table | ❌ | P0 |
| SSE notification stream | ❌ | P1 |
| Email notification delivery | ❌ | P1 |
| Dashboard KPI cache (Redis) | ❌ | P2 |
| iCal export | ❌ | P2 |
| Conflict detection | ❌ | P1 |
| rrule builder UI | ❌ (partial) | P2 |
| Excel (.xlsx) export | ❌ | P2 |
| External share audit log | ❌ | P2 |
| Self-approval block | ❌ | P1 |
