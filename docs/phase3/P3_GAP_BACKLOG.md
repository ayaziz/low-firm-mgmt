# LOMA — Phase 3 Gap Backlog

> **Version**: 3.0  
> **Status**: TODO — Ready for Sprint Planning  
> **Total Items**: 55  
> **Format**: `ID | Priority | Layer | Entity/Module | Gap | Root Cause | Fix | Status`  
> **Priorities**: P0 = Blocking / Financial Risk · P1 = High Value · P2 = Enhancement · P3 = Infrastructure  
> **Layers**: DB · Backend · Frontend · Full-Stack · Infra

---

## Sprint Suggested Grouping

| Sprint | Items | Theme |
|--------|-------|-------|
| S1 | P3-001 – P3-010 | Schema enrichment migrations + status history engine |
| S2 | P3-011 – P3-022 | Approval workflows (wages, invoices, postponements) |
| S3 | P3-023 – P3-033 | Document management (folders fix, expiry, bulk ops) |
| S4 | P3-034 – P3-042 | Notifications + SSE + email |
| S5 | P3-043 – P3-050 | Reporting + dashboard |
| S6 | P3-051 – P3-055 | Calendar + OCR + external sharing + UX |

---

## Backlog Table

| ID | Priority | Layer | Entity / Module | Gap | Root Cause | Fix | Status |
|----|----------|-------|-----------------|-----|------------|-----|--------|
| P3-001 | P0 | DB | `wages` | Wage approval states missing: only `Planned/Paid`; no `Submitted/Approved` | Schema designed for simple bookkeeping; governance deferred from Phase 1 | `p3_04_wage_approval.sql`: extend CHECK constraint; add `submitted_at/by`, `approved_at/by`, `paid_at`, `payment_method`, `payment_ref`; migrate `Planned→Draft` | TODO |
| P3-002 | P0 | DB | `status_history` | No generic status transition history table; from/to status changes are unrecoverable from `audit_events` | Audit log captures raw events; structured timeline was deferred | `p3_06_status_history.sql`: CREATE `status_history(id, entity_type, entity_id, from_status, to_status, actor_user_id, comment, metadata, created_at)`; GIN index on (entity_type, entity_id) | TODO |
| P3-003 | P0 | DB | `folders` | Folders table has wrong columns (`parent_id`, `case_id`, `description`) — every folder API call returns 500 | P1/P2 placeholder schema never corrected; folder feature shipped broken | `p3_07_folders_fix.sql`: DROP and recreate `folders` with correct columns `(scope_type, scope_id, parent_folder_id, name, is_deleted)`; add `folder_id` + `expires_at` to `documents` | TODO |
| P3-004 | P1 | DB | `customers` | KYC fields missing: `kyc_status`, `kyc_verified_at` | Customer schema kept minimal in Phase 1 | `p3_01_customer_enrichment.sql`: ADD COLUMN `kyc_status VARCHAR(20) DEFAULT 'NotStarted'`, `kyc_verified_at TIMESTAMPTZ` | TODO |
| P3-005 | P1 | DB | `customers` | Risk and relationship fields missing: `risk_profile`, `relationship_manager_user_id`, `credit_rating` | Phase 1 deferred | Same migration file: ADD COLUMN `risk_profile`, `credit_rating`, `relationship_manager_user_id UUID` | TODO |
| P3-006 | P2 | DB | `customers` | Communication preference fields missing: `preferred_language`, `preferred_comm_channel`, `industry_sector` | Phase 1 deferred | Same migration: ADD COLUMN `preferred_language VARCHAR(5)`, `preferred_comm_channel VARCHAR(20)`, `industry_sector VARCHAR(200)` | TODO |
| P3-007 | P2 | DB | `customers` | Individual identity fields missing: `date_of_birth`, `gender`; organization: `incorporation_date`, `annual_revenue_band` | Phase 1 deferred | Same migration: ADD COLUMN all four fields with appropriate types and CHECK constraints | TODO |
| P3-008 | P1 | DB | `cases` | Risk/priority fields missing: `risk_level`, `priority`, `source`, `estimated_value` | Phase 1 minimal case schema | `p3_02_case_enrichment.sql`: ADD COLUMN `risk_level VARCHAR(10)`, `priority VARCHAR(10)`, `source VARCHAR(20)`, `estimated_value DECIMAL(18,2)` | TODO |
| P3-009 | P1 | DB | `cases` | Legal/judgment fields missing: `legal_acts JSONB`, `judgment_date`, `judgment_outcome`, `judgment_reference`, `appeal_deadline` | Phase 1 deferred | Same migration: ADD COLUMN all five fields; `appeal_deadline` gets a DB trigger warning when < 30 days | TODO |
| P3-010 | P1 | DB | `cases` | Team assignment fields missing: `lead_lawyer_user_id`, `junior_lawyers UUID[]` | Only `assigned_lawyer_user_id` exists | Same migration: ADD COLUMN `lead_lawyer_user_id UUID`, `junior_lawyers UUID[] DEFAULT '{}'` | TODO |
| P3-011 | P1 | DB | `case_parties` | Opposing counsel contact details missing | `case_parties` only has `party_id` FK; no embedded counsel details | `p3_02_case_enrichment.sql`: ALTER `case_parties` ADD COLUMN `opposing_counsel_name`, `opposing_counsel_firm`, `opposing_counsel_email`, `opposing_counsel_phone`, `opposing_counsel_bar_no` | TODO |
| P3-012 | P1 | DB | `sessions` | Judge, witness, and billable fields missing | Session schema minimal; judge FK deferred; billable concept not introduced | `p3_03_session_enrichment.sql`: ADD COLUMN `judge_id UUID REFERENCES judges(id)`, `witness_list JSONB DEFAULT '[]'`, `actual_outcome TEXT`, `actual_start_time TIMESTAMPTZ`, `actual_end_time TIMESTAMPTZ`, `is_billable BOOLEAN DEFAULT FALSE`, `billable_duration_minutes INT` | TODO |
| P3-013 | P2 | DB | `sessions` | Postponement chain link missing | Reschedule creates isolated records; no FK linking replaced session to replacement | `p3_03_session_enrichment.sql`: ADD COLUMN `postponed_from_session_id UUID REFERENCES sessions(id)` | TODO |
| P3-014 | P1 | DB | `invoices` | Invoice review step missing: no `Review` state; no `reviewed_by/at/comment` columns | Phase 1 simple 5-state machine; second-eye review deferred | `p3_05_invoice_review.sql`: extend CHECK; ADD COLUMN `reviewed_by UUID`, `reviewed_at TIMESTAMPTZ`, `review_comment TEXT` | TODO |
| P3-015 | P1 | DB | `session_reschedules` | Postponement approval status missing | Reschedule was a simple log; approval gating deferred | `p3_10_session_postponement.sql`: ADD COLUMN `approval_status VARCHAR(20) DEFAULT 'Approved'`, `approved_by UUID`, `approval_comment TEXT`, `decided_at TIMESTAMPTZ` | TODO |
| P3-016 | P2 | DB | `document_ocr_text` | No OCR text storage table | OCR deferred from Phase 1 BRD | `p3_08_document_ocr.sql`: CREATE `document_ocr_text(id, document_id, version_id, raw_text, search_vector TSVECTOR, ocr_status)`; GIN index | TODO |
| P3-017 | P2 | DB | `external_share_links` | No external share link table | External sharing deferred from Phase 1 BRD | `p3_09_external_shares.sql`: CREATE `external_share_links` + `external_share_accesses` tables | TODO |
| P3-018 | P0 | Backend | `wages` | `WagesService` has no `submit()`, `approve()`, `reject()`, `markPaid()` methods | State machine not implemented | Implement `ApprovalService` (generic) with `WageApprovalAdapter`; add 4 endpoints; enforce self-approval block | TODO |
| P3-019 | P1 | Backend | `invoices` | `InvoicesService` has no `submitForReview()`, `approveReview()`, `rejectReview()` when toggle enabled | Review step not implemented | Implement `InvoiceApprovalAdapter`; add 3 endpoints; gateway by `invoiceApprovalRequired` tenant setting | TODO |
| P3-020 | P1 | Backend | `sessions` | No postponement approval flow: `POST /sessions/{id}/reschedule/submit`, `approve`, `reject` | Reschedule was immediate; approval gating not implemented | Implement `SessionPostponementAdapter`; `reschedule` endpoint splits into submit + approve/reject flow | TODO |
| P3-021 | P0 | Backend | `status-history` | `StatusHistoryService` does not exist; no `emit()` calls on any status transition | History capture deferred | Create `StatusHistoryService`; add `emit()` call inside each service method that modifies status on: `CasesService`, `InvoicesService`, `ExpensesService`, `WagesService`, `FilingsService`, `DocumentsService` | TODO |
| P3-022 | P1 | Backend | `status-history` | No `GET /status-history?entityType=&entityId=` endpoint | Service not implemented | Add `StatusHistoryController` with single GET endpoint; pagination; ordered newest-first | TODO |
| P3-023 | P0 | Backend + Frontend | `folders` | `FoldersService` uses wrong SQL columns; all folder CRUD calls crash | Phase 1 service written against incorrect schema | Rewrite `FoldersService` against correct schema; implement `create`, `findTree`, `rename`, `move`, `softDelete`; fix `DocumentsService` `folder_id` references | TODO |
| P3-024 | P1 | Backend | `documents` | No `bulk/move`, `bulk/tag`, `bulk/delete`, `bulk/confidentiality` endpoints | Bulk operations not in Phase 1/2 scope | Add `POST /documents/bulk/{action}` endpoints; accept `{ documentIds[] }`; single DB transaction per bulk op | TODO |
| P3-025 | P1 | Backend | `documents` | No document expiry logic or filtering | `expires_at` column does not exist yet | After P3-003 migration: add `expires_at` write to create/update DTOs; add `?expiringWithin=30` filter to list endpoint | TODO |
| P3-026 | P2 | Backend | `documents` | No OCR job enqueued after scan pass | OCR deferred; scan pass handler only updates `scan_status` | In `document-scan` processor: on `Passed`, enqueue job to `ocr` BullMQ queue | TODO |
| P3-027 | P2 | Backend | `ocr` | OCR worker module does not exist | Not implemented | Create `OcrModule` with `OcrProcessor` (BullMQ); integrate `tesseract.js`; write extracted text to `document_ocr_text` | TODO |
| P3-028 | P2 | Backend | `documents` | Document search does not query OCR text | OCR table did not exist | After P3-016 + P3-027: modify GET `/documents` list query to JOIN `document_ocr_text` and add FTS WHERE clause | TODO |
| P3-029 | P2 | Backend | `documents` | No external share link endpoints | External sharing deferred | `POST /documents/{id}/external-shares` (create link; return plain token once); `DELETE` (revoke); `GET /share/{token}` (public endpoint; returns signed download URL) | TODO |
| P3-030 | P2 | Backend | `documents` | No version restore endpoint | Restore deferred from Phase 1 | `POST /documents/{id}/versions/{versionId}/restore` — creates new version with content from old version; requires checkout; audited | TODO |
| P3-031 | P1 | Backend | `notifications` | No SSE endpoint | Notification delivery mechanism never built | `GET /api/v1/notifications/stream` — auth-guarded SSE; publish via Redis Pub/Sub on `notif:{tenantId}:{userId}` | TODO |
| P3-032 | P1 | Backend | `notifications` | No email delivery integration | SMTP not configured | Add Nodemailer; `NotificationsService.sendEmail()`; templates for: hearing alert, approval request, task due, digest | TODO |
| P3-033 | P1 | Backend | `notifications` | No scheduled notification jobs | `@nestjs/schedule` not configured for notifications | Add `NotificationsScheduler`: hearing day-of cron (07:00 UTC), deadline reminder cron (08:00 UTC), digest cron (09:00 UTC Mon for weekly, daily) | TODO |
| P3-034 | P1 | Backend | `reports` | No dashboard KPI endpoints | Reports are CSV-export only; no aggregation API | `GET /api/v1/reports/dashboard-kpis` — returns 4 KPI objects; cached 60s in Redis per tenant | TODO |
| P3-035 | P1 | Backend | `reports` | No case aging report | Not implemented | `GET /api/v1/reports/case-aging?format=json|csv|xlsx` — queries cases grouped by state and days-in-state | TODO |
| P3-036 | P1 | Backend | `reports` | No receivables aging report | Not implemented | `GET /api/v1/reports/receivables-aging?format=json|csv|xlsx` — unpaid invoices grouped by overdue bands | TODO |
| P3-037 | P2 | Backend | `reports` | No lawyer utilization report | `is_billable` and `billable_duration_minutes` don't exist yet | After P3-012: `GET /api/v1/reports/lawyer-utilization?year=&month=&format=` — aggregate billable minutes per user | TODO |
| P3-038 | P2 | Backend | `reports` | No expense category breakdown report | Not implemented | `GET /api/v1/reports/expense-breakdown?year=&format=` — stacked by category × month | TODO |
| P3-039 | P2 | Backend | `reports` | No Excel (.xlsx) export | Only CSV via `csv-stringify` | Add `exceljs` package; `ReportsService.toXlsx(data, columns)` helper; used by all report endpoints | TODO |
| P3-040 | P2 | Backend | `sessions` | No iCal export endpoint | Not implemented | `GET /api/v1/sessions/{id}/ical` — returns `text/calendar` response; `ical-generator` npm package | TODO |
| P3-041 | P1 | Backend | `sessions` | No hearing conflict detection | Not implemented | On `POST /cases/{id}/sessions` and reschedule: query overlapping sessions for the same `assigned_lawyer_user_id` within ± 2 hours; return `409 Conflict` with conflicting session info | TODO |
| P3-042 | P1 | Backend | `customers` | Customer service does not read/write enrichment columns | Columns don't exist yet (added in P3-004 to P3-007) | After migrations: update `CustomersService` CREATE/UPDATE SQL to include all 11 new columns; update DTOs with validation decorators | TODO |
| P3-043 | P1 | Backend | `cases` | Case service does not read/write enrichment columns | Columns don't exist yet (P3-008 to P3-011) | After migrations: update `CasesService`; validate `legal_acts` JSONB array; add opposing counsel sub-service on case parties | TODO |
| P3-044 | P1 | Backend | `sessions` | Complete-session endpoint does not capture actual outcome/times/billable | `PATCH /sessions/{id}` only updates planned fields | Update `SessionsService.update()` or add `POST /sessions/{id}/complete` to accept `actual_outcome`, `actual_start_time`, `actual_end_time`, `is_billable`, `billable_duration_minutes` | TODO |
| P3-045 | P2 | Backend | `approval` | Self-approval not blocked for expenses | `ExpenseApprovalsService` does not check `submittedBy !== actorUserId` | In `ApprovalService.validateApprover()`: throw `ForbiddenException` if `actorUserId === submittedBy`; apply to all adapter validations | TODO |
| P3-046 | P1 | Frontend | `wages` | Wages list shows 2-state status; no approval action buttons | State machine not built | Add status badge chip with 4 states; Add contextual action buttons: "Submit" (Draft), "Approve/Reject" (Submitted, role-gated), "Mark Paid" (Approved); use `ApprovalActions` shared component | TODO |
| P3-047 | P1 | Frontend | `invoices` | Invoice detail has no "Submit for Review" / "Approve Review" / "Reject Review" UI | Review step not built | Conditionally render Review action buttons when `invoiceApprovalRequired` tenant setting = true; add `StatusTimeline` section | TODO |
| P3-048 | P1 | Frontend | `sessions` | Session form has no postponement approval flow | Reschedule was immediate mutation | Replace "Reschedule" button with "Request Postponement" dialog; show "Pending Approval" state on session; approval actions for CaseOwner | TODO |
| P3-049 | P0 | Frontend | `status-timeline` | `StatusTimeline` shared component does not exist | Never built | Create `components/StatusTimeline.tsx` using MUI `Timeline`; props: `entries: StatusHistoryEntry[]`; render coloured status chips, actor name, relative timestamp, comment; add to Case/Invoice/Wage/Expense/Filing/Document detail pages | TODO |
| P3-050 | P1 | Frontend | `notifications` | Bell icon, unread badge, and Notification Center do not exist | Notifications table exists but no UI | Create `NotificationCenter.tsx` drawer; `useNotifications()` SSE hook; bell icon with unread badge in `AppHeader`; mark-read and mark-all-read actions | TODO |
| P3-051 | P0 | Frontend | `folders` | Document Library has no folder tree sidebar | Folders broken | After P3-023 backend fix: implement `FolderTree.tsx` (MUI TreeView + context menu); left-pane sidebar in Documents page; breadcrumb navigation | TODO |
| P3-052 | P2 | Frontend | `documents` | No bulk action bar in Document Library | Not implemented | After P3-024 backend: add checkbox column to doc DataGrid; `DocumentBulkBar.tsx` floats above list when ≥1 selected; actions: Move, Tag, Confidentiality, Delete | TODO |
| P3-053 | P2 | Frontend | `documents` | No external share link UI | Not implemented | After P3-029 backend: "Share Externally" option in document context menu; `ExternalShareDialog.tsx` with expiry/password/max-download config; shows generated link for copy | TODO |
| P3-054 | P1 | Frontend | `reports` | No dashboard KPI widgets on home page | Home page is a placeholder | After P3-034 backend: build `/` dashboard with `KpiCard` components and `AgingChart` for open cases visualization | TODO |
| P3-055 | P2 | Frontend | `calendar` | No rrule builder UI | rrule engine implemented server-side (P2 G-070) but FE accepts raw string | Create `RecurrenceRuleBuilder.tsx` with: frequency picker (None/Daily/Weekly/Monthly), weekday selector, end-condition selector; serializes to RRULE string for API | TODO |

---

| P3-056 | P0 | Backend | `documents` | No context-aware rich upload session API | Existing upload flow is document-library centric | Add `POST /documents/upload-sessions` + finalize endpoint with per-file validation and signed URL bootstrap | TODO |
| P3-057 | P1 | DB | `documents` | No origin-trace metadata on documents | Upload source module/entity not persisted | Add `origin_module`, `origin_entity_type`, `origin_entity_id`; index by `(origin_entity_type, origin_entity_id)` | TODO |
| P3-058 | P0 | Frontend | `documents` | Shared Rich Upload component missing | Upload UX duplicated/inconsistent across modules | Build `RichDocumentUpload.tsx` with queue/progress/retry and metadata editor | TODO |
| P3-059 | P1 | Frontend | `case/customer` | Case/Customer views lack embedded contextual uploader | Users must navigate away to documents page | Integrate uploader in Case Documents tab, timeline quick action, and Customer KYC panel | TODO |
| P3-060 | P1 | Frontend | `finance` | Expense/Invoice forms lack in-form attachment upload | Finance evidence upload disconnected from workflow context | Integrate uploader in Expense/Invoice forms with finance doc-type presets | TODO |
| P3-061 | P2 | Frontend | `tasks/comms/sessions/filings` | Workflow forms lack universal attachment entry point | Attachments added late or missed | Add uploader to Task drawer, Communication drawer, Session/Hearing and Filing forms | TODO |

---

## Progress Tracker

| Sprint | Items | Completed | Remaining |
|--------|-------|-----------|-----------|
| S1 — Schema + Status History | P3-001 to P3-010 | 0 | 10 |
| S2 — Approval Workflows | P3-011 to P3-022 | 0 | 12 |
| S3 — Document Management | P3-023 to P3-033 | 0 | 11 |
| S4 — Notifications | P3-031 to P3-033 | 0 | 3 |
| S5 — Reporting | P3-034 to P3-044 | 0 | 11 |
| S6 — Calendar + OCR + UX | P3-045 to P3-055 | 0 | 11 |
| S7 — Rich Upload Integration | P3-056 to P3-061 | 0 | 6 |
| **Total** | **61** | **0** | **61** |

---

## Definition of Done (per item)

1. Migration applied (if DB layer) — verified in Docker container.
2. Backend endpoint(s) created — integration test passing.
3. Frontend UI updated — renders correctly in EN and AR layouts.
4. Existing 195 Jest tests still pass.
5. Status updated to ✅ `DONE` in this table.
