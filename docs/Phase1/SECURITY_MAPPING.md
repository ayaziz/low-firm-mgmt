# SECURITY_MAPPING

Primary maintained security mapping report is in [../doc/SECURITY_MAPPING.md](../doc/SECURITY_MAPPING.md).

## 2026-02-24 Verification Snapshot

| Check | Status |
|---|---:|
| `GET /customers` without token | 401 |
| `POST /customers` as Accountant | 403 |
| `GET /admin/users` as Lawyer | 403 |
| `GET /customers` as Lawyer | 200 |
| `GET /admin/users` as TenantAdmin | 200 |
| Backend e2e | 62/62 passing |
