# Phase 2 File Manifest
## Law Office Management Application (LOMA)

**Date:** 2026-02-25  
**Total Documents:** 21 (8 updated baseline + 13 new Phase 2)

---

## Baseline Documents (Updated to v2.0)

| # | File | Location | Version | Description |
|---|---|---|---|---|
| 1 | PRD.md | `doc/PRD.md` | 2.0 | Product Requirements — Phase 2 features (§4.3), promoted deferrals, NFRs |
| 2 | BRD.md | `doc/BRD.md` | 2.0 | Business Requirements — Phase 2 KPIs (§2.3), business rules (§4.5-4.7) |
| 3 | FSD.md | `doc/FSD.md` | 2.0 | Functional Spec — doc features (§3.7-3.14), calendar (§6), court/judge (§7), time (§8) |
| 4 | SRS.md | `doc/SRS.md` | 2.0 | Software Requirements — FR-DOC-14-24, FR-ACC-15-20, §2.12-2.17, §3.7-3.10 |
| 5 | TDD_System_Architecture.md | `doc/TDD_System_Architecture.md` | 2.0 | Architecture — 8 new modules, 50 API endpoints, OIDC, OCR workers, storage |
| 6 | Wireframes_IA.md | `doc/Wireframes_IA.md` | 2.0 | Wireframes — new nav, dashboard, hearings (§2.6), time tracking (§2.7), admin (§4.3-4.5) |
| 7 | Style_Guide.md | `doc/Style_Guide.md` | 2.0 | Design System — new tokens, 7 component sections, ARIA, keyboard nav, RTL |
| 8 | SECURITY_MAPPING.md | `doc/SECURITY_MAPPING.md` | 2.0 | Security — RBAC (10 new rows), ABAC (§3.5-3.7), screen routes (§4.9-4.15), OIDC flow (§6.1) |

---

## New Phase 2 Documents

| # | File | Location | Description |
|---|---|---|---|
| 9 | PHASE1_BASELINE_SUMMARY.md | `docs/phase2/` | Baseline audit: 15 resolved gaps, weaknesses, test counts, codebase stats |
| 10 | PHASE2_VISION_AND_METRICS.md | `docs/phase2/` | 5 pillars, drivers traceability, success criteria, KPIs, scope boundaries |
| 11 | PHASE2_DOMAIN_MODEL_AND_WORKFLOWS.md | `docs/phase2/` | 8 new entities, 10 extended, ERD, 4 state machines, 4 workflow diagrams |
| 12 | GAPS_RESOLUTION.md | `doc/` | 15 Phase 1 gap resolutions with detailed per-gap analysis |
| 13 | DOC_MGMT_V2_SPEC.md | `docs/phase2/` | 12 features (F-DOC-01-12), folders, templates, OCR, full-text search |
| 14 | CALENDAR_SPEC.md | `docs/phase2/` | 14 features (F-CAL-01-14), views, recurrence, conflict detection, reminders |
| 15 | UIUX_PHASE2_PROPOSAL.md | `docs/phase2/` | Sidebar nav, dashboards, 6 screens, 17 components, design tokens, a11y |
| 16 | DOCS_CHANGE_PLAN.md | `docs/phase2/` | Section-level change instructions for all 8 baseline docs |
| 17 | PHASE2_ROADMAP_BACKLOG.md | `docs/phase2/` | 8-sprint plan (16 weeks), 8 epics, 62 stories, milestones, dependency graph |
| 18 | PHASE2_ACCEPTANCE_CRITERIA.md | `docs/phase2/` | 58+ acceptance criteria in Given/When/Then, 10 sections, AC-IDs |
| 19 | PHASE2_TEST_STRATEGY.md | `docs/phase2/` | Test pyramid, tooling, coverage targets, CI gates, performance scenarios |
| 20 | PHASE2_MIGRATION_PLAN.md | `docs/phase2/` | ~40 DB migrations, data transforms, auth & storage migration, rollback |
| 21 | PHASE2_RISKS_AND_DECISIONS.md | `docs/phase2/` | 10 risks (register + mitigations), 7 ADRs, decision log |

---

## Cross-Reference Matrix

| Document | References |
|---|---|
| PRD | → BRD, FSD, SRS, VISION, ROADMAP |
| BRD | → PRD, FSD, ACCEPTANCE_CRITERIA |
| FSD | → SRS, TDD, DOC_MGMT_V2_SPEC, CALENDAR_SPEC |
| SRS | → FSD, TDD, ACCEPTANCE_CRITERIA |
| TDD | → DOMAIN_MODEL, DOC_MGMT_V2_SPEC, CALENDAR_SPEC, MIGRATION_PLAN |
| SECURITY_MAPPING | → TDD, DOMAIN_MODEL, RISKS_AND_DECISIONS |
| DOMAIN_MODEL | → TDD, FSD, GAPS_RESOLUTION |
| ROADMAP_BACKLOG | → ACCEPTANCE_CRITERIA, TEST_STRATEGY, MIGRATION_PLAN |
| TEST_STRATEGY | → ACCEPTANCE_CRITERIA, ROADMAP_BACKLOG |
| MIGRATION_PLAN | → DOMAIN_MODEL, TDD, RISKS_AND_DECISIONS |
| RISKS_AND_DECISIONS | → ROADMAP_BACKLOG, MIGRATION_PLAN, TDD |
