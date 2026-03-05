# LOMA — Gap Backlog

> Structured backlog of all gaps found in the full-stack analysis.  
> **Priority**: P0 = runtime failure, P1 = broken UX/workflow, P2 = data quality/cosmetic  
> **Layer**: DB = schema, BE = backend DTO/service, FE = frontend form/API  

| ID | Priority | Layer | Entity | Gap Title | Root Cause | Fix Summary | Status |
|----|----------|-------|--------|-----------|-----------|-------------|--------|
| G-001 | P0 | BE | time_entries | Column name mismatch: `hourly_rate` vs `rate_per_hour` | Service SQL uses wrong column name | Rename `hourly_rate` → `rate_per_hour` in INSERT/UPDATE SQL | ✅ DONE |
| G-002 | P0 | BE | folders | Column name mismatch: `parent_id` vs `parent_folder_id` | Service SQL uses wrong column name | Rename `parent_id` → `parent_folder_id` in SQL | ✅ DONE |
| G-003 | P0 | BE | folders | Column `case_id` doesn't exist; should be `scope_id` | Service maps DTO `caseId` to non-existent column | Map to `scope_id` instead | ✅ DONE |
| G-004 | P0 | BE | folders | Column `description` doesn't exist in DB | Service writes column that was never in schema | Remove from INSERT; remove DTO field or add column | ✅ DONE |
| G-005 | P0 | BE | payments | Enum mismatch: DTO `'CreditCard'` vs DB CHECK `'Card'` | DTO enum value differs from DB constraint | Change DTO enum value to `'Card'`; update FE labels | ✅ DONE |
| G-006 | P0 | BE | calendar_reminders | Enum mismatch: DTO allows `'SMS'`, DB CHECK only `('InApp','Email')` | DTO enum has extra value | Remove `'SMS'` from DTO enum | ✅ DONE |
| G-007 | P0 | BE | folders | Scope enum mismatch: DTO `'Global'`/`'Template'` vs DB `'Customer'`/`'Tenant'` | DTO enum values differ from DB CHECK | Align DTO to `['Customer','Case','Tenant']` | ✅ DONE |
| G-008 | P0 | BE | communications | `summary` is `@IsOptional` but DB column is `NOT NULL` | DTO/DB mismatch | Make `summary` required in DTO | ✅ DONE |
| G-009 | P0 | FE | hearings | `case_id` rendered as free-text input (should be case dropdown) | FK field treated as string input | Replace with Select loading cases | ✅ DONE |
| G-010 | P0 | FE | hearings | `hearing_type` rendered as free-text (should be dropdown) | Missing enum/master-data select | Replace with Select using HEARING_TYPES array | ✅ DONE |
| G-011 | P0 | FE | contacts | `role_id` rendered as free-text (should be master-data dropdown) | FK field treated as string input | Replace with Select (6 roles) | ✅ DONE |
| G-012 | P0 | FE | addresses | `address_type` rendered as free-text (should be enum select) | Missing enum Select | Replace with Select: Home/Work/Mailing/Other | ✅ DONE |
| G-013 | P0 | FE | wages | `userId` rendered as free-text (should be user dropdown) | FK field treated as string input | Replace with Select loading users | ✅ DONE |
| G-014 | P0 | FE | documents | Confidentiality hardcoded `'Standard'` ≠ DB default `'Normal'` | UI enum mismatch | Fix to use `'Normal'`/`'Confidential'`/`'Restricted'` | ✅ DONE |
| G-015 | P1 | BE | 20+ entities | FK fields validated as `@IsString` instead of `@IsUUID` | Missing UUID validation | Add `@IsUUID()` decorator to 35+ FK fields across 10 DTOs | ✅ DONE |
| G-016 | P1 | FE | tasks | No Edit UI (Create exists, Edit absent) | Missing implementation | Add editTask state + openEditTask + save branching | ✅ DONE |
| G-017 | P1 | FE | sessions | No Edit UI | Missing implementation | Add editSession + openEditSession on case detail | ✅ DONE |
| G-018 | P1 | FE | filings | No Edit UI | Missing implementation | Add editFiling + openEditFiling on case detail | ✅ DONE |
| G-019 | P1 | FE | hearings | No Edit UI | Missing implementation | Add editHearing + Edit IconButton + save branching | ✅ DONE |
| G-020 | P1 | FE | courts | No Edit UI | Missing implementation | Add editCourt + Edit on AccordionSummary | ✅ DONE |
| G-021 | P1 | FE | judges | No Edit UI | Missing implementation | Add editJudge + Edit on judge rows | ✅ DONE |
| G-022 | P1 | FE | communications | No Edit UI | Missing implementation | Add edit dialog | ✅ DONE |
| G-023 | P1 | FE | notes | No Edit UI | Missing implementation | Add edit dialog | ✅ DONE |
| G-024 | P1 | FE | invoices | No Edit UI | Missing implementation | Add editInvoice + Edit for Draft invoices | ✅ DONE |
| G-025 | P1 | FE | payments | No Edit UI | Missing implementation | Add edit dialog | ✅ DONE |
| G-026 | P1 | FE | expenses | No Edit UI | Missing implementation | Add editExpense + Edit for Pending/Submitted | ✅ DONE |
| G-027 | P1 | FE | wages | No Edit UI | Missing implementation | Add editWage + Edit IconButton + save branching | ✅ DONE |
| G-028 | P1 | FE | time_entries | No Edit UI | Missing implementation | Add editEntry + Edit for owner+Draft entries | ✅ DONE |
| G-029 | P1 | FE | calendar_events | No Edit UI | Missing implementation | Add edit via calendarApi.update() | ✅ DONE |
| G-030 | P1 | FE | document_templates | No Edit UI | Missing implementation | Add editTemplate + DataGrid actions column | ✅ DONE |
| G-031 | P1 | FE | cases | No Create forms for Case Membership | Missing implementation | Add membership dialog on case detail | ✅ DONE |
| G-032 | P1 | FE | cases | No Create forms for Case Party | Missing implementation | Add party dialog on case detail | ✅ DONE |
| G-033 | P1 | FE | cases | Case Type dropdown hardcoded | Should fetch from master_data API | Replace with API-driven select | ✅ DONE |
| G-034 | P1 | FE | sessions | Session Type dropdown hardcoded | Should fetch from master_data API | Replace with API-driven select | ✅ DONE |
| G-035 | P1 | FE | filings | Filing Type dropdown hardcoded | Should fetch from master_data API | Replace with API-driven select | ✅ DONE |
| G-036 | P1 | FE | communications | Comm Type dropdown hardcoded | Should fetch from master_data API | Replace with API-driven select | ✅ DONE |
| G-037 | P1 | FE | documents | Doc Type dropdown hardcoded | Should fetch from master_data API | Replace with API-driven select | ✅ DONE |
| G-038 | P1 | FE | hearings | Hearing Type dropdown hardcoded | Should fetch from master_data API | Implemented with HEARING_TYPES array | ✅ DONE |
| G-039 | P1 | FE | expenses | Category dropdown hardcoded | Should fetch from master_data API | Replace with API-driven select | ✅ DONE |
| G-040 | P1 | FE | sessions | `courtId` text input → dropdown | FK as text input | Replace with Autocomplete loading courts | ✅ DONE |
| G-041 | P1 | FE | filings | `typeId` text input → dropdown | FK as text input | Replace with Select loading master data | ✅ DONE |
| G-042 | P1 | FE | tasks | `assigneeUserId` text input → dropdown | FK as text input | Replace with Select loading users | ✅ DONE |
| G-043 | P1 | FE | notes | `referencedNoteId` text input → dropdown | FK as text input | Replace with Autocomplete loading notes | ✅ DONE |
| G-044 | P1 | BE/FE | addresses | `line2` DB column never written | No DTO field or form input | Add `line2` to DTO and form | ✅ DONE |
| G-045 | P1 | BE/FE | case_customers | `role` per-customer always 'Client' | No DTO field for role | Add role param to API and form | ✅ DONE |
| G-046 | P1 | BE/FE | tasks | `linked_document_ids` not exposed | No DTO field | Add multi-select doc picker | ✅ DONE |
| G-047 | P1 | BE/FE | sessions | `linked_document_ids` not exposed | No DTO field | Add multi-select doc picker | ✅ DONE |
| G-048 | P1 | BE/FE | documents | `description` and `tags` never written | No DTO fields | Add to DTO and upload form | ✅ DONE |
| G-049 | P1 | BE/FE | wages | 5 columns never written (staff_name, deductions, etc.) | Severely under-modeled | Add DTO fields and form inputs | ✅ DONE |
| G-050 | P1 | BE/FE | time_entries | `total_amount` never computed | No server-side calculation | Compute `hours × rate_per_hour` on save | ✅ DONE |
| G-051 | P1 | BE/FE | time_entries | `task_id` not exposed | No DTO field | Add optional task picker | ✅ DONE |
| G-052 | P2 | BE | sessions | `endDateTime` required in DTO but nullable in DB | Over-strict validation | Add `@IsOptional()` | ✅ DONE |
| G-053 | P2 | BE | calendar_events | `endAt` required in DTO but nullable in DB | Over-strict validation | Add `@IsOptional()` | ✅ DONE |
| G-054 | P2 | BE | expenses | `caseId`, `customerId`, `categoryId` required but DB nullable | Over-strict validation | Add `@IsOptional()` | ✅ DONE |
| G-055 | P2 | BE | invoices | `caseId` required but DB nullable | Over-strict validation | Add `@IsOptional()` | ✅ DONE |
| G-056 | P2 | BE | time_entries | `description` required but DB nullable | Over-strict validation | Add `@IsOptional()` | ✅ DONE |
| G-057 | P2 | BE | customers | Create/Update DTO naming inconsistency (snake vs camel) | Inconsistent naming | Standardize to camelCase | ✅ DONE |
| G-058 | P2 | BE | document_templates | DTO uses snake_case (`template_body`) in camelCase project | Inconsistent naming | Rename to `templateBody` | ✅ DONE |
| G-059 | P2 | BE | courts | Duplicate DTOs: admin.dto vs court.dto | Two modules creating same entity | Consolidate to single DTO | ✅ DONE |
| G-060 | P2 | BE | contacts | `email` missing `@IsEmail` decorator | Missing validation | Add `@IsEmail()` | ✅ DONE |
| G-061 | P2 | BE | contacts/addresses | `isPrimary` missing `@IsBoolean` decorator | Missing validation | Add `@IsBoolean()` | ✅ DONE |
| G-062 | P2 | BE | addresses | `type` missing `@IsEnum` decorator | Missing validation | Add `@IsEnum()` with CHECK values | ✅ DONE |
| G-063 | P2 | BE/FE | 5+ entities | Phase 2 columns with no DTO support | Not yet implemented | Add DTO fields as needed | ✅ DONE |
| G-064 | P2 | FE | expenses | `console.log(expense)` in production code | Debug code left in | Remove console.log | ✅ DONE |
| G-065 | P2 | BE | document_versions | `changeNote` DTO field has no DB column | Field without storage | Add column or remove DTO field | ✅ DONE |
| G-066 | Arch | BE | auth | Dev-only hardcoded auth, no production JWT | No auth implementation | Implement proper JWT/Entra ID auth | ✅ DONE |
| G-067 | Arch | BE | testing | Zero unit tests | No test infrastructure | Add Jest tests for all services | ✅ DONE |
| G-068 | Arch | BE | workers | Simulated document scan & notification workers | Placeholder implementations | Integrate ClamAV + email/push | ✅ DONE |
| G-069 | Arch | BE | audit | No audit_events implementation | Feature not built | Implement audit interceptor | ✅ DONE |
| G-070 | Arch | BE/FE | calendar | Calendar view missing proper recurring event support | `recurrence_rule` never written | Implement recurrence engine | ✅ DONE |
