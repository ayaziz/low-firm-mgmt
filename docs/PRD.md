# Product Requirements Document (PRD)
## Law Office Management Web Application (LOMA)

**Version:** 2.0  
**Date:** 2026-02-25  
**Target Release:** Wave 1 MVP + Phase 2  
**Portals:** Single web application with role-based navigation (Lawyer, Accountant, Tenant Admin)

---

## 1. Product Vision
A secure, auditable, bilingual (EN/AR) law office management web application that unifies:
- Customer and case lifecycle support for court cases
- Secure document management integrated with external object storage
- Simple accounting with role separation and approvals
- Operational and financial reporting with export and audit

## 2. Guiding Principles
- **Finalize decisions, no ambiguity:** configuration is controlled via Tenant Admin master data.
- **Security first:** RBAC/ABAC, least privilege, explicit controls for HighlyConfidential documents.
- **Document governance:** scan gate before visibility; check-out/in for change control.
- **Court-case reality:** no SLA; track completeness and missing items.
- **Performance:** direct-to-storage for large files; paginated lists; efficient search.
- **Internationalization:** EN/AR with RTL; tenant timezone, locale formats, and currency.

## 3. Personas & Primary Use Cases
- Lawyer: manage customers/cases/docs/tasks/sessions/filings/comms; draft invoices.
- Accountant: finalize invoices, record payments, approve expenses, manage wages, reports.
- Tenant Admin: configure master data and workflows, manage users/memberships.
- System Admin: platform ops (not a UI persona for tenant app screens).

## 4. Scope

### 4.1 MVP Features (Detailed)

#### 4.1.1 Customer Module
**Functional Requirements**
- Support Customer types:
  - Individual
  - Organization (represented by primary contact(s))
- Identity fields and validation:
  - Org: registrationId + taxId required and unique
  - Individual: nationalId or passportNumber required (at least one), unique
- Multiple addresses: Billing/Office/Home/Other; primary flags.
- Contacts per customer; contact roles configurable by Tenant Admin.
- Party reuse:
  - Use Party model for opposing/external parties; same schema as customer identity/address.
  - Party relationships supported with configurable relationship types.
- Compliance checklist:
  - Tenant Admin defines checklist templates.
  - Customer assigned checklist; items track status and optional due dates.
- Required document prompting:
  - Tenant Admin defines customer required documents template.
  - Customer create flow shows missing required docs; does not hard-block save (configurable later).
- Customer financial summary (derived):
  - Outstanding invoices total
  - Total paid (lifetime and date-range)
  - Overdue amount + oldest overdue date
  - Last payment date/amount
  - Credit/prepayment balance (MVP policy keeps this at 0 due to no overpayment)

**Key Screens**
- Customer List (filters, search, pagination)
- Customer Detail:
  - Overview (financial summary + completeness)
  - Contacts & Parties
  - Addresses
  - Documents
  - Compliance Checklist
  - Activity feed
  - Audit (role-limited)
- Customer Create/Edit

#### 4.1.2 Case Module
**Functional Requirements**
- Case Types:
  - Tenant Admin can create/edit/disable case types for multi-country naming.
  - Case type templates:
    - required docs template link (case)
    - default task template
    - milestone/session placeholder template (optional)
    - participant placeholder template (optional)
- Case references:
  - systemCaseRef generated as CASE-{YYYY}-{SEQUENCE}
  - courtCaseNumber optional
- Case states:
  - Intake, Open, Active, Pending, Closed, Archived
  - OnHold flag (reason, start/end)
  - Reopen Closed→Active (reason required)
  - Archived is read-only
- Multi-party:
  - multiple customers per case
  - multiple opposing parties per case
- Participants:
  - participant roles configurable
  - visibilityScope per participant: LegalOnly / FinanceAllowed
  - Court is separate entity (MVP: minimal fields; details captured as notes)
- Sessions calendar:
  - create/update/reschedule/cancel/complete
  - reschedule history and reason
- Tasks:
  - assignments and fixed reminders
  - attachments via document links
  - notification center events
- Notes:
  - append-only in MVP
- Filings:
  - filing types configurable; statuses: Draft/Filed/Accepted/Rejected/Withdrawn
- Communications log:
  - both customer-level and case-level
  - types configurable
  - visibilityScope supported

**Key Screens**
- Case List (filters: type, state, owner, completeness range)
- Case Detail:
  - Timeline
  - Tasks
  - Sessions
  - Filings
  - Participants
  - Notes
  - Communications
  - Documents
  - Financial Summary (invoice headers only for Lawyer)
  - Audit
  - Completeness panel (missing items)

#### 4.1.3 Document Module
**Functional Requirements**
- Storage provider abstraction:
  - Azure Blob provider
  - S3-compatible provider
- Tenant storage configuration:
  - shared vs dedicated
  - tenant provides details; stored in secret manager references
- Hierarchical storage path (mandatory).
- Signed upload URLs (MVP focus).
- Malware scan gate:
  - Pending hidden
  - Passed visible
  - Failed quarantined (admin-visible only; uploader sees generic failure)
- Immutable versions; no rollback in MVP.
- Check-out/in:
  - lock expiry 4 hours
  - admin break lock with audit + step-up
- Confidentiality levels:
  - Normal / Confidential / HighlyConfidential
  - HighlyConfidential requires explicit ACL allow; step-up for view/download
- Internal time-bound sharing only (existing users).
- Retention seeded view-only; legal hold case/doc; soft delete/restore.

**Key Screens**
- Document Library (customer or case scope)
- Document Detail:
  - metadata, confidentiality
  - version list (Passed only by default)
  - lock status (checkout/in)
  - internal shares
  - access history (audit-limited)
- Upload modal (docType, confidentiality, tags, link targets)

#### 4.1.4 Accounting Module
**Functional Requirements**
- Invoice:
  - generic line items
  - tax% and discount% at invoice level
  - numbering: INV-{YYYY}-{SEQUENCE}
  - Lawyer drafts (tenant setting)
  - Accountant finalizes; final read-only; void by Accountant or Tenant Admin
  - PDF export
- Payments:
  - single-invoice allocation
  - partial payments allowed
  - no overpayment (reject)
  - fixed payment methods list
  - idempotency for payment create
- Expenses:
  - link to case, customer, or general
  - fixed categories
  - receipts optional
  - beneficiary user optional
  - multi-step role-based approvals
- Wages:
  - record per period; payment status; CSV export
- Reporting:
  - operational + financial; CSV export

**Key Screens**
- Invoice List/Detail
- Payment Entry
- Expenses + Approval Queue
- Wages List
- Reports dashboard

#### 4.1.5 Admin
- Manual user create/deactivate/reactivate
- Role assignment and case membership roles
- Master data management (all approved lists/templates/workflows)
- Plan tier configuration flags (Standard/Enterprise)

### 4.2 Explicit Deferrals (MVP → Phase 2)
> Items below were deferred from MVP. Items promoted to Phase 2 scope are listed in §4.3.

- Retention editing + advanced document lifecycle + multi-region replication Phase 2+
- Dedicated DB per tenant (Enterprise tier) — later
- Migration/import tooling — Wave 3/4
- Generic custom fields — Phase 2+

### 4.3 Phase 2 Features

> Traced from PRD §4.2 deferrals, BRD gaps, and Phase 1 baseline audit. See `docs/phase2/PHASE2_VISION_AND_METRICS.md` for drivers.

#### 4.3.1 Calendar & Scheduling Module
- Unified calendar with Day / Week / Month / Agenda views.
- Event types: Hearing, Session, TaskDeadline, Custom, Reminder.
- Recurring events (simplified iCalendar RRULE subset).
- Conflict detection across event types.
- In-app + email reminders via background scheduler.
- Case-filtered calendar view.
- Full RTL / bilingual support.
- **Ref:** `docs/phase2/CALENDAR_SPEC.md`

#### 4.3.2 Court, Judge & Hearing Management
- Court entity: name, jurisdiction, address, branch, contact info.
- Judge entity: name, title, specializations, contact, court assignment.
- Hearing lifecycle: Scheduled → Postponed / Adjourned / Completed / Cancelled.
- Hearing auto-creates CalendarEvent; reschedule propagates.
- Judge–Case assignment history.
- **Ref:** `docs/phase2/PHASE2_DOMAIN_MODEL_AND_WORKFLOWS.md` §1–§3

#### 4.3.3 Document Management v2
- Folder / library hierarchy with per-case default templates.
- Document templates (Handlebars engine; PDF / DOCX output).
- OCR pipeline (Tesseract ara+eng, BullMQ `ocr-extraction` queue).
- Full-text search (PostgreSQL `tsvector` + GIN index).
- Multi-file upload (batch of 10, 3 concurrent, progress bars).
- External sharing links (time-bound, optional password, download quotas).
- Azure Blob Storage provider + hierarchical path strategy.
- Configurable document numbering schemes.
- **Ref:** `docs/phase2/DOC_MGMT_V2_SPEC.md`

#### 4.3.4 Time Tracking & Billing Integration
- TimeEntry: description, duration (hours + minutes), billable flag, rate, case/task linkage.
- Workflow: Draft → Submitted → Approved → Billed / WriteOff.
- Approval by case owner or Accountant.
- Auto-populate invoice line items from approved time entries.
- Weekly summary with utilization metrics.

#### 4.3.5 Dashboard v2
- Role-specific dashboards (Lawyer, Accountant, TenantAdmin).
- Widgets: Upcoming Schedule, Task Board, Billable Hours, Revenue Summary, Storage Usage, Audit Log.
- **Ref:** `docs/phase2/UIUX_PHASE2_PROPOSAL.md` §3

#### 4.3.6 UI / UX Redesign
- Grouped sidebar navigation with collapsible sections.
- Responsive breakpoints: mobile (< 640 px), tablet (640–1023 px), desktop (1024–1439 px), wide (≥ 1440 px).
- Notification center (bell icon, dropdown, WebSocket real-time).
- Global search bar (case / customer / document).
- Editable notes (rich text, Markdown support).
- **Ref:** `docs/phase2/UIUX_PHASE2_PROPOSAL.md`

#### 4.3.7 Authentication Upgrade
- OIDC / PKCE authentication (replacing dev-mode JWT login).
- Tenant-specific IdP configuration.
- Token refresh and session management.

### 4.4 Phase 2 Deferrals
> Items explicitly out of scope for Phase 2 — targeted for Phase 3+.

- Mobile native application (iOS / Android)
- Advanced analytics and BI dashboards
- Client / customer self-service portal
- Third-party integrations (email ingestion, SMS / WhatsApp, external calendar sync)
- SLA management
- Multi-region storage replication
- Dedicated database per tenant (Enterprise)
- Generic custom fields engine

## 5. Acceptance Criteria (MVP)
- Role-based navigation and access match permission matrix.
- All list views paginated and filterable.
- All document uploads require signed URL and scan gate before visibility.
- HighlyConfidential access requires explicit ACL allow + step-up.
- Payments cannot exceed invoice remaining balance.
- Expenses follow multi-step role-based approval chain.
- English + Arabic supported end-to-end, including RTL.
- Reports export to CSV; invoice export to PDF; all exports audited.

## 6. Non-Functional Requirements (MVP summary)
- Security, performance, availability, observability, scalability, globalization as per SRS.

## 7. Non-Functional Requirements — Phase 2 Additions
| Category | Requirement | Target |
|---|---|---|
| Responsiveness | Mobile-first layouts for all new screens | 4 breakpoints (< 640, 640–1023, 1024–1439, ≥ 1440 px) |
| Notification SLA | In-app notification delivery | ≤ 2 s from trigger event |
| Notification SLA | Email reminder delivery | ≤ 60 s from scheduled time |
| Calendar performance | Month-view query (≤ 200 events) | p95 ≤ 300 ms |
| Calendar performance | Conflict detection query | p95 ≤ 200 ms |
| OCR latency | Single-page Arabic+English extraction | p95 ≤ 30 s |
| Full-text search | Document content search | p95 ≤ 500 ms |
| Upload throughput | Multi-file batch (10 files × 50 MB) | ≤ 120 s on 100 Mbps link |
| Storage quota | Per-tenant storage monitoring | Alert at 80 % utilization |

