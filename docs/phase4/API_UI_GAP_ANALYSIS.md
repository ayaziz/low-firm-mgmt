# API and UI Gap Analysis

## Summary
The biggest technical problem in the application is contract drift between frontend forms/types and backend DTO/controller behavior. The frontend often compensates with local shape repair instead of central normalization.

## 1. Cross-cutting mismatch patterns

### 1.1 Shared type drift
**Confirmed**

[frontend/src/types/index.ts](frontend/src/types/index.ts) no longer reflects the current backend shape for multiple entities.

Examples:
- `SearchResult` shape does not match backend search result shape.
- `Court` still models legacy fields like `court_type`, `jurisdiction`, and `email`.
- `HearingStatus` is narrower than backend-supported hearing transitions.
- `DocumentTemplate` category values are stale.

### 1.2 Response normalization is inconsistent
**Confirmed**

[frontend/src/api/client.ts](frontend/src/api/client.ts) unwraps `{ success, data }` envelopes, but several pages still defensively parse arrays and nested `data` because some endpoints return different shapes.

Impact:
- page components contain contract-repair logic
- type safety is weakened
- defects get hidden instead of fixed centrally

## 2. Module-by-module confirmed mismatches

## 2.1 Search

### Mismatch
Backend search returns `{ results, cursor, totalEstimate }` with each result using `entityId`, as implemented in [backend/src/search/search.service.ts](backend/src/search/search.service.ts) and exposed by [backend/src/search/search.controller.ts](backend/src/search/search.controller.ts).

The frontend search page and API typing in [frontend/src/api/misc.ts](frontend/src/api/misc.ts) and [frontend/src/app/(app)/search/page.tsx](frontend/src/app/(app)/search/page.tsx) assume a paginated list and locally use `id`.

### Effect
- result navigation and rendering are fragile
- type mismatch is guaranteed unless manually repaired

## 2.2 Time entries

### Mismatch
The backend `CreateTimeEntryDto`/`UpdateTimeEntryDto` supports `taskId` in [backend/src/time-entry/time-entry.dto.ts](backend/src/time-entry/time-entry.dto.ts), but the mapper in [frontend/src/api/timeEntries.ts](frontend/src/api/timeEntries.ts) does not forward it.

Also:
- page payload uses `rate`
- API mapper expects `rate_per_hour`
- UI includes `Rejected` as a transition option while backend supports `WriteOff`

### Effect
- task-linked billing context can be lost
- transition actions can expose invalid statuses

## 2.3 Templates

### Mismatch
[frontend/src/api/templates.ts](frontend/src/api/templates.ts) defines `render()` as returning `{ rendered: string }`, but [frontend/src/app/(app)/templates/page.tsx](frontend/src/app/(app)/templates/page.tsx) reads the response as either a raw string or `.data`.

Also, the frontend includes a `Report` category that is not part of backend template categories in [backend/src/template/template.dto.ts](backend/src/template/template.dto.ts).

### Effect
- preview can fail or display fallback content incorrectly
- category filtering/creation is inconsistent with server rules

## 2.4 Documents

### Mismatch A — share flow
Backend share DTO requires `userId` UUID in [backend/src/document/document.dto.ts](backend/src/document/document.dto.ts). The detail page collects an email-like value and sends it through [frontend/src/api/documents.ts](frontend/src/api/documents.ts) from [frontend/src/app/(app)/documents/[id]/page.tsx](frontend/src/app/(app)/documents/[id]/page.tsx).

### Mismatch B — bulk operation payload names
Backend bulk DTOs require `documentIds`, while frontend bulk methods send `ids` in [frontend/src/api/documents.ts](frontend/src/api/documents.ts).

### Mismatch C — check-in handshake vs actual upload
Backend `checkin()` returns an `uploadUrl` in [backend/src/document/document.service.ts](backend/src/document/document.service.ts), but the UI does not complete the file upload after receiving it.

### Effect
- share may fail validation or grant access to nobody
- bulk actions may fail immediately
- check-in appears successful but does not complete the content replacement

## 2.5 Courts and judges

### Mismatch
Backend court DTOs in [backend/src/court/court.dto.ts](backend/src/court/court.dto.ts) use fields like `department`, `circuit`, `jurisdictionLevel`, `city`, `phone`, and `addressText`. Frontend court typing and rendering in [frontend/src/types/index.ts](frontend/src/types/index.ts) and [frontend/src/app/(app)/courts/page.tsx](frontend/src/app/(app)/courts/page.tsx) still revolve around legacy names like `court_type`, `jurisdiction`, `address`, and `email`.

Also, judges use `fullName` in backend DTOs, while earlier contract assumptions and tests still point to `name`.

### Effect
- stale display fields
- more adapter mapping than necessary
- higher chance of broken edit/detail views

## 2.6 Hearings

### Mismatch
Backend hearing DTOs support `judgeId` and more transition states in [backend/src/hearing/hearing.dto.ts](backend/src/hearing/hearing.dto.ts). The frontend hearing page in [frontend/src/app/(app)/hearings/page.tsx](frontend/src/app/(app)/hearings/page.tsx) omits judge selection and shared type definitions lag behind the backend status model.

### Effect
- scheduling model exposed to users is incomplete
- status display logic can drift from server truth

## 2.7 Cases

### Mismatch A — richer create DTO than UI captures
Backend `CreateCaseDto` in [backend/src/case/case.dto.ts](backend/src/case/case.dto.ts) supports `assignedLawyerUserId`, `courtCaseNumber`, multiple `customerIds`, `primaryCourtId`, and `primaryJudgeId`. The create drawer in [frontend/src/app/(app)/cases/page.tsx](frontend/src/app/(app)/cases/page.tsx) captures only a subset.

### Mismatch B — session update vs reschedule
Backend exposes both session patch and reschedule routes in [backend/src/case/case.controller.ts](backend/src/case/case.controller.ts), but the frontend mainly uses reschedule for edits.

### Mismatch C — transition concurrency
Case transition methods in [frontend/src/api/cases.ts](frontend/src/api/cases.ts) discard `rowVersion`, even though the domain visibly tracks row versions.

### Effect
- incomplete case intake
- misleading session editing
- increased concurrency/conflict risk over time

## 2.8 Customers

### Mismatch A — create/edit forms underrepresent DTO rules
Backend `CreateCustomerDto` in [backend/src/customer/customer.dto.ts](backend/src/customer/customer.dto.ts) has conditional identity requirements by customer type. The create UI in [frontend/src/app/(app)/customers/page.tsx](frontend/src/app/(app)/customers/page.tsx) only collects a minimal subset.

### Mismatch B — address naming
Backend address DTO expects `type`, `isPrimary`, `state`, `postalCode`; older frontend data shapes still reference legacy naming patterns in some flows and types.

### Mismatch C — communications gap
Backend customer communications endpoints exist in [backend/src/customer/customer.controller.ts](backend/src/customer/customer.controller.ts), but [frontend/src/api/customers.ts](frontend/src/api/customers.ts) does not expose them.

### Effect
- create/update may fail or under-capture critical customer identity data
- relationship timeline is incomplete in UI

## 2.9 Admin settings and users

### Mismatch A — expense workflow settings
Backend `SaveExpenseWorkflowDto` expects a `steps` array in [backend/src/admin/admin.dto.ts](backend/src/admin/admin.dto.ts). The settings UI in [frontend/src/app/(app)/admin/SettingsTab.tsx](frontend/src/app/(app)/admin/SettingsTab.tsx) edits `requiresApproval`, `autoApproveThreshold`, and `approverRoles`.

### Mismatch B — tenant settings fields
Backend `UpdateTenantSettingsDto` supports a narrow set of tenant settings, but the UI surfaces additional fields such as firm branding and scan settings.

### Mismatch C — user password field
Backend `CreateUserDto` does not accept password, while [frontend/src/app/(app)/admin/UsersTab.tsx](frontend/src/app/(app)/admin/UsersTab.tsx) shows password fields.

### Effect
- settings can be misleading or unsavable
- user-management UI communicates unsupported behavior

## 3. Tests also show drift
**Confirmed**

[frontend/src/api/__tests__/contract-mismatch.test.ts](frontend/src/api/__tests__/contract-mismatch.test.ts) contains stale expectations such as judge creation using `name` instead of `fullName`.

Effect:
- even contract tests are not a reliable source of truth yet

## Recommended corrections
1. Make backend DTO/controller output the contract reference.
2. Update [frontend/src/types/index.ts](frontend/src/types/index.ts) to reflect current server truth.
3. Move all payload/response normalization into API adapters.
4. Remove page-level `any` and shape-repair logic after adapters are fixed.
5. Add targeted contract tests per module for the fixed shapes.
