# UI Gap Analysis

## Summary
The UI foundation is functional and broad, but the experience is inconsistent across modules. The application feels like a strong internal operations console rather than a finished law-firm product in several critical flows.

## 1. Global UX and visual consistency

### 1.1 App shell is good, but page maturity is uneven
**Confirmed**

The shell in [frontend/src/components/layout/AppShell.tsx](frontend/src/components/layout/AppShell.tsx) provides a strong base: grouped navigation, quick actions, mobile drawer, and user context. However, many inner pages do not match that level of polish.

Observed issues:
- inconsistent action placement between pages
- inconsistent drawer usage and form density
- mixed list/table/card patterns without clear rationale
- action discoverability varies by module

### 1.2 Shared grid pattern lacks robust states
**Confirmed**

[frontend/src/components/common/DataGrid.tsx](frontend/src/components/common/DataGrid.tsx) supports search, sort, and paging, but it does not provide a first-class error state and relies on narrow toolbar assumptions.

Impact:
- pages often show nothing or silently degrade when calls fail
- large tables do not communicate why data is missing

### 1.3 Language and direction handling can flash incorrectly
**Confirmed**

[frontend/src/app/layout.tsx](frontend/src/app/layout.tsx) hardcodes `lang="en" dir="ltr"`, while [frontend/src/theme/ThemeProvider.tsx](frontend/src/theme/ThemeProvider.tsx) updates direction and language client-side.

Impact:
- possible initial LTR flash for Arabic users
- weaker perceived quality and accessibility

## 2. Cases UX gaps

### 2.1 Case detail is broad but overloaded
**Confirmed**

[frontend/src/app/(app)/cases/[id]/page.tsx](frontend/src/app/(app)/cases/[id]/page.tsx) contains many tabs and forms in one page. Functionally rich, but heavy and uneven.

Issues:
- tab density is high
- edit/delete patterns vary by tab
- forms are drawer/modal heavy without strong inline context
- related lists often lack empty-state guidance
- multiple flows rely on defensive parsing, which suggests weak trust in data contracts

### 2.2 Session workflow is misleading
**Confirmed**

The UI implies editable sessions, but the current edit path effectively behaves as reschedule-only. This is a workflow-design issue, not just a contract issue.

Impact:
- users may believe title/location/outcome edits are supported consistently when they are not

### 2.3 Financials inside case are read-only and disconnected
**Confirmed**

The case detail page exposes financial context but not a coherent action flow into invoice/payment operations.

Impact:
- users must mentally bridge case and accounting modules
- weak cross-module workflow continuity

## 3. Customers UX gaps

### 3.1 Customer create/edit forms are too narrow
**Confirmed**

[frontend/src/app/(app)/customers/page.tsx](frontend/src/app/(app)/customers/page.tsx) and [frontend/src/app/(app)/customers/[id]/page.tsx](frontend/src/app/(app)/customers/[id]/page.tsx) expose only part of the customer model.

Missing or weak UX:
- organization vs individual guidance is insufficient
- identity fields are incomplete for each customer type
- status management is underexposed
- detail edit focuses mainly on name and notes

### 3.2 Customer detail misses communications workspace
**Confirmed**

The backend supports customer-level communications, but the detail UI has no communications tab.

Impact:
- fragmented client relationship tracking
- users lose a natural place to review customer correspondence history

### 3.3 Destructive actions lack trust-building UX
**Confirmed**

Contacts and addresses can be deleted, but confirmation affordances are weak or absent in the customer detail experience.

## 4. Documents UX gaps

### 4.1 Upload flow is too case-centric
**Confirmed**

[frontend/src/app/(app)/documents/page.tsx](frontend/src/app/(app)/documents/page.tsx) primarily supports case-linked upload even though the backend supports customer-linked and origin-traceable documents.

Missing UX:
- customer-only upload flow
- upload by origin module/entity
- richer metadata capture
- better folder targeting beyond case-centric context

### 4.2 Detail workflow lacks confidence and transparency
**Confirmed**

[frontend/src/app/(app)/documents/[id]/page.tsx](frontend/src/app/(app)/documents/[id]/page.tsx) provides many actions, but the experience is brittle.

Issues:
- check-in does not visibly complete the replacement upload
- share dialog uses a raw input instead of a user picker
- metadata shows raw IDs in places where resolved labels are expected
- preview and access-history experiences are missing

### 4.3 Bulk management is not productized
**Confirmed**

The backend supports bulk delete, restore, and move, but the UI does not expose a complete bulk operations workflow.

## 5. Calendar and hearing UX gaps

### 5.1 Calendar is list-based, not planner-based
**Confirmed**

[frontend/src/app/(app)/calendar/page.tsx](frontend/src/app/(app)/calendar/page.tsx) behaves more like an event registry than a calendar workspace.

Missing UX:
- month/week/day views
- drag/drop or direct rescheduling affordances
- attendee visibility
- recurrence editing
- reminder visualization

### 5.2 Hearings page exposes only a partial scheduling model
**Confirmed**

[frontend/src/app/(app)/hearings/page.tsx](frontend/src/app/(app)/hearings/page.tsx) omits judge selection and lacks a richer detail or timeline view.

## 6. Admin UX gaps

### 6.1 Settings UI does not represent backend concepts clearly
**Confirmed**

[frontend/src/app/(app)/admin/SettingsTab.tsx](frontend/src/app/(app)/admin/SettingsTab.tsx) presents simplified toggles/thresholds for workflow settings that are more structurally complex in the backend.

Impact:
- users configure something that appears simple but maps poorly to actual system behavior

### 6.2 Master data and case types are create/delete only
**Confirmed**

[frontend/src/app/(app)/admin/MasterDataTab.tsx](frontend/src/app/(app)/admin/MasterDataTab.tsx) and [frontend/src/app/(app)/admin/CaseTypesTab.tsx](frontend/src/app/(app)/admin/CaseTypesTab.tsx) lack edit flows, despite backend edit capability.

Impact:
- admins must delete/recreate reference data to correct mistakes

### 6.3 User management UI suggests unsupported behavior
**Confirmed**

[frontend/src/app/(app)/admin/UsersTab.tsx](frontend/src/app/(app)/admin/UsersTab.tsx) includes password fields, which creates false expectations.

## 7. Dashboard, reports, search, notifications

### 7.1 Dashboard has polish gaps and a broken target
**Confirmed**

[frontend/src/app/(app)/page.tsx](frontend/src/app/(app)/page.tsx) contains a card linking to `/tasks`, which does not appear to exist as a standalone route.

Other issues:
- hardcoded currency formatting
- some clickable-looking items do not navigate
- silent catch-based fallback hides data problems

### 7.2 Reports are functional but text-heavy and underlocalized
**Confirmed**

[frontend/src/app/(app)/reports/page.tsx](frontend/src/app/(app)/reports/page.tsx) contains many hardcoded English labels and currency assumptions.

### 7.3 Search UX is thin
**Confirmed**

[frontend/src/app/(app)/search/page.tsx](frontend/src/app/(app)/search/page.tsx) depends on Enter-to-search and may search with stale filter state after filter changes.

### 7.4 Notifications navigation is simplistic
**Confirmed**

[frontend/src/app/(app)/notifications/page.tsx](frontend/src/app/(app)/notifications/page.tsx) maps notification entity types to coarse base paths. This is usable, but not precise enough for all record types and lacks richer action context.

## 8. Localization and accessibility gaps

### 8.1 Hardcoded English remains common
**Confirmed**

Examples include shared approval dialogs in [frontend/src/components/common/ApprovalActions.tsx](frontend/src/components/common/ApprovalActions.tsx), admin forms, reports text, and several labels across pages.

### 8.2 Currency and formatting are not locale-aware
**Confirmed**

Several pages format amounts with a hardcoded `$`, including time entries, dashboard, and reports.

### 8.3 Dense forms and icon-only controls need accessibility review
**Inferred**

Based on component patterns, there is likely inconsistent labeling for icon-only actions, dialog focus handling, and keyboard affordances.

## Priority UI recommendations
1. Standardize error/loading/empty states across all data pages.
2. Normalize language/direction at initial render.
3. Redesign the document and case detail workflows around explicit user journeys.
4. Expand calendar from registry view to planner view.
5. Remove misleading controls that imply unsupported behavior.
6. Complete localization of shared/common components first, then module pages.
