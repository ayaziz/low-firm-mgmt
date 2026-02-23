# Product Requirements Document (PRD)
## Law Office Management Web Application (LOMA)

**Version:** 1.0  
**Date:** 2026-02-23  
**Target Release:** Wave 1 MVP  
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

### 4.2 Explicit Deferrals
- Integrations (email/calendar/messaging) Phase 2
- OCR/full-text search Phase 2
- External sharing Phase 2
- Configurable numbering Phase 2
- Editable notes Phase 2
- Retention editing + advanced lifecycle + multi-region replication Phase 2+
- Dedicated DB (Enterprise) later
- Migration/import Wave 3/4
- Custom fields Phase 2+

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

