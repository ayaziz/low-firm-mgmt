# Implementation Changelog

## 2026-03-06

### Planning initialization
- File changed: IMPLEMENTATION_MASTER_PLAN.md
  - Purpose: Established execution scope, phased strategy, canonical deduplicated backlog, risks, dependencies, and verification strategy.
  - Linked tasks: T001-T030 (governance baseline)
  - Risk notes: None (documentation-only)
  - Change type: mixed (planning/governance)

- File changed: IMPLEMENTATION_TRACEABILITY_MATRIX.md
  - Purpose: Added end-to-end mapping for canonical findings F001-F028 to planned tasks and verification placeholders.
  - Linked tasks: T001-T030
  - Risk notes: None (documentation-only)
  - Change type: mixed (traceability)

- File changed: IMPLEMENTATION_TASKS.md
  - Purpose: Created batch-based actionable task list with status markers and finding references.
  - Linked tasks: T001-T030
  - Risk notes: None (documentation-only)
  - Change type: mixed (task management)

- File changed: IMPLEMENTATION_NOTES.md
  - Purpose: Added assumptions/discrepancy/deferred tracking workspace.
  - Linked tasks: T030
  - Risk notes: None (documentation-only)
  - Change type: mixed (technical notes)

### Batch 1 — Critical contract remediation
- File changed: frontend/src/api/documents.ts
  - Purpose: Fixed bulk payload keys to `documentIds`; aligned check-in response contract typing.
  - Linked tasks: T004, T005
  - Risk notes: Low; adapter-level key changes only.
  - Change type: contract alignment

- File changed: frontend/src/app/(app)/documents/[id]/page.tsx
  - Purpose: Completed check-in upload PUT after handshake; switched share input/submit to UUID `userId` contract.
  - Linked tasks: T003, T005
  - Risk notes: Medium; user now must provide UUID until user-picker is implemented.
  - Change type: mixed (contract alignment + validation)

- File changed: frontend/src/api/timeEntries.ts
  - Purpose: Preserved `taskId` and aligned rate mapping (`rate`/`rate_per_hour` -> `ratePerHour`).
  - Linked tasks: T015
  - Risk notes: Low.
  - Change type: contract alignment

- File changed: frontend/src/app/(app)/time-entries/page.tsx
  - Purpose: Replaced unsupported `Rejected` transition model with backend-supported lifecycle (`Draft/Submitted/Approved/Billed/WriteOff`).
  - Linked tasks: T016
  - Risk notes: Low; action options now constrained to server-valid transitions.
  - Change type: validation

- File changed: frontend/src/api/misc.ts; frontend/src/app/(app)/search/page.tsx
  - Purpose: Aligned search contract to `{ results, cursor }` and `entityId` navigation.
  - Linked tasks: T017
  - Risk notes: Low.
  - Change type: contract alignment

- File changed: frontend/src/api/templates.ts; frontend/src/app/(app)/templates/page.tsx
  - Purpose: Fixed preview parsing to `rendered`; removed unsupported `Report` category and added `Petition`.
  - Linked tasks: T018
  - Risk notes: Low.
  - Change type: contract alignment

- File changed: frontend/src/api/admin.ts; frontend/src/app/(app)/admin/SettingsTab.tsx
  - Purpose: Aligned expense workflow save payload to `{ name, steps[] }`; constrained tenant settings payload to backend-supported fields.
  - Linked tasks: T012, T013
  - Risk notes: Medium; settings UI fields reduced to backend DTO.
  - Change type: mixed (contract alignment + validation)

- File changed: frontend/src/app/(app)/admin/UsersTab.tsx
  - Purpose: Removed unsupported password field from user create/edit UI.
  - Linked tasks: T014
  - Risk notes: Low.
  - Change type: contract alignment

### Verification
- File changed: frontend build/test execution
  - Purpose: Verified compile + typecheck + targeted API contract tests.
  - Linked tasks: T029
  - Risk notes: None.
  - Change type: mixed (verification)

### Batch 2 — Validation and field correctness
- File changed: frontend/src/app/(app)/customers/page.tsx
  - Purpose: Added conditional identity capture/validation by customer type (Individual vs Organization), status selection, and create-form completeness.
  - Linked tasks: T009
  - Risk notes: Low; submit now intentionally blocked until required identity fields are present.
  - Change type: validation

- File changed: frontend/src/api/customers.ts; frontend/src/app/(app)/customers/[id]/page.tsx
  - Purpose: Normalized address request field mapping to backend DTO names and expanded address form fields (`state`, `postalCode`, `isPrimary`).
  - Linked tasks: T010
  - Risk notes: Low.
  - Change type: mixed (contract alignment + validation)

- File changed: frontend/src/app/(app)/cases/page.tsx
  - Purpose: Expanded case create to include multi-customer linkage, court case number, and optional assigned lawyer while preserving primary court/judge flow.
  - Linked tasks: T007
  - Risk notes: Medium; create form now depends on multi-select handling and optional user list loading.
  - Change type: contract alignment

### Batch 3 — Lookup/reference-data correctness (partial)
- File changed: frontend/src/app/(app)/admin/MasterDataTab.tsx; frontend/src/app/(app)/admin/CaseTypesTab.tsx
  - Purpose: Added edit workflows for master data and case types using existing patch APIs, removing delete/recreate-only correction path.
  - Linked tasks: T021
  - Risk notes: Low.
  - Change type: CRUD

### Batch 3 — Courts/hearings relationship alignment
- File changed: frontend/src/types/index.ts
  - Purpose: Aligned shared `Court`/`Judge`/`HearingStatus` definitions to backend-supported fields and status lifecycle while retaining compatibility aliases.
  - Linked tasks: T019, T020
  - Risk notes: Low; type expansion is backward-compatible for touched pages.
  - Change type: contract alignment

- File changed: frontend/src/app/(app)/courts/page.tsx; frontend/src/api/courts.ts
  - Purpose: Moved courts/judges UI and payload handling to backend-aligned fields (`department`, `circuit`, `jurisdictionLevel`, `city`, `addressText`, `notes`, `fullName`) and enabled optional judge lookup fetches.
  - Linked tasks: T019
  - Risk notes: Medium; court drawer labels/fields changed to authoritative backend model.
  - Change type: contract alignment

- File changed: frontend/src/app/(app)/hearings/page.tsx
  - Purpose: Added judge selection lookup to hearing create/edit, expanded transitions to backend lifecycle, and replaced raw case/court/judge ID fallbacks with resolved labels.
  - Linked tasks: T020, T022
  - Risk notes: Low.
  - Change type: mixed (relationship lookup + status alignment)

- File changed: frontend/src/app/(app)/cases/[id]/page.tsx
  - Purpose: Replaced case session judge free-text ID entry with lookup-driven judge select using loaded court/judge relationships.
  - Linked tasks: T022
  - Risk notes: Low.
  - Change type: relationship lookup

### Verification
- File changed: frontend build execution
  - Purpose: Verified compile + typecheck after T019/T020/T022 changes.
  - Linked tasks: T029
  - Risk notes: None.
  - Change type: verification

### Batch 4/5 — Remaining functional + CRUD + UX closeout
- File changed: frontend/src/api/cases.ts; frontend/src/app/(app)/cases/[id]/page.tsx
  - Purpose: Replaced reschedule-only session edit flow with true session patch update path and conditional reschedule trigger when datetime changes.
  - Linked tasks: T006
  - Risk notes: Medium; session update now splits schedule-change vs metadata update intentionally.
  - Change type: contract alignment

- File changed: frontend/src/api/customers.ts; frontend/src/app/(app)/customers/[id]/page.tsx
  - Purpose: Added customer communications API integration and UI tab with create/list workflows using backend communication type IDs.
  - Linked tasks: T011
  - Risk notes: Low.
  - Change type: CRUD

- File changed: frontend/src/api/calendar.ts; frontend/src/app/(app)/calendar/page.tsx
  - Purpose: Exposed attendee/reminder/recurrence/all-day fields and delete action in calendar workflows.
  - Linked tasks: T023
  - Risk notes: Medium; event create/edit forms now drive additional backend DTO fields.
  - Change type: relationship/CRUD

- File changed: frontend/src/app/(app)/documents/page.tsx; frontend/src/api/documents.ts
  - Purpose: Extended upload source handling to support case/customer/origin linkage and scope-aware folder assignment.
  - Linked tasks: T024
  - Risk notes: Medium; upload drawer flow now branches by source mode.
  - Change type: relationship lookup

- File changed: backend/src/case/case.dto.ts; backend/src/case/case.controller.ts; backend/src/case/case.service.ts; frontend/src/api/cases.ts; frontend/src/app/(app)/cases/[id]/page.tsx
  - Purpose: Closed high-value case relationship CRUD gaps by adding membership role update and case party update/delete endpoints plus UI actions.
  - Linked tasks: T025, T028
  - Risk notes: Medium; introduced new backend routes and frontend action wiring.
  - Change type: CRUD

- File changed: frontend/src/components/common/DataGrid.tsx
  - Purpose: Standardized table error state via explicit `errorMessage` handling.
  - Linked tasks: T026
  - Risk notes: Low.
  - Change type: UX consistency

- File changed: frontend/src/app/layout.tsx; frontend/src/components/common/ApprovalActions.tsx; frontend/src/app/(app)/notifications/page.tsx; frontend/src/app/(app)/reports/page.tsx; frontend/src/app/(app)/page.tsx
  - Purpose: Reduced hardcoded localization/formatting by applying translation fallbacks and Intl currency formatting in touched surfaces.
  - Linked tasks: T027
  - Risk notes: Low.
  - Change type: localization

### Verification
- File changed: frontend build execution; backend build execution
  - Purpose: Verified frontend compile/type/lint and backend Nest build after closeout batch.
  - Linked tasks: T029
  - Risk notes: None.
  - Change type: verification
