# Functional Specification Document (FSD)
## Law Office Management Web Application (LOMA) — Wave 1 MVP

**Version:** 1.0  
**Date:** 2026-02-23  
**Purpose:** Feature-by-feature behavioral blueprint for implementation (UI + API + rules)

---

## 1. Customer Module

### 1.1 Create Customer
**Inputs**
- CustomerType: Individual | Organization
- Common: name, status (Active/Inactive/Prospect), notes (optional)
- Individual:
  - nationalId (optional, unique)
  - passportNumber (optional, unique)
  - rule: at least one of nationalId/passportNumber required
- Organization:
  - registrationId (required, unique)
  - taxId (required, unique)
- Addresses: list (0..n)
  - type: Billing/Office/Home/Other
  - isPrimary (per type)
  - lines, city, state, postalCode, country
- Contacts: list (0..n)
  - name, email, phone
  - role (from configurable master data)
  - isPrimary (allowed multiple)

**Validation**
- Enforce required identifiers per type.
- Enforce uniqueness within tenant:
  - taxId, registrationId, nationalId, passportNumber (when not null)
- For addresses, allow save with none; completeness will reflect missing.

**Behavior**
- On successful create:
  - generate customerId
  - create CUSTOMER_CREATED audit event
  - attach contacts/addresses as separate entities (with audit per create)
  - apply required document template:
    - create CustomerDocRequirementInstance records (Missing by default)
  - apply compliance checklist template:
    - create CustomerChecklistInstance + items

**UI**
- Customer Create form (type selector)
- Side panel shows required docs checklist (Missing/Provided)
- Save allowed even if required docs missing (MVP)

### 1.2 Customer Detail
**Tabs**
- Overview:
  - identity fields
  - primary contacts (org)
  - financial summary (role-limited)
  - completeness summary and missing items
- Contacts & Parties:
  - contacts list + add/edit
  - party relationships view (Party↔Party)
- Addresses
- Documents (customer-scoped library)
- Compliance Checklist (template-driven)
- Activity (business events)
- Audit (security events; role-limited)

### 1.3 Party Model and Relationships
- Parties share schema with customer identity fields (individual/org).
- Relationship types configurable (Tenant Admin).
- Relationship record fields:
  - fromPartyId, toPartyId, relationshipTypeId, notes, createdAt
- UI supports create relationship and filter by type.

---

## 2. Case Module

### 2.1 Case Create (Minimal)
**Inputs (minimum)**
- customerIds (1..n)
- caseTypeId (required)
- title/subject (required)
- assignedLawyerUserId (default = current user)
- optional: courtCaseNumber

**Behavior**
- Create case in state = Intake.
- Generate systemCaseRef = CASE-{YYYY}-{SEQUENCE}.
- Create default memberships:
  - assigned lawyer as CaseOwner
- Apply case type templates:
  - required docs template → create CaseDocRequirementInstances
  - default task template → create Tasks
  - session placeholders → create Sessions (Planned)
  - participant placeholders → create CaseParty placeholder rows (optional)
- Create CASE_CREATED audit event.

### 2.2 Case States and Transitions
**States**
- Intake, Open, Active, Pending, Closed, Archived

**Transitions (allowed)**
- Intake → Open
- Open → Active
- Active → Pending
- Pending → Active
- Active → Closed
- Pending → Closed
- Closed → Archived (manual by Tenant Admin in MVP)
- Closed → Active (Reopen, reason required)

**Rules**
- OnHold is a flag independent of state:
  - set/clear with reason and timestamps
  - when OnHold=true, show banners and include in timeline
- Archived is read-only:
  - block edits and creation of tasks/sessions/filings/notes/comms/doc versions
  - allow view and exports (subject to permissions)

**Audit**
- CASE_STATE_CHANGED(from,to,reason)
- CASE_ON_HOLD_SET/CLEARED
- CASE_REOPENED

### 2.3 Case Memberships
- Roles: CaseOwner, CaseMember, ReadOnly
- Membership required for most case content access.
- Tenant Admin manages memberships.
- Audit:
  - CASE_MEMBERSHIP_ADDED/REMOVED/ROLE_CHANGED

### 2.4 Case Parties / Participants
**Entities**
- Party (global per tenant)
- CaseParty join:
  - caseId, partyId, partyRoleType (Customer/Opposing/ExternalCounsel/Other)
  - participantRoleId (configurable)
  - visibilityScope: LegalOnly | FinanceAllowed
  - notes, startDate, endDate

**Rules**
- Support multiple customers and multiple opposing parties.
- Accountant default visibility:
  - only FinanceAllowed participant records are shown (unless elevated permission).

### 2.5 Court Entity
- Court is separate entity with minimal fields:
  - name (required), notes (free text), address (optional)
- Court details for specific sessions stored as free text notes in Session.

### 2.6 Sessions (Hearings/Appointments Calendar)
**Fields**
- type (configurable list): Hearing/Session/Meeting/Deadline/Other
- title
- startDateTime, endDateTime
- location (free text)
- optional courtId
- status: Planned/Completed/Postponed/Cancelled
- outcomeNotes (required when Completed)
- linked documents (optional)
- reminders (fixed in MVP)

**Reschedule**
- When moved, store reschedule history:
  - originalDateTime, newDateTime, reason, changedBy, changedAt
- Audit:
  - SESSION_RESCHEDULED + reason

**UI**
- My Calendar (Lawyer)
- Case Calendar tab
- List and calendar views
- Reschedule history panel

### 2.7 Tasks
**Fields**
- title, description
- caseId (required), customerId (optional)
- assigneeUserId (required)
- reviewerUserId (optional)
- priority: Low/Medium/High
- status: Open/InProgress/Blocked/Done/Cancelled
- dueDate, startDate (optional)
- tags (optional)
- attachments: links to Document(s)

**Attachments**
- Attach existing Document (permission checked)
- Upload new Document (starts DMS upload flow)

**Reminders (fixed MVP)**
- 3 days before due date
- 1 day before due date
- Overdue daily until completed/cancelled

**Audit**
- TASK_CREATED/UPDATED/STATUS_CHANGED/REASSIGNED

### 2.8 Notes (Append-only MVP)
- Create only; no edit/delete.
- Fields: body (required), title (optional), tags (optional), visibilityScope, attachments.
- Corrections made by adding a new note referencing prior note.

### 2.9 Filings
- Filing types configurable (Tenant Admin).
- Statuses: Draft/Filed/Accepted/Rejected/Withdrawn
- Fields: type, status, filedDate, courtCaseNumber (optional), referenceNumber (optional), notes, linked documents.
- Audit: FILING_CREATED/UPDATED/STATUS_CHANGED

### 2.10 Communications Log (Customer + Case level)
- Types configurable (Call/Email/Meeting/Message/Other).
- Fields: date/time, direction Inbound/Outbound, participants (party links + free text), summary, nextSteps, visibilityScope, attachments.
- Audit: COMM_CREATED/UPDATED

---

## 3. Document Module

### 3.1 Metadata Model (MVP)
- Document:
  - docId, tenantId
  - scope: customerId (nullable), caseId (nullable) — at least one required
  - docTypeId (required)
  - title, description (optional)
  - tags (optional)
  - confidentialityLevel: Normal/Confidential/HighlyConfidential
  - currentVersionId
  - deletedAt (soft delete)
- DocumentVersion:
  - versionId, docId
  - providerObjectKey (path)
  - contentType, sizeBytes, checksumSha256
  - scanStatus: Pending/Passed/Failed
  - createdBy, createdAt
- DocumentAclEntry:
  - docId
  - principalType: User|Role
  - principalId
  - permission: View|Download|UploadNewVersion|Share|Admin
  - expiresAt (optional)

### 3.2 Upload Flow (Direct-to-Storage)
1. UI calls `POST /documents` with metadata:
   - scope (customer/case), docType, title, confidentiality, checksum, contentType, size
2. API validates:
   - RBAC/ABAC authorization
   - docType allowed file types
   - size limit
3. API creates Document + DocumentVersion(scanStatus=Pending).
4. API returns pre-signed upload URL.
5. Client uploads directly to storage.
6. Storage event triggers scan job (queue).
7. Worker scans and updates scanStatus:
   - Passed → visible
   - Failed → quarantined

**User-visible behavior**
- While Pending: show “Scanning…” status to uploader only.
- If Failed: uploader sees generic “Upload failed security scan”; content not accessible.

### 3.3 Download/View Flow
- UI requests `GET /documents/{docId}/versions/{versionId}/download-url`
- API checks:
  - RBAC permission
  - ABAC scope (case membership)
  - confidentiality rules
  - ACL allow for HighlyConfidential
  - scanStatus=Passed
  - step-up requirement for HighlyConfidential
- API returns signed URL.

### 3.4 Check-out / Check-in
- Check-out:
  - set lockedByUserId and lockExpiresAt = now + 4 hours
  - audit DOCUMENT_CHECKED_OUT
- Check-in:
  - upload new version (must be lock owner)
  - on success, clear lock
  - audit DOCUMENT_CHECKED_IN + DOCUMENT_VERSION_CREATED
- Break lock (Tenant Admin):
  - requires step-up
  - audit DOCUMENT_LOCK_BROKEN

### 3.5 Sharing (Internal only)
- Create share:
  - add ACL entry for User/Role with expiresAt
  - audit DOCUMENT_SHARED_INTERNAL
- Revoke share:
  - remove/expire ACL entry
  - audit DOCUMENT_SHARE_REVOKED

### 3.6 Legal Hold
- Apply hold on Document or Case:
  - store hold record with reason, appliedBy, timestamps
  - audit LEGAL_HOLD_APPLIED
- Release hold:
  - audit LEGAL_HOLD_RELEASED
- Holds block purge and retention actions.

### 3.7 Retention and Deletion
- Retention policies are seeded and visible per document.
- User delete performs soft delete:
  - set deletedAt
  - audit DOCUMENT_SOFT_DELETED
- Restore clears deletedAt:
  - audit DOCUMENT_RESTORED
- Purge only by retention job (admin/system process), blocked by legal hold:
  - audit DOCUMENT_PURGED

---

## 4. Accounting Module

### 4.1 Invoice
**Fields**
- invoiceId, invoiceNumber (INV-{YYYY}-{SEQUENCE})
- customerId, caseId (optional but recommended)
- status: Draft/Final/Sent/Paid/Voided
- lineItems: description, quantity, unitPrice, lineTotal
- discountRatePercent, taxRatePercent
- totals: subtotal, discountAmount, taxableAmount, taxAmount, total
- dueDate (optional)
- createdBy, createdAt; finalizedBy, finalizedAt

**Rules**
- Lawyer can create Draft (tenant setting).
- Only Accountant can Finalize and mark Sent.
- Final invoice is read-only; only void allowed by Accountant or Tenant Admin with reason.
- Paid is computed when payments sum equals total.

**Exports**
- Invoice PDF export; audit EXPORT_GENERATED(type=invoicePdf)

### 4.2 Payments
**Fields**
- paymentId
- invoiceId (required)
- amount
- method: Cash/BankTransfer/Cheque/Card/Other
- paidAt
- reference (optional)
- createdBy

**Rules**
- Single invoice allocation only.
- Partial payments allowed.
- Reject overpayment (amount > invoice remaining).
- Idempotency required using Idempotency-Key.

### 4.3 Expenses
**Fields**
- expenseId
- link: caseId (optional), customerId (optional), or none (general)
- category: Travel/FilingFees/Courier/Office/Other
- amount, currency (tenant currency)
- submittedByUserId, beneficiaryUserId (optional)
- status: Draft/Submitted/PendingApproval/Approved/Rejected
- attachments: linked documents (optional)

**Approvals**
- Multi-step, role-based:
  - approvalSteps defined by Tenant Admin
  - each step records decision and comment
- Audit:
  - EXPENSE_SUBMITTED/APPROVED/REJECTED

### 4.4 Wages
**Fields**
- wageId
- employeeUserId or staffName
- period (YYYY-MM)
- grossAmount, deductions, netAmount
- paymentStatus: Planned/Paid
- notes
- export CSV

---

## 5. Reporting
**Operational**
- Cases by state/type/owner
- Overdue tasks
- Upcoming sessions
- Completeness gaps

**Financial**
- Receivables by customer/status
- Cashflow by month
- Expenses by category

**Exports**
- CSV for all reports; audited EXPORT_GENERATED(type=reportCsv)

