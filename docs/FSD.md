# Functional Specification Document (FSD)
## Law Office Management Web Application (LOMA) — Wave 1 MVP

**Version:** 2.0  
**Date:** 2026-02-25  
**Purpose:** Feature-by-feature behavioral blueprint for implementation (UI + API + rules) — MVP + Phase 2

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
- **Phase 2:** Folder-level archive rules — when a folder is archived, all contained documents inherit a 365-day retention floor.

### 3.8 Folder / Library Hierarchy (Phase 2)
**Entity: Folder**
- folderId, tenantId, caseId (nullable), customerId (nullable)
- parentFolderId (nullable — null = root)
- name, description (optional)
- createdByUserId, createdAt, updatedAt
- isArchived (default false)

**Default Folder Templates**
- CaseType defines a JSON array of default folder names.
- On case creation, system instantiates folders from the template.
- Users may create, rename, move, and archive (not hard-delete) folders.

**Permission Inheritance**
- Folders inherit permissions from their parent.
- Explicit folder-level ACL overrides are supported.
- Documents within a folder inherit folder permissions unless they have explicit ACLs.

**API**
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/folders` | List root folders (query: caseId, customerId) |
| GET | `/api/v1/folders/:id/children` | List child folders + documents |
| POST | `/api/v1/folders` | Create folder |
| PATCH | `/api/v1/folders/:id` | Rename / move / archive |
| DELETE | `/api/v1/folders/:id` | Soft-delete (only if empty) |

### 3.9 Document Templates (Phase 2)
**Template Management**
- TenantAdmin CRUDs templates with Handlebars (`.hbs`) bodies.
- Templates reference merge fields: `{{case.systemCaseRef}}`, `{{customer.name}}`, etc.
- Output formats: PDF, DOCX.

**Generation Workflow**
1. User selects template and target entity (case/customer).
2. API resolves merge fields from entity data.
3. Engine renders output via Handlebars → HTML → PDF (or DOCX).
4. Generated document auto-uploaded to DMS under target folder.

**API**
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/document-templates` | List templates |
| POST | `/api/v1/document-templates` | Create template |
| PATCH | `/api/v1/document-templates/:id` | Update template |
| POST | `/api/v1/document-templates/:id/preview` | Preview with sample data |
| POST | `/api/v1/document-templates/:id/generate` | Generate document for entity |

### 3.10 OCR Pipeline (Phase 2)
- Engine: Tesseract with `ara+eng` language packs.
- Processing: After malware scan passes, document queued to BullMQ `ocr-extraction` queue.
- OCR worker extracts text → stored in `extractedText` column on DocumentVersion.
- Status tracking: `ocrStatus` enum: `Pending | Processing | Completed | Failed | Skipped`.
- Skipped if file type not OCR-eligible (e.g., spreadsheets, JSON).
- Extracted text feeds into full-text search index (`tsvector`).

### 3.11 Full-Text Search (Phase 2)
- PostgreSQL `tsvector` column on DocumentVersion populated from:
  - title + description (from Document)
  - extractedText (from OCR)
- GIN index for efficient search.
- Search endpoint: `GET /api/v1/documents/search?q=...&scope=...&docType=...&from=...&to=...`
- Results include `headline` (highlighted snippet) and `rank` (relevance score).

### 3.12 Multi-File Upload (Phase 2)
- Batch limit: 10 files per request.
- Concurrent uploads: 3 at a time.
- Per-file validation: type whitelist, max size (50 MB default), checksum.
- UI: progress bars per file, individual retry on failure.
- All files share the same scope (case/customer) and target folder.

### 3.13 External Sharing (Phase 2)
**Entity: DocumentShare**
- shareId, docId, shareToken (URL-safe UUID)
- createdByUserId, expiresAt (max 30 days)
- passwordHash (optional), maxDownloads (default 5), downloadCount
- isActive (soft revoke)

**Rules**
- HighlyConfidential documents cannot be shared externally.
- All access via share link creates DOCUMENT_EXTERNAL_ACCESS audit event.
- Expired/exhausted links return 410 Gone.

**API**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/documents/:id/share` | Create share link |
| GET | `/api/v1/shares/:token` | Public access (validates expiry/password/quota) |
| DELETE | `/api/v1/documents/:id/share/:shareId` | Revoke share |

### 3.14 Configurable Document Numbering (Phase 2)
- Tenant Admin defines numbering scheme per docType.
- Tokens: `{YYYY}`, `{MM}`, `{SEQ}`, `{CASE_REF}`, `{DOC_TYPE}`, `{TENANT_CODE}`.
- Sequence table tracks `nextVal` per scheme; uses `SELECT FOR UPDATE` for concurrency.
- Example: `DOC-{YYYY}-{DOC_TYPE}-{SEQ:5}` → `DOC-2026-CONTRACT-00042`.

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

### 4.5 Time Entries (Phase 2)
**Entity: TimeEntry**
- timeEntryId, tenantId, caseId, taskId (optional)
- userId (owner)
- description (required)
- date (required)
- durationHours, durationMinutes
- billable (boolean, default true)
- ratePerHour (from user profile or override)
- status: Draft | Submitted | Approved | Billed | WriteOff

**Workflow**
1. User creates time entry (Draft).
2. User submits → status = Submitted.
3. CaseOwner or Accountant approves → status = Approved.
4. Approved entries eligible for invoice line-item generation.
5. On invoice finalization, linked entries → Billed.
6. WriteOff requires Accountant/TenantAdmin approval.

**Invoice Auto-Population**
- `POST /api/v1/invoices/from-time-entries` body: `{ caseId, timeEntryIds[], customerId }`
- Creates Draft invoice with line items derived from selected time entries.
- Line description = time entry description; qty = hours; unitPrice = rate.

**API**
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/time-entries` | List (filters: caseId, userId, status, dateRange) |
| POST | `/api/v1/time-entries` | Create |
| PATCH | `/api/v1/time-entries/:id` | Update (Draft/Submitted only) |
| POST | `/api/v1/time-entries/:id/submit` | Submit for approval |
| POST | `/api/v1/time-entries/:id/approve` | Approve |
| POST | `/api/v1/time-entries/:id/write-off` | Write off |

**Weekly Summary**
- `GET /api/v1/time-entries/summary?userId=...&weekOf=...`
- Returns: totalHours, billableHours, nonBillableHours, utilization %, daily breakdown.

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

---

## 6. Calendar Module (Phase 2)

### 6.1 Event Types
| Type | Source | Auto-Created | Editable | Deletable |
|---|---|---|---|---|
| Hearing | HearingModule | Yes (on hearing create) | Via hearing only | Via hearing only |
| Session | CaseModule | Yes (on session create) | Via session only | Via session only |
| TaskDeadline | TaskModule | Yes (on task dueDate set) | Via task only | Via task only |
| Custom | User | No | Yes | Yes |
| Reminder | System | Yes (from rules) | Limited (snooze/dismiss) | Yes |

### 6.2 Calendar Views
- **Day View:** 30-minute slots, 06:00–22:00 default range, drag-to-create.
- **Week View:** 7-day grid, same slot size, drag-to-reschedule.
- **Month View:** cell per day showing up to 3 events + "+N more" overflow.
- **Agenda View:** chronological list with grouping by day; ideal for mobile.

### 6.3 Recurring Events
- Supported RRULE subset: `FREQ` (DAILY, WEEKLY, MONTHLY), `INTERVAL`, `BYDAY`, `COUNT`, `UNTIL`.
- Instances generated on demand for the query window (not pre-materialized).
- Single-instance exceptions supported (edit one occurrence).

### 6.4 Conflict Detection
- `POST /api/v1/calendar/conflicts` body: `{ startDateTime, endDateTime, excludeEventId? }`
- Returns list of overlapping events for the current user.
- UI shows warning before save; does not hard-block.

### 6.5 Reminders
- Default reminders per event type (e.g., Hearing: 1 day + 2 hours before).
- CronJob (`@Cron('*/1 * * * *')`) scans upcoming reminders.
- Channels: InApp (WebSocket push) and Email.
- Notification UI: bell icon with unread count badge, dropdown with mark-read/dismiss.

### 6.6 Case-Filtered Calendar
- Case Detail → Calendar tab shows only events linked to that case.
- Filter query parameter: `?caseId=...`

### 6.7 API
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/calendar/events` | List events (range, type, caseId) |
| POST | `/api/v1/calendar/events` | Create custom event |
| PATCH | `/api/v1/calendar/events/:id` | Update event |
| DELETE | `/api/v1/calendar/events/:id` | Delete custom event |
| POST | `/api/v1/calendar/conflicts` | Check conflicts |
| GET | `/api/v1/calendar/events/:id/reminders` | List reminders |
| POST | `/api/v1/calendar/events/:id/reminders` | Add reminder |
| GET | `/api/v1/notifications` | List notifications (filters) |

---

## 7. Court & Judge Management (Phase 2)

### 7.1 Court Entity (Extended)
**Fields**
- courtId, tenantId
- name (required, bilingual EN/AR)
- jurisdiction (configurable list)
- courtType (configurable: Civil/Criminal/Family/Commercial/Administrative/Other)
- address (full address object)
- branch (optional)
- contactPhone, contactEmail
- isActive (boolean)

**Rules**
- Court deactivation prevents new hearing assignments.
- Courts are tenant-scoped and managed by TenantAdmin.

### 7.2 Judge Entity
**Fields**
- judgeId, tenantId
- name (required, bilingual EN/AR)
- title (configurable)
- courtId (required — assigned court)
- specializations (text[])
- contactEmail, contactPhone
- notes
- isActive

**Rules**
- Judge must be assigned to exactly one active court.
- Judge assignment history tracked (judgeId, courtId, startDate, endDate).

### 7.3 Hearing Lifecycle
**States:** Scheduled → Adjourned | Postponed | Completed | Cancelled

**Fields**
- hearingId, caseId, courtId, judgeId
- hearingDate, startTime, endTime (optional)
- hearingType (configurable)
- status
- location (auto-populated from court, overridable)
- outcome, notes
- nextHearingDate (when Adjourned/Postponed)
- calendarEventId (auto-linked)

**Behavior**
- Creating a Hearing auto-creates a CalendarEvent (type=Hearing).
- Rescheduling updates both Hearing and CalendarEvent.
- Cancellation removes CalendarEvent.
- Reschedule history preserved with reason.

**API**
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/hearings` | List (filters: caseId, courtId, judgeId, status) |
| POST | `/api/v1/hearings` | Create + auto-create calendar event |
| PATCH | `/api/v1/hearings/:id` | Update |
| POST | `/api/v1/hearings/:id/reschedule` | Reschedule with reason |
| POST | `/api/v1/hearings/:id/complete` | Complete with outcome |
| POST | `/api/v1/hearings/:id/cancel` | Cancel |
| GET | `/api/v1/courts` | List courts |
| POST | `/api/v1/courts` | Create court |
| PATCH | `/api/v1/courts/:id` | Update court |
| GET | `/api/v1/judges` | List judges |
| POST | `/api/v1/judges` | Create judge |
| PATCH | `/api/v1/judges/:id` | Update judge |

---

## 8. Time Tracking Module (Phase 2)

> Time entry entity and API defined in §4.5. This section covers UI behavior and reporting.

### 8.1 Time Entry UI
- **Timer Mode:** Start/stop timer that auto-calculates duration.
- **Manual Mode:** Enter hours + minutes directly.
- **Quick Entry:** Inline row in weekly timesheet grid.
- **Weekly Timesheet View:** Grid with days as columns, cases as rows; totals per day and per case.
- **Weekly Progress Bar:** Visual indicator of billable vs target hours.

### 8.2 Approval Queue
- CaseOwner / Accountant sees list of Submitted time entries.
- Bulk approve / reject with comment.
- Filter by: user, case, date range, status.

### 8.3 Billing Integration
- From Case Detail → Financial tab, user can select approved time entries and generate invoice draft.
- Invoice line items auto-populated; user can edit before finalization.
- Billed entries show link to invoice.

### 8.4 Reports
- **Utilization Report:** billable hours / available hours per user per period.
- **Case Cost Report:** total hours × rate per case; compare to budget.
- **Unbilled Time Report:** Approved entries not yet invoiced.
- All reports exportable to CSV.

