# LOMA — Phase 3 Business Requirements Document (BRD)

> **Version**: 3.0  
> **Status**: Draft — Ready for Review  
> **Prepared by**: Product & Engineering  
> **Assumes**: Phase 1 (MVP) and Phase 2 (Stability + Integrations) are fully delivered and deployed.  
> **Scope**: Eight enhancement pillars selected to maximise operational value for law-firm users.

---

## 1. Executive Overview

Phase 1 delivered the foundational multi-tenant legal operations platform covering customer lifecycle, case management, a document management system (DMS), and simple accounting with a bilingual (EN/AR) interface.  Phase 2 hardened the platform: production auth, test coverage, malware scanning, audit trail, calendar recurrence, and critical bug remediation.

Phase 3 elevates LOMA from a **record-keeping system** into a **decision-support and workflow platform**.  The core theme is:

> _"Every entity should tell a story — what happened, who acted, when it changed, and what was decided."_

### 1.1 Business Drivers

| Driver | Description |
|--------|-------------|
| **Operational Visibility** | Partners and senior lawyers need rich case data — opposing counsel, legal acts, risk levels — currently missing from the schema. |
| **Governance & Approval** | Wages and invoices go directly from draft to paid/finalized with no review step.  Expense approval exists but lacks full history. |
| **Document Maturity** | The DMS stores files but provides no folder hierarchy, no version comparison, no bulk operations, and no expiry alerting. |
| **Audit & Accountability** | Status changes happen silently.  Stakeholders cannot see who changed what, when, or why without trawling raw audit logs. |
| **Analytics & Reporting** | Export-to-CSV is not analytics.  Management needs aging reports, utilization dashboards, and receivables visibility. |
| **Notification Reliability** | The `notifications` table exists but no delivery mechanism reaches users before deadlines and hearings. |

---

## 2. Business Goals

| ID | Goal | Success KPI |
|----|------|-------------|
| BG-01 | **Rich entity data** — case and customer records capture complete legal and business context. | ≥ 95 % of active cases have opposing-counsel, risk-level, and assigned-judge populated within 5 business days of creation. |
| BG-02 | **Governed financial flows** — wages and invoices require explicit approval before disbursement or dispatch. | Zero wages paid or invoices sent without a completed approval chain. |
| BG-03 | **Document lifecycle control** — documents are organized in folder trees, versions are comparable, expiry is tracked. | Document retrieval time reduced by ≥ 40 % (user survey) vs. Phase 2. |
| BG-04 | **Transparent status history** — every entity exposes a full audit timeline visible in the UI, not just in the database. | 100 % of status-bearing entities show a status timeline with actor and comment. |
| BG-05 | **Actionable analytics** — management can view live dashboards without exporting data. | ≥ 3 dashboard KPI panels used weekly by Tenant Admin / senior Lawyer. |
| BG-06 | **Timely notifications** — users receive in-app and email alerts before hearings, deadlines, and approval requests. | Hearing day-of alert delivered ≥ 24 h in advance for 100 % of scheduled sessions. |

---

## 3. Scope

### 3.1 In Scope — Phase 3

#### 3.1.1 Schema Richness

**Customer enrichment:**
- KYC status and verification date.
- Credit rating field (internal classification).
- Preferred language, preferred communication channel.
- Relationship manager (linked user).
- Industry sector and annual revenue band.
- Risk profile classification.
- Date of birth / incorporation date and gender (Individual customers).

**Case enrichment:**
- Opposing counsel: name, firm, contact details, bar number.
- Legal act references (JSONB array: act name, article, jurisdiction).
- Judgment fields: date, outcome text, judgment reference number, appeal deadline.
- Case risk level (Low / Medium / High / Critical).
- Case priority (Normal / Urgent / Emergency).
- Case source (Referral / Direct / Government / Repeat).
- Case estimated value (for priority triage).
- Seniority assignment (Lead Lawyer + Junior Lawyers list).

**Hearing / Session enrichment:**
- Actual outcome text (separate from planned outcome notes).
- Judge assignment (FK to judges master data).
- Witness list (JSONB: name, type, status).
- Actual start / end times (vs. planned).
- Billable flag and billable duration (minutes).
- Postponement chain: link next session to the one it replaced.

**Wage enrichment:**
- Approval workflow state: `Draft → Submitted → Approved → Paid`.
- Approver comments per step.

#### 3.1.2 Approval Workflow Engine

A generic, reusable approval engine that can be wired to any entity:

- **Wage Approval**: `Draft → Submitted → Approved → Paid` — Senior Accountant or Tenant Admin approves before payment is recorded.
- **Invoice Approval**: `Draft → Review → Approved → Sent → Paid` — optional second-eye review step configurable per tenant.
- **Hearing Postponement Request**: postponing a hearing requires a submitter (Lawyer) and approver (CaseOwner or Tenant Admin).
- **Expense Approval** (enhancement): existing multi-step chain gains full comment history and timeline view (currently persisted in `expense_approvals` but not surfaced in UI).

Approval engine requirements:
- Each step has: actor role, action (`approve`/`reject`), comment (required on reject), timestamp.
- Rejection returns entity to the previous state with reason.
- Complete approval history stored and displayed in status timeline.
- Notifications triggered on each step transition.

#### 3.1.3 Status Timeline Views

Every entity with a `status` field must expose a **Status Timeline** panel in its detail view:

- Entities in scope: Case, Invoice, Expense, Wage, Filing, Session (postponement chain), Document (scan status + version events).
- Timeline entry fields: `from_status`, `to_status`, `actor_name`, `comment`, `timestamp`.
- Stored in a generic `status_history` table keyed by `(entity_type, entity_id)`.
- All existing status transition handlers (case transitions, invoice finalize/void, expense approve/reject) must emit `status_history` records.

#### 3.1.4 Document Management Enhancement

- **Folder Hierarchy**: Full folder tree per case and per customer.  Folders can be nested; drag-and-drop move.  Breadcrumb navigation.  Folder creation, rename, soft-delete.
- **Version Management UI**: Side-by-side metadata comparison between two versions.  Restore (new version from old content) — previously deferred.
- **Bulk Operations**: Multi-select in document list; bulk: move to folder, apply tags, change confidentiality, soft-delete, initiate share.
- **Document Expiry**: `expires_at` field per document (driven by retention policy or manual override).  Alert 30 / 14 / 7 days before expiry.  Expired documents flagged in list view.
- **OCR & Full-text Search**: Text extraction on PDF / image uploads (Tesseract worker).  Full-text search across document content via `tsvector` index.  Search results highlight matched terms.
- **External Sharing (time-bound links)**: Generate a tokenized download link valid for a configurable window (1 h – 30 d).  Link access is audited.  Recipient does not need a LOMA account.

#### 3.1.5 Advanced Calendar & Scheduling

- **iCal Export**: Single-session and multi-session calendar export (`.ics`).
- **Conflict Detection**: Warn on hearing creation if the assigned lawyer has another session within ± 2 h.
- **Resource Booking**: Courtroom / conference room capacity check (optional per-tenant toggle).
- **Full rrule Builder UI**: Visual recurrence rule editor replacing free-text RRULE string (select frequency, days, end condition via checkboxes/dropdowns).

#### 3.1.6 Reporting & Analytics Dashboard

- **Dashboard KPI Widgets** (Tenant Admin view):
  - Open cases by state.
  - Total overdue invoices (amount + count).
  - Upcoming hearings (next 7 days).
  - Expense approval queue depth.
- **Case Aging Report**: Cases by state grouped by days-in-state bands (0-30, 31-90, 91-180, 180+).
- **Receivables Aging**: Outstanding invoices by customer and days-overdue bands.
- **Lawyer Utilization**: Billable hours per lawyer per month (from session billable flag).
- **Expense Category Breakdown**: Stacked bar by category and month.
- **Export enhancements**: All reports export to `.xlsx` (Excel) in addition to CSV.  Dashboard PDF snapshot.

#### 3.1.7 Notification System

- **In-app Notification Center**: Bell icon in app header; unread badge; notification list with mark-all-read, entity deep-links.  Real-time delivery via Server-Sent Events (SSE).
- **Email Digest**: Configurable daily / weekly summary email per user (opt-in).
- **Deadline Reminders**: Task due-date and document expiry reminders — configurable lead time.
- **Hearing Day-of Alert**: Notification at 08:00 local time on the day of any scheduled hearing for assigned case members.
- **Approval Request Notification**: Immediate notification to the next approver when an entity enters their queue.

#### 3.1.8 User-Facing Accessibility & UX Improvements

- **Dark mode** toggle (MUI theme switch; persisted via user preference).
- **Keyboard navigation** audit and fixes for all DataGrid and form components.
- **Print-friendly views** for Case Detail, Invoice, and Wage Slip.
- **Session summary email**: Auto-send post-hearing summary to case members (configurable per tenant).

---

#### 3.1.9 Rich Document Upload & System-wide Integration

Phase 3 introduces a **single rich upload capability** reusable from all major modules so users do not leave context to attach evidence/files:

- **Context-aware upload entry points** in: Customer, Case, Session/Hearing, Filing, Expense, Invoice, Task, and Communications detail views.
- **Smart metadata defaults**: `scope_type`, `scope_id`, `document_type`, confidentiality, tags, and expiry prefilled from current module and tenant policy.
- **Upload profile enforcement** by context:
  - Hearings/Filings: evidence-first doc types and mandatory case reference.
  - Finance (Invoice/Expense): finance-attachment whitelist and retention defaults.
  - Customer KYC: identity-doc checklist and required metadata validation.
- **Batch upload orchestration**: drag-drop multi-file queue, per-file progress, resumable retry, and post-upload bulk metadata edit.
- **Cross-module discoverability**: uploaded documents appear in both Document Library and originating module timelines/activity feeds with deep-links.

Business outcome: reduce attachment friction and ensure every critical workflow can capture documents at point-of-work without navigation loss.

### 3.2 Out of Scope / Deferred to Phase 4

| Item | Rationale |
|------|-----------|
| Dedicated DB per tenant | Enterprise tier only; deferred. |
| AI/ML contract analysis | Requires ML pipeline; Phase 4+. |
| External calendar sync (Google / Outlook) | Phase 2 integration; not yet built. |
| Client portal (external login) | Separate product surface; Phase 4. |
| Billing automation (Stripe / payment gateway) | Out of scope for all phases currently. |
| Multi-region replication | Infrastructure; Phase 4. |
| Custom field builder (generic EAV) | Deferred — Phase 2 deferral maintained. |

---

## 4. Business Rules

### 4.1 Approval Integrity

- An approved wage record is **immutable**; corrections require voiding and re-entry.
- An invoice may not be sent until it has passed all configured approval steps.
- Approval rejection requires a non-empty comment.
- A user may not approve their own submission.

### 4.2 Status History Integrity

- Status history records are **append-only**.
- Every programmatic status transition (service layer) must emit a `status_history` record within the same transaction.
- Manual corrections by Tenant Admin are permitted but must include a `corrective_action` flag and comment.

### 4.3 Document Hierarchy

- A document may belong to at most one folder.
- Deleting a folder soft-deletes the folder only; contained documents are unlinked (not deleted).
- Moving a document under Legal Hold to a different folder is permitted but audited.

### 4.4 External Share Links

- Link tokens are single-use (first download consumes the token) or time-bounded, whichever expires first.
- External share links may not be generated for `HighlyConfidential` documents.
- All link accesses (including expired/invalid attempts) are audit-logged.

### 4.5 OCR Processing

- OCR text is **supplemental metadata** only; original binary is the source of truth.
- OCR failures do not block document visibility.
- Extracted text is stored separately and not included in document export downloads.

---

## 5. Assumptions

- Phase 1 and Phase 2 are fully deployed and stable (70/70 GAP_BACKLOG items resolved).
- The existing `notifications` table and `audit_events` table serve as the foundation; no schema replacement is needed, only augmentation.
- Tesseract OCR (self-hosted) is acceptable for Phase 3; cloud OCR (Azure Document Intelligence) is a Phase 4 upgrade path.
- A single currency per tenant remains in force.
- SSE (Server-Sent Events) is acceptable for real-time notifications; WebSocket is a Phase 4 enhancement.

---

## 6. Business Acceptance

| Role | Sign-off |
|------|----------|
| Sponsor | |
| Product Owner | |
| Architecture | |
| Security | |
| Delivery Lead | |
