# CRUD Coverage Matrix

## Legend
- **Full**: create, read/list, update, delete/archive/restore or equivalent lifecycle coverage is visible.
- **Partial**: some core operations exist, but one or more important lifecycle actions are missing or misleading.
- **Backend-only**: backend capability exists, but the frontend does not expose it well.
- **None**: no meaningful support found in reviewed UI.

| Module | Entity / Flow | Create | Read/List | Update | Delete / Archive / Restore | Notes |
|---|---|---:|---:|---:|---:|---|
| Cases | Case | Partial | Full | Partial | Partial | Create form under-captures DTO; state transitions exist; no complete archival lifecycle UX reviewed. |
| Cases | Tasks | Full | Full | Partial | Partial | Creation/listing present; update exists; delete/close patterns inconsistent in case detail UI. |
| Cases | Sessions | Full | Full | Partial | Partial | UI edit path behaves like reschedule-only although backend supports patch. |
| Cases | Filings | Full | Full | Partial | Partial | Present in detail workflow but not uniformly complete. |
| Cases | Notes | Full | Full | Partial | Partial | Similar lifecycle inconsistency across case tabs. |
| Cases | Communications | Full | Full | Partial | Partial | Backend update exists; frontend local validation and UX are thin. |
| Cases | Memberships | Partial | Full | Partial | Partial | Add supported; removal/management not fully surfaced. |
| Cases | Parties | Partial | Full | Partial | Partial | Add supported; resolution logic is opaque; remove/edit weak. |
| Customers | Customer | Partial | Full | Partial | Partial | Create/edit underuse DTO; delete/archive not fully reviewed in UI. |
| Customers | Contacts | Full | Full | Full | Full | Functional CRUD exists, but destructive UX needs confirmation dialogs. |
| Customers | Addresses | Full | Full | Full | Full | CRUD exists, but payload mapping/validation drift risk remains. |
| Customers | Communications | Backend-only | Backend-only | Backend-only | Backend-only | Backend endpoints exist; no frontend surface found. |
| Customers | Compliance checklist | Partial | Full | Partial | None | Read and status update exist; broader lifecycle is template-driven. |
| Documents | Document upload/create | Partial | Full | Partial | Partial | Upload flow exists but is too narrow; metadata edit absent. |
| Documents | Check-out / check-in | Partial | Partial | Partial | None | Check-in handshake exists but frontend does not complete upload. |
| Documents | Share / ACL | Partial | Partial | None | None | Share UI exists but uses wrong identifier type. |
| Documents | Bulk actions | Backend-only | Partial | Backend-only | Backend-only | Backend supports bulk delete/move/restore; UI incomplete. |
| Documents | Legal hold | Partial | Partial | Partial | Partial | Exposed on detail page, but broader case-level legal-hold management is limited in UI. |
| Courts | Courts | Full | Full | Partial | Partial | Create/list present; model is stale; delete/deactivate flows not obvious. |
| Courts | Judges | Full | Full | Partial | Partial | Basic CRUD implied; contract drift around naming persists. |
| Hearings | Hearings | Full | Full | Partial | Partial | Create/list/status transitions exist; judge/detail/delete coverage weak. |
| Calendar | Calendar events | Partial | Full | Partial | Backend-only | Backend supports richer lifecycle than UI uses; delete not surfaced clearly. |
| Time Entries | Time entries | Full | Full | Partial | Partial | Core CRUD plus transitions exist, but mapper/status drift weakens reliability. |
| Templates | Templates | Full | Full | Partial | Partial | Preview/render mismatch; category drift. |
| Admin | Users | Partial | Full | Partial | Partial | Create/edit/list exist; activation/deactivation/delete incomplete; password UX misleading. |
| Admin | Master data | Full | Full | None | Full | Edit missing in UI though backend supports patch. |
| Admin | Case types | Full | Full | None | Full | Edit missing in UI though backend supports patch. |
| Admin | Tenant settings | Partial | Partial | Partial | None | UI fields do not align with DTO structure. |
| Reports | Report generation | Full | Partial | None | Export partial | Functional generation exists; export available for some routes. |
| Dashboard | KPI navigation | None | Partial | None | None | Read-only dashboard; some navigations incomplete or broken. |
| Notifications | Notifications | None | Full | Partial | None | Read and mark-read flows exist; no delete/archive UX. |
| Search | Global search | Partial | Partial | None | None | Search works conceptually, but contract and filter behavior are unstable. |

## Highest-value CRUD gaps
1. Customer communications are backend-only.
2. Master data and case types lack edit UI.
3. Document bulk operations are not properly surfaced.
4. Session update is not properly surfaced as true update.
5. Calendar delete/attendees/reminders/recurrence are backend-only or underexposed.
