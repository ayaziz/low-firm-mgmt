# Backend Codebase Inventory

> **Generated**: Research-only audit of every NestJS module, route, service method, DTO,
> guard, middleware, interceptor, Prisma model, migration, seed file, and tenant-schema table.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module → Routes → Services → DTOs Map](#2-module-map)
3. [Middleware, Guards & Interceptors](#3-middleware-guards-interceptors)
4. [Prisma Schema Models (Platform)](#4-prisma-schema-models)
5. [Tenant-Schema Tables (Phase 1)](#5-tenant-schema-tables-phase-1)
6. [Phase 2 Migration (New Tables & Alterations)](#6-phase-2-migration)
7. [Seed Data](#7-seed-data)
8. [Gaps, Risks & Observations](#8-gaps-risks-observations)

---

## 1. Architecture Overview

| Aspect | Detail |
|---|---|
| Framework | NestJS (TypeScript) |
| ORM / DB | Prisma (platform tables) + raw pg Pool (tenant tables) — PostgreSQL |
| Multi-tenancy | Schema-per-tenant (`tenant_{slug}`) via `SET LOCAL search_path` inside transaction |
| Auth | JWT (dev-only: cookie-less Bearer token via `ExtractJwt.fromAuthHeaderAsBearerToken()`) |
| Roles | `Lawyer`, `Accountant`, `TenantAdmin`, `SystemAdmin` |
| Object Storage | MinIO / S3-compatible (@aws-sdk/client-s3) |
| Queue | BullMQ + Redis (queues: `document-scan`, `document-ocr`) |
| Logging | Winston (nest-winston), JSON structured, service `loma-backend` |
| Rate Limiting | @nestjs/throttler — 3 tiers: 20 req/s, 200 req/min, 5000 req/hr |
| API prefix | `api/v1` (global) |
| Swagger | `/api/v1/docs` |
| Template engine | Handlebars (document templates) |
| PDF | pdfkit (invoice PDFs) |
| Port | 4000 |

### State Machines (defined in `common/types.ts`)

**Case states** — `VALID_STATE_TRANSITIONS`:
```
Intake → Open → Active → Pending | Closed → Archived
```

**Hearing statuses** — `VALID_HEARING_TRANSITIONS`:
```
Scheduled → Completed | Postponed | Cancelled
Postponed → Scheduled | Cancelled
```

**Time-entry statuses** — `VALID_TIME_ENTRY_TRANSITIONS`:
```
Draft → Submitted → Approved | Draft
Approved → Billed | WriteOff
```

---

## 2. Module Map

### 2.1 Accounting Module

**Controller**: `@Controller()` (no route prefix — routes are at root)
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Extra Guards | Controller Method |
|---|--------|-------|-------|-------------|-------------------|
| 1 | POST | `/invoices` | Lawyer, TenantAdmin | — | `createInvoice` |
| 2 | GET | `/invoices` | Lawyer, Accountant, TenantAdmin | — | `listInvoices` |
| 3 | GET | `/invoices/:id` | Lawyer, Accountant, TenantAdmin | — | `getInvoice` |
| 4 | POST | `/invoices/:id/finalize` | Accountant, TenantAdmin | — | `finalizeInvoice` |
| 5 | POST | `/invoices/:id/send` | Accountant, TenantAdmin | — | `markInvoiceSent` |
| 6 | POST | `/invoices/:id/void` | TenantAdmin | — | `voidInvoice` |
| 7 | GET | `/invoices/:id/pdf` | Lawyer, Accountant, TenantAdmin | — | `getInvoicePdf` |
| 8 | POST | `/payments` | Accountant, TenantAdmin | — | `createPayment` |
| 9 | POST | `/expenses` | Lawyer, Accountant, TenantAdmin | — | `createExpense` |
| 10 | GET | `/expenses` | Lawyer, Accountant, TenantAdmin | — | `listExpenses` |
| 11 | POST | `/expenses/:id/approve` | Accountant, TenantAdmin | — | `approveExpense` |
| 12 | POST | `/expenses/:id/reject` | Accountant, TenantAdmin | — | `rejectExpense` |
| 13 | POST | `/wages` | TenantAdmin | — | `createWage` |
| 14 | GET | `/wages` | Accountant, TenantAdmin | — | `listWages` |
| 15 | GET | `/wages/export` | TenantAdmin | `StepUpGuard` | `exportWagesCsv` |

**Service Methods** (`AccountingService` — ~654 lines):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `createInvoice(slug, dto, userId)` | INSERT invoices, invoice_line_items; SELECT case check; `lawyerCanDraft` tenant setting gate | INV-YYYY-SEQ sequence; discount/tax calculation |
| `getInvoiceById(slug, id)` | SELECT invoices JOIN invoice_line_items + payments | — |
| `listInvoices(slug, query)` | SELECT invoices with ILIKE, status, caseId, dateRange filters; cursor pagination | — |
| `finalizeInvoice(slug, id, userId)` | UPDATE invoices (Draft→Finalized); INSERT audit_events | Transition guard |
| `markInvoiceSent(slug, id, userId)` | UPDATE invoices (Finalized→Sent); INSERT audit_events | — |
| `voidInvoice(slug, id, dto, userId)` | UPDATE invoices (→Voided); INSERT audit_events | Stores void reason |
| `generateInvoicePdf(slug, id)` | SELECT full invoice data | pdfkit rendering with line items, totals, payment summary |
| `createPayment(slug, dto, userId)` | SELECT idempotency_records; INSERT payments, idempotency_records; UPDATE invoices (→Paid if balance=0); INSERT audit_events | Idempotent; overpayment guard |
| `createExpense(slug, dto, userId)` | INSERT expenses; SELECT expense_approval_workflows | Sets initial step=1 |
| `listExpenses(slug, query)` | SELECT expenses; cursor pagination | — |
| `approveExpense(slug, id, userId)` | INSERT expense_approvals; UPDATE expenses (step++ or →Approved); INSERT audit_events | Multi-step workflow |
| `rejectExpense(slug, id, dto, userId)` | INSERT expense_approvals; UPDATE expenses (→Rejected); INSERT audit_events | — |
| `createWage(slug, dto, userId)` | INSERT wages; INSERT audit_events | — |
| `listWages(slug, query)` | SELECT wages | — |
| `exportWagesCsv(slug, query)` | SELECT wages; INSERT audit_events | Returns CSV string |

**DTOs**:

| DTO | Fields | Validators |
|-----|--------|-----------|
| `InvoiceLineItemDto` | `description: string`, `quantity: number`, `unitPrice: number` | IsString+IsNotEmpty, IsNumber+Min(0.01) ×2 |
| `CreateInvoiceDto` | `caseId: string`, `customerId: string`, `lineItems: InvoiceLineItemDto[]`, `notes?: string`, `discountPercent?: number`, `taxPercent?: number`, `dueDate?: string` | IsUUID ×2, ValidateNested+Type, IsOptional+IsString, IsOptional+IsNumber+Min(0)+Max(100) ×2, IsOptional+IsDateString |
| `VoidInvoiceDto` | `reason: string` | IsString+IsNotEmpty |
| `CreatePaymentDto` | `invoiceId: string`, `amount: number`, `method: string`, `reference?: string`, `idempotencyKey: string` | IsUUID, IsNumber+Min(0.01), IsString+IsNotEmpty, IsOptional+IsString, IsString+IsNotEmpty |
| `CreateExpenseDto` | `caseId: string`, `category: string`, `amount: number`, `description: string`, `receiptUrl?: string` | IsUUID, IsString, IsNumber+Min(0.01), IsString, IsOptional+IsString |
| `ApproveExpenseDto` | `comments?: string` | IsOptional+IsString |
| `RejectExpenseDto` | `reason: string` | IsString+IsNotEmpty |
| `CreateWageDto` | `userId: string`, `month: string`, `baseSalary: number`, `allowances?: number`, `deductions?: number`, `notes?: string` | IsUUID, IsString+Matches(YYYY-MM), IsNumber+Min(0), IsOptional+IsNumber+Min(0) ×2, IsOptional+IsString |

---

### 2.2 Admin Module

**Controller**: `@Controller('admin')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/admin/users` | TenantAdmin, SystemAdmin | `createUser` |
| 2 | GET | `/admin/users` | TenantAdmin, SystemAdmin | `listUsers` |
| 3 | PATCH | `/admin/users/:userId` | TenantAdmin, SystemAdmin | `updateUser` |
| 4 | GET | `/admin/master-data/:category` | ALL | `getMasterData` |
| 5 | POST | `/admin/master-data/:category` | TenantAdmin, SystemAdmin | `createMasterData` |
| 6 | PATCH | `/admin/master-data/:category/:id` | TenantAdmin, SystemAdmin | `updateMasterData` |
| 7 | GET | `/admin/case-types` | ALL | `getCaseTypes` |
| 8 | POST | `/admin/case-types` | TenantAdmin, SystemAdmin | `createCaseType` |
| 9 | PATCH | `/admin/case-types/:id` | TenantAdmin, SystemAdmin | `updateCaseType` |
| 10 | GET | `/admin/expense-approval-workflow` | Accountant, TenantAdmin | `getWorkflow` |
| 11 | POST | `/admin/expense-approval-workflow` | TenantAdmin | `saveWorkflow` |
| 12 | GET | `/admin/settings` | TenantAdmin, SystemAdmin | `getSettings` |
| 13 | PATCH | `/admin/settings` | TenantAdmin, SystemAdmin | `updateSettings` |
| 14 | GET | `/admin/retention-policies` | TenantAdmin, SystemAdmin | `getRetentionPolicies` |
| 15 | POST | `/admin/retention-policies` | TenantAdmin, SystemAdmin | `upsertRetentionPolicy` |
| 16 | GET | `/admin/courts` | ALL | `listCourts` |
| 17 | POST | `/admin/courts` | TenantAdmin, SystemAdmin | `createCourt` |
| 18 | PATCH | `/admin/courts/:id` | TenantAdmin, SystemAdmin | `updateCourt` |

**Service Methods** (`AdminService`):

| Method | DB Operations |
|--------|--------------|
| `createUser(tenantId, slug, dto)` | Prisma: `user.create`; raw SQL: INSERT users (tenant schema) |
| `listUsers(slug)` | Prisma: `user.findMany` (by tenantId, isActive) |
| `updateUser(slug, userId, dto)` | Prisma: `user.update` |
| `getMasterData(slug, category)` | SELECT master_data WHERE category |
| `createMasterData(slug, category, dto)` | INSERT master_data |
| `updateMasterData(slug, category, id, dto)` | UPDATE master_data |
| `getCaseTypes(slug)` | SELECT case_types |
| `createCaseType(slug, dto)` | INSERT case_types |
| `updateCaseType(slug, id, dto)` | UPDATE case_types |
| `getExpenseApprovalWorkflow(slug)` | SELECT expense_approval_workflows ORDER BY step_order |
| `saveExpenseApprovalWorkflow(slug, dto)` | DELETE all + INSERT expense_approval_workflows (replace) |
| `getSettings(slug)` | Prisma: `tenant.findUnique` |
| `updateSettings(slug, dto)` | Prisma: `tenant.update` |
| `getRetentionPolicies(slug)` | SELECT retention_policies |
| `upsertRetentionPolicy(slug, dto)` | INSERT ... ON CONFLICT (doc_type) DO UPDATE |
| `listCourts(slug)` | SELECT courts |
| `createCourt(slug, dto)` | INSERT courts |
| `updateCourt(slug, id, dto)` | UPDATE courts |

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateUserDto` | `email`, `displayName`, `roles[]`, `password`, `language?` |
| `UpdateUserDto` | `displayName?`, `roles?[]`, `isActive?`, `language?` |
| `CreateMasterDataDto` | `label_ar`, `label_en`, `is_active?` |
| `UpdateMasterDataDto` | `label_ar?`, `label_en?`, `is_active?` |
| `WorkflowStepDto` | `step_order`, `role`, `min_amount`, `max_amount?` |
| `SaveExpenseWorkflowDto` | `steps: WorkflowStepDto[]` |
| `UpdateTenantSettingsDto` | `name?`, `currency?`, `timezone?`, `locale?`, `lawyerCanDraft?` |
| `UpsertRetentionPolicyDto` | `doc_type`, `retention_days`, `action` (Archive\|Delete) |
| `CreateCourtDto` | `name`, `court_type`, `address?`, `phone?`, `jurisdiction?` |
| `UpdateCourtDto` | `name?`, `court_type?`, `address?`, `phone?`, `jurisdiction?`, `is_active?` |

**VALID_CATEGORIES** (10): `case_category`, `document_type`, `filing_type`, `communication_channel`, `task_priority`, `session_type`, `note_category`, `payment_method`, `expense_category`, `party_role`

---

### 2.3 Audit Module

**Controller**: `@Controller('audit')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | GET | `/audit` | TenantAdmin, SystemAdmin | `getAuditLog` |
| 2 | GET | `/audit/entity` | ALL | `getEntityAudit` |

**Service Methods**:

| Method | DB Operations |
|--------|--------------|
| `log(slug, event)` | INSERT audit_events |
| `getByEntity(slug, entityType, entityId)` | SELECT audit_events WHERE entity_type AND entity_id |
| `getByTenant(slug, filters)` | SELECT audit_events; cursor pagination; filters: actor_id, action, entity_type, from/to dates |

---

### 2.4 Auth Module

**Controller**: `@Controller('auth/dev')`  
**Guards**: None class-level (per-route)

| # | Method | Route | Guards | Controller Method |
|---|--------|-------|--------|-------------------|
| 1 | POST | `/auth/dev/login` | None | `devLogin` |
| 2 | POST | `/auth/dev/step-up` | `JwtAuthGuard` | `devStepUp` |

**Service Methods** (`AuthService`):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `devLogin(email)` | Prisma: `user.findFirst` (includes tenant) | Returns JWT: `{sub, email, tenantId, tenantSlug, roles, displayName}` |
| `devStepUp(user)` | None | Returns JWT with `stepUp: true`, 5 min expiry |
| `validateUser(payload: JwtPayload)` | Prisma: `user.findUnique` | Returns null if user inactive or not found |

**Guards** (src/auth/):

| Guard | Type | Behavior |
|-------|------|----------|
| `JwtAuthGuard` | `AuthGuard('jwt')` | Passport JWT strategy; extracts Bearer token from `Authorization` header |
| `JwtStrategy` | `PassportStrategy` | Validates JWT, calls `authService.validateUser`; secret: `JWT_SECRET` env or hardcoded dev key |
| `RolesGuard` | `CanActivate` | Reads `@Roles()` metadata; throws 403 if user lacks required role |
| `StepUpGuard` | `CanActivate` | Reads `@RequireStepUp()` metadata; throws 403 if `user.stepUp` is falsy |
| `TenantGuard` | `CanActivate` (global) | Skips unauthenticated requests; throws 403 if `user.tenantSlug` missing |

---

### 2.5 Calendar Module

**Controller**: `@Controller('calendar')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/calendar/events` | Lawyer, TenantAdmin | `createEvent` |
| 2 | GET | `/calendar/events` | ALL | `listEvents` |
| 3 | GET | `/calendar/my-events` | ALL | `getMyEvents` |
| 4 | GET | `/calendar/events/:id` | ALL | `getEvent` |
| 5 | PATCH | `/calendar/events/:id` | Lawyer, TenantAdmin | `updateEvent` |
| 6 | DELETE | `/calendar/events/:id` | Lawyer, TenantAdmin | `deleteEvent` |
| 7 | POST | `/calendar/events/:id/attendees` | Lawyer, TenantAdmin | `addAttendee` |
| 8 | PATCH | `/calendar/events/:id/rsvp` | ALL | `updateRsvp` |
| 9 | POST | `/calendar/events/:id/reminders` | Lawyer, TenantAdmin | `addReminder` |

**Service Methods** (`CalendarService`):

| Method | DB Operations |
|--------|--------------|
| `create(slug, dto, userId)` | INSERT calendar_events; INSERT calendar_event_attendees (creator); INSERT calendar_reminders; INSERT notifications; conflict detection via overlapping range query |
| `list(slug, query)` | SELECT calendar_events; filters: startDate, endDate, caseId, eventType; ORDER BY start_at |
| `getMyEvents(slug, userId, query)` | SELECT via JOIN calendar_event_attendees WHERE user_id; same date filters |
| `getById(slug, id)` | SELECT calendar_events + attendees (JOIN users for display_name/email) + reminders |
| `update(slug, id, dto, userId)` | UPDATE calendar_events; INSERT notifications |
| `addAttendee(slug, eventId, dto, userId)` | INSERT calendar_event_attendees; INSERT notifications |
| `updateRsvp(slug, eventId, dto, userId)` | UPDATE calendar_event_attendees SET rsvp |
| `addReminder(slug, eventId, dto)` | INSERT calendar_reminders |
| `deleteEvent(slug, id, userId)` | UPDATE calendar_events SET status='Cancelled'; INSERT notifications |

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateCalendarEventDto` | `title`, `description?`, `startAt` (ISO), `endAt` (ISO), `allDay?`, `eventType` (enum), `caseId?`, `hearingId?`, `sessionId?`, `taskId?`, `location?`, `recurrence?` (enum), `recurrenceEndDate?`, `recurrenceRule?`, `attendeeUserIds?[]`, `reminders?[]` (minutesBefore + channel) |
| `UpdateCalendarEventDto` | All of above optional |
| `AddAttendeeDto` | `userId` |
| `UpdateRsvpDto` | `rsvp` (Accepted\|Declined\|Tentative) |
| `AddReminderDto` | `minutesBefore`, `channel` (InApp\|Email) |

---

### 2.6 Case Module

**Controller**: `@Controller('cases')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/cases` | Lawyer, TenantAdmin | `createCase` |
| 2 | GET | `/cases` | ALL | `listCases` |
| 3 | GET | `/cases/:id` | ALL | `getCase` |
| 4 | POST | `/cases/:id/transition` | Lawyer, TenantAdmin | `transitionCase` |
| 5 | POST | `/cases/:id/on-hold` | Lawyer, TenantAdmin | `setOnHold` |
| 6 | DELETE | `/cases/:id/on-hold` | Lawyer, TenantAdmin | `removeOnHold` |
| 7 | POST | `/cases/:id/reopen` | TenantAdmin | `reopenCase` |
| 8 | GET | `/cases/:id/completeness` | ALL | `getCompleteness` |
| 9 | POST | `/cases/:id/memberships` | Lawyer, TenantAdmin | `addMembership` |
| 10 | GET | `/cases/:id/memberships` | ALL | `getMemberships` |
| 11 | DELETE | `/cases/:id/memberships/:userId` | TenantAdmin | `removeMembership` |
| 12 | POST | `/cases/:id/tasks` | Lawyer, TenantAdmin | `createTask` |
| 13 | PATCH | `/cases/:id/tasks/:taskId` | Lawyer, TenantAdmin | `updateTask` |
| 14 | GET | `/cases/:id/tasks` | ALL | `listTasks` |
| 15 | POST | `/cases/:id/sessions` | Lawyer, TenantAdmin | `createSession` |
| 16 | PATCH | `/cases/:id/sessions/:sessionId` | Lawyer, TenantAdmin | `updateSession` |
| 17 | POST | `/cases/:id/sessions/:sessionId/reschedule` | Lawyer, TenantAdmin | `rescheduleSession` |
| 18 | GET | `/cases/:id/sessions` | ALL | `listSessions` |
| 19 | POST | `/cases/:id/notes` | ALL | `createNote` |
| 20 | GET | `/cases/:id/notes` | ALL | `listNotes` |
| 21 | POST | `/cases/:id/filings` | Lawyer, TenantAdmin | `createFiling` |
| 22 | PATCH | `/cases/:id/filings/:filingId` | Lawyer, TenantAdmin | `updateFiling` |
| 23 | GET | `/cases/:id/filings` | ALL | `listFilings` |
| 24 | POST | `/cases/:id/communications` | ALL | `createCommunication` |
| 25 | GET | `/cases/:id/communications` | ALL | `listCommunications` |
| 26 | POST | `/cases/:id/parties` | Lawyer, TenantAdmin | `addParty` |
| 27 | GET | `/cases/:id/parties` | ALL | `listParties` |

**Service Methods** (`CaseService` — ~600 lines):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `createCase` | INSERT cases, case_sequences, case_customers, case_memberships; INSERT audit_events | CASE-YYYY-SEQ sequence; auto-membership for creator |
| `listCases` | SELECT cases JOIN case_types; filters: state, caseTypeId, customerId, search (ILIKE title/reference_number); cursor pagination | — |
| `getCaseById` | SELECT cases JOIN case_types; SELECT case_customers, case_memberships, tasks, sessions, notes, documents, invoices | Full aggregate |
| `transitionCase` | UPDATE cases SET state; INSERT audit_events | VALID_STATE_TRANSITIONS enforcement |
| `setOnHold / removeOnHold` | UPDATE cases SET on_hold / on_hold_reason | — |
| `reopenCase` | UPDATE cases SET state='Active'; INSERT audit_events | From Closed only |
| `addMembership / removeMembership` | INSERT / DELETE case_memberships | Duplicate check |
| `getMemberships` | SELECT case_memberships JOIN users | — |
| `createTask / updateTask / listTasks` | INSERT / UPDATE / SELECT tasks | Status, priority, due_date, assignee |
| `createSession / updateSession / rescheduleSession / listSessions` | INSERT / UPDATE / INSERT session_reschedules / SELECT sessions | Reschedule tracks old/new date+reason |
| `createNote / listNotes` | INSERT / SELECT notes | — |
| `createFiling / updateFiling / listFilings` | INSERT / UPDATE / SELECT filings | — |
| `createCommunication / listCommunications` | INSERT / SELECT communications | — |
| `addParty / listParties` | INSERT case_parties / SELECT case_parties JOIN parties | — |

**Completeness Service** (`CompletenessService`):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `calculateCompleteness(slug, caseId)` | SELECT case, case_doc_requirements (fulfilled vs total), case_memberships, case_customers | Weighted: 40% fields, 40% docs, 20% participants; returns `CompletenessResult` |

**DTOs** (13 classes): `CreateCaseDto`, `TransitionCaseDto`, `SetOnHoldDto`, `ReopenCaseDto`, `CreateMembershipDto`, `CreateTaskDto`, `UpdateTaskDto`, `CreateSessionDto`, `UpdateSessionDto`, `RescheduleSessionDto`, `CreateNoteDto`, `CreateFilingDto`, `UpdateFilingDto`, `CreateCommunicationDto`, `AddCasePartyDto`

---

### 2.7 Court Module

**Controller**: `@Controller('courts')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/courts` | TenantAdmin | `createCourt` |
| 2 | GET | `/courts` | ALL | `listCourts` |
| 3 | GET | `/courts/:id` | ALL | `getCourt` |
| 4 | PATCH | `/courts/:id` | TenantAdmin | `updateCourt` |
| 5 | POST | `/courts/judges` | TenantAdmin | `createJudge` |
| 6 | GET | `/courts/judges` | ALL | `listJudges` |
| 7 | GET | `/courts/judges/:id` | ALL | `getJudge` |
| 8 | PATCH | `/courts/judges/:id` | TenantAdmin | `updateJudge` |

**Service Methods** (`CourtService`):

| Method | DB Operations |
|--------|--------------|
| `createCourt` | INSERT courts; INSERT audit_events |
| `listCourts(slug, query)` | SELECT courts + subquery `activeJudgeCount`; filters: court_type, is_active, search (ILIKE name/address) |
| `getCourtById` | SELECT courts |
| `updateCourt` | UPDATE courts; INSERT audit_events |
| `createJudge` | INSERT judges; INSERT audit_events |
| `listJudges(slug, query)` | SELECT judges JOIN courts (court_name); filters: court_id, is_active, search |
| `getJudgeById` | SELECT judges JOIN courts |
| `updateJudge` | UPDATE judges; INSERT audit_events |

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateCourtDto` | `name`, `court_type`, `address?`, `phone?`, `jurisdiction?`, `department?`, `circuit?`, `jurisdiction_level?`, `city?` |
| `UpdateCourtDto` | All optional + `is_active?` |
| `CreateJudgeDto` | `court_id`, `full_name`, `title?`, `specialization?`, `phone?`, `email?` |
| `UpdateJudgeDto` | All optional + `is_active?` |

---

### 2.8 Customer Module

**Controller**: `@Controller('customers')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/customers` | Lawyer, TenantAdmin | `createCustomer` |
| 2 | GET | `/customers` | ALL | `listCustomers` |
| 3 | GET | `/customers/:customerId` | ALL | `getCustomer` |
| 4 | PATCH | `/customers/:customerId` | Lawyer, TenantAdmin | `updateCustomer` |
| 5 | POST | `/customers/:customerId/contacts` | Lawyer, TenantAdmin | `addContact` |
| 6 | PATCH | `/customers/:customerId/contacts/:contactId` | Lawyer, TenantAdmin | `updateContact` |
| 7 | DELETE | `/customers/:customerId/contacts/:contactId` | TenantAdmin | `deleteContact` |
| 8 | POST | `/customers/:customerId/addresses` | Lawyer, TenantAdmin | `addAddress` |
| 9 | PATCH | `/customers/:customerId/addresses/:addressId` | Lawyer, TenantAdmin | `updateAddress` |
| 10 | DELETE | `/customers/:customerId/addresses/:addressId` | TenantAdmin | `deleteAddress` |
| 11 | GET | `/customers/:customerId/financial-summary` | Accountant, TenantAdmin | `getFinancialSummary` |
| 12 | GET | `/customers/:customerId/compliance-checklist` | ALL | `getComplianceChecklist` |
| 13 | PATCH | `/customers/:customerId/compliance-checklist` | Lawyer, TenantAdmin | `updateComplianceChecklist` |
| 14 | POST | `/customers/:customerId/communications` | ALL | `createCommunication` |
| 15 | GET | `/customers/:customerId/communications` | ALL | `listCommunications` |

**Service Methods** (`CustomerService` — ~370 lines):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `create` | INSERT customers, contacts, addresses; SELECT checklist_templates; INSERT customer_checklists; INSERT audit_events | Identity validation: Org needs registration_id+tax_id; Individual needs national_id or passport. Uniqueness check. |
| `list` | SELECT customers; ILIKE on name/registration_id/national_id/passport | — |
| `getById` | SELECT customer + contacts + addresses + cases (via case_customers) | — |
| `update / addContact / updateContact / deleteContact / addAddress / updateAddress / deleteAddress` | Corresponding INSERT/UPDATE/DELETE | — |
| `getFinancialSummary` | SELECT invoices aggregate (total, paid, pending) + expenses aggregate + payments aggregate | Per customer |
| `getComplianceChecklist / updateComplianceChecklist` | SELECT / UPDATE customer_checklists | — |
| `createCommunication / listCommunications` | INSERT / SELECT communications WHERE customer_id | — |

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateContactDto` | `full_name`, `phone?`, `email?`, `role?`, `is_primary?` |
| `CreateAddressDto` | `label?`, `street`, `city`, `state?`, `postal_code?`, `country`, `is_primary?` |
| `CreateCustomerDto` | `customer_type` (Individual\|Organization), `full_name`, `national_id?`, `passport_number?`, `registration_id?`, `tax_id?`, `email?`, `phone?`, `notes?`, `contacts?[]`, `addresses?[]` |
| `UpdateCustomerDto` | All optional |
| `CreateCustomerCommunicationDto` | `channel`, `direction`, `subject?`, `body`, `metadata?` |

---

### 2.9 Document Module

**Controller**: `@Controller('documents')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Extra Guards | Controller Method |
|---|--------|-------|-------|-------------|-------------------|
| 1 | POST | `/documents` | Lawyer, TenantAdmin | — | `upload` |
| 2 | GET | `/documents` | ALL | — | `listDocuments` |
| 3 | GET | `/documents/:id` | ALL | — | `getDocument` |
| 4 | GET | `/documents/:id/download` | ALL | — | `downloadDocument` |
| 5 | POST | `/documents/:id/checkout` | Lawyer, TenantAdmin | — | `checkout` |
| 6 | POST | `/documents/:id/checkin` | Lawyer, TenantAdmin | — | `checkin` |
| 7 | POST | `/documents/:id/break-lock` | TenantAdmin | `StepUpGuard` | `breakLock` |
| 8 | POST | `/documents/:id/share` | Lawyer, TenantAdmin | — | `shareDocument` |
| 9 | POST | `/documents/:id/legal-hold` | TenantAdmin | `StepUpGuard` | `setLegalHold` |
| 10 | DELETE | `/documents/:id/legal-hold` | TenantAdmin | `StepUpGuard` | `removeLegalHold` |
| 11 | DELETE | `/documents/:id` | Lawyer, TenantAdmin | — | `deleteDocument` |
| 12 | POST | `/documents/:id/restore` | TenantAdmin | — | `restoreDocument` |
| 13 | POST | `/documents/cases/:caseId/legal-hold` | TenantAdmin | `StepUpGuard` | `bulkLegalHold` |
| 14 | DELETE | `/documents/cases/:caseId/legal-hold` | TenantAdmin | `StepUpGuard` | `bulkRemoveLegalHold` |

**Service Methods** (`DocumentService` — ~250 lines):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `upload` | INSERT documents, document_versions; queue `document-scan` job | MIME/extension validation; presigned upload URL via StorageService |
| `listDocuments` | SELECT documents JOIN document_versions; filters: caseId, customerId, docType, search; HighlyConfidential ACL filter | Cursor pagination |
| `getDocument` | SELECT document + versions + acl + shares | ACL enforcement |
| `downloadDocument` | SELECT document; presigned download URL | ACL check |
| `checkout` | UPDATE documents SET checked_out_by, checked_out_at | 4hr auto-expire check |
| `checkin` | INSERT document_versions; UPDATE documents; queue scan | Ownership check |
| `breakLock` | UPDATE documents CLEAR checkout fields; INSERT audit_events | Requires StepUp |
| `shareDocument` | INSERT document_acl | — |
| `setLegalHold / removeLegalHold` | INSERT / DELETE legal_holds; INSERT audit_events | — |
| `deleteDocument / restoreDocument` | UPDATE SET is_deleted / CLEAR is_deleted | Soft delete; legal hold guard |
| `bulkLegalHold / bulkRemoveLegalHold` | Batch INSERT/DELETE legal_holds for all case documents | — |

**Storage Service** (`StorageService`):

| Method | Description |
|--------|-------------|
| `buildKey(tenantId, customerId, caseId, docType, docId, versionId)` | `tenants/{tenantId}/customers/{cId}/cases/{csId}/documents/{docType}/{docId}/versions/{vId}` |
| `getUploadUrl(bucket, key, contentType)` | PutObject presigned URL, 15 min |
| `getDownloadUrl(bucket, key, filename)` | GetObject presigned URL, 5 min |
| `deleteObject(bucket, key)` | DeleteObjectCommand |

Docker URL rewriting: replaces `minio:9000` ↔ `localhost:9000` for dev.

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateDocumentDto` | `caseId`, `customerId`, `title`, `filename`, `mimeType`, `docType`, `confidentiality?` (Standard\|Confidential\|HighlyConfidential), `folderId?` |
| `CheckinDocumentDto` | `filename`, `mimeType`, `changeNote?` |
| `ShareDocumentDto` | `userId`, `permission` (View\|Edit) |

---

### 2.10 Folder Module

**Controller**: `@Controller('folders')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/folders` | Lawyer, TenantAdmin | `createFolder` |
| 2 | GET | `/folders/case/:caseId` | ALL | `listByCase` |
| 3 | GET | `/folders/case/:caseId/tree` | ALL | `getTree` |
| 4 | GET | `/folders/:id` | ALL | `getFolder` |
| 5 | GET | `/folders/:id/documents` | ALL | `getDocuments` |
| 6 | PATCH | `/folders/:id` | Lawyer, TenantAdmin | `updateFolder` |
| 7 | POST | `/folders/:id/move` | Lawyer, TenantAdmin | `moveFolder` |
| 8 | POST | `/folders/move-document` | Lawyer, TenantAdmin | `moveDocument` |
| 9 | POST | `/folders/case/:caseId/defaults` | TenantAdmin | `createDefaults` |
| 10 | DELETE | `/folders/:id` | TenantAdmin | `deleteFolder` |

**Service Methods** (`FolderService`):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `create` | SELECT parent (if parentId); INSERT folders | Builds path from parent; duplicate name check at same level |
| `listByCase` | SELECT folders WHERE case scope; includes document_count + child_count subqueries | — |
| `getTree` | SELECT folders for case; returns flat list with parent_id for client-side tree building | — |
| `getById` | SELECT folder | — |
| `getDocuments` | SELECT documents WHERE folder_id; cursor pagination | — |
| `update` | UPDATE folder (name, description); renames path prefix for self + descendants | — |
| `move` | UPDATE folder parent + path; subtree cycle prevention; updates all descendant paths | Checks ancestry chain |
| `moveDocument` | UPDATE documents SET folder_id | — |
| `createDefaultFolders` | INSERT 6 folders: Pleadings, Correspondence, Evidence, Court Orders, Client Documents, Financial | Idempotent (skips if exist) |
| `delete` | DELETE folder | Blocked if children or documents exist |

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateFolderDto` | `name`, `caseId?`, `parentId?`, `scope?` (Case\|Global\|Template), `description?` |
| `UpdateFolderDto` | `name?`, `description?` |
| `MoveFolderDto` | `newParentId?` |
| `MoveDocumentToFolderDto` | `documentId`, `folderId?` |

---

### 2.11 Health Module

**Controller**: `@Controller('health')`
**Guards**: None (public endpoints)

| # | Method | Route | Controller Method |
|---|--------|-------|-------------------|
| 1 | GET | `/health` | `liveness` |
| 2 | GET | `/health/ready` | `readiness` |

- **Liveness**: Returns `{ status: 'ok' }`
- **Readiness**: Checks DB latency (SELECT 1); storage + queue marked ok for MVP

---

### 2.12 Hearing Module

**Controller**: `@Controller('hearings')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/hearings` | Lawyer, TenantAdmin | `createHearing` |
| 2 | GET | `/hearings` | ALL | `listHearings` |
| 3 | GET | `/hearings/:id` | ALL | `getHearing` |
| 4 | PATCH | `/hearings/:id` | Lawyer, TenantAdmin | `updateHearing` |
| 5 | POST | `/hearings/:id/transition` | Lawyer, TenantAdmin | `transitionHearing` |

**Service Methods** (`HearingService`):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `create` | INSERT hearings; INSERT calendar_events (1hr); INSERT calendar_event_attendees (creator + assigned lawyer); INSERT calendar_reminders (30min InApp); INSERT notifications | Auto-creates linked calendar event |
| `list` | SELECT hearings; filters: caseId, status, courtId, judgeId; ORDER BY hearing_date DESC | — |
| `getById` | SELECT hearings JOIN cases (title), courts (name), judges (name) | — |
| `update` | UPDATE hearings (only if Scheduled); UPDATE calendar_events (syncs date) | — |
| `transition` | UPDATE hearings SET status; UPDATE calendar_events (syncs status); INSERT audit_events; INSERT notifications | VALID_HEARING_TRANSITIONS; Postponed→newDate support |

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateHearingDto` | `caseId` (required), `courtId?`, `judgeId?`, `hearingDate` (ISO), `location?`, `hearingType?` (Initial\|Continuation\|Ruling\|Appeal\|Procedural), `notes?` |
| `UpdateHearingDto` | `hearingDate?`, `location?`, `notes?`, `courtId?`, `judgeId?` |
| `TransitionHearingDto` | `toStatus` (Scheduled\|Completed\|Postponed\|Cancelled), `outcome?`, `reason?`, `newDate?` |

---

### 2.13 Notification Module

**Controller**: `@Controller('notifications')`
**Guards**: `JwtAuthGuard` (class-level; **no** `RolesGuard`)

| # | Method | Route | Controller Method |
|---|--------|-------|-------------------|
| 1 | GET | `/notifications` | `list` |
| 2 | GET | `/notifications/unread-count` | `getUnreadCount` |
| 3 | PATCH | `/notifications/:id/read` | `markAsRead` |
| 4 | POST | `/notifications/mark-all-read` | `markAllRead` |

**Service Methods** (`NotificationService`):

| Method | DB Operations |
|--------|--------------|
| `create(slug, data)` | INSERT notifications |
| `listForUser(slug, userId, query)` | SELECT notifications WHERE user_id; filters: isRead; cursor pagination |
| `getUnreadCount(slug, userId)` | SELECT COUNT WHERE user_id AND NOT is_read |
| `markAsRead(slug, id, userId)` | UPDATE notifications SET is_read = true |
| `markAllRead(slug, userId)` | UPDATE notifications SET is_read = true WHERE user_id AND NOT is_read |

---

### 2.14 Report Module

**Controller**: `@Controller('reports')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Extra Guards | Controller Method |
|---|--------|-------|-------|-------------|-------------------|
| 1 | GET | `/reports/cases-by-state` | ALL | — | `casesByState` |
| 2 | GET | `/reports/cases-by-type` | ALL | — | `casesByType` |
| 3 | GET | `/reports/cases-by-owner` | ALL | — | `casesByOwner` |
| 4 | GET | `/reports/overdue-tasks` | ALL | — | `overdueTasks` |
| 5 | GET | `/reports/upcoming-sessions` | ALL | — | `upcomingSessions` |
| 6 | GET | `/reports/completeness-gaps` | ALL | — | `completenessGaps` |
| 7 | GET | `/reports/receivables` | Accountant, TenantAdmin | — | `receivables` |
| 8 | GET | `/reports/cashflow` | Accountant, TenantAdmin | — | `cashflow` |
| 9 | GET | `/reports/expenses-by-category` | Accountant, TenantAdmin | — | `expensesByCategory` |
| 10 | GET | `/reports/:reportType/export` | TenantAdmin | `StepUpGuard` | `exportCsv` |

**Service Methods** (`ReportService`):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `casesByState` | SELECT cases GROUP BY state; optional date range, caseTypeId filters | — |
| `casesByType` | SELECT cases JOIN case_types GROUP BY case_type | — |
| `casesByOwner` | SELECT cases GROUP BY created_by (JOIN users for display_name) | — |
| `overdueTasks` | SELECT tasks WHERE due_date < NOW() AND status NOT IN (Done, Cancelled); filters: caseId, assigneeId | — |
| `upcomingSessions` | SELECT sessions WHERE session_date BETWEEN NOW() AND NOW() + N days | N configurable |
| `completenessGaps` | SELECT cases with completeness < threshold; calculates field/doc/participant scores | Uses CompletenessService logic inline |
| `receivables` | SELECT invoices aggregated by customer (total, paid, outstanding) | — |
| `cashflow` | SELECT monthly payments SUM vs approved expenses SUM; computes net | — |
| `expensesByCategory` | SELECT expenses GROUP BY category; SUM amounts | — |
| `exportCsv` | Dispatches to any report method + `toCsv()` serializer; INSERT audit_events | Generic CSV export with audit trail |

---

### 2.15 Search Module

**Controller**: `@Controller('search')`
**Guards**: `JwtAuthGuard` (class-level; **no** `RolesGuard`)

| # | Method | Route | Controller Method |
|---|--------|-------|-------------------|
| 1 | GET | `/search` | `globalSearch` |
| 2 | GET | `/search/documents/fulltext` | `documentFulltextSearch` |

**Service Methods** (`SearchService`):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `normalizeArabic(text)` | None (pure function) | Strips diacritics, normalizes Hamza→Alef, Taa Marbuta→Haa, Alef Maksura→Yaa, strips Kashida |
| `globalSearch(slug, query, user)` | 4 parallel SELECTs: customers (name/IDs), cases (title/ref/court_number), documents (title/filename), invoices (invoice_number) | HighlyConfidential docs excluded without step-up; unified result format |
| `documentFulltextSearch(slug, query, user)` | `plainto_tsquery('simple', ...)` against `full_text_tsvector`; `ts_headline` for snippets; `ts_rank` for ordering | HighlyConfidential filter; GIN index |

---

### 2.16 Telemetry Module

**Controller**: `@Controller('telemetry')`
**Guards**: None (open endpoint)

| # | Method | Route | Controller Method |
|---|--------|-------|-------------------|
| 1 | POST | `/telemetry/ui-error` | `reportUiError` |

**Inline DTO**: `UiErrorDto` — `message: string`, `stack?: string`, `componentStack?: string`, `url?: string`, `userAgent?: string`, `extra?: any`

Logs frontend errors via Winston. Returns `204 No Content`.

---

### 2.17 Template Module

**Controller**: `@Controller('templates')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/templates` | TenantAdmin | `createTemplate` |
| 2 | GET | `/templates` | ALL | `listTemplates` |
| 3 | GET | `/templates/:id` | ALL | `getTemplate` |
| 4 | PATCH | `/templates/:id` | TenantAdmin | `updateTemplate` |
| 5 | POST | `/templates/render` | Lawyer, TenantAdmin | `renderTemplate` |
| 6 | POST | `/templates/generate` | Lawyer, TenantAdmin | `generateDocument` |
| 7 | DELETE | `/templates/:id` | TenantAdmin | `deactivateTemplate` |

**Service Methods** (`TemplateService`):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `create` | INSERT document_templates | Validates Handlebars compilation |
| `list` | SELECT document_templates; filters: category, is_active, search (ILIKE name/description); cursor pagination | — |
| `getById` | SELECT document_templates | — |
| `update` | UPDATE document_templates | Validates template_body if provided |
| `render` | SELECT template; compile Handlebars; return HTML | Validates required variables from `variable_schema` |
| `generate` | render() + INSERT documents; INSERT audit_events | Creates document record in DB |
| `deactivate` | UPDATE document_templates SET is_active = false | Soft delete |

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateTemplateDto` | `name`, `description?`, `category` (Contract\|Letter\|Petition\|Motion\|Filing\|Other), `template_body`, `variable_schema?` (JSON) |
| `UpdateTemplateDto` | All optional + `is_active?` |
| `RenderTemplateDto` | `templateId`, `data` (object), `caseId?`, `title?` |

---

### 2.18 Tenant Module (Service-Only)

**No Controller** — used internally by other modules.

**Service Methods** (`TenantService`):

| Method | DB Operations |
|--------|--------------|
| `getTenantBySlug(slug)` | Prisma: `tenant.findUnique({ where: { slug } })` |
| `getTenantById(id)` | Prisma: `tenant.findUnique({ where: { id } })` |
| `provisionTenantSchema(slug)` | `CREATE SCHEMA IF NOT EXISTS tenant_{slug}` |

---

### 2.19 Time-Entry Module

**Controller**: `@Controller('time-entries')`
**Guards**: `JwtAuthGuard`, `RolesGuard` (class-level)

| # | Method | Route | Roles | Controller Method |
|---|--------|-------|-------|-------------------|
| 1 | POST | `/time-entries` | Lawyer, TenantAdmin | `createTimeEntry` |
| 2 | GET | `/time-entries` | ALL | `listTimeEntries` |
| 3 | GET | `/time-entries/summary` | Accountant, TenantAdmin | `getSummary` |
| 4 | GET | `/time-entries/my` | ALL | `getMyTimeEntries` |
| 5 | GET | `/time-entries/:id` | ALL | `getTimeEntry` |
| 6 | PATCH | `/time-entries/:id` | Lawyer, TenantAdmin | `updateTimeEntry` |
| 7 | POST | `/time-entries/:id/transition` | ALL | `transitionTimeEntry` |
| 8 | DELETE | `/time-entries/:id` | Lawyer, TenantAdmin | `deleteTimeEntry` |

**Service Methods** (`TimeEntryService`):

| Method | DB Operations | Notes |
|--------|--------------|-------|
| `create` | SELECT case (exists check); INSERT time_entries | Default billable=true, status=Draft |
| `list` | SELECT time_entries JOIN cases+users; filters: caseId, userId, status, dateRange; cursor pagination | — |
| `getSummary` | SELECT aggregate: total_entries, total_hours, total_amount, billable_hours, billable_amount, non_billable_hours; filters: caseId, userId, dateRange | — |
| `getMyEntries` | SELECT WHERE user_id = current user | — |
| `getById` | SELECT time_entry JOIN case+user | — |
| `update` | UPDATE (only Draft; only owner) | — |
| `transition` | UPDATE status; role-based: only owner may submit; only Accountant/TenantAdmin may approve/bill/writeoff; sets approved_by/approved_at; inserts notification for owner | VALID_TIME_ENTRY_TRANSITIONS |
| `delete` | DELETE (only Draft; only owner) | Hard delete |

**DTOs**:

| DTO | Fields |
|-----|--------|
| `CreateTimeEntryDto` | `caseId`, `entryDate` (ISO), `hours` (Min 0.01), `description`, `activityType?`, `ratePerHour?` (Min 0), `hearingId?`, `billable?` |
| `UpdateTimeEntryDto` | All optional except caseId |
| `TransitionTimeEntryDto` | `toStatus` (Submitted\|Approved\|Billed\|WriteOff), `reason?` |

---

### 2.20 Worker Module (BullMQ Processors — No HTTP Routes)

**Workers**:

| Worker | Queue | Behavior |
|--------|-------|----------|
| `ScanWorker` | `document-scan` | Checks scan_status idempotency. Deterministic scan: filename containing `EICAR` → Failed, else → Passed. On pass: updates `current_version_id`, queues `document-ocr` job (1s delay). Creates audit event + notifies uploader. |
| `OcrWorker` | `document-ocr` | Checks ocr_status idempotency. TEXT_EXTRACTABLE mimes: pdf, png, jpeg, tiff, text/plain, text/html, msword, docx. Non-extractable → Skipped. Simulates text extraction. Updates `full_text_content` (triggers DB tsvector update). |

---

## 3. Middleware, Guards & Interceptors

### Global (registered in `AppModule` / `main.ts`)

| Component | Type | Registration | Behavior |
|-----------|------|-------------|----------|
| `CorrelationMiddleware` | Middleware | `app.module.ts` — `configure(consumer)` → `forRoutes('*')` | Generates/propagates `X-Correlation-Id` UUID; attaches `req.correlationId` |
| `TenantGuard` | Guard | `APP_GUARD` | Validates `user.tenantSlug` exists on authenticated requests; skips public |
| `ThrottlerGuard` | Guard | `APP_GUARD` | Rate-limits: 20/s, 200/min, 5000/hr |
| `LoggingInterceptor` | Interceptor | `APP_INTERCEPTOR` | Logs every request/response: correlationId, method, url, IP, userAgent, userId, tenantSlug, statusCode, duration (ms). On error: logs stack trace. |

### Per-Route Guards

| Guard | Decorator | Behavior |
|-------|-----------|----------|
| `JwtAuthGuard` | `@UseGuards(JwtAuthGuard)` | Passport JWT strategy; extracts from `Authorization: Bearer <token>` |
| `RolesGuard` | `@UseGuards(RolesGuard)` + `@Roles(...)` | Returns 403 if user missing required role |
| `StepUpGuard` | `@UseGuards(StepUpGuard)` + `@RequireStepUp()` | Returns 403 if JWT lacks `stepUp: true` |

### Custom Decorators

| Decorator | Key | Usage |
|-----------|-----|-------|
| `@Roles(...roles)` | `ROLES_KEY` | `SetMetadata` for RolesGuard |
| `@RequireStepUp()` | `STEP_UP_KEY` | `SetMetadata` for StepUpGuard |
| `@CurrentUser` | — | `createParamDecorator` extracting `request.user` |

### Validation (Global)

```
ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
})
```

### Security Headers

- `helmet()` — default config
- `cookieParser()`
- CORS — configured origins from `CORS_ORIGINS` env

---

## 4. Prisma Schema Models (Platform DB)

### 4.1 Tenant

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String (uuid) | PK, default uuid |
| `name` | String | — |
| `slug` | String | @unique |
| `currency` | String | default "SAR" |
| `timezone` | String | default "Asia/Riyadh" |
| `locale` | String | default "ar" |
| `planTier` | String | default "basic" |
| `lawyerCanDraft` | Boolean | default false |
| `isActive` | Boolean | default true |
| `storageMode` | String | default "private" |
| `storageProvider` | String | default "minio" |
| `storageBucket` | String | default "loma-documents" |
| `storageEndpoint` | String | default "http://minio:9000" |
| `createdAt` | DateTime | default now() |
| `updatedAt` | DateTime | @updatedAt |

Relations: `users User[]`

### 4.2 User

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String (uuid) | PK, default uuid |
| `tenantId` | String | FK → Tenant |
| `email` | String | — |
| `displayName` | String | — |
| `passwordHash` | String | default "" |
| `roles` | String[] | — |
| `isActive` | Boolean | default true |
| `language` | String | default "ar" |
| `createdAt` | DateTime | default now() |
| `updatedAt` | DateTime | @updatedAt |

Unique constraint: `@@unique([tenantId, email])`

### 4.3 IdempotencyRecord

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String (uuid) | PK, default uuid |
| `tenantId` | String | — |
| `idempotencyKey` | String | — |
| `endpoint` | String | — |
| `requestHash` | String | — |
| `responseCode` | Int | — |
| `responseBody` | String | — |
| `expiresAt` | DateTime | — |
| `createdAt` | DateTime | default now() |

Unique constraint: `@@unique([tenantId, idempotencyKey, endpoint])`

---

## 5. Tenant-Schema Tables (Phase 1)

From `tenant-schema.sql` — ~35 tables created per tenant in schema `tenant_{slug}`:

| # | Table | Key Columns | Notes |
|---|-------|-------------|-------|
| 1 | `customers` | id, customer_type, full_name, national_id, passport_number, registration_id, tax_id, email, phone, notes, is_active, created_at, updated_at | Individual\|Organization |
| 2 | `addresses` | id, customer_id (FK), label, street, city, state, postal_code, country, is_primary | — |
| 3 | `contacts` | id, customer_id (FK), full_name, phone, email, role, is_primary | — |
| 4 | `parties` | id, full_name, party_type, national_id, registration_id, phone, email, address, notes | External parties |
| 5 | `party_relationships` | id, party_id, related_party_id, relationship_type | — |
| 6 | `master_data` | id, category, label_ar, label_en, sort_order, is_active | 10 categories |
| 7 | `case_types` | id, name_ar, name_en, description, default_checklist, is_active | — |
| 8 | `checklist_templates` | id, case_type_id (nullable), label_ar, label_en, sort_order | — |
| 9 | `customer_checklists` | id, customer_id, checklist_template_id, is_fulfilled, fulfilled_at, notes | — |
| 10 | `doc_requirement_templates` | id, case_type_id (nullable), label_ar, label_en, is_mandatory, sort_order | — |
| 11 | `customer_doc_requirements` | id, customer_id, template_id, is_fulfilled, document_id (nullable) | — |
| 12 | `cases` | id, tenant_id, case_type_id, customer_id, title, reference_number, court_name, court_number, state (default 'Intake'), on_hold, on_hold_reason, description, notes, created_by, created_at, updated_at | Core entity |
| 13 | `case_sequences` | id, tenant_id, year, last_value | For CASE-YYYY-SEQ |
| 14 | `invoice_sequences` | id, tenant_id, year, last_value | For INV-YYYY-SEQ |
| 15 | `case_customers` | id, case_id, customer_id, role | M:N relationship |
| 16 | `case_memberships` | id, case_id, user_id, role, joined_at | Team membership |
| 17 | `case_parties` | id, case_id, party_id, role, added_at | External party links |
| 18 | `courts` | id, name, court_type, address, phone, jurisdiction, created_at | — |
| 19 | `sessions` | id, case_id, session_type, session_date, location, judge_name, status, outcome, notes, created_by, created_at | Court sessions |
| 20 | `session_reschedules` | id, session_id, old_date, new_date, reason, rescheduled_by, created_at | — |
| 21 | `tasks` | id, case_id, title, description, status, priority, due_date, assigned_to, created_by, created_at, updated_at | — |
| 22 | `notes` | id, case_id, content, category, created_by, created_at | — |
| 23 | `filings` | id, case_id, filing_type, title, description, filed_date, court_response, status, created_by, created_at, updated_at | — |
| 24 | `communications` | id, case_id, customer_id, channel, direction, subject, body, metadata, created_by, created_at | — |
| 25 | `case_doc_requirements` | id, case_id, template_id, is_fulfilled, document_id (nullable) | — |
| 26 | `documents` | id, case_id, customer_id, title, doc_type, filename, mime_type, storage_key, current_version_id, confidentiality, scan_status, is_deleted, legal_hold, checked_out_by, checked_out_at, uploaded_by, created_at, updated_at | — |
| 27 | `document_versions` | id, document_id, version_number, filename, mime_type, storage_key, file_size, change_note, uploaded_by, created_at | — |
| 28 | `document_acl` | id, document_id, user_id, permission (View\|Edit), granted_by, created_at | — |
| 29 | `document_shares` | id, document_id, shared_with_user_id, permission, shared_by, expires_at, created_at | — |
| 30 | `legal_holds` | id, document_id, reason, placed_by, created_at | — |
| 31 | `invoices` | id, case_id, customer_id, invoice_number, status, subtotal, discount_percent, discount_amount, tax_percent, tax_amount, total, due_date, notes, created_by, created_at, updated_at | — |
| 32 | `invoice_line_items` | id, invoice_id, description, quantity, unit_price, line_total | — |
| 33 | `payments` | id, invoice_id, amount, method, reference, idempotency_key, created_by, created_at | — |
| 34 | `expenses` | id, case_id, category, amount, description, receipt_url, status, current_step, created_by, created_at | — |
| 35 | `expense_approvals` | id, expense_id, step, action, comments, actor_id, created_at | — |
| 36 | `expense_approval_workflows` | id, step_order, role, min_amount, max_amount, created_at | — |
| 37 | `wages` | id, user_id, month, base_salary, allowances, deductions, net_salary, notes, created_by, created_at | — |
| 38 | `audit_events` | id, actor_id, action, entity_type, entity_id, metadata (JSONB), ip_address, created_at | — |
| 39 | `notifications` | id, user_id, type, title, body, metadata (JSONB), is_read, created_at | — |
| 40 | `retention_policies` | id, doc_type (UNIQUE), retention_days, action (Archive\|Delete), created_at, updated_at | — |

---

## 6. Phase 2 Migration (New Tables & Alterations)

From `phase2-migration.sql`:

### New Tables

| Table | Key Columns |
|-------|-------------|
| `judges` | id, court_id (FK→courts), full_name, title, specialization, phone, email, is_active, created_at |
| `hearings` | id, case_id (FK), court_id, judge_id, hearing_date, location, hearing_type (5 enums), status (4 enums), outcome, notes, calendar_event_id, created_by, created_at, updated_at |
| `calendar_events` | id, title, description, start_at, end_at, all_day, event_type (6 enums), recurrence (5 enums), recurrence_end_date, recurrence_rule, case_id, hearing_id, session_id, task_id, location, status (4 enums), created_by, created_at, updated_at |
| `calendar_event_attendees` | id, calendar_event_id (FK), user_id, rsvp (4 enums); UNIQUE(event, user) |
| `calendar_reminders` | id, calendar_event_id (FK), minutes_before, channel (InApp\|Email), sent (bool), sent_at, trigger_at |
| `folders` | id, parent_folder_id, name, path, scope (Customer\|Case\|Tenant), scope_id, confidentiality_default, inherit_permissions (bool), is_archived, is_deleted, created_by, created_at, updated_at |
| `document_templates` | id, name, description, category (6 enums), template_body (TEXT), variable_schema (JSONB), is_active (bool), created_by, created_at, updated_at |
| `time_entries` | id, case_id (FK), task_id, hearing_id, user_id, entry_date, hours (NUMERIC(6,2)), description, activity_type, billable (bool), rate_per_hour (NUMERIC(10,2)), total_amount (NUMERIC(10,2)), status (5 enums), invoice_line_id, approved_by, approved_at, created_at, updated_at |
| `notification_subscriptions` | id, user_id, event_type, channel (InApp\|Email\|Both), enabled (bool); UNIQUE(user, event_type) |

### Altered Tables

| Table | Change |
|-------|--------|
| `courts` | +department, +circuit, +jurisdiction_level, +city, +phone (nullable), +is_active (default true) |
| `cases` | +primary_court_id (FK→courts), +primary_judge_id (FK→judges) |
| `documents` | +folder_id (FK→folders), +full_text_content (TEXT), +ocr_status (5 enums), +full_text_tsvector (TSVECTOR, GIN index) |
| `document_versions` | +storage_provider |
| `sessions` | +calendar_event_id |
| `tasks` | +calendar_event_id, +estimated_hours (NUMERIC(6,2)) |
| `notes` | +updated_at, +updated_by, +edit_history (JSONB) |

### Database Trigger

```sql
CREATE OR REPLACE FUNCTION update_document_tsvector()
  RETURNS trigger AS $$
BEGIN
  NEW.full_text_tsvector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.full_text_content, '')), 'B');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Trigger: trg_doc_tsvector ON documents BEFORE INSERT OR UPDATE OF title, full_text_content
```

---

## 7. Seed Data

From `seed.ts` (314 lines):

| Category | Items |
|----------|-------|
| **Tenant** | 1: "Demo Law Firm" / slug `demo-firm` |
| **Users** | 5: lawyer@demo.com (Lawyer), lawyer2@demo.com (Lawyer), accountant@demo.com (Accountant), admin@demo.com (TenantAdmin), sysadmin@demo.com (SystemAdmin) |
| **Schema** | Creates `tenant_demo-firm` schema, applies `tenant-schema.sql` + `phase2-migration.sql` |
| **Master Data** | 10 categories seeded (e.g., document_type, filing_type, etc.) |
| **Case Types** | 5: Civil Litigation, Criminal Defense, Family Law, Corporate/Commercial, Real Estate |
| **Checklist Templates** | Multiple per case type |
| **Doc Requirement Templates** | Multiple per case type |
| **Expense Workflows** | Multi-step approval workflows |
| **Retention Policies** | Per document type |
| **Courts** | 4 courts (various types) |
| **Judges** | 3 judges (linked to courts) |
| **Document Templates** | 3: Contract template, Legal Letter, Court Petition |
| **Notification Subscriptions** | Per user, per event type |

---

## 8. Gaps, Risks & Observations

### 8.1 Critical Gaps

| # | Area | Gap | Impact |
|---|------|-----|--------|
| 1 | **Auth** | Only dev auth implemented (`/auth/dev/login`). No production auth strategy (OAuth, OIDC, password-based login). | **Blocker for production** |
| 2 | **Workers** | OCR and virus scan are simulated (hardcoded logic). Comments reference Azure Document Intelligence / ClamAV for production. | Non-functional in production |
| 3 | **JwtStrategy** | Extracts token from `Authorization: Bearer` header ONLY — does not extract from cookies despite `cookieParser()` being configured. | Inconsistency with Swagger `ApiCookieAuth('access_token')` |
| 4 | **Accounting routes** | `@Controller()` has no route prefix, so invoice/payment/expense/wage routes sit at root (`/api/v1/invoices` etc.) instead of under a namespace like `/accounting`. | Non-standard REST structure |
| 5 | **Telemetry** | `POST /telemetry/ui-error` has **no auth guard** — open to the internet behind the global `ThrottlerGuard` only. | Potential abuse vector |

### 8.2 Column Name Mismatches

| # | File A | File B | Column A | Column B |
|---|--------|--------|----------|----------|
| 1 | `phase2-migration.sql` | `folder.service.ts` | `parent_folder_id` | `parent_id` |

The migration defines `parent_folder_id` but the folder service queries using `parent_id`. This will cause runtime SQL errors.

### 8.3 Missing Endpoints (Compared to Typical CRUD)

| Module | Missing |
|--------|---------|
| Notification | No DELETE endpoint for individual notifications |
| Notification | No PATCH for notification_subscriptions (preferences management) |
| Calendar | No recurrence expansion endpoint (series instances) |
| Calendar | No bulk operations (e.g., cancel all events for a case) |
| Document | No version rollback endpoint |
| Document | No batch upload endpoint |
| Search | No saved-search / bookmark feature |
| Admin | No user deactivation separate from soft-delete |
| Audit | No audit export endpoint |

### 8.4 Testing Gaps

| Area | Status |
|------|--------|
| Unit tests (guards) | 3 spec files exist: `roles.guard.spec.ts`, `step-up.guard.spec.ts`, `tenant.guard.spec.ts` |
| Unit tests (services) | **None found** for any service |
| E2E tests | 4 files: `app.e2e-spec.ts`, `case.e2e-spec.ts`, `customer.e2e-spec.ts`, `permissions.e2e-spec.ts` |
| Coverage | Most modules (accounting, calendar, court, document, folder, hearing, notification, report, search, template, time-entry) have **zero tests** |

### 8.5 Security Observations

| # | Observation |
|---|-------------|
| 1 | JWT secret has hardcoded fallback: `'loma-dev-secret-key-change-in-production'` |
| 2 | `tenant.guard.ts` only checks `tenantSlug` existence — does NOT cross-check against data being accessed |
| 3 | No CSRF protection (using cookies for auth in Swagger but Bearer tokens in practice) |
| 4 | No input sanitization beyond class-validator (no SQL injection protection beyond parameterized queries) |
| 5 | Presigned URLs (upload/download) not scoped to authenticated user — anyone with the URL can access within the TTL |
| 6 | Step-up token has 5-minute expiry but no usage tracking (can be reused within window) |

### 8.6 Architectural Observations

| # | Observation |
|---|-------------|
| 1 | `PrismaService.queryTenant` uses BEGIN/COMMIT per query — no connection pooling optimization for read-only queries |
| 2 | No caching layer (Redis is used for BullMQ only, not for caching) |
| 3 | No pagination on some list endpoints (e.g., `getMemberships`, `listParties`, `listSessions`) |
| 4 | No WebSocket / SSE for real-time notifications — polling only |
| 5 | No file size limits enforced server-side (only MIME type validation) |
| 6 | Recurrence rules stored but never expanded — no recurrence engine implemented |
| 7 | Expense approval workflow is synchronous — no async notification to next approver |
| 8 | `health/ready` marks storage and queue as OK without actually checking them |

### 8.7 Route Count Summary

| Module | Routes |
|--------|--------|
| Accounting | 15 |
| Admin | 18 |
| Audit | 2 |
| Auth | 2 |
| Calendar | 9 |
| Case | 27 |
| Court | 8 |
| Customer | 15 |
| Document | 14 |
| Folder | 10 |
| Health | 2 |
| Hearing | 5 |
| Notification | 4 |
| Report | 10 |
| Search | 2 |
| Telemetry | 1 |
| Template | 7 |
| Time-Entry | 8 |
| **TOTAL** | **159** |

---

*End of inventory.*
