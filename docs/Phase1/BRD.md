# Business Requirements Document (BRD)
## Law Office Management Web Application (LOMA)

**Version:** 2.0  
**Date:** 2026-02-25  
**Owner:** Product / Business  
**Scope:** Wave 1 (MVP) + Phase 2 + explicit deferrals  
**Terminology (canonical):** Customer/Client, Case/Matter, Document, Invoice, Payment, Expense, User, Role

---

## 1. Executive Overview

### 1.1 Problem Statement
Law offices commonly manage Customers, Cases, Documents, and Accounting artifacts across spreadsheets, email, shared drives, and informal tools. This results in:
- Loss of traceability between Customer ↔ Case ↔ Document ↔ Finance
- Weak security controls (over-sharing, lack of confidentiality enforcement, unmanaged links)
- Limited auditability (who accessed what and when)
- Missed deadlines (tasks/hearings/sessions not tracked consistently)
- Delayed billing and inaccurate financial visibility (manual invoicing, payment tracking)

### 1.2 Business Vision
Provide a secure, auditable, bilingual (English + Arabic) web application that:
- Centralizes Customer and Case lifecycle operations (court-case support)
- Implements secure Document Management using external object storage (Azure Blob and S3-compatible)
- Enables simple accounting for invoices, payments, expenses (multi-step approvals), wages records
- Supports multi-country tenant needs via configurable case types and role-configurable master data

---

## 2. Business Goals

### 2.1 Primary Goals
1. **Operational Control**
   - Standardize capture of Customer and Case data with completeness visibility.
   - Track hearings/sessions calendar and deadlines with reminders.
   - Maintain structured filings, communications, and notes.

2. **Governed Document Management**
   - Store all document binaries in governed object storage with hierarchical structure.
   - Enforce confidentiality, explicit access control, check-out/in, and audit trails.
   - Prevent malware propagation via mandatory scan gate and quarantine.

3. **Financial Discipline (Simple Accounting)**
   - Provide invoice issuance (draft/final), payments recording (no overpayment), expense approvals, and wages records.
   - Offer financial visibility via receivables and cashflow reports and CSV exports.
   - Enforce separation of duties between Lawyer and Accountant.

4. **Multi-country Readiness**
   - Configurable case types and master data lists per tenant.
   - English + Arabic from day 1 (RTL support).
   - Tenant timezone and locale formatting; single currency per tenant.

### 2.2 Success Criteria (KPIs)
- **Adoption:** ≥ 80% of active cases have weekly updates (tasks/sessions/documents).
- **Case creation efficiency:** reduce time to create a case record by ≥ 50% vs baseline process.
- **Document governance:** 100% of case/customer documents stored through the managed DMS (no unmanaged external storage).
- **Security quality:** 0 critical authorization vulnerabilities pre go-live.
- **Billing efficiency:** reduce invoice draft-to-final time by ≥ 30%.
- **Availability:** meet MVP availability target in SRS.

### 2.3 Phase 2 KPIs
- **Time-to-billing cycle:** reduce from manual tracking to ≤ 48 h from service delivery to invoice draft.
- **Document retrieval time:** p95 ≤ 3 s for full-text search results.
- **Calendar adoption:** ≥ 90 % of hearings and sessions entered via calendar (vs ad-hoc notes).
- **OCR coverage:** ≥ 95 % of uploaded Arabic+English docs processed within SLA (30 s p95).
- **Dashboard engagement:** ≥ 70 % of daily active users interact with role-specific dashboard.

---

## 3. Scope

### 3.1 In-Scope (Wave 1 MVP)

#### 3.1.1 Customer Data Management
- **Customer types:** Individual and Organization.
  - Organization represented by one or more **Primary Contacts**.
- **Identity fields (validation + uniqueness per tenant):**
  - Organization: `registrationId` (required, unique) + `taxId` (required, unique)
  - Individual: `nationalId` (unique) OR `passportNumber` (unique) (at least one required)
- **Multiple addresses** per customer with type and primary flags.
- **Contacts per customer** (not global), with **configurable contact roles**.
- **Party model**:
  - Opposing party and external parties reuse the same Party schema (individual/org).
  - Party relationships supported (configurable relationship types).
- **Compliance checklist**:
  - Globally defined checklist templates, assigned and tracked per customer.
- **Customer Financial Summary** (derived):
  - Outstanding invoices, total paid, overdue amount & oldest overdue date, last payment, credit/prepayment balance (note: credit/prepayment is excluded by Payment policy in MVP; balance remains 0).
- **Customer documents** (customer-scoped) with required document prompting via templates.

#### 3.1.2 Case Lifecycle Management (Court Case Support)
- **Configurable Case Types** (tenant-admin managed; add/remove/disable).
  - Case Type linked templates:
    - required docs template (case)
    - default task template
    - milestone/session placeholders (optional)
    - participant role placeholders (optional)
- **References:**
  - `systemCaseRef` auto-generated: `CASE-{YYYY}-{SEQUENCE}`
  - `courtCaseNumber` optional (user-entered)
- **States and transitions:**
  - States: Intake → Open → Active → Pending → Closed → Archived
  - Flags:
    - On Hold (flag with reason and dates)
    - Reopen (Closed → Active requires reason)
  - Archived is read-only
- **Multi-party support:**
  - multiple Customers per case
  - multiple Opposing Parties per case
- **Participants:**
  - configurable participant roles
  - participant-level visibility scope: LegalOnly / FinanceAllowed
  - Court as a separate entity (MVP: free-text details)
- **Hearings/Sessions Calendar:**
  - create/update/reschedule/cancel/complete
  - reschedule history + reason
  - in-app reminders (fixed intervals)
- **Tasks:**
  - assignment/reassignment, status tracking
  - attachments by linking documents
  - fixed reminder defaults; notifications center
- **Notes:** append-only in MVP.
- **Filings:** configurable filing types + statuses.
- **Communications log:** exists at both Customer and Case level (configurable types).

#### 3.1.3 Document Management (DMS)
- **Storage providers:**
  - Azure Blob Storage
  - S3-compatible storage
  - pluggable provider abstraction
- **Per-tenant storage config:**
  - shared (platform-managed) OR dedicated (tenant-provided)
  - tenant provides storage details
- **Hierarchical storage path (mandatory):**
  - `/tenants/{tenantId}/customers/{customerId}/cases/{caseId}/documents/{docType}/{docId}/versions/{versionId}`
- **Metadata + permissions in DB**; binaries in object storage.
- **Signed upload URLs (MVP priority)**; signed download URLs after authorization (tightening later phases).
- **Malware scanning gate:**
  - Pending: hidden
  - Passed: visible
  - Failed: quarantined (admin-visible only)
- **Versioning:** immutable versions (no rollback in MVP).
- **Check-out/in:** explicit with lock expiry (default 4 hours); admin can break lock (step-up re-auth).
- **Confidentiality:** Normal / Confidential / HighlyConfidential
  - HighlyConfidential requires explicit Document ACL allow and step-up re-auth for view/download.
- **Sharing:** internal time-bound sharing only.
- **Retention:** seeded defaults, visible in UI; not editable in MVP.
- **Legal hold:** case-level and document-level, audited.
- **Deletion:** soft delete + restore; purge only via retention job; hold blocks purge.

#### 3.1.4 Accounting (Simple)
- **Invoices:**
  - generic line items (qty * unit price)
  - invoice-level tax% and discount%
  - numbering: `INV-{YYYY}-{SEQUENCE}`
  - Lawyer drafts (tenant setting)
  - Accountant finalizes; final read-only; void by Accountant or Tenant Admin
  - invoice PDF export
- **Payments:**
  - allocated to single invoice only
  - partial payments allowed
  - **no overpayment** (no credit/prepayment in MVP)
  - fixed payment methods list
  - idempotency required
- **Expenses:**
  - linkable to case, customer, or general
  - user linkage (submittedBy, optional beneficiary)
  - fixed categories
  - receipts optional
  - multi-step role-based approval workflow
- **Wages:**
  - record-keeping per period; CSV export
- **Reports:**
  - operational: cases by state/type/owner, overdue tasks, upcoming sessions, completeness gaps
  - financial: receivables, cashflow, expenses by category
  - CSV export for all reports

#### 3.1.5 Admin / Configuration
- Manual user creation; deactivate/reactivate.
- Role assignment: Lawyer, Accountant, Tenant Admin (System Admin is platform).
- Case membership roles: CaseOwner, CaseMember, ReadOnly.
- Configurable master data (tenant-admin):
  - Contact roles
  - Participant roles
  - Party relationship types
  - Communication types
  - Filing types
  - Case types + templates
  - docTypes (allowed file types, default confidentiality, retention mapping)
  - Expense approval workflow chain (role-based, multi-step)
- Plan tiers: Standard / Enterprise as feature flags (no billing automation in MVP).

### 3.2 Out of Scope / Deferred

#### 3.2.1 Promoted to Phase 2
- Calendar & scheduling module (unified events, recurrence, reminders).
- Court / judge entity management; hearing lifecycle.
- Document Management v2 (folders, templates, OCR, full-text search, external sharing, configurable numbering).
- Time tracking with approval workflow and billing integration.
- Role-specific dashboards with widgets.
- UI / UX redesign (grouped nav, responsive breakpoints, notification center).
- Editable rich-text notes.
- OIDC / PKCE authentication.

#### 3.2.2 Deferred Beyond Phase 2
- SLA management (explicitly excluded from MVP).
- Data migration/import tooling (Wave 3/4).
- Third-party integrations: email ingestion, invoice emailing, external calendar sync, SMS/WhatsApp.
- Mobile native application (iOS / Android).
- Advanced analytics and BI dashboards.
- Client / customer self-service portal.
- Retention editing + advanced document lifecycle + multi-region replication.
- Dedicated DB per tenant (Enterprise tier).
- Generic custom fields engine.

---

## 4. Business Rules (Key)

### 4.1 Identity Uniqueness
- Within a tenant:
  - `taxId`, `registrationId`, `nationalId`, and `passportNumber` must be unique if present.
- MVP: no merge; only prevent duplicates.

### 4.2 Separation of Duties
- Accountants own finalization of invoices and recording of payments.
- Lawyers have limited finance visibility (invoice headers only for permitted scope).

### 4.3 Document Governance
- No document is accessible until malware scan passes.
- HighlyConfidential documents require explicit ACL allow (case membership not sufficient).
- All exports are audited.

### 4.4 Case Archiving
- Archived cases are read-only; no new tasks/sessions/filings/notes.

### 4.5 Time Entry Approval Chain (Phase 2)
- Time entries must be submitted by the owning user.
- Approval by CaseOwner or Accountant (configurable per tenant).
- Only Approved time entries may be linked to invoice line items.
- Write-off requires Accountant or TenantAdmin approval.

### 4.6 External Document Sharing Constraints (Phase 2)
- Share links are time-bound (max 30 days, configurable).
- Optional password protection; password not stored in plaintext.
- Download quota per link (default: 5 downloads).
- All share link access is audited.
- HighlyConfidential documents cannot be shared externally.

### 4.7 Court Hierarchy Integrity (Phase 2)
- A Judge must be associated with exactly one Court at a time.
- Hearings reference both Court and Judge; changing Court on a case propagates validation.
- Court deactivation prevents new hearing assignments.

---

## 5. Assumptions
- Tenants are law firms; multi-tenant SaaS is acceptable.
- Each tenant uses a single currency in MVP.
- Tenants provide their storage configuration for dedicated storage mode.
- OIDC identity provider is available per tenant.

---

## 6. Business Acceptance (Sign-off)
- Sponsor:
- Product Owner:
- Architecture:
- Security:
- Delivery:

---

## 7. Phase 2 Business Addendum

### 7.1 Phase 2 Drivers
1. **Weak data model** — Court, Judge, Hearing, Folder, TimeEntry entities missing from Phase 1.
2. **No calendar** — sessions/hearings managed ad-hoc; no unified scheduling.
3. **Missing core entities** — no time tracking, no document templates, no OCR.
4. **Poor UI** — no responsive design, no dashboards, no notification center.
5. **Inadequate document management** — flat structure, no folders, no full-text search.

### 7.2 Phase 2 Vision
Transform LOMA from an MVP record-keeping tool into a fully operational law office platform with:
- Unified calendar and scheduling across all event types.
- Structured court / judge / hearing hierarchy.
- Document management with folders, templates, OCR, and full-text search.
- Time tracking with approval workflow integrated into billing.
- Role-specific dashboards and responsive UI.
- Production-grade OIDC authentication.

### 7.3 Phase 2 Success Criteria
See `docs/phase2/PHASE2_VISION_AND_METRICS.md` for full success criteria, KPIs, and measurement methodology.

### 7.4 Phase 2 Scope References
| Area | Specification Document |
|---|---|
| Calendar & Scheduling | `docs/phase2/CALENDAR_SPEC.md` |
| Document Management v2 | `docs/phase2/DOC_MGMT_V2_SPEC.md` |
| Domain Model & Workflows | `docs/phase2/PHASE2_DOMAIN_MODEL_AND_WORKFLOWS.md` |
| UI / UX Redesign | `docs/phase2/UIUX_PHASE2_PROPOSAL.md` |
