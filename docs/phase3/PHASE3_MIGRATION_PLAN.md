# Phase 3 Migration Plan

## Migration Strategy
- Additive schema changes first.
- Backfill and enum/state normalization second.
- API compatibility layer third.
- UI enforcement after backend feature flags confirm readiness.

## Migration Waves

| Wave | Scope | Notes |
|---|---|---|
| W1 | Customer/Case/Session enrichment columns | No destructive change; defaults + nullable fields. |
| W2 | Approval engine tables and state constraints | Introduce generic workflow tables; map existing expense approvals. |
| W3 | Status history table and write hooks | Backfill from audit logs for key entities where feasible. |
| W4 | Document lifecycle upgrades | Folder integrity fixes, expiry fields, external sharing hardening. |
| W5 | Notification outbox + retries | Ensure idempotency keys and dead-letter handling. |
| W6 | Reporting materialized views/indexes | Performance guardrails for dashboards. |

## Backfill Rules
- Preserve original timestamps and actor IDs whenever source exists.
- Mark synthetic backfill rows with `metadata.backfilled=true`.
- Never infer approval steps without source evidence.

## Rollback Guidelines
- Each wave ships with reversible migration scripts where practical.
- Feature flags guard UI/action entry points until data validation passes.
- Rollback path documented per wave in deployment runbook.
