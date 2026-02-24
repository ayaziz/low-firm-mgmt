# GAPS.md — MVP Gap Analysis
## Law Office Management Application (LOMA)

**Generated:** 2026-02-23  
**Compared Against:** PRD v1.0, FSD v1.0, SRS v1.0, TDD v1.0, Appendix v1.0  
**Codebase Snapshot:** Window 8 Session 11

---

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Fully implemented — code exists and works |
| ⚠️ | Partially implemented — some code exists but incomplete |
| ❌ | Not implemented — no code found |
| 🔜 | Explicitly deferred (Phase 2+) per PRD §4.2 |

---

## 1. Customer Module (FR-CUST)

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| FR-CUST-01 | Individual + Organization types | ✅ | `customer_type` enum in entity; validated in `CustomerService` |
| FR-CUST-02 | Org requires registrationId + taxId | ✅ | Validated in `createCustomer()` |
| FR-CUST-03 | Individual requires nationalId or passportNumber | ✅ | Validated in `createCustomer()` |
| FR-CUST-04 | Uniqueness enforcement for identity fields | ✅ | Duplicate check queries in `createCustomer()` |
| FR-CUST-05 | Multiple addresses per customer | ✅ | `addresses` table; `POST /customers/:id/addresses` endpoint; frontend Addresses tab |
| FR-CUST-06 | Contacts per customer | ✅ | `contacts` table; add/delete endpoints; frontend Contacts tab |
| FR-CUST-07 | Contact roles configurable by Tenant Admin | ⚠️ | Roles stored in contacts; no admin UI for managing contact role types. Master data category list does not include `contactRoles` |
| FR-CUST-08 | Party entity reusable for opposing parties | ✅ | `case_parties` table; `POST /cases/:id/parties` endpoint |
| FR-CUST-09 | Party relationship types configurable | ⚠️ | Parties exist but relationship types are not managed in admin master data |
| FR-CUST-10 | Compliance checklist templates + tracking | ✅ | `checklist_templates`, `customer_checklists`, `customer_checklist_items` tables; auto-applied on customer create; `GET /customers/:id/compliance-checklist` |
| FR-CUST-11 | Required document prompting from templates | ✅ | `doc_requirement_templates`, `customer_doc_requirements` tables; auto-applied on create |
| FR-CUST-12 | Customer financial summary (derived) | ✅ | `GET /customers/:id/financial-summary` returns outstanding, paid, overdue amounts |

### Customer Frontend Screens

| Screen | Status | Notes |
|--------|--------|-------|
| Customer List (filters, search, pagination) | ⚠️ | List with cursor pagination ✅; type column ✅; search/filter controls ❌ (no inline filters) |
| Customer Detail – Overview | ⚠️ | Shows name, type, nationalId; no financial summary card on detail page |
| Customer Detail – Contacts & Parties | ✅ | Contacts tab with add/delete |
| Customer Detail – Addresses | ✅ | Addresses tab with add/delete |
| Customer Detail – Documents | ❌ | No documents tab on customer detail |
| Customer Detail – Compliance Checklist | ❌ | API exists (`GET /compliance-checklist`) but no UI tab for it |
| Customer Detail – Activity Feed | ❌ | No activity feed tab |
| Customer Detail – Audit | ❌ | No audit tab on customer detail (audit API exists but not wired here) |
| Customer Create/Edit | ✅ | Create dialog + edit dialog with optimistic locking |

---

## 2. Case Module (FR-CASE)

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| FR-CASE-01 | Case types configurable per tenant | ✅ | `case_types` table; Admin CaseTypes tab |
| FR-CASE-02 | Case type templates (req docs, tasks, sessions, participants) | ⚠️ | Case type has `task_templates` + `doc_requirements` columns; no session/participant templates |
| FR-CASE-03 | systemCaseRef = CASE-{YYYY}-{SEQUENCE} | ✅ | Auto-generated via `case_sequences` table |
| FR-CASE-04 | courtCaseNumber optional | ✅ | Column exists in cases table |
| FR-CASE-05 | Case states: Intake→Open→Active→Pending→Closed→Archived | ✅ | `VALID_STATE_TRANSITIONS` map enforced in CaseService |
| FR-CASE-06 | OnHold flag with reason + dates | ✅ | `POST /cases/:id/on-hold` endpoint |
| FR-CASE-07 | Reopen from Closed→Active with reason | ✅ | `POST /cases/:id/reopen` endpoint |
| FR-CASE-08 | Archived cases read-only | ✅ | `ensureNotArchived()` guard in CaseService |
| FR-CASE-09 | Multiple customers + opposing parties per case | ✅ | `case_customers` + `case_parties` tables |
| FR-CASE-10 | Participant roles configurable; visibilityScope | ⚠️ | `case_memberships` has role field; no `visibilityScope` column |
| FR-CASE-11 | Court as separate entity | ❌ | No court entity; courts stored in master data (flat key-value) |
| FR-CASE-12 | Sessions with reschedule history + reason | ✅ | `sessions` + `session_reschedules` tables; PATCH endpoint creates reschedule record |
| FR-CASE-13 | Tasks with assignments, reminders, notifications | ⚠️ | Tasks exist with due dates and assignments; no reminder scheduling (no cron/scheduler) |
| FR-CASE-14 | Notes append-only | ✅ | POST only, no PATCH/DELETE on notes |
| FR-CASE-15 | Filing types configurable; statuses | ✅ | Filings with type + status; filing types in master data |
| FR-CASE-16 | Communications log at customer + case level | ⚠️ | Case-level communications ✅; customer-level communications ❌ (no endpoint) |

### Case Frontend Screens

| Screen | Status | Notes |
|--------|--------|-------|
| Case List (filters: type, state, owner, completeness) | ⚠️ | List with pagination ✅; state chips ✅; completeness % ✅; no inline filter controls |
| Case Detail – Timeline | ❌ | No unified timeline view combining tasks/sessions/filings/comms |
| Case Detail – Tasks | ✅ | Tab with list + create dialog |
| Case Detail – Sessions | ✅ | Tab with list + create dialog |
| Case Detail – Filings | ✅ | Tab with list + create dialog |
| Case Detail – Notes | ✅ | Tab with list + create dialog |
| Case Detail – Communications | ✅ | Tab with list + create dialog |
| Case Detail – Participants | ❌ | No participants tab on case detail UI |
| Case Detail – Documents | ❌ | No documents tab scoped to case on detail page |
| Case Detail – Financial Summary | ❌ | No financial summary (invoice headers) tab for Lawyer |
| Case Detail – Audit | ❌ | No audit tab on case detail |
| Case Detail – Completeness Panel | ⚠️ | Shows completeness % bar but not the detailed missing items list |

---

## 3. Completeness Engine (FR-COMP)

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| FR-COMP-01 | Compute Case completeness % (40/40/20 weights) | ✅ | `CompletenessService` with exact weight formula |
| FR-COMP-02 | Show missing items list in UI | ⚠️ | API returns missing items; UI shows only the % bar, not the list |
| FR-COMP-03 | Completeness does not block progress | ✅ | Informational only |

---

## 4. Document Module (FR-DOC)

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| FR-DOC-01 | External object storage; metadata in DB | ✅ | MinIO (S3) via `StorageService`; metadata in tenant schema |
| FR-DOC-02 | Hierarchical storage path | ⚠️ | Key format is `<tenant>/<docId>/<versionId>` — simpler than spec (`/tenants/{tid}/customers/{cid}/cases/{caseId}/documents/{docType}/{docId}/versions/{vid}`) |
| FR-DOC-03 | Pre-signed upload URLs | ✅ | `getUploadUrl()` returns 15-min presigned PUT URL |
| FR-DOC-04 | Content-type + checksum validation; size limits | ❌ | No content-type validation, no checksum verification, no size limit enforcement |
| FR-DOC-05 | Malware scan gate (Pending/Passed/Failed) | ✅ | BullMQ scan worker; scan_status field; EICAR detection |
| FR-DOC-06 | Immutable versions; no rollback | ✅ | Versions are append-only; no rollback endpoint |
| FR-DOC-07 | Check-out/in with 4h lock expiry | ✅ | `checkout()` / `checkin()` with `checkout_expires_at` |
| FR-DOC-08 | Admin break lock with step-up + audit | ✅ | `POST /documents/:id/break-lock` with `@RequireStepUp()` |
| FR-DOC-09 | Confidentiality levels + HighlyConfidential rules | ⚠️ | Confidentiality stored; ACL exists; no step-up enforcement for HC view/download |
| FR-DOC-10 | Internal time-bound sharing | ⚠️ | Sharing via ACL (by email) implemented; no time-bound expiry on shares |
| FR-DOC-11 | Retention policies seeded, visible, not editable | ❌ | No retention policies table or UI |
| FR-DOC-12 | Legal hold at case + document level | ⚠️ | Document-level legal hold ✅; case-level legal hold ❌ |
| FR-DOC-13 | Soft delete + restore; purge via retention job | ⚠️ | Soft delete/restore ✅; no retention purge job |

### Document Frontend Screens

| Screen | Status | Notes |
|--------|--------|-------|
| Document Library | ✅ | List with scan status, confidentiality, upload dialog |
| Document Detail – Metadata | ✅ | Metadata card with all fields |
| Document Detail – Versions | ✅ | Version history list |
| Document Detail – Lock status | ✅ | Checkout/checkin/break-lock UI |
| Document Detail – Shares | ✅ | Share dialog (by email) |
| Document Detail – Access History | ❌ | No access history / audit trail on document detail |
| Upload modal (docType, confidentiality, tags) | ⚠️ | Title + case + confidentiality + file; no docType dropdown, no tags |

---

## 5. Storage Providers (FR-STO)

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| FR-STO-01 | Storage abstraction: Azure Blob + S3 | ⚠️ | S3-compatible only (MinIO); no Azure Blob provider |
| FR-STO-02 | Shared vs dedicated storage per tenant | ❌ | Tenant table has `storageBucket`/`storageEndpoint` fields but single hardcoded MinIO instance |
| FR-STO-03 | Provider credentials via secret manager | ❌ | Credentials in environment variables, not secret manager |

---

## 6. Accounting Module (FR-ACC)

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| FR-ACC-01 | Invoice generic line items + totals | ✅ | `invoice_line_items` table; dynamic rows in create dialog |
| FR-ACC-02 | Invoice-level tax% and discount% | ⚠️ | Tax calculated in service; no discount% field in schema |
| FR-ACC-03 | Invoice numbering INV-{YYYY}-{SEQUENCE} | ✅ | `invoice_sequences` table; auto-generated |
| FR-ACC-04 | Lawyer may create draft invoices (tenant setting) | ⚠️ | `lawyerCanDraft` exists on Tenant model; invoice create endpoint only allows Accountant/TenantAdmin — Lawyer draft creation not conditionally enabled by this flag |
| FR-ACC-05 | Only Accountant finalizes | ✅ | `@Roles(Role.Accountant, Role.TenantAdmin)` on finalize |
| FR-ACC-06 | Finalized invoices read-only; void by Accountant/TenantAdmin | ✅ | Status checks in service; void endpoint restricted |
| FR-ACC-07 | Payments allocated to single invoice | ✅ | Payment has `invoice_id` FK |
| FR-ACC-08 | Partial payments allowed | ✅ | Auto-updates status to PartiallyPaid/Paid |
| FR-ACC-09 | Overpayments rejected | ✅ | Validation in `recordPayment()` |
| FR-ACC-10 | Payment idempotency via Idempotency-Key | ✅ | `IdempotencyRecord` model + header check |
| FR-ACC-11 | Expense multi-step role-based approvals | ⚠️ | Single-step approval (approve/reject by Accountant/TenantAdmin); no multi-step chain (e.g., Manager→Director→CFO) |
| FR-ACC-12 | Receipts optional for expenses | ✅ | `receipt_ref` column nullable |
| FR-ACC-13 | Wages with CSV export | ✅ | CRUD + `GET /wages/export-csv` with StepUp |
| FR-ACC-14 | Reports as CSV exports, audited | ✅ | `GET /reports/:type/export` with StepUp + audit event |

### Accounting Frontend Screens

| Screen | Status | Notes |
|--------|--------|-------|
| Invoice List | ✅ | InvoicesTab with status chips, create dialog |
| Invoice Detail | ✅ | Actions (finalize/send/void/PDF), line items, payments, record payment dialog |
| Payment Entry | ✅ | Dialog within invoice detail |
| Expenses + Approval Queue | ⚠️ | Expense list with approve/reject buttons; no dedicated "approval queue" view |
| Wages List | ✅ | WagesTab with create + CSV export |
| Reports Dashboard | ✅ | 9 report types with charts + CSV export |

---

## 7. Admin Module

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| User create/deactivate/reactivate | ✅ | UsersTab: create, edit, toggle-active |
| Role assignment | ✅ | Multi-select roles in user create/edit |
| Case membership roles | ✅ | `POST /cases/:id/memberships` |
| Master data management | ✅ | 9 categories in MasterDataTab |
| Plan tier configuration | ❌ | `planTier` field exists on Tenant but no UI to change it |
| Tenant settings | ✅ | SettingsTab: firm name, timezone, currency, invoice prefix, auto-scan, expense workflow |
| Governance – Legal Holds | ❌ | Document-level legal hold exists but no admin dashboard listing all holds |
| Governance – Retention Policies | ❌ | No retention policies |

---

## 8. Search (FR-SEARCH)

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| FR-SEARCH-01 | Global search: customers, cases, documents, invoices | ✅ | `SearchService` queries all 4 entities |
| FR-SEARCH-02 | Arabic normalization | ✅ | `normalizeArabic()` strips diacritics, normalizes hamza/alef/taa/kashida |
| FR-SEARCH-03 | Permission-filtered results | ⚠️ | Tenant-scoped (schema isolation) ✅; no document confidentiality filtering on search results |
| FR-SEARCH-04 | Filters per entity | ⚠️ | Entity type toggle ✅; no advanced filters per entity type |

---

## 9. Auth & Security (FR-AUTHN, FR-AUTHZ, FR-SESSION, NFR-SEC)

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| FR-AUTHN-01 | OIDC Authorization Code + PKCE | ❌ | Dev-mode login only (email/password → JWT). OIDC is production auth; OK for MVP dev mode |
| FR-AUTHN-02 | JWT validation server-side | ✅ | Passport JWT strategy |
| FR-AUTHN-03 | Map users to tenantId + roles at login | ✅ | JWT payload includes tenantSlug + roles |
| FR-SESSION-01 | Idle session timeout in UI | ❌ | No idle timeout; token has `exp` but no activity-based refresh |
| FR-SESSION-02 | Step-up for sensitive actions | ⚠️ | Step-up implemented for break-lock, legal-hold, CSV export; NOT for HC doc view/download |
| FR-SESSION-03 | Step-up attempts audited | ⚠️ | Break-lock + legal-hold create audit events; step-up auth attempt itself not audited |
| FR-AUTHZ-01 | RBAC permissions | ✅ | `@Roles()` decorator + `RolesGuard` |
| FR-AUTHZ-02 | ABAC: tenant boundary, case membership, doc ACL | ⚠️ | Tenant boundary ✅ (TenantGuard); case membership check ❌ (no membership enforcement on read); doc ACL ✅ for HighlyConfidential |
| FR-AUTHZ-03 | HighlyConfidential requires explicit ACL allow | ⚠️ | ACL table exists; sharing adds ACL; no enforcement on `GET /documents/:id` for HC docs requiring ACL check |
| FR-AUTHZ-04 | Case membership roles | ✅ | CaseOwner, CaseMember, ReadOnly via memberships |
| NFR-SEC-01 | TLS 1.2+ | ⚠️ | nginx serves HTTP in Docker; TLS is deployment concern (OK for MVP dev) |
| NFR-SEC-04 | Short-lived signed URLs | ✅ | Upload 15min, download 5min |
| NFR-SEC-05 | Rate limiting | ❌ | No rate limiting configured |
| NFR-SEC-06 | Audit logs immutable append-only | ✅ | INSERT-only in AuditService; no UPDATE/DELETE endpoints |

---

## 10. Notifications

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| In-app notifications | ✅ | CRUD + unread count + mark read |
| Real-time push | ❌ | No WebSocket/SSE; polling only via manual refresh |
| Notification on task assignment | ⚠️ | Notification created on doc scan completion; no notification on task create/assign |
| Notification on session scheduling | ❌ | No notification on session create |
| Type-based filtering | ⚠️ | Entity type stored; no filter controls in notification list UI |

---

## 11. Non-Functional Requirements

| Req | Description | Status | Evidence / Notes |
|-----|-------------|--------|------------------|
| NFR-OBS-01 | Structured logs with correlation IDs | ❌ | No structured logging; only `console.log` at startup |
| NFR-OBS-02 | Metrics dashboards (API, DB, storage, queue, worker) | ❌ | No metrics collection or dashboards |
| NFR-OBS-03 | Alerts on thresholds | ❌ | No alerting |
| NFR-GLOB-01 | English + Arabic (RTL) | ✅ | i18next with en.json + ar.json; Emotion RTL cache switching |
| NFR-GLOB-02 | Tenant default timezone; UTC storage | ⚠️ | Tenant has `timezone` field; timestamps stored as `TIMESTAMP` (not explicitly `TIMESTAMPTZ`) |
| NFR-GLOB-03 | Locale formatting for dates/numbers | ⚠️ | Tenant has `locale` field; frontend uses browser locale, not tenant locale |
| NFR-GLOB-04 | Single currency per tenant | ✅ | Tenant `currency` field; invoices use tenant currency |
| NFR-PERF-01 | Pagination on all list endpoints | ✅ | Cursor-based pagination on all list APIs |
| NFR-PERF-02 | File transfers via direct-to-storage | ✅ | Presigned URLs; API not a file proxy |
| NFR-AVAIL-02 | DB PITR/daily backups | ❌ | No backup configuration in Docker setup (deployment concern) |
| NFR-AVAIL-03 | Storage soft delete + versioning | ⚠️ | Application-level soft delete ✅; MinIO versioning not enabled |
| NFR-COMP-02 | Legal hold blocks purge | ⚠️ | Legal hold flag exists; no purge job to test against |

---

## 12. Infrastructure

| Concern | Status | Notes |
|---------|--------|-------|
| Docker Compose stack | ✅ | 8 services: postgres, redis, minio, minio-init, backend, db-init, frontend, nginx |
| Health checks | ✅ | `GET /api/v1/health` + `GET /api/v1/health/ready` |
| DB migrations | ✅ | Prisma migrate deploy via db-init service |
| Seed data | ✅ | `prisma db seed` creates demo tenant + users + tenant schema |
| CI/CD readiness | ❌ | No CI/CD pipeline configuration (no GitHub Actions, etc.) |
| Observability stack | ❌ | No Loki, Grafana, Prometheus, or other observability services |

---

## 13. Explicit Deferrals (PRD §4.2 — Not Gaps)

| Feature | Status |
|---------|--------|
| Email/calendar/messaging integrations | 🔜 Phase 2 |
| OCR/full-text search | 🔜 Phase 2 |
| External sharing | 🔜 Phase 2 |
| Configurable numbering | 🔜 Phase 2 |
| Editable notes | 🔜 Phase 2 |
| Retention editing + advanced lifecycle | 🔜 Phase 2+ |
| Dedicated DB per tenant (Enterprise) | 🔜 Later |
| Migration/import | 🔜 Wave 3/4 |
| Custom fields | 🔜 Phase 2+ |

---

## Summary

| Category | ✅ Done | ⚠️ Partial | ❌ Missing |
|----------|---------|------------|-----------|
| Customer Module | 10 | 2 | 0 |
| Customer Screens | 4 | 2 | 4 |
| Case Module | 11 | 3 | 1 |
| Case Screens | 5 | 2 | 5 |
| Completeness | 2 | 1 | 0 |
| Document Module | 7 | 4 | 2 |
| Document Screens | 5 | 1 | 1 |
| Storage Providers | 0 | 1 | 2 |
| Accounting | 10 | 3 | 0 |
| Accounting Screens | 5 | 1 | 0 |
| Admin | 4 | 0 | 3 |
| Search | 2 | 2 | 0 |
| Auth & Security | 7 | 5 | 3 |
| Notifications | 1 | 2 | 2 |
| Non-Functional | 4 | 3 | 4 |
| Infrastructure | 4 | 0 | 2 |
| **TOTAL** | **81** | **32** | **29** |

### Top Priority Gaps for MVP Hardening

1. **NFR-OBS-01/02/03** — No structured logging, no correlation IDs, no dashboards, no alerts
2. **FR-SESSION-01** — No idle session timeout
3. **FR-DOC-09** — HighlyConfidential view/download missing step-up enforcement
4. **FR-CASE-16** — Customer-level communications missing
5. **FR-DOC-04** — No content-type/size validation on uploads
6. **FR-ACC-04** — Lawyer draft invoice conditional on `lawyerCanDraft` not wired
7. **FR-ACC-11** — Multi-step expense approval chain not implemented (single-step only)
8. **Customer/Case Detail screens** — Missing tabs (Documents, Compliance, Audit, Activity, Participants, Timeline, Financial Summary)
9. **Rate limiting (NFR-SEC-05)** — No throttling on any endpoint
10. **Real-time notifications** — Polling only, no WebSocket/SSE
