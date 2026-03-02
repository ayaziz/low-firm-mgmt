# Phase 2 Risks & Architecture Decisions
## Law Office Management Application (LOMA)

**Version:** 1.0  
**Date:** 2026-02-25  
**Scope:** Risk register, mitigation strategies, and Architecture Decision Records (ADRs) for Phase 2

---

## Part A — Risk Register

### Risk Matrix Key

| Probability | Impact | Score |
|---|---|---|
| High (3) | High (3) | **9 — Critical** |
| High (3) | Medium (2) | **6 — High** |
| Medium (2) | High (3) | **6 — High** |
| Medium (2) | Medium (2) | **4 — Medium** |
| Low (1) | High (3) | **3 — Medium** |
| Low (1) | Medium (2) | **2 — Low** |
| Low (1) | Low (1) | **1 — Low** |

---

### R-01: OIDC Migration Disrupts Existing Users

| Attribute | Value |
|---|---|
| **Category** | Authentication |
| **Probability** | Medium (2) |
| **Impact** | High (3) |
| **Score** | **6 — High** |
| **Description** | Migrating from JWT dev-mode to OIDC/PKCE requires all users to re-authenticate via an external IdP. Misconfiguration or IdP downtime locks out users. |
| **Mitigation** | Dual-mode auth (`AUTH_MODE=dev|oidc`) throughout Phase 2. Per-tenant opt-in flag. JWT fallback always available. Automated smoke test validates both modes in CI. |
| **Owner** | Backend Lead |
| **Sprint** | S1–S7 |

### R-02: OCR Performance Degrades Under Load

| Attribute | Value |
|---|---|
| **Category** | Performance |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Score** | **4 — Medium** |
| **Description** | Tesseract.js is CPU-intensive. Bulk document uploads (e.g., case import) may queue hundreds of OCR jobs, causing backlog and slow search indexing. |
| **Mitigation** | BullMQ concurrency capped at 2 workers. Priority queue for single-file uploads over bulk. Dead-letter queue for failures. OCR status visible to users (Pending → Processing → Complete). Optional: offload to dedicated OCR container if P95 > 30s. |
| **Owner** | Backend Lead |
| **Sprint** | S5–S6 |

### R-03: Storage Provider Switch Causes Data Loss

| Attribute | Value |
|---|---|
| **Category** | Infrastructure |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | **3 — Medium** |
| **Description** | Migrating objects from MinIO to Azure Blob may fail silently (network, permission, encoding issues), leaving orphaned references in DB. |
| **Mitigation** | Checksum verification (SHA-256) on every migrated object. Dual-read period: new storage attempted first, fallback to MinIO. MinIO kept read-only until full verification. Migration script logs every object with pass/fail. |
| **Owner** | DevOps |
| **Sprint** | S6–S8 |

### R-04: Calendar Conflict Detection Performance

| Attribute | Value |
|---|---|
| **Category** | Performance |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Score** | **4 — Medium** |
| **Description** | Conflict detection on recurring events with many attendees may be slow if naively implemented (expanding all recurrence instances). |
| **Mitigation** | Limit conflict check window (±30 days from event). GiST index on `tstzrange(start_at, end_at)`. Pre-expand recurring events into instances only within query window. P95 target ≤ 200ms validated in Sprint 5 performance tests. |
| **Owner** | Backend Lead |
| **Sprint** | S3–S4 |

### R-05: Multi-Tenant Schema Migration Failures

| Attribute | Value |
|---|---|
| **Category** | Database |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | **3 — Medium** |
| **Description** | Migrations run per tenant schema. If one schema fails mid-batch while others succeed, tenants end up at different schema versions. |
| **Mitigation** | Each migration wrapped in a transaction. Schema version tracked in `_migrations` table per schema. Migration runner reports per-tenant status. Failed tenants retried independently. Pre-migration backup mandatory. |
| **Owner** | DBA / Backend Lead |
| **Sprint** | All |

### R-06: Scope Creep from Document Management v2

| Attribute | Value |
|---|---|
| **Category** | Project Management |
| **Probability** | High (3) |
| **Impact** | Medium (2) |
| **Score** | **6 — High** |
| **Description** | Doc Mgmt v2 has 12 features (F-DOC-01 to F-DOC-12). Stakeholders may push for additional features: version diffing, collaborative editing, workflow approvals on documents. |
| **Mitigation** | Strict scope freeze after Sprint 2 planning. Phase 3 backlog created for deferred doc features. Change requests require impact assessment (SP estimate + dependency check). Product owner sign-off for any scope additions. |
| **Owner** | Product Owner |
| **Sprint** | S4–S6 |

### R-07: Frontend Test Coverage Target Unrealistic

| Attribute | Value |
|---|---|
| **Category** | Quality |
| **Probability** | Medium (2) |
| **Impact** | Low (1) |
| **Score** | **2 — Low** |
| **Description** | Going from 0% to 60% frontend coverage in 8 sprints while delivering features is aggressive. |
| **Mitigation** | Focus tests on critical paths (calendar, folders, auth flows). Accept 40% as Sprint 6 checkpoint; 60% as Sprint 8 target. Pair testing with feature development (no separate "test sprint"). |
| **Owner** | Frontend Lead |
| **Sprint** | S3–S8 |

### R-08: WebSocket Scalability in Multi-Instance Deployment

| Attribute | Value |
|---|---|
| **Category** | Architecture |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Score** | **4 — Medium** |
| **Description** | Socket.IO sticky sessions or Redis adapter required for multi-pod deployment. Without it, users on different pods don't receive real-time events. |
| **Mitigation** | Socket.IO Redis adapter (`@socket.io/redis-adapter`) configured from Day 1. Load tests validate 100 concurrent WebSocket connections across 3 pods. Fallback: long-polling mode degrades gracefully. |
| **Owner** | Backend Lead |
| **Sprint** | S6–S7 |

### R-09: Arabic Full-Text Search Quality

| Attribute | Value |
|---|---|
| **Category** | Functionality |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Score** | **4 — Medium** |
| **Description** | PostgreSQL's built-in Arabic text search configuration may produce poor results for legal terminology. Tesseract.js Arabic OCR accuracy varies by font/scan quality. |
| **Mitigation** | Custom Arabic text search dictionary with legal terms. OCR confidence score stored; documents below threshold flagged for manual review. Test with 20+ real Arabic legal documents during Sprint 5. |
| **Owner** | Backend Lead |
| **Sprint** | S5–S6 |

### R-10: Team Velocity Overestimate

| Attribute | Value |
|---|---|
| **Category** | Project Management |
| **Probability** | Medium (2) |
| **Impact** | High (3) |
| **Score** | **6 — High** |
| **Description** | 446 SP across 8 sprints (~56 SP/sprint) assumes consistent velocity. Learning curves (OIDC, Tesseract, FullCalendar) may slow early sprints. |
| **Mitigation** | Sprint 1-2 buffer of 15%. Velocity re-baselined after Sprint 2. If behind, Calendar UX polish (E4 stretch tasks) deferred. Risks & Dependencies review at each sprint retrospective. |
| **Owner** | Scrum Master |
| **Sprint** | S1–S2 |

---

### Risk Summary Dashboard

| Score | Risks | IDs |
|---|---|---|
| **6 (High)** | 3 | R-01, R-06, R-10 |
| **4 (Medium)** | 4 | R-02, R-04, R-08, R-09 |
| **3 (Medium)** | 2 | R-03, R-05 |
| **2 (Low)** | 1 | R-07 |

---

## Part B — Architecture Decision Records (ADRs)

### ADR-01: Tesseract.js over Azure AI Document Intelligence for OCR

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-02-25 |
| **Context** | Phase 2 requires OCR for scanned legal documents (Arabic + English). Options: (A) Tesseract.js — open source, runs locally; (B) Azure AI Document Intelligence — cloud SaaS, higher accuracy. |
| **Decision** | Use **Tesseract.js v5** as the primary OCR engine. |
| **Rationale** | (1) No cloud dependency — works offline and in air-gapped deployments. (2) No per-page cost — critical for high-volume scanning. (3) Acceptable accuracy for typed Arabic/English with `ara+eng` langpack. (4) BullMQ offloading prevents main thread blocking. (5) Azure AI can be added as a premium provider later (StorageProvider pattern reusable). |
| **Consequences** | Lower accuracy on handwritten documents. Manual review queue needed for low-confidence results. OCR worker needs dedicated CPU allocation in production. |
| **Alternatives Rejected** | Azure AI Document Intelligence — cost per page, cloud dependency, latency. Google Cloud Vision — same cloud concerns. |

### ADR-02: FullCalendar React over Custom Calendar Component

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-02-25 |
| **Context** | Phase 2 requires a full-featured calendar UI with day/week/month views, drag-and-drop, recurring events, and RTL support. Options: (A) FullCalendar React — mature library; (B) Custom-built calendar; (C) React Big Calendar. |
| **Decision** | Use **FullCalendar React** (premium license for team scheduling features). |
| **Rationale** | (1) Native drag-and-drop, resize, event overlap handling. (2) Built-in RTL support via `direction: 'rtl'`. (3) `rrule` plugin for recurring event rendering. (4) Proven at scale in legal/enterprise apps. (5) Custom builds would take 3-4 sprints of calendar UI alone. |
| **Consequences** | Premium license cost (~$599/year for team features). Bundle size increase (~150KB gzipped). Locked into FullCalendar's event model — adapter layer needed for our CalendarEvent entity. |
| **Alternatives Rejected** | React Big Calendar — lacks drag-resize and RTL quality. Custom build — prohibitive timeline. |

### ADR-03: Handlebars over Mustache for Document Templates

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-02-25 |
| **Context** | Document templates need variable substitution, conditionals (e.g., show clause if `hasGuarantor`), and loops (e.g., list of parties). Options: (A) Handlebars; (B) Mustache; (C) EJS; (D) Liquid. |
| **Decision** | Use **Handlebars** for server-side document template rendering. |
| **Rationale** | (1) Superset of Mustache — backward compatible. (2) `#if`, `#each`, `#unless` helpers cover all legal document patterns. (3) Custom helpers for date formatting, currency, Arabic numeral conversion. (4) Sandboxed execution — no arbitrary code injection. (5) Template syntax readable by non-developers (legal admins). |
| **Consequences** | Template authors must understand Handlebars syntax (minor training). Complex templates may need custom helpers (maintained by dev team). |
| **Alternatives Rejected** | Mustache — too limited (no conditionals). EJS — allows arbitrary JS execution (security risk). Liquid — Ruby-centric ecosystem, less npm support. |

### ADR-04: Socket.IO over Native WebSocket for Real-Time

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-02-25 |
| **Context** | Phase 2 adds real-time notifications (task assignment, hearing reminders, approval requests). Options: (A) Socket.IO; (B) Native WebSocket; (C) Server-Sent Events (SSE). |
| **Decision** | Use **Socket.IO** with Redis adapter for real-time communication. |
| **Rationale** | (1) Automatic reconnection with exponential backoff. (2) Room-based broadcasting (per-tenant, per-case, per-user). (3) Redis adapter for multi-pod horizontal scaling. (4) Falls back to long-polling if WebSocket blocked by proxy. (5) NestJS has first-class `@WebSocketGateway` decorators for Socket.IO. |
| **Consequences** | Larger client bundle than native WS (~40KB). Socket.IO protocol overhead vs raw WS. Redis adapter adds infrastructure dependency (already using Redis for BullMQ). |
| **Alternatives Rejected** | Native WebSocket — no auto-reconnect, no rooms, no fallback. SSE — unidirectional (server→client only), no client→server channel. |

### ADR-05: Schema-Per-Tenant over Row-Level Security for Multi-Tenancy

| Field | Value |
|---|---|
| **Status** | Reaffirmed (Phase 1 decision, reviewed for Phase 2) |
| **Date** | 2026-02-25 |
| **Context** | Phase 1 chose schema-per-tenant. Phase 2 adds 8+ new tables per tenant. Review whether to continue or switch to RLS. |
| **Decision** | **Continue schema-per-tenant** for Phase 2. |
| **Rationale** | (1) Proven isolation — no risk of cross-tenant data leaks. (2) Per-tenant backup/restore trivial. (3) Migration tooling already handles per-schema execution. (4) 8 new tables per tenant is manageable at current scale (~50 tenants). (5) RLS migration would be a Phase 2-sized project on its own. |
| **Consequences** | Connection pool management complexity grows with tenant count. Migration execution time scales linearly with tenants. Future Phase 3 should evaluate RLS if tenant count exceeds 200. |

### ADR-06: `rrule` npm Package for Recurrence Rules

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-02-25 |
| **Context** | Calendar recurring events need a standard recurrence rule engine. Options: (A) `rrule` npm; (B) Custom parser; (C) Store pre-expanded instances. |
| **Decision** | Use **`rrule`** npm package conforming to RFC 5545 (iCalendar). |
| **Rationale** | (1) RFC-standard — interoperable with Google Calendar, Outlook. (2) Supports FREQ, INTERVAL, BYDAY, BYMONTH, COUNT, UNTIL. (3) Efficient instance generation within date windows. (4) FullCalendar's `rrule` plugin consumes same format. (5) Rules stored as text — no schema changes for new recurrence patterns. |
| **Consequences** | Complex recurrence UIs (e.g., "every 2nd Tuesday") need custom form builder. Backend must validate rule strings before storage. Instance expansion bounded to ±365 days for performance. |
| **Alternatives Rejected** | Custom parser — error-prone, non-standard. Pre-expanded — storage explosion for unbounded recurrences. |

### ADR-07: BullMQ over Agenda/node-cron for Job Scheduling

| Field | Value |
|---|---|
| **Status** | Reaffirmed (Phase 1 decision, extended for Phase 2) |
| **Date** | 2026-02-25 |
| **Context** | Phase 2 adds reminder scheduling, OCR processing, notification dispatch. Evaluate whether BullMQ remains suitable. |
| **Decision** | **Continue with BullMQ** for all background job processing. |
| **Rationale** | (1) Already in stack — no new dependency. (2) Supports delayed jobs (reminders), repeatable jobs (daily digest), priority queues (OCR vs scan). (3) Redis-backed — survives pod restarts. (4) Dead-letter queues for failed jobs. (5) Bull Board UI for monitoring. |
| **Consequences** | Redis memory usage grows with job volume. Need monitoring for queue depth. Separate worker processes recommended for OCR to avoid blocking other queues. |

---

## Part C — Decision Log (Quick Reference)

| ID | Decision | Sprint | Status |
|---|---|---|---|
| ADR-01 | Tesseract.js for OCR | S4 | Accepted |
| ADR-02 | FullCalendar React for calendar UI | S3 | Accepted |
| ADR-03 | Handlebars for document templates | S4 | Accepted |
| ADR-04 | Socket.IO for real-time | S6 | Accepted |
| ADR-05 | Schema-per-tenant (reaffirmed) | S1 | Reaffirmed |
| ADR-06 | rrule npm for recurrence | S3 | Accepted |
| ADR-07 | BullMQ for job scheduling (reaffirmed) | S1 | Reaffirmed |
