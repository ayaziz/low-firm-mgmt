# Phase 3 Risks and Decisions

## Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R3-01 | Approval complexity causes user friction | Medium | High | Progressive rollout by entity and contextual guidance in UI. |
| R3-02 | Timeline volume impacts detail-page performance | Medium | Medium | Pagination, indexed queries, lazy loading. |
| R3-03 | Reporting queries degrade OLTP performance | Medium | High | Materialized views/read replicas and query budget monitoring. |
| R3-04 | Notification failures reduce trust | Medium | High | Outbox retries, dead-letter queue, operational alerts. |
| R3-05 | Backfill inaccuracies from incomplete legacy audit data | Low | Medium | Mark synthetic entries explicitly; preserve traceability metadata. |

## Key Decisions

| Decision | Rationale |
|---|---|
| Use generic approval engine vs per-module logic | Reduces duplicated policy code and keeps behavior consistent. |
| Standardize status-history projection across entities | Enables one UI component and predictable audit semantics. |
| Keep migrations additive and feature-flagged | Minimizes tenant disruption and rollback risk. |
| Prioritize in-app notification reliability before advanced channels | Highest value/effort ratio with existing platform primitives. |
