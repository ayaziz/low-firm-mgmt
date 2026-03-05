# Software Requirements Specification (SRS)
## Law Office Management Web Application (LOMA)

**Version:** 2.0  
**Date:** 2026-02-25  
**Scope:** Wave 1 MVP + Phase 2 requirements (functional + non-functional)

---

## 1. System Overview

### 1.1 System Context
The system is a multi-tenant web application for law firms. Users authenticate via an OIDC identity provider. The app stores business metadata in PostgreSQL (schema-per-tenant) and document binaries in external object storage (Azure Blob or S3-compatible). A queue + worker performs malware scanning and updates document version status.

```mermaid
graph LR
  UI[SPA Web UI<br/>EN+AR RTL] --> API[Backend API]
  API --> DB[(PostgreSQL<br/>schema-per-tenant)]
  API --> STORE[(Object Storage<br/>Azure Blob / S3)]
  API --> Q[Queue]
  Q --> WORKER[AV Scan Worker]
  API --> IDP[OIDC Identity Provider]
  API --> OBS[Logs/Metrics/Traces]
```

### 1.2 Users and Roles
- Lawyer
- Accountant
- Tenant Admin
- System Admin (platform)

### 1.3 Core Constraints
- External object storage is mandatory for binaries.
- Hierarchical storage path is mandatory.
- Metadata and permissions stored in DB; access enforced by API.
- Separation of duties: Accountant controls finalized finance records.
- English + Arabic required in MVP.

---

## 2. Functional Requirements

### 2.1 Tenancy (FR-TEN)
- FR-TEN-01: System SHALL enforce tenant isolation on every request.
- FR-TEN-02: System SHALL store business data per tenant in a dedicated DB schema.
- FR-TEN-03: System SHALL ensure all storage paths begin with `/tenants/{tenantId}/`.
- FR-TEN-04: System SHALL prevent cross-tenant access even if a user guesses resource IDs.

### 2.2 Authentication (FR-AUTHN)
- FR-AUTHN-01: System SHALL authenticate via OIDC Authorization Code + PKCE.
- FR-AUTHN-02: System SHALL validate JWT access tokens server-side.
- FR-AUTHN-03: System SHALL map users to tenantId and roles at login.

### 2.3 Session and Step-up (FR-SESSION)
- FR-SESSION-01: System SHALL enforce idle session timeout in UI.
- FR-SESSION-02: System SHALL require step-up re-auth for sensitive actions:
  - view/download HighlyConfidential document
  - break document lock
  - apply/release legal hold
  - export finance reports
- FR-SESSION-03: Step-up attempts SHALL be audited.

### 2.4 Authorization (FR-AUTHZ)
- FR-AUTHZ-01: System SHALL enforce RBAC permissions for actions.
- FR-AUTHZ-02: System SHALL enforce ABAC constraints:
  - tenant boundary
  - case membership for case content
  - document ACL and confidentiality rules
- FR-AUTHZ-03: HighlyConfidential documents SHALL require explicit ACL allow.
- FR-AUTHZ-04: Case membership SHALL support roles: CaseOwner, CaseMember, ReadOnly.

### 2.5 Customer Management (FR-CUST)
- FR-CUST-01: System SHALL support Individual and Organization customers.
- FR-CUST-02: Organization customer SHALL require registrationId and taxId.
- FR-CUST-03: Individual customer SHALL require nationalId or passportNumber.
- FR-CUST-04: System SHALL enforce uniqueness per tenant for taxId, registrationId, nationalId, passportNumber when present.
- FR-CUST-05: System SHALL support multiple addresses per customer.
- FR-CUST-06: System SHALL store contacts per customer (no global address book in MVP).
- FR-CUST-07: Contact roles SHALL be configurable by Tenant Admin.
- FR-CUST-08: System SHALL maintain a Party entity reusable for opposing/external parties.
- FR-CUST-09: Party relationship types SHALL be configurable; relationships recorded and auditable.
- FR-CUST-10: System SHALL support customer compliance checklist templates and per-customer status tracking.
- FR-CUST-11: System SHALL prompt for required customer documents defined by templates.
- FR-CUST-12: System SHALL compute customer financial summary (derived from accounting).

### 2.6 Case Lifecycle (FR-CASE)
- FR-CASE-01: Case types SHALL be configurable per tenant (create/edit/disable).
- FR-CASE-02: Case type SHALL link templates: required docs, default tasks, optional session placeholders, optional participant placeholders.
- FR-CASE-03: System SHALL generate systemCaseRef as CASE-{YYYY}-{SEQUENCE}.
- FR-CASE-04: System SHALL store courtCaseNumber as optional field.
- FR-CASE-05: System SHALL support case states: Intake, Open, Active, Pending, Closed, Archived.
- FR-CASE-06: System SHALL support OnHold flag with reason and dates.
- FR-CASE-07: System SHALL allow Reopen from Closed→Active with reason and audit.
- FR-CASE-08: Archived cases SHALL be read-only.
- FR-CASE-09: Cases SHALL support multiple customers and multiple opposing parties.
- FR-CASE-10: Participant roles SHALL be configurable; each participant has visibilityScope.
- FR-CASE-11: Court SHALL be a separate entity; court details may be stored as free-text notes in MVP.
- FR-CASE-12: System SHALL provide sessions calendar with reschedule history and reason.
- FR-CASE-13: System SHALL provide tasks with assignments, fixed reminders, and notifications.
- FR-CASE-14: Notes SHALL be append-only in MVP.
- FR-CASE-15: Filing types SHALL be configurable; statuses supported (Draft/Filed/Accepted/Rejected/Withdrawn).
- FR-CASE-16: Communications log SHALL exist at both customer and case level; types configurable.

### 2.7 Completeness Engine (FR-COMP)
- FR-COMP-01: System SHALL compute Case completeness % using fixed weights in MVP:
  - required fields: 40%
  - required docs: 40%
  - required participants/checklists: 20%
- FR-COMP-02: System SHALL show missing items list in UI.
- FR-COMP-03: Completeness SHALL NOT block progress (except validation constraints).

### 2.8 Document Management (FR-DOC)
- FR-DOC-01: System SHALL store binaries in external object storage; metadata and permissions in DB.
- FR-DOC-02: Storage path SHALL follow:
  `/tenants/{tenantId}/customers/{customerId}/cases/{caseId}/documents/{docType}/{docId}/versions/{versionId}`
- FR-DOC-03: System SHALL issue pre-signed upload URLs after authorization.
- FR-DOC-04: System SHALL validate upload content-type and checksum; enforce size limits.
- FR-DOC-05: System SHALL enforce malware scan gate:
  - Pending hidden
  - Passed visible
  - Failed quarantined
- FR-DOC-06: Document versions SHALL be immutable; no rollback in MVP.
- FR-DOC-07: System SHALL support explicit check-out/in with lock expiry 4 hours.
- FR-DOC-08: Tenant Admin SHALL be able to break locks (step-up + audit).
- FR-DOC-09: System SHALL support confidentiality levels and enforce HighlyConfidential rules.
- FR-DOC-10: System SHALL support internal time-bound sharing to existing users.
- FR-DOC-11: Retention policies SHALL be seeded and visible; not editable in MVP.
- FR-DOC-12: System SHALL support legal hold at case and document level.
- FR-DOC-13: Deletion SHALL be soft delete + restore; purge via retention job only.

#### Phase 2 Additions
- FR-DOC-14: System SHALL support folder hierarchy with parent/child relationships.
- FR-DOC-15: System SHALL auto-create default folders from case type templates on case creation.
- FR-DOC-16: Folder permissions SHALL inherit from parent; explicit ACL overrides supported.
- FR-DOC-17: System SHALL support document templates with Handlebars merge fields.
- FR-DOC-18: Template generation SHALL produce PDF or DOCX output and auto-upload to DMS.
- FR-DOC-19: System SHALL process uploaded documents through OCR (Tesseract ara+eng) after scan passes.
- FR-DOC-20: System SHALL maintain full-text search index (tsvector + GIN) over document content and metadata.
- FR-DOC-21: System SHALL support external sharing links with time-bound expiry, optional password, and download quota.
- FR-DOC-22: HighlyConfidential documents SHALL NOT be shareable externally.
- FR-DOC-23: System SHALL support configurable document numbering schemes per docType.
- FR-DOC-24: System SHALL support multi-file upload (batch of 10, 3 concurrent).

### 2.9 Storage Providers (FR-STO)
- FR-STO-01: System SHALL provide a storage abstraction interface with Azure Blob and S3-compatible implementations.
- FR-STO-02: Tenant SHALL be configurable to use shared or dedicated storage.
- FR-STO-03: Provider credentials SHALL be stored via secret manager references (no plaintext).

### 2.10 Accounting (FR-ACC)
- FR-ACC-01: Invoice SHALL support generic line items and totals.
- FR-ACC-02: Invoice SHALL support invoice-level tax% and discount%.
- FR-ACC-03: Invoice numbering SHALL be INV-{YYYY}-{SEQUENCE}.
- FR-ACC-04: Lawyer MAY create draft invoices (tenant setting).
- FR-ACC-05: Only Accountant SHALL finalize invoices in MVP.
- FR-ACC-06: Final invoices SHALL be read-only; void by Accountant or Tenant Admin with reason.
- FR-ACC-07: Payments SHALL be allocated to a single invoice only.
- FR-ACC-08: Partial payments SHALL be allowed.
- FR-ACC-09: Overpayments SHALL be rejected (no credit balance in MVP).
- FR-ACC-10: Payment creation SHALL be idempotent via Idempotency-Key.
- FR-ACC-11: Expense SHALL support multi-step role-based approvals.
- FR-ACC-12: Receipts SHALL be optional for expenses.
- FR-ACC-13: Wages records SHALL be supported with CSV export.
- FR-ACC-14: Reports SHALL be available as CSV exports, audited.

#### Phase 2 Additions
- FR-ACC-15: System SHALL support time entries with duration, billable flag, rate, and case/task linkage.
- FR-ACC-16: Time entry workflow SHALL follow: Draft → Submitted → Approved → Billed / WriteOff.
- FR-ACC-17: Only CaseOwner or Accountant SHALL approve time entries.
- FR-ACC-18: System SHALL support invoice auto-population from approved time entries.
- FR-ACC-19: WriteOff SHALL require Accountant or TenantAdmin approval.
- FR-ACC-20: System SHALL provide weekly utilization summary per user.

### 2.11 Search (FR-SEARCH)
- FR-SEARCH-01: Global search SHALL cover Customers, Cases, Documents (metadata), Invoices.
- FR-SEARCH-02: Search SHALL support Arabic via normalized fields/collation.
- FR-SEARCH-03: Search results SHALL be permission filtered.
- FR-SEARCH-04: Filters SHALL be provided per entity as approved.

#### Phase 2 Additions
- FR-SEARCH-05: System SHALL provide full-text document content search using PostgreSQL tsvector + GIN.
- FR-SEARCH-06: System SHALL provide a global unified search bar covering cases, customers, documents, and calendar events.

### 2.12 Calendar (FR-CAL) — Phase 2
- FR-CAL-01: System SHALL provide a unified calendar with Day, Week, Month, and Agenda views.
- FR-CAL-02: System SHALL support event types: Hearing, Session, TaskDeadline, Custom, Reminder.
- FR-CAL-03: Hearing/Session/TaskDeadline events SHALL be auto-created from their source entities.
- FR-CAL-04: System SHALL support recurring events using simplified iCalendar RRULE (FREQ, INTERVAL, BYDAY, COUNT, UNTIL).
- FR-CAL-05: System SHALL detect scheduling conflicts and warn users before save.
- FR-CAL-06: System SHALL support in-app and email reminders via background scheduler.
- FR-CAL-07: Default reminders SHALL be configurable per event type.
- FR-CAL-08: System SHALL support case-filtered calendar view.
- FR-CAL-09: Calendar SHALL support drag-to-create and drag-to-reschedule interactions.
- FR-CAL-10: Calendar SHALL support full RTL layout for Arabic.

### 2.13 Hearing Management (FR-HEAR) — Phase 2
- FR-HEAR-01: System SHALL support hearing CRUD linked to case, court, and judge.
- FR-HEAR-02: Hearing states SHALL follow: Scheduled → Adjourned | Postponed | Completed | Cancelled.
- FR-HEAR-03: Creating a hearing SHALL auto-create a CalendarEvent; rescheduling SHALL update both.
- FR-HEAR-04: System SHALL maintain reschedule history with reason and timestamp.
- FR-HEAR-05: Hearing completion SHALL require outcome notes.
- FR-HEAR-06: System SHALL support adjournment with next hearing date.

### 2.14 Folder Management (FR-FOLD) — Phase 2
- FR-FOLD-01: System SHALL support folder CRUD with parent/child hierarchy.
- FR-FOLD-02: System SHALL auto-create default folders from case type folder templates.
- FR-FOLD-03: Folder permissions SHALL inherit from parent; explicit overrides supported.
- FR-FOLD-04: Folders SHALL support archival (no hard delete).
- FR-FOLD-05: Archived folders SHALL be read-only; contained documents inherit 365-day retention floor.
- FR-FOLD-06: System SHALL support moving documents between folders.

### 2.15 Document Templates (FR-TMPL) — Phase 2
- FR-TMPL-01: TenantAdmin SHALL CRUD document templates with Handlebars body.
- FR-TMPL-02: Templates SHALL reference merge fields from case, customer, and court entities.
- FR-TMPL-03: System SHALL support template preview with sample data.
- FR-TMPL-04: System SHALL generate documents from templates in PDF or DOCX format.
- FR-TMPL-05: Generated documents SHALL be auto-uploaded to the target entity's folder.

### 2.16 Time Tracking (FR-TIME) — Phase 2
- FR-TIME-01: System SHALL support time entry CRUD with description, duration, billable flag, and rate.
- FR-TIME-02: Time entries SHALL be linked to a case and optionally to a task.
- FR-TIME-03: Time entry workflow SHALL follow: Draft → Submitted → Approved → Billed / WriteOff.
- FR-TIME-04: CaseOwner or Accountant SHALL approve time entries.
- FR-TIME-05: System SHALL support timer mode (start/stop) and manual entry mode.
- FR-TIME-06: System SHALL provide weekly timesheet view with daily breakdown.
- FR-TIME-07: System SHALL support bulk approval/rejection of time entries.
- FR-TIME-08: System SHALL support invoice generation from selected approved time entries.

### 2.17 Court & Judge (FR-COURT) — Phase 2
- FR-COURT-01: System SHALL support court CRUD with name, jurisdiction, type, branch, contact, and address.
- FR-COURT-02: System SHALL support judge CRUD with name, title, specializations, court assignment.
- FR-COURT-03: Judge SHALL be assigned to exactly one active court; assignment history tracked.
- FR-COURT-04: Court deactivation SHALL prevent new hearing assignments.

---

## 3. Non-Functional Requirements

### 3.1 Security (NFR-SEC)
- NFR-SEC-01: TLS 1.2+ required for all endpoints.
- NFR-SEC-02: Encryption at rest for DB and storage (provider native).
- NFR-SEC-03: Secrets stored in secret manager.
- NFR-SEC-04: Signed URLs must be short-lived; upload URL TTL default 15 minutes.
- NFR-SEC-05: Rate limiting for auth, exports, signed URL issuance.
- NFR-SEC-06: Audit logs immutable append-only.

### 3.2 Privacy & Compliance (NFR-COMP)
- NFR-COMP-01: Retention is configurable later; MVP uses seeded defaults.
- NFR-COMP-02: Legal hold must block purge and retention actions.

### 3.3 Performance (NFR-PERF)
- NFR-PERF-01: Pagination on all list endpoints; cursor-based for large lists.
- NFR-PERF-02: File transfers use direct-to-storage; API not used as file proxy.
- NFR-PERF-03: Metadata search P95 ≤ 500ms under normal load (assumption).

### 3.4 Availability & DR (NFR-AVAIL)
- NFR-AVAIL-01: MVP single-region.
- NFR-AVAIL-02: DB PITR enabled; daily backups.
- NFR-AVAIL-03: Storage soft delete + versioning enabled.
- NFR-AVAIL-04: Restore test performed in Test environment.

### 3.5 Observability (NFR-OBS)
- NFR-OBS-01: Structured logs with correlation IDs.
- NFR-OBS-02: Metrics dashboards for API, DB, storage, queue, worker.
- NFR-OBS-03: Alerts on thresholds (errors, latency, queue depth, scan failures).

### 3.6 Globalization (NFR-GLOB)
- NFR-GLOB-01: English + Arabic (RTL) supported in MVP.
- NFR-GLOB-02: Tenant default timezone; timestamps stored UTC.
- NFR-GLOB-03: Locale formatting for dates/numbers.
- NFR-GLOB-04: Single currency per tenant.

### 3.7 Responsiveness (NFR-RESP) — Phase 2
- NFR-RESP-01: All screens SHALL support 4 breakpoints: mobile (< 640 px), tablet (640–1023 px), desktop (1024–1439 px), wide (≥ 1440 px).
- NFR-RESP-02: Calendar SHALL default to Agenda view on mobile.
- NFR-RESP-03: Navigation SHALL collapse to bottom tab bar on mobile.

### 3.8 Notification SLA (NFR-NOTIF) — Phase 2
- NFR-NOTIF-01: In-app notifications SHALL be delivered within 2 s of trigger event.
- NFR-NOTIF-02: Email reminders SHALL be sent within 60 s of scheduled time.
- NFR-NOTIF-03: System SHALL support user notification preferences (in-app, email, or both).

### 3.9 Calendar & Search Performance (NFR-CALPERF) — Phase 2
- NFR-CALPERF-01: Month-view query (≤ 200 events) p95 ≤ 300 ms.
- NFR-CALPERF-02: Conflict detection query p95 ≤ 200 ms.
- NFR-CALPERF-03: Full-text document search p95 ≤ 500 ms.
- NFR-CALPERF-04: OCR extraction (single page ara+eng) p95 ≤ 30 s.

### 3.10 Storage (NFR-STORAGE) — Phase 2
- NFR-STORAGE-01: Per-tenant storage quota monitoring; alert at 80 % utilization.
- NFR-STORAGE-02: Multi-file upload batch (10 × 50 MB) SHALL complete within 120 s on 100 Mbps.

---

## 4. System Interfaces
- OIDC IdP (Auth)
- Object storage provider (Azure Blob/S3)
- Queue/worker for scanning
- Observability stack (logs/metrics/traces)

