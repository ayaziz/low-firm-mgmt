# README_OPERATIONS.md — LOMA Operations Runbook

## Table of Contents

1. [Stack Overview](#stack-overview)
2. [Quick Start](#quick-start)
3. [Log Architecture](#log-architecture)
4. [Accessing Grafana](#accessing-grafana)
5. [Querying Logs in Grafana / Loki](#querying-logs-in-grafana--loki)
6. [Correlation IDs](#correlation-ids)
7. [Frontend Error Reporting](#frontend-error-reporting)
8. [Common LogQL Queries](#common-logql-queries)
9. [Troubleshooting](#troubleshooting)
10. [Health Checks](#health-checks)

---

## Stack Overview

| Service | Port | Purpose |
|---------|------|---------|
| nginx | 80 | Reverse proxy (frontend + API) |
| frontend | 3000 | Next.js UI |
| backend | 4000 | NestJS API |
| postgres | 5432 | PostgreSQL 16 |
| redis | 6379 | BullMQ job queue |
| minio | 9000/9001 | S3-compatible object storage |
| loki | 3100 | Log aggregation |
| promtail | — | Ships Docker logs → Loki |
| grafana | 3001 | Dashboards & log explorer |

---

## Quick Start

```bash
# Start everything
docker compose up --build -d

# Verify all containers are healthy
docker compose ps

# View live backend logs
docker compose logs -f backend

# Stop
docker compose down

# Full reset (wipes data)
docker compose down -v
```

---

## Log Architecture

```
┌──────────┐    JSON stdout    ┌───────────┐    push    ┌──────┐    query    ┌─────────┐
│ Backend  │ ──────────────>   │ Promtail  │ ────────>  │ Loki │ <────────  │ Grafana │
│ (winston)│                   │           │            │      │            │  :3001  │
└──────────┘                   └───────────┘            └──────┘            └─────────┘
                                    ▲
                                    │ Docker socket
                               ┌────┴─────┐
                               │ frontend │
                               │  nginx   │
                               └──────────┘
```

### Backend Log Format

All backend logs are emitted as structured JSON via **winston**:

```json
{
  "level": "info",
  "message": "HTTP request completed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "loma-backend",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "GET",
  "url": "/api/v1/cases",
  "statusCode": 200,
  "duration": 42,
  "userId": "user-uuid",
  "tenantSlug": "acme-law",
  "ip": "172.18.0.1",
  "userAgent": "Mozilla/5.0 ..."
}
```

---

## Accessing Grafana

1. Open **http://localhost:3001** in your browser.
2. Login: `admin` / `admin` (skip password change).
3. Loki data source is pre-provisioned — no setup needed.
4. Navigate to **Dashboards → LOMA → LOMA — Backend Observability**.

### Pre-built Dashboard Panels

| Panel | Description |
|-------|-------------|
| Request Rate | Requests per second (1m window) |
| Error Rate | Errors per second (1m window) |
| Errors by Tenant | Error counts grouped by `tenantSlug` |
| UI Errors | Frontend errors reported via ErrorBoundary |
| Recent Logs | Live tail of all backend JSON logs |

---

## Querying Logs in Grafana / Loki

Go to **Explore** (compass icon) → select **Loki** data source.

### LogQL Basics

```logql
# All backend logs
{container=~".*backend.*"}

# Parse JSON fields
{container=~".*backend.*"} | json

# Filter by level
{container=~".*backend.*"} | json | level = "error"

# Filter by tenant
{container=~".*backend.*"} | json | tenantSlug = "acme-law"

# Filter by correlation ID
{container=~".*backend.*"} | json | correlationId = "a1b2c3d4-..."
```

---

## Correlation IDs

Every HTTP request gets a unique `X-Correlation-Id` header:

1. **Inbound**: If the client sends `X-Correlation-Id`, the backend propagates it.
2. **Generated**: Otherwise, the backend generates a UUID v4.
3. **Response**: The correlation ID is echoed back in the response header.
4. **Logs**: Every log entry includes the `correlationId` field.

### Tracing a Request

```logql
{container=~".*backend.*"} | json | correlationId = "YOUR-ID-HERE"
```

This shows the complete lifecycle: middleware → guard → handler → response, all correlated.

---

## Frontend Error Reporting

The React `ErrorBoundary` component:

1. Catches unhandled render errors.
2. Generates a client-side correlation ID.
3. POSTs to `POST /api/v1/telemetry/ui-error` with:
   - `message`, `stack`, `componentStack`
   - `url`, `userAgent`
   - `X-Correlation-Id` header
4. Shows a user-friendly error page with the correlation ID as a reference.

### Querying UI Errors

```logql
{container=~".*backend.*"} | json | source = "frontend"
```

---

## Common LogQL Queries

### Slow Requests (> 1s)

```logql
{container=~".*backend.*"} | json | duration > 1000
```

### Failed Requests (5xx)

```logql
{container=~".*backend.*"} | json | statusCode >= 500
```

### Auth Failures

```logql
{container=~".*backend.*"} | json | statusCode = 401 or statusCode = 403
```

### Requests for a Specific User

```logql
{container=~".*backend.*"} | json | userId = "USER-UUID"
```

### Invoice Operations

```logql
{container=~".*backend.*"} | json | url =~ "/api/v1/accounting/invoices.*"
```

### Document Scan Errors

```logql
{container=~".*backend.*"} | json | message =~ ".*scan.*" | level = "error"
```

---

## Troubleshooting

### Loki not receiving logs

```bash
# Check Promtail is running
docker compose logs promtail

# Verify Docker socket access
docker compose exec promtail ls -la /var/run/docker.sock

# Check Loki is healthy
curl http://localhost:3100/ready
```

### Grafana shows "No data"

1. Ensure time range is correct (use "Last 1 hour").
2. Try a simple query: `{container=~".*backend.*"}`.
3. Check that backend is producing logs: `docker compose logs backend | head`.

### Backend not starting

```bash
# Check for startup errors
docker compose logs backend

# Verify DB is ready
docker compose exec postgres pg_isready -U loma

# Check Redis
docker compose exec redis redis-cli ping
```

### MinIO issues

```bash
# Check bucket exists
docker compose exec minio-init mc ls local/loma-documents

# Verify MinIO health
curl http://localhost:9000/minio/health/live
```

---

## Health Checks

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/health` | GET | No | Liveness — is the process running? |
| `/api/v1/health/ready` | GET | No | Readiness — can it serve traffic? (checks DB + Redis) |

```bash
# Quick health check
curl http://localhost/api/v1/health

# Readiness (checks DB + Redis)
curl http://localhost/api/v1/health/ready
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Winston level: error, warn, info, debug |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | `loma-dev-...` | JWT signing secret |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `MINIO_ENDPOINT` | — | S3 endpoint URL |
| `FRONTEND_URL` | `http://localhost` | CORS allowed origin |
| `PORT` | `4000` | Backend listen port |
