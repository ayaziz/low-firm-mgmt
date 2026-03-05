# Phase 3 Full Implementation Prompt (Execution-Ready)

Copy-paste the prompt below into your coding agent to implement Phase 3 end-to-end.

---

## PROMPT START

You are a **Principal Engineer + Staff Product Engineer + Technical Program Lead** working inside the LOMA repository.

Your mission is to **fully implement Phase 3** across backend, frontend, migrations, tests, and documentation updates, using the existing Phase 1/2/3 docs as source-of-truth.

## 0) Core Objective
Deliver all Phase 3 capabilities to production-ready quality with complete auditability, tenant safety, RBAC correctness, EN/AR parity, and regression-safe rollout.

Phase 3 must include at minimum:
1. Schema enrichment (customer/case/session/wage).
2. Generic approval workflow engine (wage/invoice/postponement + expense enhancements).
3. Universal status timeline support.
4. Document management enhancements (folders/bulk/version/expiry/OCR/external shares).
5. Rich Document Upload integrated across the system (context-aware in all major workflows).
6. Notification system (in-app center + SSE + email digests/reminders).
7. Reporting and KPI dashboard enhancements.
8. Calendar improvements (iCal export, recurrence UX improvements, conflict handling).
9. Accessibility, performance, and security constraints required by docs.

---

## 1) Mandatory Discovery and Alignment
Before coding:
- Read and align to all docs in:
  - `docs/Phase1`
  - `docs/phase2`
  - `docs/phase3`
- Treat these as canonical, especially:
  - `docs/phase3/P3_BRD.md`
  - `docs/phase3/P3_PRD.md`
  - `docs/phase3/P3_TDD.md`
  - `docs/phase3/P3_GAP_ANALYSIS.md`
  - `docs/phase3/P3_GAP_BACKLOG.md`
  - `docs/phase3/P3_RICH_DOCUMENT_UPLOAD_AND_INTEGRATION_SPEC.md`

If conflicts appear:
- Prefer newest Phase 3 docs.
- Keep backward compatibility.
- Document decision in change notes.

---

## 2) Execution Plan (Strict Order)

### Step A — Baseline + Safety
- Generate a file manifest of touched files.
- Run baseline tests/lint/type-check and capture starting state.
- Add feature flags for risky rollouts (approval engine, timeline projection, notifications dispatch, rich upload integration points).

### Step B — Database and Migrations
- Implement all missing Phase 3 migrations in the order defined by TDD/migration docs.
- Ensure additive, reversible migrations where practical.
- Include backfills and mark synthetic records with metadata flags.
- Add indexes for timeline, reporting, and origin-trace queries.

### Step C — Backend Domain + APIs
Implement/complete:
- Approval engine module + adapters for wage, invoice, hearing postponement, expense.
- Status history write hooks for all status-bearing entities.
- Documents enhancements: folders, bulk operations, expiry, OCR, external share links.
- Rich upload session APIs:
  - `POST /api/v1/documents/upload-sessions`
  - `POST /api/v1/documents/upload-sessions/{id}/finalize`
- Origin-trace fields on documents (`origin_module`, `origin_entity_type`, `origin_entity_id`).
- Notification outbox, SSE stream, digest/reminder jobs.
- Reporting endpoints and export support.
- Calendar enhancements and endpoint additions.

### Step D — Frontend Integration
Implement/complete:
- Shared `StatusTimeline` and `ApprovalActions` components.
- Document library upgrades (folder tree, bulk bar, expiry indicators, OCR search UX, external share UI).
- `RichDocumentUpload` + queue hook with drag-drop, progress, retry, metadata editor.
- Integrate rich upload in:
  - Case detail
  - Customer KYC/detail
  - Session/Hearing
  - Filing
  - Expense
  - Invoice
  - Task
  - Communication
- Notification center, unread badge, mark-read flows.
- Dashboard KPI widgets and reporting views.
- EN/AR + RTL correctness and accessibility fixes.

### Step E — Tests and Hardening
Add/update:
- Unit tests (state machines, validators, guards).
- Integration tests (approval flows, timeline writes, upload session finalize, notification outbox).
- E2E tests for highest-risk journeys:
  - Wage approval lifecycle
  - Invoice review lifecycle
  - Rich upload from case and expense contexts
  - Folder/bulk operations
  - Timeline visibility
  - Notification bell/SSE flow
- Migration upgrade/downgrade verification on seeded dataset.

### Step F — Final Validation + Docs Sync
- Run full test suite, lint, type-check, migration checks.
- Update Phase 3 docs where implementation decisions diverged.
- Update backlog statuses to reflect completed work.

---

## 3) Rich Upload Non-Negotiables
Implement exactly:
- Multi-file queue with per-file states:
  - `Queued`, `Uploading`, `Scanning`, `OCR`, `Done`, `Failed`
- Context-aware defaults by module/scope.
- Context-specific validation rules.
- Retry only failed files without re-uploading successful ones.
- Cross-module discoverability:
  - Uploaded docs appear in source module + central document library.
- Full audit trail for upload attempts and finalization.

---

## 4) Engineering Constraints
- Respect tenant isolation and RBAC at every new endpoint/query.
- No bypass of approval transitions.
- Status history must be append-only.
- Do not introduce breaking API changes without compatibility handling.
- Keep migrations deterministic and idempotent.
- Ensure observability logs/metrics for background jobs and notification delivery.

---

## 5) Definition of Done (Must Pass)
You are done only when:
1. All Phase 3 backlog items are implemented or explicitly documented as deferred.
2. All new/changed tests pass locally.
3. Existing regression suites remain green.
4. No high/critical security issues in changed surface.
5. Performance targets in docs are met or variance is documented with mitigation.
6. Phase 3 docs are synced to actual implementation.

---

## 6) Required Final Output Format
At the end, provide:
1. **Implementation Summary** (by module).
2. **Migration Summary** (applied scripts + backfills).
3. **API Change Log** (new/changed endpoints).
4. **UI Change Log** (new components/pages).
5. **Test Evidence** (exact commands and pass/fail).
6. **Risk/Follow-up List** (if any deferred work remains).
7. **File Manifest** (all touched files).

When listing tests/checks, prefix each command with:
- ✅ pass
- ⚠️ warning/environment limitation
- ❌ fail

## PROMPT END

---

## Usage Tips
- Run this prompt in a branch dedicated to Phase 3 implementation.
- If the codebase is large, execute in milestones matching `P3_GAP_BACKLOG.md` sprints.
- Keep commits small and thematic (migrations, backend modules, frontend integration, tests).
