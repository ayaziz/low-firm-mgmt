# Prioritized Remediation Plan

## Planning principles
- Fix contract truth before redesigning large workflows.
- Prioritize business-critical legal/document/customer flows over cosmetic polish.
- Prefer central fixes in shared types and API adapters over page-level patches.
- Preserve current route structure where possible and improve incrementally.

## Phase 0 — Stabilize contracts and trust layer
**Goal:** remove the highest-risk API/UI inconsistencies.

### Work items
1. Align [frontend/src/types/index.ts](frontend/src/types/index.ts) with backend DTO/controller reality.
2. Standardize response normalization in [frontend/src/api/client.ts](frontend/src/api/client.ts) and module adapters.
3. Fix known adapter defects:
   - search result shape
   - time-entry `taskId` and rate mapping
   - document bulk payload naming
   - template preview response handling
   - admin workflow/settings payload shapes
4. Update stale contract tests in [frontend/src/api/__tests__/contract-mismatch.test.ts](frontend/src/api/__tests__/contract-mismatch.test.ts).

### Outcome
- frontend can trust adapter outputs
- page-level `any` usage and repair code can start shrinking

## Phase 1 — Repair business-critical workflows
**Goal:** make the most important user actions actually reliable.

### 1A. Documents
1. Complete the check-in file upload flow after upload URL retrieval.
2. Replace freeform share input with a valid user selector returning backend-required `userId`.
3. Expand upload UI to support customer-linked and origin-linked documents.
4. Expose bulk delete/move/restore with server-aligned payloads.
5. Replace raw IDs with resolved related labels where possible.

### 1B. Cases
1. Separate session update from reschedule in the UI.
2. Add clearer CRUD actions per case sub-tab.
3. Expand case create to include court case number, assigned lawyer, multi-customer selection, primary court, and primary judge.
4. Honor concurrency/version fields where required.

### 1C. Customers
1. Add conditional create/edit forms for individual vs organization identity fields.
2. Normalize address payloads and validation.
3. Add customer communications UI.
4. Add stronger confirmation UX for deleting contacts/addresses.

### Success criteria
- no known critical document flow is misleading
- case/customer intake reflects backend rules
- validation failures drop materially

## Phase 2 — Expose backend-complete features already available
**Goal:** close the gap between backend capability and frontend usability.

### Work items
1. Calendar:
   - attendees
   - reminders
   - recurrence
   - delete flow
   - stronger linked-record visibility
2. Hearings:
   - judge selection
   - richer status/lifecycle coverage
   - better detail view
3. Admin:
   - edit master data
   - edit case types
   - align tenant settings UI to actual DTO
   - remove unsupported password UX
4. Documents:
   - origin-based lookup/filtering
   - better folder-management flows

## Phase 3 — UX modernization and consistency
**Goal:** raise product quality and confidence.

### Work items
1. Create a standard page-state framework for:
   - loading
   - empty
   - error
   - permission-denied
2. Modernize dense modules:
   - case detail
   - customer detail
   - documents list/detail
   - reports
3. Improve responsive behavior on data-heavy screens.
4. Add clearer inline guidance and section hierarchy in forms.

## Phase 4 — Localization, accessibility, and polish
**Goal:** make the system production-ready for multilingual professional use.

### Work items
1. Move initial `lang`/`dir` handling to server-compatible bootstrapping.
2. Remove remaining hardcoded English from shared and module components.
3. Replace hardcoded currency formatting with locale-aware formatting.
4. Perform accessibility pass on dialogs, icon actions, focus order, labels, and keyboard navigation.

## Phase 5 — Quality gates
**Goal:** prevent regression.

### Work items
1. Add contract regression tests for each high-risk adapter.
2. Add integration tests for:
   - document create/check-in/share/bulk flows
   - customer conditional validation
   - case session update vs reschedule
   - time-entry transitions
   - admin settings save
3. Add UI tests for:
   - role-restricted flows
   - validation messaging
   - empty/error states

## Priority order by module
1. Documents
2. Cases
3. Customers
4. Admin settings/users
5. Time entries
6. Search
7. Calendar/hearings
8. Reports/dashboard/localization

## Suggested execution sequence
- Sprint 1: contract fixes + documents
- Sprint 2: cases + customers
- Sprint 3: admin + time entries + search
- Sprint 4: calendar/hearings + UX consistency
- Sprint 5: localization/accessibility + regression hardening

## Expected result
If phases 0 through 2 are completed first, the application will move from “broad but inconsistent” to “trustworthy core workflow platform.” Phases 3 through 5 then convert that stable core into a polished product experience.
