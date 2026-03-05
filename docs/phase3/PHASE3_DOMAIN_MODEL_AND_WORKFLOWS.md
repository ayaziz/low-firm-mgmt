# Phase 3 Domain Model and Workflows

## 1. Domain Extensions

### 1.1 New/Extended Entities
- **CustomerProfileExtension**: KYC, risk profile, credit rating, relationship manager.
- **CaseExtension**: opposing counsel, legal acts, risk, priority, source, estimated value.
- **SessionExtension**: judge link, witness list, actual timing/outcome, billable markers, postponement chain.
- **ApprovalInstance / ApprovalStep**: generic entity approval framework.
- **StatusHistory**: append-only status transition ledger.
- **DocumentLifecycle**: folder hierarchy, expiry metadata, external share policy.
- **NotificationDispatch**: outbox/attempt status for in-app/email delivery.

## 2. Canonical Workflow State Machines

### 2.1 Wage
`Draft -> Submitted -> Approved -> Paid` (+ `Rejected` return to `Draft`)

### 2.2 Invoice (configurable review)
`Draft -> Review -> Approved -> Sent -> Paid` (+ `Rejected` to `Draft`, `Void` terminal)

### 2.3 Hearing Postponement
`Requested -> Approved -> Rescheduled` / `Rejected`

### 2.4 Expense (enhanced)
Existing chain retained; now includes full step comments + timeline projection.

## 3. Cross-Cutting Lifecycle Hooks
For each governed transition:
1. Validate actor permission + segregation-of-duties constraints.
2. Apply state change transactionally.
3. Write `status_history` entry.
4. Emit audit event.
5. Queue notification dispatch.

## 4. API Contract Principles
- Backward-compatible additive DTO evolution.
- State transitions exposed via explicit action endpoints (not generic patch where possible).
- Timeline endpoints standardized:
  - `GET /{entity}/{id}/status-history`
- Approval action endpoint standardized:
  - `POST /approvals/{entityType}/{entityId}/actions`

## 5. UI Composition Principles
- Shared `StatusTimeline` component reused across Case, Invoice, Wage, Expense, Filing, Document.
- Shared `ApprovalActions` block for submit/approve/reject/comment patterns.
- Consistent badge semantics for statuses and risk levels across modules.
