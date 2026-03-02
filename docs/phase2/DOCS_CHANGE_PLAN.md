# Baseline Documentation Change Plan
## Law Office Management Application (LOMA) — Phase 2

**Date:** 2026-02-25  
**Purpose:** Enumerate every section-level change needed across the 8 existing baseline docs to incorporate Phase 2 scope.

---

## 1. Change Summary

| Document | File | Changes |
|---|---|---|
| PRD | `docs/PRD.md` | Add §4.3 Phase 2 Features, update §4.2 Deferrals, update §6 NFRs |
| BRD | `docs/BRD.md` | Add §6 Phase 2 Business Goals, update §3 Scope, update §4 Business Rules |
| FSD | `docs/FSD.md` | Add §6 Calendar, §7 Court/Judge, §8 Time Tracking; update §3 Document, §4 Accounting |
| SRS | `docs/SRS.md` | Add FR-CAL, FR-HEAR, FR-TIME, FR-FOLD, FR-TMPL; update FR-DOC, FR-ACC, FR-SEARCH; add NFRs |
| TDD | `docs/TDD_System_Architecture.md` | Extend ERD, add modules, add API endpoints, update deployment |
| Wireframes & IA | `docs/Wireframes_IA.md` | Add calendar screens, doc library, hearing, time tracking; update nav |
| Style Guide | `docs/Style_Guide.md` | Add calendar patterns, folder tree, dashboard widgets, notification |
| Security Mapping | `docs/SECURITY_MAPPING.md` | Add routes for all new entities; update RBAC matrix |

---

## 2. Detailed Change Instructions

### 2.1 PRD.md

| Section | Action | Detail |
|---|---|---|
| §4.2 Explicit Deferrals | **Update** | Move items now in Phase 2 scope out of deferrals: Calendar, OCR, External Sharing, Configurable Numbering, Editable Notes |
| §4.3 Phase 2 Features | **Add** | New section listing all Phase 2 feature groups: Calendar (F-CAL), Court/Judge/Hearing, Document v2 (folders, templates, OCR, sharing), Time Tracking, Dashboard v2, OIDC |
| §4.4 Phase 2 Deferrals | **Add** | Items explicitly deferred beyond Phase 2: mobile native app, advanced analytics, client portal, third-party integrations |
| §6 NFRs | **Update** | Add responsiveness (mobile/tablet), notification delivery SLA, calendar performance targets |

### 2.2 BRD.md

| Section | Action | Detail |
|---|---|---|
| §2 Business Goals | **Update** | Add Phase 2 KPIs: time-to-billing cycle, document retrieval time, calendar adoption rate |
| §3.1 In-Scope | **Update** | Add Phase 2 in-scope items: Calendar, Court hierarchy, Time tracking, Doc v2, Dashboard v2 |
| §3.2 Out-of-Scope | **Update** | Refresh deferred items (remove newly in-scope, add Phase 2 deferrals) |
| §4 Business Rules | **Update** | Add rules: time entry approval chain, external sharing constraints, court hierarchy integrity |
| §6 Phase 2 Addendum | **Add** | New section referencing Phase 2 vision, drivers, and success criteria |

### 2.3 FSD.md

| Section | Action | Detail |
|---|---|---|
| §3 Document Module | **Update** | Add folder hierarchy, template generation, OCR pipeline, external sharing, multi-upload |
| §3.7 Retention | **Update** | Add folder-level archive rules |
| §4 Accounting | **Update** | Add time entry fields/rules, invoice auto-population from time entries |
| §6 Calendar Module | **Add** | Event types, views, recurrence, reminders, conflict detection |
| §7 Court & Judge | **Add** | Court hierarchy, judge management, hearing lifecycle |
| §8 Time Tracking | **Add** | Time entry fields, approval workflow, billing integration |

### 2.4 SRS.md

| Section | Action | Detail |
|---|---|---|
| §2 Functional Reqs | **Update FR-DOC** | Add: FR-DOC-14 through FR-DOC-22 (folders, templates, OCR, sharing, numbering) |
| §2 Functional Reqs | **Update FR-ACC** | Add: FR-ACC-15 through FR-ACC-20 (time entries, auto-invoice) |
| §2 Functional Reqs | **Update FR-SEARCH** | Add: FR-SEARCH-05 (full-text doc search), FR-SEARCH-06 (global unified search) |
| §2 Functional Reqs | **Add FR-CAL** | FR-CAL-01 through FR-CAL-10 (events, views, recurrence, reminders, conflict) |
| §2 Functional Reqs | **Add FR-HEAR** | FR-HEAR-01 through FR-HEAR-06 (hearing CRUD, state transitions, calendar link) |
| §2 Functional Reqs | **Add FR-FOLD** | FR-FOLD-01 through FR-FOLD-06 (folder CRUD, permission inheritance, archive) |
| §2 Functional Reqs | **Add FR-TMPL** | FR-TMPL-01 through FR-TMPL-05 (template CRUD, preview, generate) |
| §2 Functional Reqs | **Add FR-TIME** | FR-TIME-01 through FR-TIME-08 (time entry lifecycle, approval, billing) |
| §2 Functional Reqs | **Add FR-COURT** | FR-COURT-01 through FR-COURT-04 (court/judge CRUD) |
| §3 NFRs | **Update** | Add: responsiveness (3 breakpoints), notification SLA, calendar perf, storage quota |

### 2.5 TDD_System_Architecture.md

| Section | Action | Detail |
|---|---|---|
| §1 Decisions | **Update** | Add decision: Calendar library choice, OCR engine, OIDC provider |
| §2 Logical Architecture | **Update** | Add CalendarModule, HearingModule, TimeEntryModule, FolderModule to Mermaid diagram |
| §4 Data Architecture | **Update** | Extend ERD with Phase 2 entities (reference PHASE2_DOMAIN_MODEL_AND_WORKFLOWS.md) |
| §5 Storage Abstraction | **Update** | Add hierarchical path strategy, Azure Blob provider |
| §6 Scanning Pipeline | **Update** | Add OCR worker to pipeline diagram |
| §7 Security | **Update** | Add OIDC AuthN flow, new RBAC permissions, folder permission inheritance |
| §8 API Specification | **Update** | Add Calendar, Hearing, Folder, Template, TimeEntry, Court/Judge endpoints |
| §9 Operations | **Update** | Add OCR worker, reminder scheduler, notification service |

### 2.6 Wireframes_IA.md

| Section | Action | Detail |
|---|---|---|
| §1 Global Navigation | **Update** | Replace nav structure with Phase 2 grouped sidebar |
| §2 Lawyer IA | **Update** | Add calendar page, hearing management, time tracking, folder browser |
| §2.1 Dashboard | **Replace** | New role-specific dashboard layout (see UIUX_PHASE2_PROPOSAL §3.1) |
| §2.5 Calendar | **Replace** | Full calendar views (was placeholder) |
| §3 Accountant IA | **Update** | Add time entry approval, accountant dashboard |
| §4 Admin IA | **Update** | Add court/judge management, settings page, template management |

### 2.7 Style_Guide.md

| Section | Action | Detail |
|---|---|---|
| §5 Components | **Update** | Add: CalendarGrid, FolderTree, EventChip, FileDropZone, NotificationBell, StatCard, ChartWidget, StepperForm |
| §4 Colors | **Update** | Add calendar event colors, dashboard stat colors, folder tree colors |
| §7 Interaction Rules | **Update** | Add: calendar keyboard navigation, drag-and-drop rules, notification behavior |
| §6 Accessibility | **Update** | Add calendar grid ARIA, folder tree ARIA, notification live region |

### 2.8 SECURITY_MAPPING.md

| Section | Action | Detail |
|---|---|---|
| RBAC Matrix | **Update** | Add rows for Calendar, Hearing, Folder, Template, TimeEntry, Court, Judge |
| ABAC Rules | **Update** | Add folder permission inheritance, time entry ownership, calendar visibility |
| Screen→Route Mapping | **Update** | Add all new screens and their API routes |
| OIDC Section | **Add** | OIDC/PKCE authentication flow, token handling, session management |

---

## 3. Cross-Reference Integrity Checks

After all updates, verify:

| Check | Documents Involved |
|---|---|
| Every SRS FR has a corresponding FSD section | SRS ↔ FSD |
| Every FSD feature has a PRD scope entry | FSD ↔ PRD |
| Every API endpoint in TDD has an SRS FR | TDD §8 ↔ SRS §2 |
| Every screen in Wireframes has a Security Mapping entry | Wireframes ↔ SECURITY_MAPPING |
| Every new entity in TDD ERD has RBAC rules | TDD §4 ↔ SECURITY_MAPPING |
| Calendar spec matches Wireframes calendar screens | CALENDAR_SPEC ↔ Wireframes §2.5 |
| Doc v2 spec matches FSD document section | DOC_MGMT_V2_SPEC ↔ FSD §3 |
| Style Guide components cover all Wireframes components | Style_Guide §5 ↔ Wireframes |
