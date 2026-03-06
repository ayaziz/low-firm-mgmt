# Validation Gap Analysis

## Summary
Backend validation is strict and generally correct. The main gap is that frontend forms and API adapters do not consistently honor DTO naming, required-field logic, and server-side business rules.

## 1. Validation model
**Confirmed**

[backend/src/main.ts](backend/src/main.ts) enables:
- whitelist validation
- forbid-non-whitelisted rejection
- transformation

This is a strong baseline, but it magnifies frontend payload drift.

## 2. Confirmed validation gaps by module

## 2.1 Customers

### Create customer conditional identity requirements
**Confirmed**

[backend/src/customer/customer.service.ts](backend/src/customer/customer.service.ts) enforces:
- organizations require `registrationId` and `taxId`
- individuals require at least one of `nationalId` or `passportNumber`

Gap:
- [frontend/src/app/(app)/customers/page.tsx](frontend/src/app/(app)/customers/page.tsx) only captures a minimal set of fields and does not guide the user through the conditional identity requirements.

Risk:
- user submits a seemingly complete form and receives a server-side `400`

### Identity uniqueness errors are server-only
**Confirmed**

Customer service checks uniqueness for national ID, passport number, registration ID, and tax ID.

Gap:
- no strong pre-submit validation or targeted inline feedback is evident in customer forms

## 2.2 Customer addresses

### Field-name mismatch risk
**Confirmed**

Backend address DTO expects `type`, `isPrimary`, `line1`, `line2`, `city`, `state`, `postalCode`, `country` in [backend/src/customer/customer.dto.ts](backend/src/customer/customer.dto.ts).

Gap:
- frontend address handling has evidence of older naming patterns across types and forms
- current adapter usage does not clearly enforce one canonical payload shape

Risk:
- request rejection via non-whitelisted fields

## 2.3 Cases and sessions

### Session completion rule
**Confirmed**

[backend/src/case/case.service.ts](backend/src/case/case.service.ts) requires `outcomeNotes` when a session is completed.

Gap:
- the UI does not clearly enforce this as a first-class workflow rule

Risk:
- state transition failure late in the process

### Case create under-captures DTO expectations
**Confirmed**

`CreateCaseDto` expects richer intake context than the UI currently gathers.

Risk:
- valid business data is omitted during intake
- downstream manual correction burden increases

## 2.4 Documents

### Share validation mismatch
**Confirmed**

Backend requires a UUID `userId` for share operations.

Gap:
- document share UI accepts freeform email/text input

Risk:
- guaranteed `400` or access-control errors

### File workflow validation is only half represented in UI
**Confirmed**

Document create/check-in validate file metadata before issuing upload URLs in [backend/src/document/document.service.ts](backend/src/document/document.service.ts).

Gap:
- the UI initiates workflows without fully representing the multi-step validation + upload process to the user

Risk:
- users cannot distinguish metadata acceptance from completed file storage

## 2.5 Time entries

### Transition validation mismatch
**Confirmed**

Backend transition DTO supports `WriteOff`, while the UI exposes `Rejected`.

Risk:
- user sees an invalid lifecycle action
- request fails or becomes semantically inconsistent

### Missing task linkage validation in practice
**Confirmed**

Backend supports `taskId`, but the frontend mapper drops it.

Risk:
- even when the UI collects the value, it may never reach validation/business logic

## 2.6 Admin settings and users

### Workflow settings shape mismatch
**Confirmed**

Backend expects structured `steps`; UI edits a simplified object.

Risk:
- settings save can fail or create false confidence

### Password field in create/edit user UI
**Confirmed**

The users UI suggests password is part of validation, but the backend DTO does not accept it.

Risk:
- user trust erosion
- confusion about account provisioning flow

## 3. Feedback-quality gaps

### 3.1 Many pages lack explicit validation summaries
**Confirmed**

Across list/detail pages, error handling often uses `try/finally` or generic catch paths without strong field-level messaging.

### 3.2 Silent degradation hides real validation problems
**Confirmed**

Several pages fall back to empty arrays or alternate shapes on failure instead of surfacing contract problems.

Impact:
- validation defects can look like missing data instead of actionable errors

## 4. Recommended validation improvements
1. Add client-side conditional validation for customer type, document share, session completion, and time-entry status changes.
2. Make API adapters reject or normalize stale field names before requests are sent.
3. Surface server validation messages inline in drawer forms and detail forms.
4. Introduce module-specific schema validation on the frontend that mirrors DTO requirements.
5. Add regression tests for all known strict-validation workflows.
