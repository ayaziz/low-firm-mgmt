# Phase 2 Vision & Success Metrics
## Law Office Management Application (LOMA)

**Date:** 2026-02-25  
**Baseline:** PHASE1_BASELINE_SUMMARY.md  
**Scope:** Phase 2 objectives, success criteria, and measurable KPIs

---

## 1. Phase 2 Vision Statement

Phase 2 transforms LOMA from an MVP record-keeping tool into a **professional-grade law office platform** by:

1. **Strengthening the data model** — promoting Court, Judge, Hearing, and Folder to first-class entities with proper relationships, RBAC, and audit trails.
2. **Delivering a Calendar module** — unified scheduling for hearings, sessions, tasks, and deadlines with day/week/month views, conflict detection, and reminder infrastructure.
3. **Upgrading Document Management to v2** — hierarchical folder/library model with inherited permissions, multi-file upload, OCR/full-text search, document templates, and Azure Blob provider.
4. **Enterprise UI overhaul** — interactive timelines, advanced filtering, dashboard KPI widgets, accessibility improvements, and mobile-responsive views.
5. **Closing architectural gaps** — OIDC/PKCE authentication, case membership enforcement on read, visibilityScope wiring, real-time notifications (WebSocket/SSE), and production-grade scanning.

---

## 2. Phase 2 Drivers (Traceability)

| # | Driver | Source | Phase 1 Gap |
|---|---|---|---|
| D1 | Weak data model | GAPS.md §Courts, §Case Type Templates | Minimal Court entity; no Judge; templates not instantiated |
| D2 | No calendar module | PRD §4.2 (deferred); Wireframes §2.5 (listed but unbuilt) | Sessions are CRUD-only; no visual calendar; no conflict detection |
| D3 | Missing core entities | GAPS.md §Case, §Document; PHASE1_BASELINE_SUMMARY §3.3 | No Judge, Hearing, Folder, Template, Time Entry |
| D4 | Poor UI / missing screens | GAPS.md §Frontend; Wireframes §2.5 | No calendar view, no case timeline, basic filters, minimal dashboards |
| D5 | Inadequate doc management | GAPS.md §Document, §Storage; PRD §4.2 (OCR, external sharing deferred) | Flat doc list, no folders, no bulk ops, no full-text search, stub scanner |

---

## 3. Success Criteria & KPIs

### 3.1 Functional KPIs

| KPI | Target | Measurement | Baseline (Phase 1) |
|---|---|---|---|
| Calendar adoption | ≥ 90% of sessions/hearings created via calendar | Count sessions with calendar event / total sessions | 0% (no calendar) |
| Document hierarchy utilization | ≥ 80% of documents organized in folders | Docs with folderId / total docs | 0% (flat list) |
| Search effectiveness | Full-text search covers ≥ 95% of uploaded PDFs | OCR-indexed docs / total PDF docs | 0% (metadata only) |
| Case membership enforcement | 100% of case-scoped GET endpoints enforce membership | Security audit pass rate | Partial (write-only) |
| Template instantiation | ≥ 70% of new cases use case type templates | Cases with template-generated tasks / total new cases | 0% (templates defined not instantiated) |
| Hearing tracking accuracy | 100% of court hearings linked to Judge + Court | Hearings with judge_id / total hearings | 0% (no Hearing entity) |

### 3.2 Non-Functional KPIs

| KPI | Target | Measurement | Baseline (Phase 1) |
|---|---|---|---|
| Authentication security | OIDC/PKCE for all users | Auth flow type in production | Dev JWT login only |
| API P95 latency | ≤ 500ms for read, ≤ 1s for write | Grafana API metrics | Unmeasured |
| Full-text search P95 | ≤ 800ms | Search query latency histogram | N/A |
| Calendar event conflict detection latency | ≤ 200ms | Overlap query timing | N/A |
| Document upload throughput | ≥ 50 concurrent uploads | Load test results | Untested |
| Real-time notification delivery | ≤ 2s from event to UI | WebSocket message timing | Polling only |
| Frontend test coverage | ≥ 60% component coverage | Jest/Vitest coverage report | 0% |
| WCAG 2.1 AA compliance | 100% of new screens | Accessibility audit | Untested |

### 3.3 Business KPIs

| KPI | Target | Measurement | Baseline (Phase 1) |
|---|---|---|---|
| Time to locate document | Reduce by ≥ 60% vs flat list | User testing task completion time | Manual browsing |
| Scheduling conflicts prevented | ≥ 95% of double-bookings caught pre-save | Conflicts detected / conflicts attempted | 0% (no detection) |
| Invoice generation from time entries | ≥ 50% of invoices auto-populated | Invoices with time entry line items / total invoices | 0% (manual line items) |
| Missed hearing rate | Reduce by ≥ 80% | Missed hearings with reminders enabled / total | Untracked |
| Document compliance rate | 100% of required docs tracked in folders | Required docs present / required docs expected | Partial (checklist) |

---

## 4. Phase 2 Scope Boundaries

### 4.1 In-Scope
- Calendar module (day/week/month/agenda views, conflict detection, reminders)
- Court → Judge → Department hierarchy
- Hearing entity (separate from Session)
- Hierarchical document management (Folder/Library, inherited permissions)
- Multi-file upload + drag-and-drop
- OCR/full-text search integration
- Document templates (generation from templates)
- Azure Blob storage provider
- Time Entry tracking (billable hours)
- OIDC/PKCE authentication
- Case membership enforcement on all reads
- visibilityScope enforcement
- Real-time notifications (WebSocket/SSE)
- Production malware scanner (ClamAV)
- Editable notes (append-only lifted)
- Configurable numbering schemes
- External document sharing (time-bound links)
- Enterprise UI (timelines, dashboards, advanced filters, responsive)
- Frontend test coverage

### 4.2 Out-of-Scope (Phase 3+)
- Email ingestion / inbox integration
- SMS/WhatsApp messaging integration
- Multi-region replication
- Dedicated DB per tenant (Enterprise tier)
- Data migration/import tooling
- Custom fields engine
- SLA management
- Billing automation (recurring invoices)
- Client portal (external user access)
- Mobile native apps

---

## 5. Phase 2 Personas Impact

| Persona | Phase 2 Gains |
|---|---|
| **Lawyer** | Calendar with hearing schedule, judge information, document folders, time entry logging, full-text doc search, case timeline view, real-time task notifications |
| **Accountant** | Time entry → invoice integration, expense approval queue view, financial dashboard widgets, CSV/PDF export improvements |
| **Tenant Admin** | Court/Judge management, folder structure templates, document template management, numbering scheme config, OIDC tenant setup, enhanced governance dashboard |
| **System Admin** | ClamAV integration, Azure Blob provider config, WebSocket infrastructure, per-tenant storage mode selection |

---

## 6. Dependencies & Prerequisites

| Dependency | Owner | Required By |
|---|---|---|
| OIDC Identity Provider (tenant) | Tenant / Ops | Sprint 1 — Auth upgrade |
| ClamAV or cloud scanner endpoint | Ops / Infra | Sprint 2 — Scanner upgrade |
| Azure Blob Storage account (dev/test) | Ops / Infra | Sprint 3 — Storage provider |
| OCR engine (Tesseract/Azure AI) | Infra | Sprint 4 — Full-text search |
| WebSocket infrastructure (Redis adapter) | Backend | Sprint 2 — Real-time notifications |
| Frontend testing framework setup (Vitest + RTL) | Frontend | Sprint 1 — Test infrastructure |
