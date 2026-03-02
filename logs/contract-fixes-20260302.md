# Contract Fix Log (2026-03-02)

## Contract truth source
No OpenAPI/Swagger contract file was found during repository scan. Backend NestJS route definitions (`@Controller`, `@Get/@Post/@Patch/@Delete`) and DTO validators (`class-validator` decorators) were treated as the contract source of truth.

## Inventory (static analysis)

| Area | Files inspected | Potential mismatch flags |
|---|---|---|
| Frontend API clients | `frontend/src/api/client.ts`, `calendar.ts`, `courts.ts`, `folders.ts`, `cases.ts`, plus other API modules under `frontend/src/api/` | Calendar path/method payload mismatch, courts judges path mismatch, folders move-document path mismatch, response-envelope mismatch, session reschedule field mismatch |
| Backend routes/controllers | `backend/src/calendar/calendar.controller.ts`, `court/court.controller.ts`, `folder/folder.controller.ts`, `case/case.controller.ts` | Confirmed route paths and payload keys differ from FE calls |
| Backend DTO/validation schemas | `backend/src/calendar/calendar.dto.ts`, `folder/folder.dto.ts`, `case/case.dto.ts` | `rsvp` required (not `rsvpStatus`), `newDateTime` required (not `newDate`), `folderId` must be body field for move-document |
| Frontend request/response typing | `frontend/src/types/index.ts` and API module signatures | FE expected plain bodies while some BE modules return `{ success, data }` / `{ success, ...pagination }` envelopes |

## Fix entries

### Issue 1
- **Symptom:** 404 and follow-on UI data errors on Calendar pages.
- **Impacted endpoint/UI:** `/calendar` list/create/get/update/delete and attendee/rsvp/reminder calls from calendar UI.
- **Root cause:** FE called `/calendar` and `/calendar/:id/*`, but BE routes are `/calendar/events` and `/calendar/events/:id/*`; FE sent `rsvpStatus` while BE DTO requires `rsvp`.
- **Fix summary:** Updated FE calendar API paths to `/calendar/events...`; changed RSVP payload key to `rsvp`.
- **Files changed:** `frontend/src/api/calendar.ts`.
- **Tests added/updated:** Added frontend API contract test coverage asserting updated calendar paths and RSVP payload key.
- **Verification steps:** `npm --prefix frontend test -- --runInBand` ✅.

### Issue 2
- **Symptom:** 404 for judges listing/updates and 400 on judge creation in courts management.
- **Impacted endpoint/UI:** Courts > Judges flows.
- **Root cause:** FE used nested routes (`/courts/:courtId/judges...`) but BE exposes flat routes (`/courts/judges...`) with `courtId` as query/body field.
- **Fix summary:** Updated FE judges routes to flat backend routes and included `courtId` in query/body where required.
- **Files changed:** `frontend/src/api/courts.ts`.
- **Tests added/updated:** Added frontend API contract tests asserting judges path + `courtId` transport.
- **Verification steps:** `npm --prefix frontend test -- --runInBand` ✅.

### Issue 3
- **Symptom:** 404 when moving documents between folders.
- **Impacted endpoint/UI:** Folder document move action.
- **Root cause:** FE called `/folders/:folderId/move-document`; BE route is `/folders/move-document` and expects `{ documentId, folderId }` body.
- **Fix summary:** Updated FE to call `/folders/move-document` and send `folderId` in payload.
- **Files changed:** `frontend/src/api/folders.ts`.
- **Tests added/updated:** Added frontend API contract test for move-document route/payload.
- **Verification steps:** `npm --prefix frontend test -- --runInBand` ✅.

### Issue 4
- **Symptom:** Runtime UI errors/undefined data when reading API responses from modules that return envelopes (`{ success, data }` / `{ success, ... }`).
- **Impacted endpoint/UI:** Calendar, Folder, and any endpoint returning success-envelope format.
- **Root cause:** FE client returned raw response object without unwrapping backend envelope shape; consumer code expected direct domain objects/paginated structures.
- **Fix summary:** Added centralized envelope normalization in FE HTTP client to unwrap `success` responses safely.
- **Files changed:** `frontend/src/api/client.ts`.
- **Tests added/updated:** Indirectly validated in API contract tests; envelope unwrapping logic covered by build/type checks.
- **Verification steps:** `npm --prefix frontend run build` ✅.

### Issue 5
- **Symptom:** 400 validation error for case session rescheduling payload.
- **Impacted endpoint/UI:** Case session reschedule action.
- **Root cause:** FE typed payload as `newDate`; BE DTO requires `newDateTime`.
- **Fix summary:** Updated FE API signature to use `newDateTime`.
- **Files changed:** `frontend/src/api/cases.ts`.
- **Tests added/updated:** Covered through static type/compilation checks.
- **Verification steps:** `npm --prefix frontend run build` ✅.

## Verification runs

- `npm --prefix frontend test -- --runInBand` → **PASS** (3 new contract tests).
- `npm --prefix frontend run lint` → **BLOCKED** (interactive Next.js ESLint setup prompt because no preconfigured eslint settings).
- `npm --prefix frontend run build` → **PASS**.
- `npm --prefix backend run lint` → **BLOCKED** (no ESLint config file in backend project).
- `npm --prefix backend test -- --runInBand` → **PASS** (existing 182 backend tests passed).
- `npm --prefix backend run test:e2e -- --runInBand` → **PARTIAL/BLOCKED** (tests bootstrap but environment lacks `DATABASE_URL` and Redis; suite prints skip warnings and repeated connection-refused logs).
- `npm --prefix backend run build` → **PASS**.
- `docker compose build` → **BLOCKED** (`docker` binary unavailable in execution environment).

## Remaining issues / next actions

1. Add non-interactive ESLint configuration for frontend and backend so lint can run in CI and local automation without prompts.
2. Stabilize e2e bootstrap by providing test infra (`DATABASE_URL`, Redis) or hard-disable background queue connections in e2e mode to prevent noisy post-test connection errors.
3. Consider introducing shared API contract types (generated or shared package) to prevent drift of route paths and DTO fields across FE/BE.
