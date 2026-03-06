# Implementation Notes

## Assumptions
1. Backend DTO/controller contracts are canonical for API shape.
2. Existing role/permission behavior remains unchanged unless mismatch fix requires minimal correction.
3. Review findings are treated as hypotheses until verified in current branch code; discrepancies are logged below.

## Code-vs-Review Discrepancies
- Review requested a user selector for document share; current codebase has no lightweight reusable user-lookup selector in documents detail flow. Implemented strict UUID input validation for contract correctness as an interim fix.
- Review flagged dropped case transition `rowVersion`, but current backend transition DTOs do not accept `rowVersion`; sending it would violate whitelist/forbidNonWhitelisted validation.

## Deferred/Blocked Items
- Deferred: document share user-picker UX (requires reusable user lookup/autocomplete component and/or admin user list integration endpoint for non-admin contexts).
- Blocked: case transition concurrency token wiring (backend transition/on-hold/reopen DTOs/controllers currently reject `rowVersion` because of whitelist validation; requires backend contract change before adapter can send token).

## Risky Changes Isolation Log
- SettingsTab now only edits backend-supported tenant fields (`currency`, `timezone`, `locale`, `planTier`, `lawyerCanDraft`) to avoid DTO rejections.

## Technical Findings During Implementation
- Search backend contract is `{ results, cursor, totalEstimate }`; prior frontend paginated-shape assumptions were inaccurate.
- Document check-in is a two-step workflow (metadata handshake then storage PUT); prior UI implemented only the first step.
- Customer create business rules in service are stricter than DTO-only surface: identity requirements are conditional by `customerType` and must be mirrored in UI for acceptable UX.
- Court/judge contracts expose canonical values in snake_case DB output (`jurisdiction_level`, `address_text`, `full_name`), so frontend types/pages must preserve backend field names to avoid repetitive ad-hoc mapping.
- Hearing list payload already includes resolved `case_title`/`court_name`/`judge_name`; lookup maps are still needed as safe fallback to avoid showing raw IDs when joined labels are absent.
- Case session edit should not be treated as equivalent to reschedule; backend supports distinct patch vs reschedule routes and UI now needs to branch accordingly.
- Case party list quality depends on backend join enrichment (party/customer names), not only frontend mapping.
