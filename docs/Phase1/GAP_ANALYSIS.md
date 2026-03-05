# LOMA — Full-Stack Gap Analysis

> **Generated**: 2025-01-XX  
> **Scope**: DB schema ↔ Backend DTOs/Services ↔ Frontend Forms/API calls  
> **Source of truth**: `doc/BRD.md`, `doc/PRD.md`, `doc/SRS.md`, `doc/FSD.md`, `doc/TDD_System_Architecture.md`, `doc/Wireframes_IA.md`  
> **Analysed**: 10 documentation files · 18 backend modules · 159 API routes · 60+ DTOs · 20+ frontend pages · 40+ DB tables

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [P0 — Critical Runtime Failures](#2-p0--critical-runtime-failures)
3. [P0 — Enum / CHECK Constraint Mismatches](#3-p0--enum--check-constraint-mismatches)
4. [P0 — Column Name Mismatches (SQL will fail)](#4-p0--column-name-mismatches)
5. [P0 — NOT NULL Violations](#5-p0--not-null-violations)
6. [P1 — FK Fields Validated as Free-Text](#6-p1--fk-fields-validated-as-free-text)
7. [P1 — Missing Edit UI (Create exists, Edit absent)](#7-p1--missing-edit-ui)
8. [P1 — Missing Form Fields (DB columns with no DTO/UI)](#8-p1--missing-form-fields)
9. [P1 — Hardcoded Dropdowns (should come from API)](#9-p1--hardcoded-dropdowns)
10. [P1 — Text Inputs That Should Be Dropdowns](#10-p1--text-inputs-that-should-be-dropdowns)
11. [P2 — DTO Required but DB Nullable (Over-strict)](#11-p2--dto-required-but-db-nullable)
12. [P2 — DB Columns Never Written](#12-p2--db-columns-never-written)
13. [P2 — Naming Inconsistencies](#13-p2--naming-inconsistencies)
14. [P2 — Duplicate / Conflicting DTOs](#14-p2--duplicate--conflicting-dtos)
15. [P2 — Missing Validation Decorators](#15-p2--missing-validation-decorators)
16. [P2 — Phase 2 Columns With No DTO Support](#16-p2--phase-2-columns-with-no-dto-support)
17. [Architecture & Security Gaps](#17-architecture--security-gaps)
18. [Appendix: Per-Entity Field Map](#18-appendix-per-entity-field-map)

---

## 1. Executive Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | **14** | Runtime SQL failures — INSERTs that will crash |
| **P1** | **48+** | Missing Edit UIs, FK validation, hardcoded dropdowns |
| **P2** | **30+** | Never-written columns, over-strict DTOs, naming issues |
| **Arch** | **6** | Security, auth, testing, observability |

### P0 Breakdown (14 critical bugs)

| # | Category | Entity | Bug |
|---|----------|--------|-----|
| 1 | Column mismatch | `time_entries` | Service writes `hourly_rate`, DB column is `rate_per_hour` |
| 2 | Column mismatch | `folders` | Service writes `parent_id`, DB column is `parent_folder_id` |
| 3 | Column mismatch | `folders` | Service writes `case_id`, DB column doesn't exist (should be `scope_id`) |
| 4 | Non-existent column | `folders` | Service writes `description`, column doesn't exist |
| 5 | Enum mismatch | `payments` | DTO `'CreditCard'` ≠ DB CHECK `'Card'` |
| 6 | Enum mismatch | `calendar_reminders` | DTO allows `'SMS'`, DB CHECK only `('InApp','Email')` |
| 7 | Enum mismatch | `folders` | DTO `'Global'`/`'Template'` ≠ DB CHECK `'Customer'`/`'Tenant'` |
| 8 | NOT NULL violation | `communications` | `summary` is `@IsOptional` in DTO but `NOT NULL` in DB |
| 9 | Form bug | `hearings` | `case_id` (UUID FK) rendered as free-text input |
| 10 | Form bug | `hearings` | `hearing_type` rendered as free-text instead of dropdown |
| 11 | Form bug | `contacts` | `role_id` (UUID FK) rendered as free-text input |
| 12 | Form bug | `addresses` | `address_type` rendered as free-text instead of enum dropdown |
| 13 | Form bug | `wages` | `userId` (UUID FK) rendered as free-text input |
| 14 | UI enum | `documents` | Confidentiality default `'Standard'` ≠ DB `'Normal'` |

---

## 2. P0 — Critical Runtime Failures

### 2.1 `time_entries` — Column Name Mismatch

- **File**: `backend/src/time-entries/time-entries.service.ts`
- **Bug**: Service INSERT writes column `hourly_rate` but DB column is `rate_per_hour`
- **Impact**: Every time entry creation fails with "column hourly_rate does not exist"
- **Fix**: Rename `hourly_rate` → `rate_per_hour` in the INSERT SQL

### 2.2 `folders` — Three Column Mismatches

- **File**: `backend/src/documents/documents.service.ts` (folder methods)
- **Bug 1**: Service writes `parent_id` but column is `parent_folder_id`
- **Bug 2**: Service writes `case_id` but column doesn't exist (should be `scope_id`)
- **Bug 3**: Service writes `description` but column doesn't exist in `folders` table
- **Impact**: Every folder creation fails
- **Fix**: Rename columns in INSERT; remove `description`; map `caseId` → `scope_id`

### 2.3 `payments` — Enum Mismatch

- **File**: `backend/src/accounting/accounting.dto.ts`
- **Bug**: `PaymentMethod` enum includes `'CreditCard'` but DB CHECK constraint expects `'Card'`
- **Impact**: Selecting "Credit Card" payment throws CHECK violation
- **Fix**: Change DTO enum value from `'CreditCard'` to `'Card'`; update frontend label

### 2.4 `calendar_reminders` — Enum Mismatch

- **File**: `backend/src/calendar/calendar.dto.ts`
- **Bug**: `ReminderChannel` enum includes `'SMS'` but DB CHECK only allows `('InApp','Email')`
- **Impact**: Creating SMS reminder throws CHECK violation
- **Fix**: Remove `'SMS'` from DTO enum (or ALTER DB to add it)

### 2.5 `folders` — Scope Enum Mismatch

- **File**: `backend/src/documents/documents.dto.ts`
- **Bug**: DTO scope enum is `['Case','Global','Template']` but DB CHECK is `('Customer','Case','Tenant')`
- **Impact**: `'Global'` and `'Template'` values violate CHECK; `'Customer'` cannot be selected
- **Fix**: Align DTO enum to `['Customer','Case','Tenant']`

### 2.6 `communications` — NOT NULL Violation

- **File**: `backend/src/communications/communications.dto.ts`
- **Bug**: `summary` field is `@IsOptional` in `CreateCommunicationDto` and `CreateCustomerCommunicationDto`, but `summary` column is `TEXT NOT NULL`
- **Impact**: Omitting summary crashes INSERT
- **Fix**: Make `summary` required in DTO (`@IsString()` without `@IsOptional()`)

---

## 3. P0 — Enum / CHECK Constraint Mismatches

| Entity | DTO Value(s) | DB CHECK Value(s) | Fix Direction |
|--------|-------------|-------------------|---------------|
| `payments.method` | `'CreditCard'` | `'Card'` | DTO → `'Card'` |
| `calendar_reminders.channel` | `'SMS'` | Not in CHECK | Remove from DTO |
| `folders.scope` | `'Global'`, `'Template'` | `'Customer'`, `'Tenant'` | DTO → match DB |
| `documents` (UI only) | `'Standard'` confidentiality | `'Normal'` default | UI → `'Normal'` |

---

## 4. P0 — Column Name Mismatches

| Entity | Service Writes | DB Column | Fix |
|--------|---------------|-----------|-----|
| `time_entries` | `hourly_rate` | `rate_per_hour` | Rename in SQL |
| `folders` | `parent_id` | `parent_folder_id` | Rename in SQL |
| `folders` | `case_id` | `scope_id` | Rename in SQL |
| `folders` | `description` | *(doesn't exist)* | Remove from SQL |

---

## 5. P0 — NOT NULL Violations

| Entity | Column | DB | DTO | Fix |
|--------|--------|-----|-----|-----|
| `communications` | `summary` | `TEXT NOT NULL` | `@IsOptional` | Make required in DTO |

---

## 6. P1 — FK Fields Validated as Free-Text

**20+ FK fields** across the codebase are validated with `@IsString` instead of `@IsUUID`, allowing malformed UUIDs to pass validation and only fail at the DB layer with cryptic errors.

| Entity | DTO Field | Should Be | Backend File |
|--------|-----------|-----------|-------------|
| `contacts` | `role_id` | `@IsUUID` | `customers.dto.ts` |
| `cases` | `caseTypeId` | `@IsUUID` | `cases.dto.ts` |
| `cases` | `assignedLawyerUserId` | `@IsUUID` | `cases.dto.ts` |
| `case_memberships` | `userId` | `@IsUUID` | `cases.dto.ts` |
| `case_parties` | `partyId` | `@IsUUID` | `cases.dto.ts` |
| `case_parties` | `participantRoleId` | `@IsUUID` | `cases.dto.ts` |
| `tasks` | `customerId` | `@IsUUID` | `tasks.dto.ts` |
| `tasks` | `assigneeUserId` | `@IsUUID` | `tasks.dto.ts` |
| `tasks` | `reviewerUserId` | `@IsUUID` | `tasks.dto.ts` |
| `sessions` | `typeId` | `@IsUUID` | `sessions.dto.ts` |
| `sessions` | `courtId` | `@IsUUID` | `sessions.dto.ts` |
| `notes` | `referencedNoteId` | `@IsUUID` | `notes.dto.ts` |
| `filings` | `typeId` | `@IsUUID` | `filings.dto.ts` |
| `communications` | `typeId` | `@IsUUID` | `communications.dto.ts` |
| `documents` | `docTypeId` | `@IsUUID` | `documents.dto.ts` |
| `expenses` | `receiptDocId` | `@IsUUID` | `accounting.dto.ts` |
| `judges` | `courtId` | `@IsUUID` | `court.dto.ts` |
| `hearings` | `caseId`, `courtId`, `judgeId` | `@IsUUID` | `hearings.dto.ts` |
| `time_entries` | `caseId` | `@IsUUID` | `time-entries.dto.ts` |
| `calendar_event_attendees` | `userId` | `@IsUUID` | `calendar.dto.ts` |

**Fix**: Add `@IsUUID()` decorator; on the frontend, replace all free-text inputs for FK fields with dropdown selects populated from the appropriate API endpoint.

---

## 7. P1 — Missing Edit UI

The following entities have a Create dialog/page but **no Edit functionality** in the frontend, despite the backend supporting PATCH/PUT:

| Entity | Create UI | Edit UI | Backend PATCH | Priority |
|--------|-----------|---------|--------------|----------|
| Tasks | ✅ | ❌ | ✅ | High |
| Sessions | ✅ | ❌ | ✅ | High |
| Filings | ✅ | ❌ | ✅ | High |
| Hearings | ✅ | ❌ | ✅ | High |
| Courts | ✅ | ❌ | ✅ | Medium |
| Judges | ✅ | ❌ | ✅ | Medium |
| Communications | ✅ | ❌ | ✅ | Medium |
| Notes | ✅ | ❌ | ✅ | Medium |
| Invoices | ✅ | ❌ | ✅ | High |
| Payments | ✅ | ❌ | ✅ | Medium |
| Expenses | ✅ | ❌ | ✅ | Medium |
| Wages | ✅ | ❌ | ✅ | Medium |
| Time Entries | ✅ | ❌ | ✅ | High |
| Calendar Events | ✅ | ❌ | ✅ | High |
| Document Templates | ✅ | ❌ | ✅ | Low |

**Fix**: For each entity, add an Edit button to the data table row, open the same form dialog pre-populated with current values, and call the PATCH endpoint on save.

---

## 8. P1 — Missing Form Fields

Fields that exist in the DB schema and are documented in requirements, but have no DTO field or UI input:

| Entity | Missing Fields | Impact |
|--------|---------------|--------|
| `addresses` | `line2` | Second address line always NULL |
| `case_customers` | `role` (per-customer role) | Always defaults to 'Client' |
| `tasks` | `linked_document_ids` | Can't attach docs to tasks |
| `sessions` | `linked_document_ids` | Can't attach docs to sessions |
| `filings` | `linked_document_ids` | Can't attach docs to filings |
| `communications` | `linked_document_ids` | Can't attach docs to communications |
| `notes` | `customer_id`, `linked_document_ids` | Can't create customer-level notes |
| `documents` | `description`, `tags` | Always NULL/empty |
| `wages` | `staff_name`, `deductions`, `gross_amount`, `net_amount`, `payment_status` | 5 columns always defaults |
| `time_entries` | `task_id`, `total_amount` | Can't link time to task; no computed total |
| `calendar_events` | `all_day`, `recurrence_rule`, `session_id`, `task_id` | Features don't work |
| `expenses` | `beneficiary_user_id`, `linked_document_ids` | Can't assign beneficiary |
| `document_versions` | `size_bytes`, `checksum_sha256` | No file metadata |
| `folders` | `confidentiality_default`, `inherit_permissions`, `is_archived` | Folder features broken |
| `cases` | `primary_court_id`, `primary_judge_id` (Phase 2) | Phase 2 columns unused |

---

## 9. P1 — Hardcoded Dropdowns

Frontend dropdown options that are hardcoded in TSX instead of fetched from the `master_data` API:

| Page | Field | Hardcoded Values | Should Come From |
|------|-------|-----------------|-----------------|
| Cases | Case Type | Hardcoded options | `GET /api/v1/admin/master-data?category=case_type` |
| Cases | Assigned Lawyer | Hardcoded list | `GET /api/v1/admin/users` (role=Lawyer) |
| Sessions | Session Type | Hardcoded options | `GET /api/v1/admin/master-data?category=session_type` |
| Filings | Filing Type | Hardcoded options | `GET /api/v1/admin/master-data?category=filing_type` |
| Communications | Comm Type | Hardcoded options | `GET /api/v1/admin/master-data?category=communication_type` |
| Communications | Direction | Hardcoded options | OK to keep hardcoded (simple enum) |
| Documents | Doc Type | Hardcoded options | `GET /api/v1/admin/master-data?category=document_type` |
| Documents | Confidentiality | `'Standard'` hardcoded | Use DB enum `'Normal'` / `'Confidential'` / `'Restricted'` |
| Hearings | Hearing Type | Hardcoded options | `GET /api/v1/admin/master-data?category=hearing_type` |
| Expenses | Category | Hardcoded options | `GET /api/v1/admin/master-data?category=expense_category` |
| Tasks | Priority | Hardcoded options | OK to keep hardcoded (simple enum) |
| Calendar | Event Type | Hardcoded options | OK to keep hardcoded (simple enum) |

---

## 10. P1 — Text Inputs That Should Be Dropdowns

| Page | Field | Current Control | Correct Control | Data Source |
|------|-------|----------------|----------------|-------------|
| Hearings | `caseId` | TextField | Autocomplete | Cases API |
| Hearings | `hearingType` | TextField | Select | Master data or enum |
| Contacts | `role_id` | TextField | Select | Master data (contact_role) |
| Addresses | `address_type` | TextField | Select | Enum: Billing/Office/Home/Other |
| Wages | `userId` | TextField | Select | Users API |
| Sessions | `courtId` | TextField | Autocomplete | Courts API |
| Filings | `typeId` | TextField | Select | Master data (filing_type) |
| Tasks | `assigneeUserId` | TextField | Autocomplete | Users API |
| Notes | `referencedNoteId` | TextField | Autocomplete | Notes API |

---

## 11. P2 — DTO Required but DB Nullable (Over-strict)

| Entity | DTO Field | DTO Status | DB Status | Impact |
|--------|-----------|------------|-----------|--------|
| `sessions` | `endDateTime` | Required | Nullable | Must provide end time even when unknown |
| `calendar_events` | `endAt` | Required | Nullable | Must provide end time |
| `expenses` | `caseId` | `@IsUUID` required | Nullable | Can't create office-level expenses |
| `expenses` | `customerId` | `@IsUUID` required | Nullable | Can't create expenses without customer |
| `expenses` | `categoryId` | `@IsUUID` required | Nullable | Can't create uncategorized expenses |
| `invoices` | `caseId` | `@IsUUID` required | Nullable | Can't create case-independent invoices |
| `time_entries` | `description` | `@IsString` required | Nullable | Must provide description |

**Fix**: Add `@IsOptional()` to these DTO fields to match DB nullability.

---

## 12. P2 — DB Columns Never Written

| Entity | Columns | Always |
|--------|---------|--------|
| `customers` | `completeness_pct` | 0 |
| `addresses` | `line2` | NULL |
| `documents` | `description`, `tags` | NULL / `{}` |
| `document_versions` | `size_bytes`, `checksum_sha256` | NULL |
| `wages` | `staff_name`, `deductions`, `gross_amount`, `net_amount`, `payment_status` | DEFAULT |
| `time_entries` | `total_amount`, `activity_type` | DEFAULT |
| `calendar_events` | `all_day`, `recurrence_rule`, `session_id`, `task_id` | DEFAULT / NULL |
| `expenses` | `beneficiary_user_id` | NULL |
| `folders` | `confidentiality_default`, `inherit_permissions`, `is_archived`, `is_deleted`, `scope_id` | DEFAULT |

---

## 13. P2 — Naming Inconsistencies

| Entity | Issue | Details |
|--------|-------|---------|
| `customers` | Create vs Update naming | Create: `national_id` (snake_case), Update: `nationalId` (camelCase) |
| `document_templates` | DTO field naming | `template_body`, `variable_schema` (snake_case) in otherwise camelCase project |
| `addresses` | DTO→DB mapping | DTO `lines` → DB `line1` (semantic mismatch) |

---

## 14. P2 — Duplicate / Conflicting DTOs

| Entity | DTO 1 | DTO 2 | Conflict |
|--------|-------|-------|----------|
| `courts` | `admin.dto.CreateCourtDto` (3 fields) | `court.dto.CreateCourtDto` (8 fields) | Two endpoints create courts with different schemas |

**Fix**: Consolidate to a single DTO; keep the richer one (8 fields). Deprecate admin route or have it delegate.

---

## 15. P2 — Missing Validation Decorators

| Entity | Field | Missing | Risk |
|--------|-------|---------|------|
| `contacts` | `email` | `@IsEmail` | Malformed emails accepted |
| `contacts` | `isPrimary` | `@IsBoolean` | Truthy strings accepted |
| `addresses` | `isPrimary` | `@IsBoolean` | Truthy strings accepted |
| `addresses` | `type` | `@IsEnum` | Free text accepted for CHECK-constrained column |

---

## 16. P2 — Phase 2 Columns With No DTO Support

| Entity | Column | Added By |
|--------|--------|----------|
| `cases` | `primary_court_id`, `primary_judge_id` | phase2-migration.sql |
| `tasks` | `calendar_event_id`, `estimated_hours` | phase2-migration.sql |
| `documents` | `folder_id`, `full_text_content`, `ocr_status` | phase2-migration.sql |
| `notes` | `updated_at`, `updated_by`, `edit_history` | phase2-migration.sql |
| `document_versions` | `storage_provider` | phase2-migration.sql |

---

## 17. Architecture & Security Gaps

### 17.1 Authentication (P0 for Production)
- **Current**: Dev-only hardcoded users with no real JWT verification
- **Impact**: Zero security in production
- **Fix**: Implement proper JWT auth with refresh tokens (Microsoft Entra ID recommended per project docs)

### 17.2 Zero Unit Tests
- **Current**: No test files exist in backend
- **Impact**: No regression protection
- **Fix**: Add Jest tests for all services, starting with financial operations (payments, invoices, expenses)

### 17.3 Simulated Workers
- **Current**: BullMQ workers for document scanning and notification delivery are simulated (just log and return)
- **Impact**: No actual virus scanning or notification delivery
- **Fix**: Integrate ClamAV for scanning; integrate email/push for notifications

### 17.4 Missing Audit Trail
- **Current**: No audit_events table implementation despite being in schema
- **Impact**: Compliance gap for legal application
- **Fix**: Implement audit interceptor that logs all mutations

### 17.5 Missing Case Membership & Case Party Create Forms
- **Current**: No UI to add team members or parties to a case
- **Impact**: Core case management workflow broken
- **Fix**: Add create dialogs on the case detail page for memberships and parties

### 17.6 `console.log` in Production Code
- **Current**: `ExpensesTab.tsx` has `console.log(expense)` in submit handler
- **Impact**: PII leakage in browser console
- **Fix**: Remove all `console.log` statements

---

## 18. Appendix: Per-Entity Field Map

*(See detailed per-entity tables in the DTO vs DB comparison analysis)*

### Entity Count Summary

| Category | Count |
|----------|-------|
| DB Tables (tenant schema) | ~40 |
| Backend Modules | 18 |
| API Routes | 159 |
| DTO Classes | 60+ |
| Frontend Pages | 20+ |
| Frontend API Modules | 13 |
| P0 Gaps | 14 |
| P1 Gaps | 48+ |
| P2 Gaps | 30+ |
