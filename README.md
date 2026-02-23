# LOMA – Law Office Management Application

A full-stack, multi-tenant law office management system built for Saudi/MENA law firms. Supports Arabic + English, RTL/LTR, schema-per-tenant isolation, and a complete case lifecycle.

## Architecture

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Nginx   │────▶│  Next.js 14  │     │  MinIO (S3)  │
│  :80     │     │  :3000       │     │  :9000       │
└──────────┘     └──────────────┘     └──────────────┘
      │                                      ▲
      ▼                                      │
┌──────────────┐     ┌───────────┐     ┌─────┘
│  NestJS 10   │────▶│ PostgreSQL│     │
│  :4000       │     │  :5432    │     │
│  (API + BullMQ)    └───────────┘     │
└──────────────┘────▶┌───────────┐─────┘
                     │  Redis    │
                     │  :6379    │
                     └───────────┘
```

## Tech Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | Next.js 14, React 18, MUI 5, i18next          |
| Backend     | NestJS 10, TypeScript, Prisma 5, BullMQ       |
| Database    | PostgreSQL 16 (schema-per-tenant)              |
| Cache/Queue | Redis 7                                       |
| Storage     | MinIO (S3-compatible) for documents            |
| Proxy       | Nginx                                         |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (optional, but recommended)
- Node.js 20+ (for local dev)

### Deploy with Docker

```bash
# Build and start everything
make up

# Or without Make:
docker compose up --build -d
```

The following services will be available:

| Service     | URL                          |
|-------------|------------------------------|
| Application | http://localhost              |
| Frontend    | http://localhost:3000         |
| Backend API | http://localhost:4000/api/v1  |
| MinIO UI    | http://localhost:9001         |

### Dev Login Accounts

| Email                | Role(s)       | Tenant     |
|----------------------|---------------|------------|
| lawyer@demo.com      | Lawyer        | demo-firm  |
| lawyer2@demo.com     | Lawyer        | demo-firm  |
| accountant@demo.com  | Accountant    | demo-firm  |
| admin@demo.com       | TenantAdmin   | demo-firm  |
| sysadmin@demo.com    | SystemAdmin   | demo-firm  |

### Local Development

```bash
# Install dependencies
make install

# Start infrastructure only
docker compose up postgres redis minio minio-init -d

# Run DB migrations + seed
cd backend && npx prisma migrate deploy && npx ts-node prisma/seed.ts

# Start backend (port 4000)
cd backend && npm run start:dev

# Start frontend (port 3000)
cd frontend && npm run dev
```

## API Endpoints

All endpoints are prefixed with `/api/v1`.

| Method | Path                                | Auth     | Description                   |
|--------|-------------------------------------|----------|-------------------------------|
| POST   | /auth/dev/login                     | Public   | Dev login (email only)        |
| POST   | /auth/dev/step-up                   | JWT      | Step-up authentication        |
| GET    | /health                             | Public   | Health check                  |
| POST   | /customers                          | Lawyer+  | Create customer               |
| GET    | /customers                          | Any      | List/search customers         |
| GET    | /customers/:id                      | Any      | Customer detail               |
| PATCH  | /customers/:id                      | Lawyer+  | Update customer (rowVersion)  |
| POST   | /customers/:id/contacts             | Lawyer+  | Add contact                   |
| GET    | /cases                              | Any      | List cases                    |
| POST   | /cases                              | Lawyer+  | Create case                   |
| GET    | /cases/:id                          | Any      | Case detail                   |
| POST   | /cases/:id/transition               | Lawyer+  | State transition              |
| POST   | /documents                          | Lawyer+  | Create document (presigned)   |
| GET    | /documents                          | Any      | List documents                |
| GET    | /documents/:id                      | Any      | Document detail               |
| GET    | /documents/:id/download             | Any      | Download (presigned URL)      |
| POST   | /documents/:id/checkout             | Lawyer+  | Checkout (lock)               |
| POST   | /documents/:id/checkin              | Lawyer+  | Checkin (new version)         |
| GET    | /accounting/invoices                | Any      | List invoices                 |
| POST   | /accounting/invoices                | Any      | Create invoice                |
| POST   | /accounting/invoices/:id/payments   | Any      | Record payment                |
| GET    | /search                             | Any      | Global search (Arabic-aware)  |
| GET    | /notifications                      | Any      | List notifications            |
| GET    | /reports/:type                       | Lawyer+  | Generate report               |

## Testing

```bash
# Unit tests (53 tests, no infrastructure needed)
make test

# Integration tests (requires Docker services)
make test-e2e
```

### Test Coverage

| Suite                  | Tests | Focus                                    |
|------------------------|-------|------------------------------------------|
| roles.guard.spec       | 8     | RBAC enforcement                         |
| step-up.guard.spec     | 6     | Step-up auth guard                       |
| search.service.spec    | 13    | Arabic normalization                     |
| accounting.service.spec| 9     | Payment creation, overpayment, idempotency |
| case.service.spec      | 16    | State transitions, validation            |
| **Total**              | **53**|                                          |

Integration tests (3 suites):
- `app.e2e-spec.ts` – Health, auth, JWT validation
- `customer.e2e-spec.ts` – CRUD, RBAC, identity uniqueness
- `case.e2e-spec.ts` – Case lifecycle, state transitions

## Case State Machine

```
Intake → Open → Active → Pending ↔ Active
                Active → Closed → Archived
                Pending → Closed → Archived
```

## Multi-Tenancy

Each tenant gets its own PostgreSQL schema. The tenant slug is extracted from the JWT token. All data queries use `SET search_path TO <tenant_schema>` for complete isolation.

## Key Features

- **Bilingual UI** – Full Arabic + English with RTL/LTR auto-switching
- **Schema-per-tenant** – Complete data isolation between law firms
- **Document Management** – S3/MinIO storage, checkout/checkin, versioning, virus scan queue
- **Accounting** – Invoices, payments, expenses, wages with PDF generation
- **Case Management** – State machine, tasks, court sessions, filings, notes
- **RBAC** – Role-based access (Lawyer, Accountant, TenantAdmin, SystemAdmin)
- **Arabic Search** – Diacritics/hamza/kashida normalization for accurate text search
- **Audit Trail** – Every mutation logged with actor, entity, and payload
- **Optimistic Concurrency** – rowVersion-based conflict detection on updates

## License

Private – All rights reserved.
