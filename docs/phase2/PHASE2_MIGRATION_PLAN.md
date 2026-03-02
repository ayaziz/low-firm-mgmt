# Phase 2 Migration Plan
## Law Office Management Application (LOMA)

**Version:** 1.0  
**Date:** 2026-02-25  
**Scope:** Database migrations, data transformations, storage provider migration, auth migration, rollback procedures  
**Baseline:** Phase 1 PostgreSQL 16 schema-per-tenant, MinIO local storage, JWT dev-mode auth

---

## 1. Migration Principles

1. **All migrations are reversible** — every `up()` has a matching `down()`
2. **Zero-downtime** — use additive-first strategy (add columns → backfill → enforce constraints)
3. **Tenant-scoped** — migrations run per tenant schema; shared schemas migrated separately
4. **Transactional** — each migration file runs in a single DB transaction
5. **Idempotent** — migrations check current state before applying
6. **Ordered by dependency** — topic-sorted then dependency-sorted within each sprint

---

## 2. Database Migrations

### 2.1 Sprint 1 — Foundation & Auth

| # | Migration | Type | Reversible | Notes |
|---|---|---|---|---|
| M-001 | Add `oidc_subject`, `oidc_issuer` columns to `users` | ALTER TABLE | Yes — DROP COLUMN | Both nullable initially |
| M-002 | Create index `ix_users_oidc_subject` on `(oidc_subject, oidc_issuer)` | CREATE INDEX | Yes — DROP INDEX | Unique per tenant schema |
| M-003 | Add `auth_mode` to `tenants` table | ALTER TABLE | Yes — DROP COLUMN | Enum: `jwt`, `oidc`; default `jwt` |

**Rollback:** Drop columns and indexes. No data loss (columns are nullable additions).

### 2.2 Sprint 2 — Courts, Judges, Hearings

| # | Migration | Type | Reversible | Notes |
|---|---|---|---|---|
| M-010 | Extend `courts` table — add `department`, `circuit`, `jurisdiction_level`, `is_active` | ALTER TABLE | Yes | `jurisdiction_level` enum: `District`, `Appeal`, `Supreme`, `Specialized` |
| M-011 | Create `judges` table | CREATE TABLE | Yes — DROP TABLE | FK → `courts.id` |
| M-012 | Create `hearings` table | CREATE TABLE | Yes — DROP TABLE | FKs → `cases.id`, `courts.id`, `judges.id` |
| M-013 | Add `primary_court_id`, `primary_judge_id` to `cases` | ALTER TABLE | Yes | Nullable FKs |
| M-014 | Create index `ix_hearings_case_date` on `(case_id, hearing_date)` | CREATE INDEX | Yes | Covering index for case hearing list |
| M-015 | Create index `ix_hearings_status` on `(status)` | CREATE INDEX | Yes | Filter by status |

**Rollback:** Drop hearings → judges → drop case columns → drop court columns. No data loss for new tables; court column drops lose new column data only.

### 2.3 Sprint 3 — Calendar

| # | Migration | Type | Reversible | Notes |
|---|---|---|---|---|
| M-020 | Create `calendar_events` table | CREATE TABLE | Yes | Includes `recurrence_rule` text column |
| M-021 | Create `calendar_reminders` table | CREATE TABLE | Yes | FK → `calendar_events.id` |
| M-022 | Create `calendar_event_attendees` table | CREATE TABLE | Yes | FK → `calendar_events.id`, `users.id` |
| M-023 | Add `calendar_event_id` FK to `hearings` | ALTER TABLE | Yes | Nullable; backfill in M-024 |
| M-024 | Backfill: create CalendarEvent for each existing Hearing | DATA | Yes — delete generated rows | Script creates events, links `hearing.calendar_event_id` |
| M-025 | Add `calendar_event_id` FK to `sessions` | ALTER TABLE | Yes | Nullable |
| M-026 | Backfill: create CalendarEvent for each existing Session | DATA | Yes — delete generated rows | Links `session.calendar_event_id` |
| M-027 | Add `calendar_event_id`, `estimated_hours` to `tasks` | ALTER TABLE | Yes | Both nullable |
| M-028 | Create indexes on `calendar_events` — `(tenant_id, start_at, end_at)`, `(case_id)` | CREATE INDEX | Yes | Range queries + case filter |

**Rollback:** Delete backfilled calendar events → drop attendees → reminders → calendar_events → drop FK columns from hearings/sessions/tasks.

### 2.4 Sprint 4 — Folders & Document Extensions

| # | Migration | Type | Reversible | Notes |
|---|---|---|---|---|
| M-030 | Create `folders` table | CREATE TABLE | Yes | Includes materialized `path` column |
| M-031 | Create `document_templates` table | CREATE TABLE | Yes | `template_body` text, `variable_schema` jsonb |
| M-032 | Add `folder_id` FK to `documents` | ALTER TABLE | Yes | Nullable — root-level docs have NULL |
| M-033 | Add `full_text_content` (text), `ocr_status` (enum) to `documents` | ALTER TABLE | Yes | `ocr_status`: `Pending`, `Processing`, `Completed`, `Failed`, `NotApplicable` |
| M-034 | Create GIN index on `to_tsvector('english', full_text_content)` | CREATE INDEX | Yes | Full-text search |
| M-035 | Create GIN index on `to_tsvector('arabic', full_text_content)` | CREATE INDEX | Yes | Arabic full-text search |
| M-036 | Add `checksum_sha256`, `storage_provider` to `document_versions` | ALTER TABLE | Yes | `storage_provider` enum: `minio`, `azure_blob` |
| M-037 | Backfill: create root folders per Customer and Case | DATA | Yes — delete | Creates `/clients/{name}` and `/clients/{name}/cases/{title}` folders |
| M-038 | Backfill: assign existing documents to case folders | DATA | Yes — set folder_id=NULL | Sets `folder_id` for existing docs based on `case_id` |

**Rollback:** Nullify `folder_id` on documents → delete backfill folders → drop templates → folders → drop document columns.

### 2.5 Sprint 5 — Time Entries & Billing

| # | Migration | Type | Reversible | Notes |
|---|---|---|---|---|
| M-040 | Create `time_entries` table | CREATE TABLE | Yes | All fields per ERD |
| M-041 | Add `time_entry_ids` jsonb to `invoice_lines` (or create join table) | ALTER TABLE | Yes | Links approved time entries to invoice lines |
| M-042 | Create index `ix_time_entries_user_date` on `(user_id, entry_date)` | CREATE INDEX | Yes | Timesheet queries |
| M-043 | Create index `ix_time_entries_case_status` on `(case_id, status)` | CREATE INDEX | Yes | Case billing view |

**Rollback:** Drop indexes → remove invoice_lines column → drop time_entries.

### 2.6 Sprint 6 — Notifications & Templates Enhancement

| # | Migration | Type | Reversible | Notes |
|---|---|---|---|---|
| M-050 | Create `notification_subscriptions` table | CREATE TABLE | Yes | Per ERD |
| M-051 | Create `notifications` table (in-app log) | CREATE TABLE | Yes | `user_id`, `type`, `title`, `body`, `read`, `created_at` |
| M-052 | Add `task_template_json`, `session_template_json`, `participant_template_json` to `case_types` | ALTER TABLE | Yes | JSONB columns, nullable |
| M-053 | Alter `notes` — add `updated_at`, `updated_by`, `edit_history_json` | ALTER TABLE | Yes | Remove append-only constraint |

**Rollback:** Drop notifications tables → drop case_types columns → drop notes extensions.

### 2.7 Sprint 7–8 — Cleanup & Optimization

| # | Migration | Type | Reversible | Notes |
|---|---|---|---|---|
| M-060 | Add NOT NULL constraint on `documents.folder_id` (if policy mandates) | ALTER TABLE | Yes — DROP CONSTRAINT | Only after confirming all docs have folder_id |
| M-061 | Deprecation: add `deprecated_at` to `sessions` standalone scheduling fields | ALTER TABLE | Yes | Soft-deprecation marker |
| M-062 | Materialized view `mv_case_hearing_summary` | CREATE MATERIALIZED VIEW | Yes | Pre-computed for dashboard widgets |
| M-063 | Materialized view `mv_timesheet_monthly` | CREATE MATERIALIZED VIEW | Yes | Monthly billing rollup |

---

## 3. Data Transformations

### 3.1 Existing Documents → Folder Structure

**When:** M-037 + M-038 (Sprint 4)

**Algorithm:**
1. For each tenant schema:
   a. Query distinct `customers` → create `/clients/{customer.name}` folder
   b. Query `cases` per customer → create `/clients/{customer.name}/cases/{case.title}` folder
   c. Query `documents` per case → set `document.folder_id` to case folder
   d. Orphan documents (no case) → assign to customer root folder
2. Set `folder.scope = 'Customer'` for customer folders, `'Case'` for case folders
3. Log: count of folders created, documents assigned, orphans

**Estimated volume:** ~500 documents, ~120 cases, ~40 customers (typical small firm)

**Rollback:** Set `folder_id = NULL` on all documents, delete all auto-created folders.

### 3.2 Court Table Extension

**When:** M-010 (Sprint 2)

**Algorithm:**
1. Existing courts get `jurisdiction_level = 'District'` (default), `is_active = true`
2. `department`, `circuit` set to NULL (user fills in later)

### 3.3 Notes Table — Remove Append-Only

**When:** M-053 (Sprint 6)

**Algorithm:**
1. Backfill `updated_at = created_at` for all existing notes
2. Backfill `updated_by = created_by` for all existing notes
3. Set `edit_history_json = '[]'::jsonb`

### 3.4 Session → CalendarEvent Migration

**When:** M-026 (Sprint 3)

**Algorithm:**
1. For each `session`:
   a. Create `CalendarEvent` with `event_type = 'Session'`, `start_at = session.session_date`, duration = 1h default
   b. Set `session.calendar_event_id = new_event.id`
   c. Copy `session.case_id` to `calendar_event.case_id`
2. Log: count of events created

---

## 4. Authentication Migration (JWT → OIDC)

### 4.1 Strategy — Dual-Mode Transition

```
Phase 1 (Current)          Phase 2 Sprint 1-2         Phase 2 Sprint 7+
─────────────────          ────────────────────        ──────────────────
   JWT only           →    JWT + OIDC (feature flag)  →  OIDC primary
   AUTH_MODE=dev            AUTH_MODE=dev|oidc             AUTH_MODE=oidc
```

### 4.2 Steps

| Step | Sprint | Action |
|---|---|---|
| 1. Deploy IdP | S1 | Provision Keycloak (dev) or configure Entra ID (prod). Create LOMA client with PKCE. |
| 2. Add OIDC columns | S1 | Migration M-001, M-002 |
| 3. Implement OidcGuard | S1 | Guard validates OIDC tokens when `AUTH_MODE=oidc` |
| 4. User linking | S1 | On first OIDC login, match by email → populate `oidc_subject`, `oidc_issuer` |
| 5. Dual-mode testing | S2 | All integration tests run in both JWT and OIDC modes |
| 6. Tenant opt-in | S3+ | Per-tenant `auth_mode` flag; tenants migrate at their own pace |
| 7. Deprecate JWT | S7 | Log warning for JWT logins; schedule removal in Phase 3 |

### 4.3 Rollback

- Set `AUTH_MODE=dev` in environment → immediate fallback to JWT
- OIDC columns remain but are ignored
- No data loss

---

## 5. Storage Provider Migration (MinIO → Azure Blob)

### 5.1 Strategy — Abstraction Layer

```typescript
// StorageProvider interface (already partially exists)
interface StorageProvider {
  upload(bucket: string, key: string, stream: Readable): Promise<UploadResult>;
  download(bucket: string, key: string): Promise<Readable>;
  getSignedUrl(bucket: string, key: string, expiresIn: number): Promise<string>;
  delete(bucket: string, key: string): Promise<void>;
  copy(source: Key, destination: Key): Promise<void>;
}
```

### 5.2 Steps

| Step | Sprint | Action |
|---|---|---|
| 1. Abstract provider | S4 | Implement `StorageProvider` interface with MinIO + Azure Blob implementations |
| 2. Config-driven | S4 | `STORAGE_PROVIDER=minio|azure_blob` environment variable |
| 3. Azure Blob impl | S5 | `AzureBlobStorageProvider` using `@azure/storage-blob` SDK |
| 4. Dual-write (optional) | S6 | New uploads go to Azure Blob; reads fall back to MinIO |
| 5. Bulk migration | S7 | Script copies existing objects from MinIO → Azure Blob |
| 6. Cutover | S8 | Set `STORAGE_PROVIDER=azure_blob`; MinIO kept read-only for rollback |

### 5.3 Rollback

- Set `STORAGE_PROVIDER=minio` → immediate fallback
- All original objects remain in MinIO until explicitly deleted

---

## 6. Migration Execution Plan

### 6.1 Local Development

```bash
# Run all pending migrations
npm run migration:run

# Rollback last batch
npm run migration:revert

# Generate new migration
npm run migration:generate -- --name M-0XX_description
```

### 6.2 CI/CD Pipeline

```
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌────────────┐
│ Build + Lint │──→│ Unit Tests   │──→│ Migration Dry  │──→│ Integration│
│              │   │              │   │ Run (test DB)  │   │  Tests     │
└─────────────┘   └──────────────┘   └───────────────┘   └────────────┘
```

- Migrations run against `test` DB before integration tests
- Staging deployment applies migrations before app startup
- Production deployment uses rolling update: migrate → deploy new pods → healthcheck

### 6.3 Production Checklist

| # | Check | Owner |
|---|---|---|
| 1 | Backup all tenant schemas | DBA / DevOps |
| 2 | Run migrations on staging, verify | Dev Team |
| 3 | Run integration + E2E tests on staging | QA |
| 4 | Schedule maintenance window (backfill migrations) | DevOps |
| 5 | Apply migrations in production | DevOps |
| 6 | Verify tenant data integrity (spot checks) | Dev Team |
| 7 | Monitor error rates for 1 hour | DevOps |
| 8 | Confirm rollback scripts are ready | DBA |

---

## 7. Rollback Strategy

### 7.1 General Approach

| Scenario | Action | RTO |
|---|---|---|
| Migration fails mid-batch | Transaction auto-rollback (single transaction per migration) | < 1 min |
| Post-deploy data issue | Run `migration:revert` for affected migration | 5-10 min |
| Critical regression | Redeploy previous version + revert migrations | 15-30 min |
| Backfill corruption | Delete backfilled data, re-run with fix | 30-60 min |

### 7.2 Point-of-No-Return Migrations

Migrations that cannot be trivially reversed:

| Migration | Why | Mitigation |
|---|---|---|
| M-038 (doc → folder assignment) | Large data update | Pre-migration snapshot; batch processing with checkpoints |
| M-024 (hearing → calendar backfill) | Creates linked records | Backfill script tagged with `source='migration'` for easy cleanup |
| M-053 (notes append-only removal) | Semantic change | Old behavior preserved via `edit_history_json`; UI shows history |

---

## 8. Timeline Summary

| Sprint | Migrations | Risk Level |
|---|---|---|
| S1 | M-001 to M-003 (Auth foundations) | Low |
| S2 | M-010 to M-015 (Courts/Judges/Hearings) | Low |
| S3 | M-020 to M-028 (Calendar + backfills) | Medium — backfill complexity |
| S4 | M-030 to M-038 (Folders/Docs + backfills) | Medium — doc reassignment |
| S5 | M-040 to M-043 (Time entries) | Low |
| S6 | M-050 to M-053 (Notifications/Notes) | Low |
| S7-8 | M-060 to M-063 (Cleanup/Optimization) | Low |

**Total: ~40 migration files across 8 sprints**
