# Security Mapping — LOMA Phase 2

**Version:** 2.0  
**Date:** 2026-02-25

---

## 1. Roles

| Role          | Description                                           |
| --------------- | ------------------------------------------------------- |
| Lawyer        | Case owner / member, handles legal work               |
| Accountant    | Financial operations (invoices, payments, wages, etc.) |
| TenantAdmin   | Full tenant-level administration                      |
| SystemAdmin   | Platform-wide super-admin                             |

---

## 2. RBAC Permission Matrix (API layer)

**Legend:** V = View, C = Create, E = Edit, D = Delete, A = Approve, X = Export, — = no access

| Module / Action             | Lawyer            | Accountant          | TenantAdmin         | SystemAdmin |
| ----------------------------- | ------------------- | --------------------- | --------------------- | ------------- |
| **Customers**               | V/C/E (scoped)    | V (finance views)   | V/C/E/D             | V/C/E/D     |
| **Contacts**                | V/C/E (scoped)    | V (limited)         | V/C/E/D             | V/C/E/D     |
| **Cases**                   | V/C/E (membership)| V (limited headers) | V/C/E/D             | V/C/E/D     |
| **Case Memberships**        | —                 | —                   | Manage              | Manage      |
| **Tasks**                   | V/C/E/D (membership)| —                 | V/C/E/D             | V/C/E/D     |
| **Sessions**                | V/C/E/D (membership)| —                 | V/C/E/D             | V/C/E/D     |
| **Filings**                 | V/C/E/D (membership)| —                 | V/C/E/D             | V/C/E/D     |
| **Notes**                   | C/V (append-only) | —                   | C/V                 | C/V         |
| **Communications**          | V/C/E/D (membership)| —                 | V/C/E/D             | V/C/E/D     |
| **Documents**               | V/C/E (membership)| V (finance-only)    | V/C/E/D + BreakLock + Hold | Full  |
| **HighlyConfidential docs** | Explicit ACL req.  | Explicit ACL req.   | Manage ACL          | Manage ACL  |
| **Invoices**                | V/C/E Draft (own)  | V/C/E/D + Finalize + X | V/C/E/D + Void + X | Full    |
| **Payments**                | V (summary only)  | C/E/X               | C/E/X               | Full        |
| **Expenses**                | V/C (own cases)   | V/C/E/A/X           | V/C/E/A/X           | Full        |
| **Wages**                   | —                 | V/C/E/X             | optional             | Full        |
| **Reports (Operational)**   | V/X (limited)     | V/X                 | V/X                 | Full        |
| **Reports (Financial)**     | V (limited)       | V/X                 | V/X                 | Full        |
| **Admin master data**       | —                 | —                   | Full (tenant)        | Full        |
| **Audit logs**              | limited           | limited             | Full tenant          | Full platform|
| **Calendar Events**         | V/C/E/D (own)     | V/C/E/D (own)       | V/C/E/D (all tenant) | Full        |
| **Hearings**                | V/C/E (membership) | —                  | V/C/E/D + Cancel     | Full        |
| **Folders**                 | V/C/E/D (membership)| —                 | V/C/E/D             | Full        |
| **Document Templates**      | V (use only)       | —                  | V/C/E/D             | Full        |
| **Time Entries**            | V/C/E/D (own)      | V/A + Bulk Approve  | V/C/E/D/A           | Full        |
| **Courts**                  | V                  | —                  | V/C/E               | Full        |
| **Judges**                  | V                  | —                  | V/C/E               | Full        |
| **External Share Links**    | V/C/D (own docs)   | —                  | V/C/D               | Full        |
| **Notification Subscriptions** | V/E (own)       | V/E (own)           | V/E (own)           | Full        |

---

## 3. ABAC Rules

### 3.1 Tenant Boundary

- **Rule:** Every data query is scoped by `tenantSlug` from JWT.
- **Enforcement:** Service layer filters by tenant on every query. Guard validates `tenantSlug` presence on JWT.

### 3.2 Case Membership

- **Roles affected:** Lawyer, Accountant (when accessing case-linked data).
- **Rule:** Lawyer see only cases where they are CaseOwner or CaseMember. Accountant sees limited headers.
- **Enforcement (MVP):** Service layer filters cases by `assignedLawyerUserId` for Lawyer, returns limited fields for Accountant.

### 3.3 Document ACL

- **Rule:** HighlyConfidential documents require explicit ACL entry + step-up auth.
- **Enforcement:** `DocumentService.getById()` checks confidentiality level and ACL entries. StepUpGuard on break-lock/legal-hold.

### 3.4 Ownership Scope

- **Rule:** Lawyer can only create/edit Draft invoices for their own cases; can only create expenses for own cases.
- **Enforcement:** Service layer validates `userId === invoice.case.assignedLawyerUserId` for mutations.

### 3.5 Folder Permission Inheritance (Phase 2)

- **Rule:** Folder access inherits from parent folder; root folders inherit from Case Membership.
- **Evaluation order:** Folder ACL → Parent Folder ACL → … → Case Membership.
- **Override:** TenantAdmin and SystemAdmin bypass folder ACL.
- **Enforcement:** `FolderService` walks the folder ancestry chain; caches resolved permissions per request.

### 3.6 Time Entry Ownership (Phase 2)

- **Rule:** Users can only create/edit/delete their own time entries in Draft status.
- **Rule:** Only Accountant or TenantAdmin can approve/reject submitted time entries.
- **Enforcement:** Service layer validates `userId === timeEntry.userId` for mutations; `RolesGuard` on approve/reject.

### 3.7 Calendar Visibility (Phase 2)

- **Rule:** Users see their own events + case-linked events for cases they are members of.
- **Rule:** TenantAdmin sees all tenant calendar events.
- **Enforcement:** CalendarService filters by `createdByUserId` OR `caseId IN (user's memberships)` OR `role === TenantAdmin`.

---

## 4. Screen → Route → API Mapping

### 4.1 Dashboard

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| ----------- | --------------- | -------------- | --------------- |
| Dashboard | `/` | `GET /reports/cases-by-state`, `GET /notifications/unread-count` | All authenticated |

### 4.2 Customers

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| ----------- | --------------- | -------------- | --------------- |
| Customer List | `/customers` | `GET /customers` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Customer Detail | `/customers/:id` | `GET /customers/:id` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Create Customer | `/customers` (dialog) | `POST /customers` | Lawyer, TenantAdmin, SystemAdmin |
| Edit Customer | `/customers/:id` (dialog) | `PATCH /customers/:id` | Lawyer, TenantAdmin, SystemAdmin |
| Financial Summary | `/customers/:id` | `GET /customers/:id/financial-summary` | All authenticated |
| Add Contact | `/customers/:id` | `POST /customers/:id/contacts` | Lawyer, TenantAdmin, SystemAdmin |

### 4.3 Cases

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| ----------- | --------------- | -------------- | --------------- |
| Case List | `/cases` | `GET /cases` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Case Detail | `/cases/:id` | `GET /cases/:id` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Create Case | `/cases` (dialog) | `POST /cases` | Lawyer, TenantAdmin, SystemAdmin |
| Case Transition | `/cases/:id` | `POST /cases/:id/transition` | Lawyer, TenantAdmin, SystemAdmin |
| Tasks | `/cases/:id` | `GET/POST /cases/:id/tasks` | Lawyer, TenantAdmin, SystemAdmin |
| Sessions | `/cases/:id` | `GET/POST /cases/:id/sessions` | Lawyer, TenantAdmin, SystemAdmin |
| Filings | `/cases/:id` | `GET/POST /cases/:id/filings` | Lawyer, TenantAdmin, SystemAdmin |
| Notes | `/cases/:id` | `GET/POST /cases/:id/notes` | Lawyer, TenantAdmin, SystemAdmin |
| Communications | `/cases/:id` | `GET/POST /cases/:id/communications` | Lawyer, TenantAdmin, SystemAdmin |

### 4.4 Documents

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| ----------- | --------------- | -------------- | --------------- |
| Document List | `/documents` | `GET /documents` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Document Detail | `/documents/:id` | `GET /documents/:id` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Upload Document | `/documents` (dialog) | `POST /documents` | Lawyer, TenantAdmin, SystemAdmin |
| Download | `/documents/:id` | `GET /documents/:id/download` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Break Lock | `/documents/:id` | `POST /documents/:id/break-lock` | TenantAdmin, SystemAdmin + StepUp |
| Legal Hold | `/documents/:id` | `POST /documents/:id/legal-hold` | TenantAdmin, SystemAdmin + StepUp |

### 4.5 Accounting

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| ----------- | --------------- | -------------- | --------------- |
| Invoice List | `/accounting` | `GET /invoices` | All authenticated |
| Invoice Detail | `/accounting/invoices/:id` | `GET /invoices/:id` | All authenticated |
| Create Invoice | `/accounting` (dialog) | `POST /invoices` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Finalize Invoice | `/accounting/invoices/:id` | `POST /invoices/:id/finalize` | Accountant, TenantAdmin, SystemAdmin |
| Void Invoice | `/accounting/invoices/:id` | `POST /invoices/:id/void` | TenantAdmin, SystemAdmin |
| Record Payment | `/accounting` (dialog) | `POST /payments` | Accountant, TenantAdmin, SystemAdmin |
| Create Expense | `/accounting` (dialog) | `POST /expenses` | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Approve/Reject Expense | `/accounting` | `POST /expenses/:id/approve\|reject` | Accountant, TenantAdmin, SystemAdmin |
| Wages | `/accounting` | `GET/POST /wages` | Accountant, TenantAdmin, SystemAdmin |

### 4.6 Reports

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| ----------- | --------------- | -------------- | --------------- |
| Operational Reports | `/reports` | `GET /reports/cases-by-*`, `GET /reports/overdue-tasks`, etc. | Lawyer, Accountant, TenantAdmin, SystemAdmin |
| Financial Reports | `/reports` | `GET /reports/receivables`, `GET /reports/cashflow`, etc. | Lawyer (limited), Accountant, TenantAdmin, SystemAdmin |
| CSV Export | `/reports` | `GET /reports/:type/export` | Lawyer (limited), Accountant, TenantAdmin, SystemAdmin + StepUp |

### 4.7 Admin

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| ----------- | --------------- | -------------- | --------------- |
| User Management | `/admin` | `GET/POST/PATCH /admin/users` | TenantAdmin, SystemAdmin |
| Master Data | `/admin` | `GET/POST/PATCH /admin/master-data/:cat` | TenantAdmin, SystemAdmin |
| Case Types | `/admin` | `GET/POST/PATCH /admin/case-types` | TenantAdmin, SystemAdmin |
| Expense Workflow | `/admin` | `GET/POST /admin/expense-approval-workflow` | TenantAdmin, SystemAdmin |
| Tenant Settings | `/admin` | `GET/PATCH /admin/settings` | TenantAdmin, SystemAdmin |

### 4.8 Other

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| ----------- | --------------- | -------------- | --------------- |
| Global Search | `/search` | `GET /search` | All authenticated |
| Notifications | `/notifications` | `GET /notifications`, `PATCH /notifications/:id/read` | All authenticated |
| Audit Log | `/admin` (tab) | `GET /audit` | TenantAdmin, SystemAdmin |

### 4.9 Calendar (Phase 2)

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| --- | --- | --- | --- |
| Calendar View | `/calendar` | `GET /calendar/events` | All authenticated |
| Event Detail | `/calendar/:eventId` | `GET /calendar/events/:eventId` | All authenticated |
| Create Event | `/calendar` (dialog) | `POST /calendar/events` | All authenticated |
| Edit Event | `/calendar/:eventId` (dialog) | `PATCH /calendar/events/:eventId` | Owner, TenantAdmin, SystemAdmin |
| Delete Event | `/calendar/:eventId` | `DELETE /calendar/events/:eventId` | Owner, TenantAdmin, SystemAdmin |
| Conflict Check | `/calendar` (inline) | `GET /calendar/events/conflicts` | All authenticated |

### 4.10 Hearings (Phase 2)

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| --- | --- | --- | --- |
| Hearing List | `/cases/:caseId/hearings` | `GET /cases/:caseId/hearings` | Lawyer (membership), TenantAdmin, SystemAdmin |
| Hearing Detail | `/hearings/:hearingId` | `GET /hearings/:hearingId` | Lawyer (membership), TenantAdmin, SystemAdmin |
| Create Hearing | `/cases/:caseId/hearings` (dialog) | `POST /cases/:caseId/hearings` | Lawyer, TenantAdmin, SystemAdmin |
| Transition Hearing | `/hearings/:hearingId` | `POST /hearings/:hearingId/transition` | Lawyer, TenantAdmin, SystemAdmin |
| Reschedule Hearing | `/hearings/:hearingId` | `POST /hearings/:hearingId/reschedule` | Lawyer, TenantAdmin, SystemAdmin |
| Cancel Hearing | `/hearings/:hearingId` | `POST /hearings/:hearingId/transition` (cancel) | TenantAdmin, SystemAdmin |

### 4.11 Folders & Document Library (Phase 2)

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| --- | --- | --- | --- |
| Document Library | `/documents` | `GET /folders`, `GET /documents` | All authenticated |
| Folder Detail | `/documents?folderId=:id` | `GET /folders/:folderId` | Lawyer (membership), TenantAdmin, SystemAdmin |
| Create Folder | `/documents` (dialog) | `POST /folders` | Lawyer, TenantAdmin, SystemAdmin |
| Move Folder | `/documents` (drag) | `POST /folders/:folderId/move` | Lawyer, TenantAdmin, SystemAdmin |
| Delete Folder | `/documents` (context) | `DELETE /folders/:folderId` | TenantAdmin, SystemAdmin |

### 4.12 Document Templates (Phase 2)

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| --- | --- | --- | --- |
| Template List | `/admin/templates` | `GET /templates` | TenantAdmin, SystemAdmin |
| Template Editor | `/admin/templates/:id` | `GET/PATCH /templates/:id` | TenantAdmin, SystemAdmin |
| Preview Template | `/admin/templates/:id` (panel) | `POST /templates/:id/preview` | TenantAdmin, SystemAdmin |
| Generate Document | `/documents` (dialog) | `POST /templates/:id/generate` | Lawyer, TenantAdmin, SystemAdmin |

### 4.13 Time Tracking (Phase 2)

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| --- | --- | --- | --- |
| Timesheet | `/time-tracking` | `GET /time-entries` | All authenticated |
| Time Entry Detail | `/time-tracking/:id` | `GET /time-entries/:id` | Owner, Accountant, TenantAdmin, SystemAdmin |
| Create Time Entry | `/time-tracking` (dialog) | `POST /time-entries` | Lawyer, Accountant, TenantAdmin |
| Submit Time Entry | `/time-tracking` | `POST /time-entries/:id/submit` | Owner |
| Approval Queue | `/time-tracking/approvals` | `GET /time-entries?status=Submitted` | Accountant, TenantAdmin, SystemAdmin |
| Bulk Approve | `/time-tracking/approvals` | `POST /time-entries/bulk-approve` | Accountant, TenantAdmin, SystemAdmin |
| Reject Entry | `/time-tracking/approvals` | `POST /time-entries/:id/reject` | Accountant, TenantAdmin, SystemAdmin |

### 4.14 Courts & Judges (Phase 2)

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| --- | --- | --- | --- |
| Court List | `/admin/courts` | `GET /courts` | TenantAdmin, SystemAdmin (manage); Lawyer (view) |
| Court Detail | `/admin/courts/:id` | `GET /courts/:id` | TenantAdmin, SystemAdmin |
| Create Court | `/admin/courts` (dialog) | `POST /courts` | TenantAdmin, SystemAdmin |
| Judge List | `/admin/courts/:id/judges` | `GET /courts/:id/judges` | TenantAdmin, SystemAdmin (manage); Lawyer (view) |
| Deactivate Judge | `/admin/courts/:id/judges` | `POST /judges/:judgeId/deactivate` | TenantAdmin, SystemAdmin |

### 4.15 Notification Preferences (Phase 2)

| UI Screen | Frontend Route | API Endpoint | Allowed Roles |
| --- | --- | --- | --- |
| Notification Preferences | `/settings/notifications` | `GET/PATCH /notifications/subscriptions` | All authenticated |

---

## 5. Step-Up Auth Requirements

| Action | Endpoint | Guard |
| -------- | ---------- | ------- |
| Break document lock | `POST /documents/:id/break-lock` | StepUpGuard |
| Set legal hold | `POST /documents/:id/legal-hold` | StepUpGuard |
| Remove legal hold | `DELETE /documents/:id/legal-hold` | StepUpGuard |
| Export wages CSV | `GET /wages/export` | StepUpGuard |
| Export report CSV | `GET /reports/:type/export` | StepUpGuard |
| Cancel hearing (irreversible) | `POST /hearings/:id/transition` (cancel) | StepUpGuard |
| Bulk approve time entries | `POST /time-entries/bulk-approve` | StepUpGuard |
| Delete folder (with contents) | `DELETE /folders/:id` | StepUpGuard |

---

## 6. Guard Stack

| Guard | Layer | Purpose |
| ------- | ------- | --------- |
| `JwtAuthGuard` | Class-level on all controllers | Validates JWT, extracts user |
| `OidcGuard` | Class-level (Phase 2) | Validates OIDC JWT via JWKS; maps `tenant_id` claim |
| `RolesGuard` | Class or method-level | Checks `@Roles(...)` metadata against `user.roles` |
| `StepUpGuard` | Method-level where needed | Requires `user.stepUp === true` on JWT |
| `TenantGuard` | Service layer (tenantSlug filter) | Ensures data isolation per tenant |
| `FolderAclGuard` | Method-level (Phase 2) | Evaluates folder permission inheritance chain |

---

## 6.1 OIDC Authentication Flow (Phase 2)

### 6.1.1 Flow
1. SPA redirects to OIDC IdP `/authorize` endpoint with `response_type=code`, `code_challenge` (PKCE S256), `scope=openid profile email tenant`.
2. User authenticates at IdP (username/password, MFA if configured).
3. IdP redirects back to SPA callback route with authorization `code`.
4. SPA exchanges `code` + `code_verifier` at IdP `/token` endpoint.
5. IdP returns: `access_token` (JWT, ≤ 15 min), `id_token`, `refresh_token`.
6. SPA stores `access_token` in memory (never localStorage); `refresh_token` in HTTP-only secure cookie.
7. Backend validates `access_token` JWT: signature (JWKS), `iss`, `aud`, `exp`, `tenant_id` custom claim.

### 6.1.2 Token Handling
- **Access token:** Short-lived (≤ 15 min). Attached as `Authorization: Bearer` header.
- **Refresh token:** Rotated on each use; previous token invalidated.
- **ID token:** Used client-side only for display (name, email). Not sent to backend.

### 6.1.3 Session Management
- Silent refresh: SPA proactively refreshes token before expiry (at 75% lifetime).
- Logout: `POST /auth/logout` revokes refresh token at IdP + clears cookie.
- Forced logout: If refresh fails (revoked/expired), redirect to IdP login.
- Dev mode: JWT dev login retained behind `AUTH_MODE=dev` env flag for local development only.

---

## 7. 401 vs 403 Semantics

| HTTP Status | Meaning | When |
| ------------ | --------- | ------ |
| 401 Unauthorized | Authentication failure | Missing/expired/invalid JWT |
| 403 Forbidden | Authorization failure | Valid JWT but user lacks required role or ABAC condition |
| 403 + `stepUpRequired: true` | Step-up needed | Valid JWT but missing step-up for sensitive action |

---

## 8. Remediation Verification (2026-02-24)

### 8.1 Authorization Semantics (runtime)

| Check | Expected | Actual |
|---|---:|---:|
| `GET /customers` (no token) | 401 | 401 |
| `GET /customers` (Lawyer) | 200 | 200 |
| `POST /customers` (Accountant) | 403 | 403 |
| `GET /customers` (Accountant) | 200 | 200 |
| `GET /admin/users` (Lawyer) | 403 | 403 |
| `GET /admin/users` (TenantAdmin) | 200 | 200 |
| `GET /cases` (Lawyer) | 200 | 200 |
| `GET /documents` (Lawyer) | 200 | 200 |

### 8.2 Automated Security Regression

- `backend` e2e permission matrix is green after remediation.
- Result: `Test Suites: 4 passed, 4 total` and `Tests: 62 passed, 62 total`.

### 8.3 Key Fixes Mapped to Security Controls

- JWT identity normalization (`sub` restored in validated principal) to keep actor identity consistent across guards/audit.
- Tenant query execution moved from Prisma raw multi-command statements to transaction-scoped `pg` client with `SET LOCAL search_path`, preventing schema bleed and 500s.
- Frontend role gating + direct route protection consolidated through `ProtectedRoute` redirection to `/403` and capability checks for create/detail entry points.
- API route parity repaired between frontend API clients and backend controllers, including missing customer/case contract endpoints.
