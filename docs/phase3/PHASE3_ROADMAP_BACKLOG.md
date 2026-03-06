# Phase 3 Roadmap Backlog

## Release Sequencing

### R3.1 — Foundations
- Schema enrichment migrations.
- Generic status-history infrastructure.
- Shared UI components (`StatusTimeline`, status badges).

### R3.2 — Governance
- Approval engine core.
- Wage and invoice workflow integration.
- Expense timeline enhancement.

### R3.3 — Documents + Notifications
- Folder and bulk operations hardening.
- External share policy + expiry alerts.
- Notification center + email dispatch reliability.

### R3.4 — Insights
- KPI dashboards and trend views.
- Receivables/utilization/throughput reports.
- Export parity and monitoring.

## Backlog Prioritization Rules
- P0: compliance/security/governance blockers.
- P1: high-value operational workflows.
- P2: usability and reporting depth.

## Dependencies
- Approval UI depends on approval engine + policy endpoints.
- Timeline UI depends on status-history write hooks.
- Dashboards depend on normalized enrichment data and indexed aggregates.
