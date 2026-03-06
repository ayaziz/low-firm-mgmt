# Lookup and Relationship Gaps

## Summary
The backend models relationships and lookup/master data more richly than the frontend currently surfaces. The result is incomplete selection flows, raw IDs in the UI, and weak cross-entity navigation.

## 1. Master data and lookup usage

### 1.1 Master data editing is incomplete
**Confirmed**

The admin UI in [frontend/src/app/(app)/admin/MasterDataTab.tsx](frontend/src/app/(app)/admin/MasterDataTab.tsx) and [frontend/src/app/(app)/admin/CaseTypesTab.tsx](frontend/src/app/(app)/admin/CaseTypesTab.tsx) supports create/delete but not edit, even though backend edit endpoints exist.

Impact:
- reference-data corrections require destructive replacement
- downstream records may retain old labels/codes

### 1.2 Lookup labels are inconsistently resolved in UI
**Confirmed**

Examples:
- document detail may show raw `case_id` instead of a case title in [frontend/src/app/(app)/documents/[id]/page.tsx](frontend/src/app/(app)/documents/[id]/page.tsx)
- courts and hearings depend on stale type definitions that can obscure current lookup values

Impact:
- users see technical identifiers instead of business-friendly context

## 2. Customer relationships

### 2.1 Customer communications are modeled but not surfaced
**Confirmed**

Backend customer communications are implemented in [backend/src/customer/customer.controller.ts](backend/src/customer/customer.controller.ts) and [backend/src/customer/customer.service.ts](backend/src/customer/customer.service.ts), but the frontend customer detail page lacks a communications tab and the customer API adapter does not expose the endpoints.

Impact:
- customer history remains fragmented
- customer relationship management is weaker than the backend supports

### 2.2 Customer document relationships are underpowered in upload flow
**Confirmed**

Documents can belong to a customer, case, or origin entity in the backend, but the primary upload UI is case-centric.

Impact:
- non-case documents have no first-class workflow

## 3. Case relationships

### 3.1 Case-to-customer relationship is richer than the UI implies
**Confirmed**

Backend case creation supports multiple `customerIds` and case-customer linking in [backend/src/case/case.service.ts](backend/src/case/case.service.ts). The create UI appears centered around a single customer selection.

Impact:
- multi-party case intake is underrepresented

### 3.2 Case party handling is technically flexible but UX-poor
**Confirmed**

`addCaseParty()` in [backend/src/case/case.service.ts](backend/src/case/case.service.ts) resolves either a direct party ID or a customer ID and can auto-create a linked party.

Gap:
- the UI does not clearly explain this relationship resolution
- party management lacks strong edit/remove affordances

Impact:
- relationship behavior feels opaque
- users may not know whether they are linking existing records or creating new ones indirectly

### 3.3 Membership lifecycle is incomplete in the UI
**Confirmed**

Case memberships can be added, but removal/management is not fully surfaced in the detail UX.

## 4. Court, judge, and hearing relationships

### 4.1 Judge lookup is not fully integrated into hearings
**Confirmed**

Backend hearings support `judgeId`, but the frontend hearing form does not fully expose judge selection.

Impact:
- hearing records may lack structured judicial linkage

### 4.2 Court model drift affects relationship clarity
**Confirmed**

Because court types are stale in the frontend, even correctly linked court relationships may render with outdated fields.

## 5. Calendar relationships

### 5.1 Events support case/hearing linkage, attendees, and reminders, but UI only uses part of it
**Confirmed**

Calendar DTOs/controllers support:
- `caseId`
- `hearingId`
- attendees
- recurrence
- reminders

The current calendar page does not fully model those relationships.

Impact:
- event planning is disconnected from related records and participants

## 6. Document relationships

### 6.1 Origin-based document retrieval exists but is not surfaced
**Confirmed**

[backend/src/document/document.controller.ts](backend/src/document/document.controller.ts) and [backend/src/document/document.service.ts](backend/src/document/document.service.ts) support origin-based lookup.

Gap:
- no clear frontend workflow uses origin relationships as a first-class filter or detail context

### 6.2 Folder relationships are not fully exposed in bulk UX
**Confirmed**

Bulk move-to-folder exists in the backend, but the UI does not provide a complete bulk folder management experience.

## Recommended relationship fixes
1. Add edit support for master data and case types.
2. Add customer communications to customer detail.
3. Make document upload support case, customer, and origin entry points.
4. Clarify case-party linking with explicit selectors and labels.
5. Add judge lookup to hearings and richer court-label rendering.
6. Expand calendar relationship editing to attendees, reminders, recurrence, and linked records.
