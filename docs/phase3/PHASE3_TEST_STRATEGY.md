# Phase 3 Test Strategy

## 1. Test Pyramid
- **Unit**: validators, state machines, policy guards, timeline mappers.
- **Integration**: approval transitions, status-history writes, notification outbox, migration/backfill logic.
- **E2E**: invoice/wage approval journeys, postponement approvals, folder and external-share flows.

## 2. Priority Test Suites
1. Approval segregation-of-duties and reject/rollback semantics.
2. Status timeline correctness and ordering.
3. Notification delivery retries and preference honoring.
4. Dashboard aggregate correctness against fixture datasets.
5. Multi-tenant isolation for all new queries.

## 3. Quality Gates
- New Phase 3 backend modules: >=85% line coverage.
- New frontend shared components (`StatusTimeline`, `ApprovalActions`): >=80% coverage.
- Migration test harness validates upgrade + downgrade on seeded snapshot.

## 4. Operational Validation
- Synthetic canary runs for notification SLA checks.
- Performance smoke tests for dashboard endpoints and timeline-heavy detail pages.
