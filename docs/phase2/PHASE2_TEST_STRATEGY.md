# Phase 2 Test Strategy
## Law Office Management Application (LOMA)

**Version:** 1.0  
**Date:** 2026-02-25  
**Baseline:** Phase 1 test counts — 92 unit, 62 e2e, 0 frontend  
**Scope:** Testing approach, tooling, coverage targets, and CI integration for Phase 2

---

## 1. Phase 1 Test Baseline

| Layer | Framework | Count | Coverage |
|---|---|---|---|
| Backend Unit | Jest | 92 | ~65% statements (estimated) |
| Backend E2E | Jest + Supertest | 62 | Critical API paths |
| Frontend Component | — | 0 | 0% |
| Visual Regression | — | 0 | N/A |
| Performance | — | 0 | N/A |

**Key gaps:** No frontend tests, no visual regression, no performance benchmarks, no accessibility automation.

---

## 2. Phase 2 Test Pyramid

```
        ╱  E2E (Smoke)  ╲          ~20 scenarios
       ╱  Integration     ╲        ~80 test cases
      ╱  Component (FE)    ╲      ~120 test cases
     ╱  Unit (BE + FE)      ╲    ~200 test cases
    ╱────────────────────────╲
```

### 2.1 Targets

| Layer | Phase 2 Target | Measurement |
|---|---|---|
| Backend Unit | ≥ 80% line coverage for new modules | Jest `--coverage` |
| Backend Integration | ≥ 1 integration test per API endpoint | Test count / endpoint count |
| Frontend Component | ≥ 60% statement coverage | Vitest `--coverage` |
| E2E Smoke | ≥ 10 critical user flows | Playwright scenario count |
| Accessibility | 0 critical/serious violations on all Phase 2 screens | axe-core results |
| Performance | API P95 ≤ 500ms, search P95 ≤ 800ms | k6 / Artillery reports |

---

## 3. Backend Testing

### 3.1 Unit Tests (Jest)

**Scope:** Services, guards, pipes, DTOs, state machine logic

**Strategy:**
- Each new service method has ≥ 1 happy-path + ≥ 1 error-path test
- State machine transitions: test every valid transition + every invalid transition
- Guards (OidcGuard, FolderAclGuard, StepUpGuard): mock JWT payloads, test allow/deny
- DTOs: test validation decorators with valid and invalid inputs

**Priority modules (new):**
| Module | Estimated Tests |
|---|---|
| CalendarService | 25 |
| HearingService | 18 |
| FolderService | 20 |
| TemplateService | 15 |
| TimeEntryService | 22 |
| OCRWorker | 10 |
| NotificationService | 15 |
| CourtService / JudgeService | 12 |
| OidcGuard / FolderAclGuard | 10 |

**Conventions:**
- File: `*.spec.ts` co-located with source
- Mocking: `jest.mock()` for DB (pg pool), external services (BullMQ, Tesseract)
- No real DB calls in unit tests — use mock query results
- Snapshot tests for template rendering output

### 3.2 Integration Tests (Jest + Supertest)

**Scope:** Controller → Service → DB round-trip with test database

**Strategy:**
- Use dedicated test tenant schema (`test_tenant`) with seeded data
- Transaction wrapping: each test runs inside a transaction that rolls back
- Test role-based access for every endpoint (Lawyer, Accountant, TenantAdmin, SystemAdmin)
- Test tenant isolation: requests for Tenant A cannot access Tenant B data

**Priority test suites:**
| Suite | Endpoints | Tests |
|---|---|---|
| Calendar API | 8 endpoints | 16 |
| Hearing API | 7 endpoints | 14 |
| Folder API | 6 endpoints | 12 |
| Template API | 7 endpoints | 14 |
| TimeEntry API | 10 endpoints | 20 |
| Court/Judge API | 8 endpoints | 12 |
| External Sharing API | 4 endpoints | 8 |
| Search API | 2 endpoints | 6 |

**Database fixtures:**
- Seed script creates: 2 tenants, 3 users per tenant (Lawyer, Accountant, TenantAdmin), 5 cases, 10 documents, 3 courts, 5 judges, folders hierarchy
- Reused across all integration tests; reset between suites

### 3.3 Worker Tests (BullMQ)

| Worker | Test Approach |
|---|---|
| OCR Worker | Mock Tesseract.js; verify queue processing, retry on failure, status updates |
| Scan Worker | Mock ClamAV client; verify clean/infected outcomes, quarantine flow |
| Reminder Scheduler | Mock clock (jest.useFakeTimers); verify dispatch at correct times, idempotency |
| Email Sender | Mock SMTP transport; verify template rendering, retry, dead-letter |

---

## 4. Frontend Testing

### 4.1 Component Tests (Vitest + React Testing Library)

**Setup:**
- Vitest (faster than Jest for Vite/Next.js)
- React Testing Library for DOM queries
- MSW (Mock Service Worker) for API mocking
- `@testing-library/user-event` for interaction simulation

**Scope:** All new MUI-based components + pages

**Priority components:**
| Component | Tests | Notes |
|---|---|---|
| CalendarGrid + EventChip | 12 | View switching, event click, drag-resize stub |
| FolderTree | 10 | Expand/collapse, context menu, keyboard nav |
| FileDropZone | 8 | Drag enter/leave, file validation, progress |
| NotificationBell | 6 | Badge count, dropdown render, animation trigger |
| TimesheetGrid | 8 | Day columns, hour totals, timer start/stop |
| DashboardWidgets (×6) | 12 | Data rendering, empty states, loading skeletons |
| StepperForm | 6 | Step navigation, validation per step |
| HearingDetail (tabs) | 8 | Tab switching, status transitions |
| TemplateEditor | 6 | Merge field insertion, preview render |

**Conventions:**
- File: `*.test.tsx` co-located with component
- Use `screen.getByRole()` over `getByTestId()` for accessibility-driven queries
- No snapshot tests for complex components (too fragile); use assertion-based tests
- Mock API via MSW handlers (shared handler registry)

### 4.2 Visual Regression (Optional — Sprint 8)

- **Tool:** Chromatic or Percy (CI service)
- **Scope:** Key screens — Dashboard, Calendar, Document Library, Hearing Detail
- **Trigger:** PR-level comparison
- **Threshold:** 0.1% pixel diff tolerance
- **Priority:** P2 — implement only if sprint capacity allows

---

## 5. End-to-End Tests (Playwright)

### 5.1 Setup

- **Framework:** Playwright (multi-browser: Chromium, Firefox, WebKit)
- **Environment:** Docker Compose with backend, frontend, DB, Redis, MinIO
- **Auth:** Pre-seeded OIDC tokens (test mode) or dev JWT mode
- **Data:** Dedicated e2e seed script

### 5.2 Critical Flows

| # | Flow | Steps | Sprint |
|---|---|---|---|
| E2E-01 | Login → Dashboard | OIDC redirect → callback → dashboard renders | S2 |
| E2E-02 | Create case with template | Select case type → auto-generate tasks/folders → verify | S4 |
| E2E-03 | Schedule hearing | Open case → create hearing → verify calendar event → verify notification | S3 |
| E2E-04 | Calendar CRUD | Create event → edit → drag-resize → delete → verify list | S4 |
| E2E-05 | Upload document to folder | Navigate folder → drag file → progress bar → verify OCR status | S5 |
| E2E-06 | Full-text search | Upload PDF → wait for OCR → search by content → verify result | S6 |
| E2E-07 | Generate from template | Select template → fill form → generate → verify folder | S6 |
| E2E-08 | Time entry lifecycle | Create → submit → approve → create invoice → verify Billed | S6 |
| E2E-09 | Notification flow | Assign task → verify WebSocket notification → verify bell badge | S7 |
| E2E-10 | Lawyer dashboard | Login as Lawyer → verify all 6 widgets render with data | S8 |

### 5.3 Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  workers: 2,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
```

---

## 6. Accessibility Testing

### 6.1 Automated (axe-core)

- Integrated into Playwright via `@axe-core/playwright`
- Run on every Phase 2 page after render stabilizes
- Fail CI if critical or serious violations found
- Results exported as JSON artifact for review

### 6.2 Manual Checklist

| Check | Screens | Frequency |
|---|---|---|
| Keyboard-only navigation (Tab, Enter, Arrow, Esc) | All Phase 2 | Per Sprint |
| Screen reader test (NVDA/VoiceOver) | Calendar, Folder Tree, Notifications | Sprint 7–8 |
| Color contrast (4.5:1 minimum) | All Phase 2 | Sprint 8 |
| Focus management on dialog open/close | All modals/dialogs | Per Sprint |

---

## 7. Performance Testing

### 7.1 Tool

- **k6** (by Grafana Labs) for load testing
- Scenarios run against staging environment

### 7.2 Scenarios

| Scenario | Target | VUs | Duration |
|---|---|---|---|
| API Mixed Reads | P95 ≤ 500ms | 50 | 5 min |
| Full-Text Search | P95 ≤ 800ms | 20 | 5 min |
| Calendar Conflict Check | P95 ≤ 200ms | 30 | 3 min |
| Concurrent Uploads | ≥ 50 sustained | 50 | 5 min |
| WebSocket Delivery | ≤ 2s event→UI | 100 | 5 min |

### 7.3 Schedule

- Initial benchmark: End of Sprint 5 (core APIs complete)
- Final benchmark: Sprint 8 (all features, production-like data volume)
- Regression: Run on every release candidate

---

## 8. CI/CD Integration

### 8.1 Pipeline Stages

```
┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────┐
│  Lint +   │──→│ Unit Tests   │──→│ Integration  │──→│ Frontend │──→│  E2E     │
│  Build    │   │ (BE)         │   │  Tests (BE)  │   │  Tests   │   │  Smoke   │
└──────────┘   └──────────────┘   └──────────────┘   └──────────┘   └──────────┘
                                                                          │
                                                                     ┌────▼─────┐
                                                                     │ A11y +   │
                                                                     │ Perf     │
                                                                     │ (nightly)│
                                                                     └──────────┘
```

### 8.2 Rules

| Gate | Threshold | Blocks Deploy? |
|---|---|---|
| Lint | 0 errors | Yes |
| Backend unit coverage | ≥ 80% new code | Yes |
| Backend integration | All pass | Yes |
| Frontend component coverage | ≥ 60% (Sprint 8+) | Yes |
| E2E smoke | All pass | Yes |
| Accessibility (axe) | 0 critical/serious | Yes (Sprint 8+) |
| Performance | P95 within targets | No (warning only) |

---

## 9. Test Data Management

| Aspect | Approach |
|---|---|
| Unit test data | In-memory mocks and fixtures |
| Integration test DB | Dockerized PostgreSQL; test schema seeded per suite; transaction rollback |
| E2E test DB | Dedicated seed script; full reset between test runs |
| OCR test files | 3 sample PDFs (English, Arabic, mixed) in `/test/fixtures/` |
| Template test data | 2 Handlebars templates in `/test/fixtures/templates/` |
| Performance test data | Generated: 10K documents, 5K calendar events, 1K time entries |

---

## 10. Risk & Contingency

| Risk | Mitigation |
|---|---|
| OCR flakiness in CI (Tesseract.js on Linux) | Pin Tesseract version, use Docker image with pre-installed langpacks |
| Playwright browser install in CI | Cache browser binaries; use `npx playwright install --with-deps` in setup |
| DB integration tests slow | Parallel test workers with isolated schemas; keep fixtures minimal |
| Frontend coverage target ambitious (0% → 60%) | Focus on critical paths first; defer cosmetic component tests |
| OIDC test complexity | Use dev JWT mode for most tests; dedicated OIDC integration test suite with mock IdP (keycloak-mock) |
