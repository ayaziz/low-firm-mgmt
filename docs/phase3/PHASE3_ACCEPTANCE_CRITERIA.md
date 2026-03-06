# Phase 3 Acceptance Criteria

## Capability Acceptance Matrix

| Capability | Acceptance Criteria |
|---|---|
| Enriched Customer/Case/Session | New fields are persisted, validated, searchable where required, and visible in EN/AR UI. |
| Approval Engine | Configured flows enforce step order, role checks, comment-on-reject, and no bypass actions. |
| Status Timeline | Every state transition appears with actor/time/comment within 2s after successful action. |
| Document Lifecycle | Folder operations, expiry alerts, and external sharing policies work with tenant scoping and audit events. |
| Notifications | In-app and email alerts dispatch successfully with retries and preference checks. |
| Dashboards/Reports | KPI widgets load under agreed performance budget and match backend source aggregates. |

## Non-Functional Exit Criteria
- P95 API response <= 500ms for standard list/detail endpoints under nominal load.
- No high/critical security findings in Phase 3 scope.
- Accessibility: keyboard navigation and contrast compliance for new timeline/approval UI.
- Regression suite for Phase 1/2 critical flows remains green.
