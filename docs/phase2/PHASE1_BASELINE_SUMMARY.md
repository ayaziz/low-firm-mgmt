# Phase 1 Baseline Summary
## Law Office Management Application (LOMA)

**Date:** 2026-02-25  
**Purpose:** Single-source audit of Phase 1 MVP state — capabilities, resolved gaps, remaining weaknesses, and doc-level contradictions.

---

## 1. Current Capabilities (Phase 1 MVP Delivered)

### 1.1 Customer Module
| Capability | Status | Notes |
|---|---|---|
| Individual + Organization types | ✅ Delivered | Identity uniqueness enforced per tenant |
| Addresses (multi, primary flag) | ✅ Delivered | Billing/Office/Home/Other |
| Contacts per customer | ✅ Delivered | Contact roles configurable |
| Party model (opposing/external) | ✅ Delivered | Shared schema with customer identity |
| Party relationships (configurable types) | ✅ Delivered | |
| Compliance checklist (template + tracking) | ✅ Delivered | Toggle endpoint added |
| Required doc prompting | ✅ Delivered | Soft block only |
| Financial summary (derived) | ✅ Delivered | Outstanding, paid, overdue, last payment |
| Customer communications | ✅ Delivered | Gap #11 resolved — customer-level CRUD |
| Customer detail tabs (7) | ✅ Delivered | Gap #15 — Overview, Contacts, Addresses, Documents, Compliance, Financial, Audit |

### 1.2 Case Module
| Capability | Status | Notes |
|---|---|---|
| Case types (configurable) | ✅ Delivered | Create/edit/disable |
| System ref (CASE-YYYY-SEQ) | ✅ Delivered | Auto-generated |
| States + transitions | ✅ Delivered | Intake→Open→Active→Pending→Closed→Archived; OnHold flag; Reopen |
| Multi-party (customers + opposing) | ✅ Delivered | |
| Participants (configurable roles) | ✅ Delivered | visibilityScope: LegalOnly/FinanceAllowed |
| Sessions (CRUD + reschedule) | ✅ Delivered | History + reason |
| Tasks (assign, remind, notify) | ✅ Delivered | Gap #10 — notification on assign |
| Notes (append-only) | ✅ Delivered | |
| Filings (configurable types) | ✅ Delivered | Statuses: Draft/Filed/Accepted/Rejected/Withdrawn |
| Communications (case-level) | ✅ Delivered | Configurable types |
| Case detail tabs (10) | ✅ Delivered | Gap #15 — added Participants, Documents, Financial Summary, Audit |
| Courts entity | ✅ Delivered | Gap #14 — Admin CRUD, dedicated `courts` table |

### 1.3 Document Module
| Capability | Status | Notes |
|---|---|---|
| Storage provider abstraction | ✅ Delivered | S3-compatible (MinIO) |
| Pre-signed upload URLs | ✅ Delivered | TTL 15min default |
| Malware scan gate | ✅ Delivered | Pending/Passed/Failed; BullMQ worker |
| Immutable versions | ✅ Delivered | No rollback |
| Check-out/in (4h lock expiry) | ✅ Delivered | Admin break lock with step-up |
| Confidentiality levels | ✅ Delivered | Normal/Confidential/HC |
| HC step-up + ACL enforcement | ✅ Delivered | Gap #2 resolved |
| Internal time-bound sharing | ✅ Delivered | Gap #4 — expiry on ACL |
| Content-type + extension validation | ✅ Delivered | Gap #3 — MIME + extension whitelist |
| Retention policies (seeded, view-only) | ✅ Delivered | Gap #6 — Admin CRUD |
| Legal hold (case + document level) | ✅ Delivered | Gap #5 — case-level hold added |
| Soft delete/restore | ✅ Delivered | Hold blocks purge |
| HC search filtering | ✅ Delivered | Gap #12 — step-up parameter |

### 1.4 Accounting Module
| Capability | Status | Notes |
|---|---|---|
| Invoices (line items, tax%, discount%) | ✅ Delivered | Gap #8 — discount% added |
| Invoice numbering (INV-YYYY-SEQ) | ✅ Delivered | |
| Lawyer draft (tenant setting) | ✅ Delivered | Gap #7 — conditional on `lawyerCanDraft` |
| Finalize/void (Accountant/TenantAdmin) | ✅ Delivered | |
| Payments (single-invoice, partial, no overpay) | ✅ Delivered | Idempotent |
| Expenses (multi-step approval) | ✅ Delivered | Gap #9 — role-based workflow |
| Wages (record + CSV export) | ✅ Delivered | |
| Reports (operational + financial CSV) | ✅ Delivered | |

### 1.5 Auth & Security
| Capability | Status | Notes |
|---|---|---|
| JWT auth (dev login) | ✅ Delivered | OIDC deferred |
| RBAC (@Roles guard) | ✅ Delivered | Lawyer/Accountant/TenantAdmin/SystemAdmin |
| ABAC (Tenant boundary) | ✅ Delivered | TenantGuard, schema-per-tenant |
| Step-up re-auth | ✅ Delivered | StepUpGuard for HC docs, lock break, legal hold |
| Rate limiting (3-tier) | ✅ Delivered | Gap #1 — @nestjs/throttler |
| Idle session timeout (15min) | ✅ Delivered | Gap #13 — React IdleTimeout component |
| Audit logging (append-only) | ✅ Delivered | Comprehensive event catalog |

### 1.6 Observability
| Capability | Status | Notes |
|---|---|---|
| Structured JSON logging (Winston) | ✅ Delivered | SRE mission |
| Correlation IDs (X-Correlation-ID) | ✅ Delivered | CorrelationMiddleware + LoggingInterceptor |
| Loki + Promtail log aggregation | ✅ Delivered | 7-day retention, TSDB store |
| Grafana dashboards | ✅ Delivered | Pre-configured Loki datasource |
| Frontend error reporting | ✅ Delivered | POST /api/v1/telemetry/ui-error |

### 1.7 Infrastructure
| Item | Details |
|---|---|
| Backend | NestJS modular monolith |
| Frontend | Next.js SPA, MUI, TypeScript |
| Database | PostgreSQL 16, schema-per-tenant |
| Storage | MinIO (S3-compatible) |
| Queue | Redis + BullMQ |
| Scanner | Stub AV scanner |
| Proxy | Nginx (port 80) |
| Docker services | 11 total |
| i18n | EN + AR (RTL) |

---

## 2. Resolved Gaps (Phase 1 Gap Closure)

All 15 gaps identified in GAPS.md were resolved in Sessions 11–12:

| # | Gap ID | Description | Resolution |
|---|---|---|---|
| 1 | NFR-SEC-05 | No rate limiting | 3-tier @nestjs/throttler |
| 2 | FR-DOC-09 | HC step-up not enforced | getById() step-up + ACL check |
| 3 | FR-DOC-04 | No upload validation | MIME + extension whitelist |
| 4 | FR-DOC-10 | No share expiry | expires_at in document_acl |
| 5 | FR-DOC-12 | No case-level legal hold | setCaseLegalHold/removeCaseLegalHold |
| 6 | FR-DOC-11 | No retention policies API | Admin CRUD endpoints |
| 7 | FR-ACC-04 | Lawyer draft not conditional | lawyerCanDraft tenant check |
| 8 | FR-ACC-02 | No discount% | discount_percent column + calculation |
| 9 | FR-ACC-11 | Single-step approval only | Multi-step role-based workflow |
| 10 | Notifications | No task/session notifications | NotificationService injection |
| 11 | FR-CASE-16 | No customer communications | Customer comms CRUD |
| 12 | FR-SEARCH-03 | HC docs in search results | hasStepUp filter parameter |
| 13 | FR-SESSION-01 | No idle timeout | React IdleTimeout component |
| 14 | FR-CASE-11 | Courts not separate entity | Admin courts CRUD + table |
| 15 | Frontend tabs | Missing detail tabs | Customer 7 tabs, Case 10 tabs |

---

## 3. Remaining Weaknesses & Phase 2 Drivers

### 3.1 Weak Data Model
| Issue | Impact | Phase 2 Action |
|---|---|---|
| Courts entity is minimal (name, city, jurisdiction, address, phone) | Cannot model judges, departments, circuits | Extend to Court → Judge → Department hierarchy |
| No Judge entity | Hearing/session cannot reference presiding judge | New Judge entity linked to Court |
| No Hearing entity (sessions used informally) | Session model conflates calendar events with court hearings | Separate Hearing from generic CalendarEvent |
| Case type templates limited | No session/participant templates wired in code | Implement template instantiation on case create |
| Party relationship model is flat | Cannot express complex multi-level relationships | Consider hierarchical party roles |
| No case membership enforcement on read (ABAC) | FR-AUTHZ-02 partially implemented | Enforce case membership on GET endpoints |
| visibilityScope on memberships not enforced | Schema has field but no code enforcement | Wire visibilityScope into authorization |

### 3.2 No Calendar Module
| Issue | Impact | Phase 2 Action |
|---|---|---|
| Sessions are CRUD only — no calendar view | Users cannot visualize scheduling | Calendar module with day/week/month views |
| No availability checking | Double-booking possible | Conflict detection |
| No external calendar sync | Manual entry only | iCal/Google Calendar integration |
| Task deadlines not on calendar | Deadlines invisible in time view | Unified calendar events |
| No reminders infrastructure | Fixed intervals, no cron scheduler | Scheduled reminder jobs |

### 3.3 Missing Core Entities
| Entity | Current State | Phase 2 Need |
|---|---|---|
| Judge | Not modeled | First-class entity with Court relationship |
| Hearing | Conflated with Session | Separate entity: date, court, judge, case, outcome |
| Folder/Library | Flat document list | Hierarchical folders with inherited permissions |
| Document Template | Not modeled | Reusable document templates (contracts, petitions) |
| Time Entry | Not modeled | Billable hours tracking for invoicing |
| Contact (global) | Per-customer only | Global contact directory with customer links |

### 3.4 Poor UI / Missing Screens
| Area | Gap | Phase 2 Action |
|---|---|---|
| Calendar view | No visual calendar | Full calendar module |
| Case timeline view | Listed in IA but no implementation | Interactive timeline component |
| Document upload modal | No docType/tags in UI | Rich upload dialog with metadata |
| Expense approval queue | No dedicated view | Approval queue with workflow state |
| Customer/case inline filters | Basic search only | Advanced faceted filtering |
| Document access history | Audit-limited | Full access log tab |
| Dashboard widgets | Minimal | KPI cards, charts, activity feeds |

### 3.5 Inadequate Document Management
| Issue | Impact | Phase 2 Action |
|---|---|---|
| Flat document list (no folders) | No organizational hierarchy | SharePoint-like folder/library model |
| No bulk operations | Single file upload only | Multi-file upload, bulk move/tag |
| No full-text search | Metadata search only | OCR + full-text indexing |
| No document templates | Cannot generate from templates | Template engine (contracts, letters) |
| Storage path is flat in implementation | Spec says hierarchical, code uses flat keys | Implement proper hierarchical storage paths |
| No Azure Blob provider | S3-compatible only | Azure Blob + storage provider selection |
| Scan is stub only | No real malware scanning | Integrate ClamAV or cloud scanning |

---

## 4. Doc-Level Contradictions & Outdated Parts

| Document | Issue | Location | Correction Needed |
|---|---|---|---|
| PRD.md §4.1.3 | Lists Azure Blob as MVP but not implemented | "Storage provider abstraction: Azure Blob Storage" | Clarify: MVP delivered S3/MinIO only; Azure Blob is Phase 2 |
| SRS.md §2.9 FR-STO-01 | "SHALL provide Azure Blob and S3 implementations" | FR-STO-01 | Mark S3 as delivered, Azure Blob as Phase 2 |
| SRS.md §2.9 FR-STO-02 | "Shared vs dedicated configurable" | FR-STO-02 | Not implemented — Phase 2 |
| SRS.md §2.9 FR-STO-03 | "Secret manager references" | FR-STO-03 | Not implemented — uses env vars |
| TDD.md §5 | Storage provider shows Azure Blob interface | IStorageProvider | Only S3 implementation exists |
| BRD.md §3.1.3 | "Hierarchical storage path (mandatory)" | Per-doc path spec | Flat paths in code; Phase 2 fix |
| FSD.md §3.1 | Implies folder hierarchy for documents | Storage path format | Flat in implementation |
| PRD.md §4.1.2 | "Case type templates: required docs, tasks, sessions, participants" | Templates section | Templates defined but not instantiated on case create |
| SRS.md §2.2 FR-AUTHN-01 | "OIDC Authorization Code + PKCE" | FR-AUTHN-01 | Dev login only in MVP; OIDC deferred |
| Wireframes_IA.md §2.5 | Lists "My Calendar view" | Calendar section | Calendar view not implemented |
| SECURITY_MAPPING.md | No entries for Court, Calendar, Folder entities | Entire doc | Needs expansion for Phase 2 entities |
| GAPS.md | Some gaps marked ❌ are now resolved | Multiple sections | GAPS_RESOLUTION.md provides the delta |
| README_OPERATIONS.md | Lists 11 Docker services | Services table | Accurate as of SRE mission completion |

---

## 5. Test Coverage Baseline

| Category | Suites | Tests | Status |
|---|---|---|---|
| Backend unit tests | 9 | 92 | ✅ All passing |
| Backend e2e tests | 4 | 62 | ✅ All passing |
| Frontend tests | 0 | 0 | ⚠️ No frontend tests |

### Unit Test Coverage Areas
- Document service (20): upload validation, HC access, shares, legal hold, checkout
- Case service (11): state transitions, archive enforcement
- Accounting service (8): payments, overpayment, partial
- Search service (16): Arabic normalization, HC filtering
- Admin service (5): retention policies, courts CRUD
- Customer service (4): communications
- Guards (19): RBAC (8), tenant boundary (5), step-up (6)

### Key Testing Gaps for Phase 2
- No frontend component tests
- No integration tests for full workflows
- No performance/load tests
- No accessibility tests
- E2E limited to 4 suites — needs expansion for new modules

---

## 6. Codebase Statistics

| Metric | Value |
|---|---|
| Total files | ~102 |
| Total lines of code | ~10,620 |
| Backend services | 12 files (2,249 lines) |
| Backend controllers | 8 files (680 lines) |
| Docker services | 11 |
| Frontend pages | 14 |
| API routes | 50+ |
| i18n languages | 2 (EN + AR) |

---

## 7. Items Explicitly Deferred from Phase 1

These items were explicitly listed in PRD §4.2 and BRD §3.2 as out-of-scope:

| Deferral | Target Phase |
|---|---|
| Integrations (email, calendar, messaging) | Phase 2 |
| OCR / full-text search | Phase 2 |
| External sharing | Phase 2 |
| Configurable numbering schemes | Phase 2 |
| Editable notes | Phase 2 |
| Retention editing + advanced lifecycle | Phase 2+ |
| Multi-region replication | Phase 2+ |
| Dedicated DB per tenant (Enterprise) | Later |
| Data migration/import tooling | Wave 3/4 |
| Custom fields | Phase 2+ |
| SLA management | Excluded |
