# LOMA — Phase 3 Product Requirements Document (PRD)

> **Version**: 3.0  
> **Status**: Draft — Ready for Implementation  
> **Assumes**: Phase 1 + Phase 2 complete.  
> **Format**: Feature areas → Functional Requirements (FR) → Key Screens → Acceptance Criteria.

---

## 1. Product Vision (Phase 3)

Phase 3 transforms LOMA from a **data entry system** into an **intelligent legal operations hub**.  Every record speaks for itself: approvals are traceable, document versions are comparable, statuses narrate their own history, and dashboards replace manual reports.

### 1.1 User Personas (unchanged from Phase 1)

| Persona | Primary Phase 3 Value |
|---------|-----------------------|
| **Lawyer** | Rich case context (opposing counsel, risk, judgments), hearing alerts, timeline view of case journey. |
| **Accountant** | Invoice and wage approval workflows, receivables aging dashboard, Excel exports. |
| **Tenant Admin** | KPI dashboard, notification control, user access reports, document expiry oversight. |

---

## 2. Feature Area: Schema Enrichment

### 2.1 Customer Profile Enrichment

**Functional Requirements**

- FR-CE-01: A customer record shall support `kyc_status` with values `NotStarted / InProgress / Verified / Rejected`.
- FR-CE-02: `kyc_verified_at` timestamp recorded when KYC moves to `Verified`.
- FR-CE-03: `credit_rating` field with values `AAA / AA / A / BBB / BB / B / Unrated`.
- FR-CE-04: `preferred_language` aligned to tenant supported languages (`en` / `ar`).
- FR-CE-05: `preferred_communication_channel` values: `Email / Phone / WhatsApp / Post`.
- FR-CE-06: `relationship_manager_user_id` FK to internal user; displayed as user name.
- FR-CE-07: `industry_sector` free-text or configurable master data (tenant admin).
- FR-CE-08: `risk_profile` values: `Low / Medium / High`.
- FR-CE-09: Individual customers: `date_of_birth` (Date), `gender` (`Male / Female / NotSpecified`).
- FR-CE-10: Organization customers: `incorporation_date` (Date), `annual_revenue_band` (`<1M / 1M-10M / 10M-100M / >100M`).
- FR-CE-11: Customer list view shall display KYC status badge and risk profile chip.
- FR-CE-12: Customer detail shall show status timeline for KYC progression.

**Key Screens**

- **Customer Edit Form** — New "Profile & KYC" tab with all enrichment fields.
- **Customer List** — KYC status filter chip; risk profile colour-coded badge.
- **Customer Detail** — "KYC & Risk" section; status timeline *(see Feature Area: Status Timeline)*.

**Acceptance Criteria**

- Customer can be saved with any combination of new optional fields.
- KYC status transition records a `status_history` entry with actor and timestamp.
- Relationship manager lookup renders existing users via API autocomplete.

---

### 2.2 Case Enrichment

**Functional Requirements**

- FR-CA-01: `opposing_counsel` JSONB object: `{ name, firm, barNumber, email, phone }` per opposing party.  May be set per `case_party` where `party_role_type = 'Opposing'`.
- FR-CA-02: `legal_acts` JSONB array: `[{ actName, article, jurisdiction, notes }]` — editable multi-row.
- FR-CA-03: Judgment fields on case: `judgment_date` (Date), `judgment_outcome` (text), `judgment_reference` (varchar), `appeal_deadline` (Date).
- FR-CA-04: `risk_level` values: `Low / Medium / High / Critical`.
- FR-CA-05: `priority` values: `Normal / Urgent / Emergency`.
- FR-CA-06: `source` values: `Referral / Direct / Government / Repeat`.
- FR-CA-07: `estimated_value` (Decimal) — financial scope of the case.
- FR-CA-08: `lead_lawyer_user_id` and `junior_lawyers` (UUID array) separate from case membership.
- FR-CA-09: Case list view shall allow filtering by `risk_level`, `priority`, and `source`.
- FR-CA-10: Case detail "Overview" tab shows enrichment fields in a structured grid.

**Key Screens**

- **Case Create / Edit** — "Details" section expanded with new fields; Legal Acts multi-row editor.
- **Case Detail — Overview Tab** — Opposing Counsel card; Legal Acts card; Judgment card (shown when `judgment_date` present).
- **Case List** — Risk level column with colour badges; priority flag icon; filter panel updated.

**Acceptance Criteria**

- Legal acts array is serialized/deserialized correctly; at least one empty entry shown in edit mode.
- Opposing counsel fields appear only when case has an opposing `case_party`.
- Judgment card is hidden until `judgment_date` is populated.

---

### 2.3 Hearing / Session Enrichment

**Functional Requirements**

- FR-SE-01: `judge_id` FK to judges master data; displayed as judge full name + title.
- FR-SE-02: `witness_list` JSONB array: `[{ name, witnessType: Prosecution/Defense/Expert/Neutral, status: Scheduled/Appeared/Absent }]`.
- FR-SE-03: `actual_outcome` text field (separate from `outcome_notes` which holds pre-session planning).
- FR-SE-04: `actual_start_time` and `actual_end_time` timestamps, filled post-session.
- FR-SE-05: `is_billable` boolean flag; `billable_duration_minutes` integer.
- FR-SE-06: `postponed_from_session_id` FK — links a new session to the session it replaced (postponement chain).
- FR-SE-07: Session detail shows postponement chain breadcrumb: "Replaced Session #N → #N+1 → #N+2".
- FR-SE-08: When completing a session (status → `Completed`), the "Complete Session" dialog prompts for `actual_outcome`, `actual_start_time`, `actual_end_time`, and `is_billable`.

**Key Screens**

- **Session Detail Panel** — Expanded form with witness list editor; actual time inputs; billable toggle.
- **Complete Session Dialog** — Structured form for post-session data capture.
- **Session List (within Case)** — Billable icon column; Postponement chain indicator.

**Acceptance Criteria**

- Witness list can have 0..N entries added/removed inline without saving.
- `postponed_from_session_id` is set automatically when "Reschedule" action creates a new session.
- Report "Lawyer Utilization" correctly sums `billable_duration_minutes` from completed sessions.

---

## 3. Feature Area: Approval Workflow Engine

### 3.1 Wage Approval Workflow

**Functional Requirements**

- FR-WA-01: Wages shall have states: `Draft → Submitted → Approved → Paid`.
- FR-WA-02: `Submitted` state created when the submitter (Accountant or Admin) clicks "Submit for Approval".
- FR-WA-03: Approver role is configurable in `expense_approval_workflows` (reuse or separate config); default: Tenant Admin.
- FR-WA-04: Approver can `Approve` (moves to `Approved`) or `Reject` (returns to `Draft`).
- FR-WA-05: `Paid` state is a separate action after `Approved`; Accountant marks as paid and records payment date, method, reference.
- FR-WA-06: Self-approval is blocked: submitter cannot be the approver.
- FR-WA-07: Each transition records: actor, comment, timestamp — visible in wage status timeline.
- FR-WA-08: On `Submitted`, notify the approver. On `Approved`/`Rejected`, notify the submitter.

**Key Screens**

- **Wages List** — Status column with coloured badge; action buttons vary by current status and user role.
- **Wage Detail / Side Panel** — Status timeline; "Submit", "Approve", "Reject", "Mark Paid" buttons (role-gated).
- **Approve/Reject Dialog** — Comment field (required for rejection), action buttons.

**Acceptance Criteria**

- A wage in `Draft` shows a "Submit for Approval" button to Accountant and Admin.
- A wage in `Submitted` shows "Approve" and "Reject" to the approver role; submitter sees read-only panel.
- Approving and then marking paid records `paid_at` and `payment_method` on the wage record.

---

### 3.2 Invoice Approval Workflow

**Functional Requirements**

- FR-IA-01: Invoice states extended: `Draft → Review → Approved → Sent → Paid → Void`.
- FR-IA-02: `Review` step is optional and controlled by a tenant-level toggle: `invoiceApprovalRequired (boolean)`.
- FR-IA-03: When enabled, Lawyer (or any drafter) clicks "Submit for Review"; invoice moves to `Review`.
- FR-IA-04: Senior Accountant or Tenant Admin approves/rejects from Review.
- FR-IA-05: Rejection returns invoice to `Draft` with comment recorded.
- FR-IA-06: If `invoiceApprovalRequired = false`, invoice goes directly from `Draft` to `Finalized` (Phase 1 behaviour preserved).
- FR-IA-07: "Finalize" button is replaced by "Approve & Finalize" when approval is enabled.
- FR-IA-08: Invoice status timeline shows all transitions including Review actions.

**Key Screens**

- **Invoice Detail** — Status badge updated; action buttons contextual; status timeline panel (same component as other entities).
- **Approval Queue** (new tab in Accounting) — Lists all invoices/wages/expenses awaiting the current user's action.

**Acceptance Criteria**

- Toggle `invoiceApprovalRequired` in Admin → Settings affects invoice flow immediately (no migration needed).
- Approval queue shows combined list: invoices in `Review`, wages in `Submitted`, expenses in `PendingApproval`.
- Count badge on "Approval Queue" tab reflects unactioned items.

---

### 3.3 Hearing Postponement Approval

**Functional Requirements**

- FR-HP-01: Postponing a session requires: reason text (mandatory), requested new date/time.
- FR-HP-02: Postponement request is logged in `session_reschedules` (existing table, enriched with `approval_status`).
- FR-HP-03: CaseOwner or Tenant Admin approves the postponement.
- FR-HP-04: If approved: new session created (`postponed_from_session_id` FK), old session set to `Postponed`.
- FR-HP-05: If rejected: session remains in original state; rejection reason stored.
- FR-HP-06: Lawyer submitting the request sees "Pending Approval" status on the session until decision.

**Acceptance Criteria**

- End-to-end: Lawyer submits postponement → CaseOwner approves → original session `Postponed`, new session `Planned`.
- Rejection: original session reverts; postponement chain is not extended.

---

## 4. Feature Area: Status Timeline Views

### 4.1 Universal Status Timeline Component

**Functional Requirements**

- FR-ST-01: A `StatusTimeline` React component renders a vertical MUI Timeline from an array of `StatusHistoryEntry` objects.
- FR-ST-02: Each entry shows: status chip (coloured by state), actor name + avatar, relative and absolute timestamp, comment (if present).
- FR-ST-03: Timeline entries are ordered newest-first by default; toggle to oldest-first.
- FR-ST-04: The component is used in: Case Detail, Invoice Detail, Expense Detail, Wage Detail, Filing Detail, Document Detail.
- FR-ST-05: Backend exposes `GET /:entity/:id/status-history` for each entity.
- FR-ST-06: All existing status transitions (case lifecycle, invoice finalize/void, expense approval) retroactively generate seed history records during Phase 3 migration.

**Key Screens**

- **Case Detail — Timeline Tab**: Shows case state history interleaved with other key events (hearing added, task completed, document uploaded) — a full activity feed.
- **Wage Detail / Invoice Detail / Expense Detail**: Collapsible "Approval & Status History" section within detail panel.

**Acceptance Criteria**

- Creating a new entity and immediately viewing its status history shows at least one entry: "Created" → initial status.
- Approving a wage adds two entries: "Submitted" and "Approved" with distinct timestamps and actor names.
- The Case activity feed shows mixed event types (status change + session add + document upload) sorted by timestamp.

---

## 5. Feature Area: Document Management Enhancement

### 5.1 Folder Hierarchy

**Functional Requirements**

- FR-DH-01: Documents listed within a case or customer context shall be organizable into named folders.
- FR-DH-02: Folders support arbitrary nesting depth.  A breadcrumb shows current path.
- FR-DH-03: Create Folder (name, parent), Rename Folder, Move Folder, Soft-delete Folder (with confirmation; contained documents are unlinked, not deleted).
- FR-DH-04: Document "Move to Folder" action available from document context menu in list view.
- FR-DH-05: Folder tree is shown in a left-pane sidebar within Document Library; clicking a folder filters the list.
- FR-DH-06: "Unfiled" virtual folder shows documents with no `folder_id` assigned.

**Key Screens**

- **Document Library** — Left sidebar: folder tree with expand/collapse, right-click context menu (Rename / Delete / Create Subfolder). Main pane: document list filtered by selected folder.
- **Move to Folder Dialog** — Tree picker showing all folders for the current scope.

**Acceptance Criteria**

- Create folder, move 2 documents into it, navigate into folder, and see only those 2 documents.
- Deleting a folder and verifying both documents appear under "Unfiled".
- Folder names are unique within the same parent and scope.

---

### 5.2 Version Management

**Functional Requirements**

- FR-VM-01: Document Detail version list shows: version number, uploaded by, size, upload date, scan status.
- FR-VM-02: "Compare with Previous" button on any version (v2+) opens a metadata comparison panel.
- FR-VM-03: Metadata comparison shows: uploaded by, size delta, filename change, tag changes.
- FR-VM-04: "Restore" action creates a new version with the content of the selected older version (not a rollback; immutability preserved).
- FR-VM-05: Restore is only available to users with `UploadNewVersion` permission and requires checkout if document is unlocked.

**Acceptance Criteria**

- Uploading v1 then v2 and clicking "Compare with Previous" on v2 shows a side-by-side diff panel.
- Restore creates v3 with an audit note "Restored from v1".

---

### 5.3 Bulk Operations

**Functional Requirements**

- FR-BO-01: Document list supports multi-select via checkbox column (header selects all visible).
- FR-BO-02: Bulk action bar appears when ≥ 1 row selected: "Move to Folder", "Add Tags", "Change Confidentiality", "Delete (soft)", "Share".
- FR-BO-03: Bulk operations are processed server-side in a single API call accepting an array of document IDs.
- FR-BO-04: Progress toast shown during bulk operation; success/failure summary shown on completion.

**Acceptance Criteria**

- Select 5 documents, bulk move to a folder, verify all 5 are in the folder.
- Bulk delete moves all 5 to soft-deleted state; they do not appear in the main list.

---

### 5.4 Document Expiry Tracking

**Functional Requirements**

- FR-DX-01: Documents have an optional `expires_at` date set at upload or by editing metadata.
- FR-DX-02: A scheduled job (daily) sends notifications to document owners for documents expiring in 30 / 14 / 7 days.
- FR-DX-03: Document list shows an "Expiry" column with coloured indicator: green (> 30 d), amber (7-30 d), red (< 7 d or expired).
- FR-DX-04: Expired documents are flagged but remain accessible (no auto-delete).  A banner in document detail warns "This document has expired."
- FR-DX-05: Document Filter includes: "Expiring within 30 days", "Expired".

**Acceptance Criteria**

- Document with `expires_at` set to yesterday shows red "Expired" badge in list.
- Notification job mock run triggers correct notification entries for documents 30, 14, 7 days from expiry.

---

### 5.5 OCR & Full-text Search

**Functional Requirements**

- FR-OS-01: After document scan completes (`Passed`), a secondary OCR job is enqueued via BullMQ.
- FR-OS-02: OCR supports PDF and common image formats (PNG, JPG, TIFF).  Non-text file types are skipped gracefully.
- FR-OS-03: Extracted text stored in `document_ocr_text` table: `(document_id, version_id, text_content tsvector, raw_text TEXT)`.
- FR-OS-04: Search bar within Document Library (per scope: case or customer) searches both title and OCR text.
- FR-OS-05: Search results highlight matched terms in title (frontend) and show OCR snippet (backend).
- FR-OS-06: OCR extraction failure does not affect document visibility.

**Acceptance Criteria**

- Upload a PDF containing the word "arbitration" → verify it appears when searching "arbitration" in Document Library.
- Non-PDF file (e.g. .docx without OCR support) is searchable by title only; no error displayed.

---

### 5.6 External Sharing

**Functional Requirements**

- FR-ES-01: Authorized user can generate a tokenized share link per document version.
- FR-ES-02: Link configuration: expiry (1h / 24h / 7d / 30d), optional password, max-download count (1..10).
- FR-ES-03: Link recipient (unauthenticated) accesses `/share/{token}` and can download without login (optionally after entering password).
- FR-ES-04: `HighlyConfidential` documents cannot have external share links.
- FR-ES-05: All external link accesses (success, expired, invalid) are audit-logged with IP and user-agent.
- FR-ES-06: Creator can revoke the link before expiry.

**Acceptance Criteria**

- Generate link for a Normal confidentiality document, open in incognito, download successfully.
- After downloading once (max-download = 1), second attempt returns "Link expired or already used."
- External share link for HighlyConfidential document: "Generate Link" button is disabled.

---

## 6. Feature Area: Reporting & Analytics Dashboard

**Functional Requirements**

- FR-RP-01: Landing page for Tenant Admin and senior roles shows a **KPI Dashboard** with configurable widget slots.
- FR-RP-02: Widgets: Open Cases by State (horizontal bar), Overdue Invoices (metric card + list), Upcoming Hearings (agenda view, next 7 days), Approval Queue Depth (metric card).
- FR-RP-03: **Case Aging Report**: tabular + bar chart; columns: Case Ref, Title, State, Days in Current State, Assigned Lawyer.  Filter by state, lawyer, case type.
- FR-RP-04: **Receivables Aging**: unpaid invoices grouped by 0-30, 31-60, 61-90, 90+ days overdue.  Customer-level drilldown.
- FR-RP-05: **Lawyer Utilization**: billable minutes per lawyer per calendar month, converted to hours.  Bar chart by lawyer + month.  Prerequisite: Session billable flag (FR-SE-05).
- FR-RP-06: **Expense Category Breakdown**: stacked bar by month grouped by category.  Filter by fiscal period.
- FR-RP-07: All reports support export to `.xlsx` (Excel) and `.csv`.
- FR-RP-08: Dashboard PDF snapshot — "Print / Export to PDF" triggers browser-friendly print stylesheet.

**Acceptance Criteria**

- KPI Dashboard loads within 2 s.
- Overdue Invoices widget count matches the Receivables Aging 30+ bucket total.
- Excel export retains column headers and data types (date cells as Date, currency as Number).

---

## 7. Feature Area: Notification System

**Functional Requirements**

- FR-NT-01: Bell icon in app header with unread badge count.
- FR-NT-02: Clicking bell opens a slide-out Notification Center panel listing recent notifications.
- FR-NT-03: Each notification: icon, title, body snippet, relative time, entity deep-link, read/unread state.
- FR-NT-04: "Mark all as read" and individual mark-as-read supported.
- FR-NT-05: Real-time delivery via Server-Sent Events (SSE) on `/api/v1/notifications/stream`.
- FR-NT-06: Email digest: user configures frequency (None / Daily / Weekly) in profile settings.  Scheduled email job aggregates unread notifications.
- FR-NT-07: Hearing day-of alert: job runs at 07:00 UTC, sends notification to all case members with a session today.
- FR-NT-08: Task/document deadline reminder: configurable lead time (1 / 3 / 7 days before due).
- FR-NT-09: Approval request notification: immediate on entity entering approver queue.

**Acceptance Criteria**

- Create a task due tomorrow → 1-day reminder notification appears at 07:00 next run.
- Approve a wage → submitter receives notification "Your wage submission for [period] has been approved."
- SSE connection drops gracefully (client reconnects with `Last-Event-ID`).

---

## 8. Feature Area: Rich Document Upload & System-wide Integration

### 8.1 Unified Rich Upload Component

**Functional Requirements**

- FR-RU-01: A shared `RichDocumentUpload` component shall support drag-drop, file picker, and clipboard paste (images/PDF where browser permits).
- FR-RU-02: Multi-file queue supports parallel uploads with per-file states: `Queued / Uploading / Scanning / OCR / Done / Failed`.
- FR-RU-03: Users can edit metadata per-file before submit and in post-upload bulk-edit mode.
- FR-RU-04: Upload validation enforces file size, extension/MIME policy, and context-specific required metadata.
- FR-RU-05: Failed files can be retried individually without restarting successful uploads.

### 8.2 Context-aware Integration Points

- FR-RU-06: Upload is embedded in Case Detail (Documents tab + timeline quick action).
- FR-RU-07: Upload is embedded in Customer Detail for KYC and general customer documents.
- FR-RU-08: Upload is available in Session/Hearing and Filing forms for evidence attachments.
- FR-RU-09: Upload is available in Invoice and Expense forms for finance supporting documents.
- FR-RU-10: Upload is available in Task and Communication drawers for ad-hoc attachments.
- FR-RU-11: Each upload persists origin metadata (`originModule`, `originEntityId`) for traceability and UI backlinking.

### 8.3 Acceptance Criteria

- Uploading 10 mixed files from Case Detail completes with per-file progress and statuses visible to user.
- A failed scan/OCR on one file does not block other files from completing.
- A document uploaded from Expense detail appears in both Expense attachments and Document Library with consistent metadata.
- KYC upload enforces required doc type and prevents final submit when mandatory metadata is missing.

## 9. Acceptance Criteria — Full Phase 3

| # | Criteria |
|---|----------|
| AC-01 | All new schema columns added via migration; no data loss; rollback script provided. |
| AC-02 | Status timeline present on all 6 entity types: Case, Invoice, Expense, Wage, Filing, Document. |
| AC-03 | Wage approval end-to-end: Create → Submit → Approve → Mark Paid — all 4 steps validated by integration test. |
| AC-04 | Invoice approval toggle: `invoiceApprovalRequired = true` adds Review step; `false` skips it.  Both paths tested. |
| AC-05 | Document folder hierarchy: create, nest, move, delete — all operations reflect correctly in Document Library. |
| AC-06 | OCR search finds text within uploaded PDF content within document library search. |
| AC-07 | Receivables aging numbers match raw invoice query. |
| AC-08 | SSE notification delivered within 5 s of server event trigger. |
| AC-09 | All existing Phase 1+2 tests still pass (no regression). |
| AC-10 | Bilingual (EN/AR) support maintained for all new UI strings. |

## 10. Non-Functional Requirements

- All new API endpoints respond within **500 ms** at p95 under normal load.
- OCR job processing: average completion within **30 s** per document (1–20 page PDF).
- Dashboard KPIs: cached with 60-second TTL; served from Redis.
- External share link token entropy: minimum 128-bit (crypto-random).
- New migrations are reversible (DOWN migration provided for each UP).
