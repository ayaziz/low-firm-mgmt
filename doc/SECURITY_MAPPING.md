# Security Mapping — LOMA Wave 1 MVP

**Version:** 1.0  
**Date:** 2025-07-13

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

---

## 5. Step-Up Auth Requirements

| Action | Endpoint | Guard |
| -------- | ---------- | ------- |
| Break document lock | `POST /documents/:id/break-lock` | StepUpGuard |
| Set legal hold | `POST /documents/:id/legal-hold` | StepUpGuard |
| Remove legal hold | `DELETE /documents/:id/legal-hold` | StepUpGuard |
| Export wages CSV | `GET /wages/export` | StepUpGuard |
| Export report CSV | `GET /reports/:type/export` | StepUpGuard |

---

## 6. Guard Stack

| Guard | Layer | Purpose |
| ------- | ------- | --------- |
| `JwtAuthGuard` | Class-level on all controllers | Validates JWT, extracts user |
| `RolesGuard` | Class or method-level | Checks `@Roles(...)` metadata against `user.roles` |
| `StepUpGuard` | Method-level where needed | Requires `user.stepUp === true` on JWT |
| `TenantGuard` | Service layer (tenantSlug filter) | Ensures data isolation per tenant |

---

## 7. 401 vs 403 Semantics

| HTTP Status | Meaning | When |
| ------------ | --------- | ------ |
| 401 Unauthorized | Authentication failure | Missing/expired/invalid JWT |
| 403 Forbidden | Authorization failure | Valid JWT but user lacks required role or ABAC condition |
| 403 + `stepUpRequired: true` | Step-up needed | Valid JWT but missing step-up for sensitive action |
