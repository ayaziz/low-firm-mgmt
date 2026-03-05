# ASSUMPTIONS.md — LOMA MVP

1. **Dev Auth**: MVP uses a dev JWT issuer (not real OIDC). A `POST /api/v1/auth/dev/login` endpoint issues JWTs for seeded users.
2. **Step-up Token**: Implemented as a short-lived JWT obtained via `POST /api/v1/auth/dev/step-up` (simulates re-auth).
3. **Single Currency**: Each tenant uses USD in MVP seed data.
4. **Tenant Timezone**: Default UTC for MVP seed data.
5. **MinIO as S3**: Local dev uses MinIO as S3-compatible storage. Azure Blob provider is a stub interface only.
6. **Malware Scanner**: MVP uses a deterministic stub: filenames containing "EICAR" are marked Failed; all others Passed.
7. **Queue**: BullMQ + Redis for document scan jobs.
8. **Notifications**: In-app only (stored in DB). No email/SMS in MVP.
9. **Retention Policies**: Seeded defaults, view-only. No automated purge scheduling; purge is a manual admin endpoint.
10. **Expense Approval Workflow**: Default 2-step: Lawyer submits → Accountant approves. Configurable by Tenant Admin.
11. **Court Entity**: Minimal fields (name, notes, address text). Court details for sessions stored as free text.
12. **PDF Generation**: Uses pdfkit for invoice PDF generation.
13. **Search**: PostgreSQL ILIKE + trigram for MVP. No external search engine.
14. **Session Reminders**: Stored as notification records. No push/email delivery in MVP.
15. **Compliance Checklist**: Template with items; per-customer instance tracking status (Pending/Complete/NA).
16. **Schema-per-tenant**: Each tenant gets a PostgreSQL schema. Platform schema holds tenants and users.
17. **Idle Session Timeout**: Frontend enforces 30-minute idle timeout.
18. **File Size Limit**: 50MB per upload in MVP.
19. **Lock Expiry**: 4 hours for document checkout locks.
20. **Signed URL TTL**: 15 minutes for upload, 5 minutes for download.
