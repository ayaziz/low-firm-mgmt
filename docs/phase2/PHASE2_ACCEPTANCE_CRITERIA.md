# Phase 2 Acceptance Criteria
## Law Office Management Application (LOMA)

**Version:** 1.0  
**Date:** 2026-02-25  
**Baseline:** PHASE2_ROADMAP_BACKLOG.md, all Phase 2 specs  
**Scope:** Testable acceptance criteria for every Phase 2 feature group

---

## Notation

- **Given / When / Then** format for behavioral criteria
- Each criterion has an ID referenced from the Roadmap backlog (`AC-*`)
- Priority aligns with the parent feature (P0 / P1 / P2)

---

## 1. Authentication & Security

### AC-AUTH-01 — OIDC/PKCE Backend Integration
- **Given** the backend is configured with an OIDC IdP (Keycloak / Entra ID)
- **When** a request arrives with a valid JWT issued by the configured IdP
- **Then** `OidcGuard` validates signature via JWKS, checks `iss`, `aud`, `exp`, and extracts `tenant_id` claim
- **And** the user context is populated with roles, tenant, and user ID
- **Rejection:** Invalid/expired JWT returns 401; missing `tenant_id` claim returns 403

### AC-AUTH-02 — OIDC SPA Flow
- **Given** a user navigates to the app without a valid session
- **When** the SPA initiates login
- **Then** it redirects to the IdP `/authorize` endpoint with PKCE `code_challenge` (S256)
- **And** on callback, exchanges the code + `code_verifier` for tokens
- **And** stores `access_token` in memory only (never localStorage)
- **And** stores `refresh_token` in an HTTP-only secure cookie
- **And** silent refresh triggers at 75% of token lifetime

### AC-AUTH-03 — Dev-Mode JWT Feature Flag
- **Given** `AUTH_MODE=dev` environment variable is set
- **When** a user submits credentials to `/auth/login`
- **Then** the existing JWT dev login flow is used
- **And** when `AUTH_MODE` is absent or set to `oidc`, the dev login endpoint returns 404

### AC-SEC-01 — Case Membership on Read
- **Given** a Lawyer is authenticated
- **When** they request `GET /cases/:id` (or any case-scoped endpoint)
- **Then** the API verifies the user is a member of the case (via `case_participant` table)
- **And** returns 403 if not a member (unless user is TenantAdmin)

### AC-SEC-02 — visibilityScope Enforcement
- **Given** a case participant has `visibilityScope = 'LimitedFinancial'`
- **When** they request financial data for that case
- **Then** sensitive financial fields are redacted per the scope definition
- **And** full data is returned only for `FullAccess` scope participants

### AC-SEC-03 — Step-Up Re-Auth for Phase 2 Actions
- **Given** a user attempts to: cancel a hearing, bulk approve time entries, or delete a folder with contents
- **When** the request reaches the endpoint
- **Then** `StepUpGuard` requires `user.stepUp === true` on the JWT
- **And** returns 403 with `step_up_required: true` if not present

### AC-SEC-04 — ClamAV Production Scanner
- **Given** ClamAV is configured as the malware scanner
- **When** a file is uploaded
- **Then** the BullMQ scan worker invokes ClamAV for virus detection
- **And** infected files are quarantined and the document status set to `ScanFailed`
- **And** clean files proceed to OCR (if applicable) and become available

---

## 2. Court, Judge & Hearing

### AC-COURT-01 — Court Entity Extensions
- **Given** the Phase 2 migration has run
- **Then** the `court` table includes columns: `department`, `circuit`, `jurisdiction_level` (enum), `is_active`
- **And** existing court records have `is_active = true` by default

### AC-COURT-02 — Court CRUD API
- **Given** a TenantAdmin is authenticated
- **When** they create/update/list/deactivate courts via `/api/v1/courts`
- **Then** CRUD operations succeed with proper validation
- **And** Lawyer role can read courts but not create/update/delete
- **And** Accountant role receives 403 for all court endpoints

### AC-COURT-03 — Judge CRUD API
- **Given** a TenantAdmin is authenticated
- **When** they manage judges via `/api/v1/courts/:courtId/judges`
- **Then** judges are linked to a court via `court_id` FK
- **And** deactivated judges (`is_active = false`) are excluded from hearing assignment dropdowns
- **And** judges can be listed by Lawyer (read-only)

### AC-COURT-04 — Case ↔ Court/Judge Linking
- **Given** a case exists
- **When** a Lawyer or TenantAdmin updates the case with `primary_court_id` and `primary_judge_id`
- **Then** the FK references are validated (court and judge must be active)
- **And** the link appears in case detail API response

### AC-HEAR-01 — Hearing State Machine
- **Given** a hearing is created with status `Scheduled`
- **Then** valid transitions are: `Scheduled → Completed`, `Scheduled → Postponed`, `Scheduled → Cancelled`
- **And** `Postponed → Scheduled` (reschedule) and `Postponed → Cancelled` are valid
- **And** `Completed` and `Cancelled` are terminal states
- **And** invalid transitions return 400 with descriptive error

### AC-HEAR-02 — Hearing CRUD + Transition API
- **Given** a Lawyer with case membership
- **When** they create a hearing via `POST /cases/:caseId/hearings`
- **Then** `case_id`, `court_id`, `hearing_date` are required; `judge_id` is recommended
- **And** transition is performed via `POST /hearings/:id/transition` with `action` and `reason`
- **And** each transition emits an audit event (`HEARING_CREATED`, `HEARING_COMPLETED`, etc.)

### AC-HEAR-03 — Hearing → CalendarEvent Auto-Creation
- **Given** a hearing is created
- **Then** a CalendarEvent of type `Hearing` is automatically created with the hearing date, court location, and case members as attendees
- **And** if the hearing is postponed, the original calendar event is cancelled and a new one is created for the rescheduled date

---

## 3. Calendar

### AC-CAL-01 — CalendarEvent CRUD
- **Given** an authenticated user
- **When** they create an event via `POST /calendar/events`
- **Then** the event is created with: `title`, `start_at`, `end_at`, `event_type`, optional `case_id`, `recurrence_rule`
- **And** the event is visible to the creator and, if case-linked, to all case members

### AC-CAL-02 — Recurring Events
- **Given** an event is created with `recurrence_rule` (RRULE format: DAILY, WEEKLY, MONTHLY)
- **Then** the system generates individual instances within the query date range
- **And** modifying a single instance creates an exception (does not affect other instances)
- **And** modifying the series updates all future non-exception instances

### AC-CAL-03 — Conflict Detection
- **Given** a user creates or updates an event
- **When** the event overlaps with another event for the same attendee(s)
- **Then** the API returns a conflict warning (non-blocking) with overlapping event details
- **And** conflict detection latency ≤ 200ms (P95)

### AC-CAL-04 — Reminders
- **Given** an event has reminders configured (e.g., 30 min before, 1 day before)
- **When** the reminder time arrives
- **Then** the CronJob scheduler dispatches notifications via the configured channel (InApp / Email / Both)
- **And** reminders are idempotent — duplicate dispatches are suppressed

### AC-CAL-05 — Case-Filtered Calendar View
- **Given** a Lawyer views the calendar with a case filter applied
- **Then** only events linked to the selected case are displayed
- **And** hearing events show court and judge information in the event chip

### AC-UI-CAL-01 — Calendar Frontend (FullCalendar)
- **Given** a user navigates to `/calendar`
- **Then** the page renders FullCalendar with Month, Week, Day, and Agenda views
- **And** events are color-coded by type (Hearing=red, Session=blue, TaskDeadline=amber, Custom=grey, Reminder=green)
- **And** clicking an event opens a detail side panel

### AC-UI-CAL-02 — Calendar Event Dialogs
- **Given** a user clicks on an empty time slot or the "Create Event" button
- **Then** a dialog opens with fields: title, type, start/end datetime, recurrence, case (optional), location, reminders
- **And** drag-to-resize adjusts event duration with optimistic UI update + backend PATCH

### AC-UI-CAL-03 — Calendar RTL Support
- **Given** the app locale is set to Arabic (RTL)
- **Then** the calendar renders right-to-left with mirrored navigation arrows
- **And** event text is right-aligned

---

## 4. Document Management v2

### AC-FOLD-01 — Folder Entity + CRUD
- **Given** a Lawyer with case membership or TenantAdmin
- **When** they create a folder via `POST /folders`
- **Then** the folder is created with `name`, `parent_folder_id` (nullable), `scope`, `scope_id`
- **And** materialized `path` is auto-generated (max depth 10)
- **And** rename updates the path for the folder and all descendants
- **And** delete only succeeds if the folder is empty (otherwise 400)

### AC-FOLD-02 — Folder Permission Inheritance
- **Given** a folder has `inherit_permissions = true` and an ACL list
- **When** a document is accessed within that folder
- **Then** the effective ACL is the union of folder ACL and document explicit ACL
- **And** confidentiality level is the higher of folder default and document level
- **And** TenantAdmin/SystemAdmin bypass folder ACL

### AC-FOLD-03 — Default Folder Templates
- **Given** a case is created with a CaseType that has folder templates configured
- **Then** the system auto-creates the standard folder hierarchy under the case
- **And** special folders (Internal Memos, Financial) have `confidentiality_default: Confidential`

### AC-UI-FOLD-01 — Folder Tree UI
- **Given** a user navigates to the Document Library (`/documents`)
- **Then** the left panel shows a recursive folder tree with expand/collapse
- **And** right-clicking a folder opens a context menu (Create subfolder, Rename, Move, Archive, Delete)
- **And** drag-and-drop moves folders/documents between folders with confirmation dialog
- **And** breadcrumb navigation shows the current path

### AC-DOC-01 — Multi-File Upload
- **Given** a user is in a folder context
- **When** they drag files onto the drop zone or use the file picker
- **Then** up to 10 files are uploaded in parallel (max 3 concurrent) with individual progress bars
- **And** each file undergoes MIME + extension validation (50 MB max)
- **And** failed files show error messages without blocking successful uploads

### AC-DOC-02 — Azure Blob Storage Provider
- **Given** the tenant is configured for Azure Blob storage
- **Then** upload URLs are SAS tokens with short expiry (15 min)
- **And** blob access tier follows lifecycle policy: Hot (0–90d), Cool (90–365d), Archive (365d+)
- **And** soft-delete is enabled with 14-day retention
- **And** blob paths follow: `{tenantId}/clients/{clientId}/cases/{caseId}/{folderId}/{docId}/{versionId}`

### AC-DOC-03 — Storage Provider Abstraction
- **Given** `STORAGE_PROVIDER` env is set to `minio` or `azure-blob`
- **Then** the storage service resolves the correct provider at runtime
- **And** all document operations (upload URL, download URL, delete) use the abstraction

### AC-DOC-04 — OCR Worker
- **Given** a PDF or image file passes malware scan
- **Then** the OCR worker (BullMQ queue `ocr-extraction`) processes the file with Tesseract.js (ara+eng)
- **And** extracted text is stored in `document.full_text_content`
- **And** OCR status transitions: `Pending → Processing → Completed` (or `Failed` with retry)
- **And** processing completes within 30 seconds (P95) for files ≤ 10 MB
- **And** failed OCR after 3 retries does not block document availability

### AC-DOC-05 — Full-Text Search
- **Given** documents have been OCR-processed
- **When** a user searches via `GET /documents/search?q=keyword`
- **Then** results are ranked by `ts_rank` with `ts_headline` snippets
- **And** search respects folder, case, customer, and confidentiality filters
- **And** search P95 latency ≤ 800ms

### AC-DOC-06 — External Sharing
- **Given** a Lawyer or TenantAdmin creates an external share link for a document
- **Then** a time-limited SAS URL is generated (configurable expiry, default 7 days)
- **And** the link is tracked in `external_share_links` table with audit trail
- **And** TenantAdmin can revoke any active share link
- **And** expired links return 403

### AC-DOC-07 — Configurable Numbering Schemes
- **Given** a TenantAdmin configures a numbering pattern (e.g., `DOC-{YYYY}-{SEQ:5}`)
- **Then** new documents auto-receive sequential numbers matching the pattern
- **And** the sequence resets per year (if `{YYYY}` is in the pattern)
- **And** concurrent creation maintains uniqueness (DB sequence or advisory lock)

### AC-DOC-08 — Documentation Completeness
- **Given** Phase 2 is complete
- **Then** all API endpoints have Swagger/OpenAPI annotations
- **And** the file manifest lists every Phase 2 document with status

---

## 5. Document Templates

### AC-TMPL-01 — Template CRUD
- **Given** a TenantAdmin is authenticated
- **When** they manage templates via `/api/v2/document-templates`
- **Then** CRUD operations work with: `name`, `category`, `template_body` (Handlebars), `variable_schema` (JSON Schema)
- **And** Lawyer can list and view templates but not create/update/delete

### AC-TMPL-02 — Template Preview & Generate
- **Given** a Lawyer selects a template and fills the variable form
- **When** they click "Preview"
- **Then** the API renders the template with provided + auto-fill variables and returns a preview
- **When** they click "Generate"
- **Then** a PDF/DOCX is produced, uploaded to the selected folder, and a document record is created with `source: "template"`

### AC-UI-TMPL-01 — Template Editor UI
- **Given** a TenantAdmin navigates to `/admin/templates/:id`
- **Then** the editor shows the Handlebars template body with syntax highlighting
- **And** a merge-field picker sidebar lists available variables (case, customer, court, judge, tenant, user, today)
- **And** clicking a variable inserts `{{variable}}` at the cursor position

---

## 6. Time Entry & Billing

### AC-TIME-01 — Time Entry CRUD + State Machine
- **Given** a Lawyer creates a time entry via `POST /time-entries`
- **Then** the entry is created in `Draft` status with: `case_id`, `hours`, `description`, `billable`, `entry_date`
- **And** valid transitions: `Draft → Submitted → Approved → Billed` or `Approved → WriteOff`
- **And** `Submitted → Draft` (reject with reason) is valid
- **And** `Billed` entries are immutable

### AC-TIME-02 — Submit / Approve / Reject
- **Given** a Lawyer submits their own time entry
- **Then** status transitions to `Submitted` and an `ApprovalRequired` notification is dispatched
- **Given** an Accountant or TenantAdmin reviews the entry
- **When** they approve → status = `Approved`; when they reject → status = `Draft` with `rejection_reason`
- **And** each transition emits an audit event

### AC-TIME-03 — Time Entry → Invoice Integration
- **Given** an Accountant creates an invoice with `timeEntryIds[]`
- **Then** approved time entries are converted to invoice line items: `description`, `hours × hourly_rate = amount`
- **And** the time entries transition to `Billed` status with `invoice_line_id` FK
- **And** already-billed entries cannot be re-added to another invoice

### AC-TIME-04 — Bulk Time Entry Approval
- **Given** an Accountant selects multiple submitted entries in the approval queue
- **When** they click "Bulk Approve"
- **Then** `StepUpGuard` is enforced
- **And** all selected entries transition to `Approved` in a single transaction
- **And** individual audit events are emitted for each entry

### AC-UI-TIME-01 — Timesheet UI
- **Given** a Lawyer navigates to `/time-tracking`
- **Then** a weekly timesheet grid shows days as columns with hour totals
- **And** a running timer widget allows start/stop/pause with automatic hour calculation
- **And** a time entry list below the grid shows all entries with status filters

---

## 7. Notifications & Real-Time

### AC-NOTIF-01 — WebSocket Gateway
- **Given** a user is connected via WebSocket (Socket.IO)
- **When** a relevant event occurs (task assigned, hearing scheduled, approval required, document shared)
- **Then** the notification is delivered to the user within ≤ 2 seconds
- **And** the WebSocket uses Redis adapter for multi-instance support

### AC-NOTIF-02 — Notification Subscriptions
- **Given** a user configures notification preferences via `PATCH /notifications/subscriptions`
- **Then** they can enable/disable per event type and per channel (InApp / Email / Both)
- **And** disabled subscriptions suppress delivery for that channel

### AC-NOTIF-03 — Email Notifications
- **Given** a user has Email channel enabled for an event type
- **When** the event occurs
- **Then** the email sender dispatches via SMTP with the configured template
- **And** failed emails are retried 3 times with exponential backoff
- **And** permanently failed emails are logged to a dead-letter queue

### AC-UI-NOTIF-01 — NotificationBell UI
- **Given** a user is on any page
- **Then** the top bar NotificationBell shows an unread count badge
- **And** clicking opens a dropdown with recent notifications (infinite scroll)
- **And** new notifications trigger a subtle bell animation

### AC-UI-NOTIF-02 — Notification Preferences UI
- **Given** a user navigates to `/settings/notifications`
- **Then** a matrix displays event types (rows) × channels (columns) with toggles
- **And** changes are persisted via the subscriptions API

---

## 8. UI & Dashboard

### AC-UI-DASH-01 — Lawyer Dashboard
- **Given** a Lawyer navigates to `/dashboard`
- **Then** a 2-column responsive grid displays 6 widgets:
  1. Today's Agenda (from calendar)
  2. My Tasks (with status filters)
  3. Recent Documents (last 10)
  4. Case Distribution chart (doughnut)
  5. Upcoming Hearings (next 7 days)
  6. Hours This Week (bar chart from time entries)
- **And** widgets collapse to single column on mobile (< 768px)

### AC-UI-DASH-02 — Accountant Dashboard
- **Given** an Accountant navigates to `/dashboard`
- **Then** a 2-column grid displays:
  1. Accounts Receivable summary (total outstanding)
  2. Pending Approvals count (time entries + expenses)
  3. Revenue Trend chart (monthly, last 12 months)
  4. Invoices by Status (pie chart)
- **And** clicking a widget navigates to the relevant list view

### AC-UI-NAV-01 — Grouped Sidebar Navigation
- **Given** any authenticated user
- **Then** the sidebar shows grouped sections: Main, Case Management, Documents, Finance, Insights, Administration
- **And** sections are collapsed by default (only active group expanded)
- **And** on mobile (< 768px), the sidebar is replaced by a bottom tab bar with 5 key actions
- **And** the active route is highlighted in the sidebar

### AC-UI-HEAR-01 — Hearing List & Detail UI
- **Given** a user views hearings for a case
- **Then** the hearing list shows: date, court, judge, type, status (color-coded)
- **And** hearing detail has tabs: Details, Documents, Notes, Timeline
- **And** status badge colors: Scheduled=blue, Completed=green, Postponed=amber, Cancelled=red

### AC-UI-DOC-01 — Document Library UI
- **Given** a user navigates to `/documents`
- **Then** the left panel shows the folder tree; the right panel shows the file list for the selected folder
- **And** an OCR search bar at the top searches across all accessible documents
- **And** bulk action toolbar appears when multiple files are selected (Move, Tag, Delete)
- **And** each file row shows: name, type icon, size, upload date, OCR status badge

### AC-UI-ADMIN-01 — Admin Settings Page
- **Given** a TenantAdmin navigates to `/admin/settings`
- **Then** sections include: Tenant Profile, Notification Defaults, Numbering Patterns, Storage Quota
- **And** changes are saved per-section with confirmation toast

---

## 9. Performance & Accessibility

### AC-PERF-01 — API Performance Benchmarks
- **Given** the system is under expected load
- **Then** API read P95 latency ≤ 500ms
- **And** API write P95 latency ≤ 1000ms
- **And** full-text search P95 ≤ 800ms
- **And** calendar conflict detection P95 ≤ 200ms
- **And** ≥ 50 concurrent document uploads sustained

### AC-A11Y-01 — WCAG 2.1 AA Compliance
- **Given** all Phase 2 screens are complete
- **Then** automated accessibility audit (axe-core) passes with 0 critical / 0 serious violations
- **And** calendar grid uses `role="grid"` with arrow key navigation
- **And** folder tree uses `role="tree"` / `role="treeitem"` with keyboard expand/collapse
- **And** notification toasts use `aria-live="polite"` region

---

## 10. Testing & Migration

### AC-TEST-01 — Frontend Test Infrastructure
- **Given** Vitest + React Testing Library are configured
- **Then** `npm run test:frontend` executes and reports coverage
- **And** CI pipeline includes frontend test step

### AC-TEST-02 — Frontend Coverage ≥ 60%
- **Given** Phase 2 is complete
- **Then** frontend component test coverage ≥ 60% of statements
- **And** critical paths covered: login, case list, calendar CRUD, folder tree, time entry submission

### AC-TEST-03 — E2E Smoke Tests
- **Given** the system is deployed to staging
- **Then** smoke tests cover: login flow, create case (+ template instantiation), schedule hearing, create calendar event, upload document to folder, search document, create time entry → submit → approve → invoice

### AC-MIG-01 — Migration Framework
- **Given** a migration runner is in place
- **Then** migrations are versioned, timestamped, and reversible
- **And** `npm run migrate:up` applies pending migrations; `npm run migrate:down` rolls back the last batch

### AC-MIG-02 — Phase 2 Schema Migration
- **Given** the Phase 2 migration script runs
- **Then** all new tables and columns from the domain model are created
- **And** existing data is not lost or corrupted
- **And** migration completes within 60 seconds for a 10 GB database

### AC-MIG-03 — Data Migration (Documents to Folders)
- **Given** existing documents have no folder assignments
- **When** the data migration script runs
- **Then** documents are assigned to a default root folder per case
- **And** the migration is idempotent (re-running produces the same result)

### AC-OPS-01 — Production Deployment Runbook
- **Given** Phase 2 is ready for production
- **Then** a runbook documents: pre-deployment checks, migration steps, feature flag sequence, rollback procedure, health check verification
