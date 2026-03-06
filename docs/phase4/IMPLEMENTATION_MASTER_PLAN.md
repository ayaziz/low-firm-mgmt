# Implementation Master Plan

## Scope Summary
Structured remediation of confirmed findings from:
- REVIEW_SUMMARY.md
- UI_GAP_ANALYSIS.md
- API_UI_GAP_ANALYSIS.md
- VALIDATION_GAP_ANALYSIS.md
- LOOKUP_AND_RELATIONSHIP_GAPS.md
- CRUD_COVERAGE_MATRIX.md
- PRIORITIZED_REMEDIATION_PLAN.md

This plan focuses on fixing functional gaps and contract mismatches first, then validation, lookup/relationship correctness, CRUD completeness, and safe UI modernization.

## Assumptions
1. Backend DTO/controller behavior is source-of-truth for contracts unless contradicted by code evidence.
2. Existing routes, permission model, and workflow semantics remain unchanged unless a confirmed mismatch requires adjustment.
3. Work is executed incrementally with verification after each batch.
4. All findings must be either implemented, deduplicated to a canonical task, or explicitly deferred/blocked.

## Dependencies
- Frontend API adapter layer (`frontend/src/api/*`)
- Shared types (`frontend/src/types/index.ts`)
- Core module pages (documents, cases, customers, admin, time entries, search, hearings, calendar)
- Existing Jest/e2e test scaffolding in frontend/backend

## Risks
- Regression risk in high-traffic workflows (document operations, case transitions).
- Hidden downstream dependencies from stale shared types.
- Validation strictness (`forbidNonWhitelisted`) can surface latent payload defects.
- UI modernization can unintentionally alter role/action discoverability.

## Canonical Findings Backlog (Deduplicated)
- F001 Shared type drift across modules.
- F002 Inconsistent response normalization and page-level shape repair.
- F003 Documents share contract mismatch (`userId` vs email/text).
- F004 Documents bulk payload mismatch (`documentIds` vs `ids`).
- F005 Documents check-in flow incomplete (missing replacement file upload).
- F006 Cases session update UX/contract mismatch (reschedule-only behavior).
- F007 Case create form under-captures backend DTO fields.
- F008 Case transitions ignore concurrency/version fields.
- F009 Customer create/edit under-captures conditional identity fields.
- F010 Customer address naming/payload drift.
- F011 Customer communications backend-only (no UI/API frontend support).
- F012 Admin workflow settings payload mismatch (`steps` expected).
- F013 Admin tenant settings UI exposes unsupported fields.
- F014 Admin users UI exposes unsupported password fields.
- F015 Time-entry mapper drops `taskId` and rate naming drift.
- F016 Time-entry transition mismatch (`Rejected` vs backend lifecycle).
- F017 Search contract mismatch (`entityId` vs `id`) and stale list assumptions.
- F018 Templates render response mismatch and stale category options.
- F019 Courts/judges stale field mapping and naming drift.
- F020 Hearings missing judge selection and stale status coverage.
- F021 Master data/case types missing edit flow despite backend support.
- F022 Lookup labels render as raw IDs in multiple pages.
- F023 Calendar underuses attendee/reminder/recurrence/delete/linkage backend features.
- F024 Document upload UX too case-centric; origin/customer flows underexposed.
- F025 Case relationships underexposed (multi-customer, parties, memberships management).
- F026 Missing/weak error/empty/loading states.
- F027 Localization/RTL/currency hardcoding inconsistencies.
- F028 CRUD incompleteness in modules flagged by matrix.

## Module-by-Module Work Plan
### Documents
- Align adapter payloads and response handling (share, bulk, check-in).
- Complete check-in replacement upload flow.
- Improve lookup label rendering and prepare customer/origin upload extension.

### Cases
- Separate session patch from reschedule UX.
- Expand create form mappings to backend-supported fields.
- Preserve transition concurrency metadata.

### Customers
- Add conditional identity capture and validation.
- Normalize address payload shape.
- Expose communications APIs and customer detail tab/workspace.

### Admin
- Align workflow settings to `steps` model.
- Restrict tenant settings UI to supported fields.
- Remove unsupported password handling.
- Add edit support for master data/case types.

### Time Entries
- Forward `taskId` and align rate field mapping.
- Restrict transition statuses to backend-supported values.

### Search/Templates/Courts/Hearings/Calendar
- Align contracts and stale enums.
- Add judge and relationship lookups where missing.
- Expand calendar feature coverage incrementally.

### Global UX
- Standardize loading/error/empty states.
- Incremental localization and formatting cleanup.

## Execution Order (Phased)
### Phase 0 (Planning + Contract Baseline)
- Produce governance documents and traceability.
- Implement adapter/type corrections that unblock downstream modules.

### Phase 1 (Batch 1: Critical contract blockers)
- F003, F004, F005, F015, F017, F018, F014, F012.

### Phase 2 (Batch 2: Validation and field correctness)
- F009, F010, F016, F007, F013.

### Phase 3 (Batch 3: Lookup and reference-data correctness)
- F021, F022, F019, F020 (lookup portions), F024 (lookup portions).

### Phase 4 (Batch 4: Relationships and CRUD completeness)
- F011, F025, F028, F023.

### Phase 5 (Batch 5: Operational UX + UI modernization)
- F026, F027 plus safe module-specific polish.

## Verification Strategy Per Phase
- Build/type-check frontend after each batch.
- Run targeted tests for touched modules, then broader tests when stable.
- Confirm payload contracts via API adapter unit tests where available.
- Manually verify: create/edit submits, detail preloads, role-gated actions, i18n keys unchanged.
- Update traceability + changelog + task status after each batch.

## Status Markers
- TODO: not started
- IN PROGRESS: active implementation
- BLOCKED: external dependency or unresolved contract ambiguity
- DONE: implemented and verified
- DEFERRED: intentionally postponed with documented reason
