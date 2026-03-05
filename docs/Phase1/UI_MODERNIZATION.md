# LOMA UI Modernization Plan

## Overview
Complete UI modernization of the LOMA (Law Office Management Application) from basic MUI layouts to a polished, enterprise-grade frontend — while keeping all existing backend APIs and business rules unchanged.

## Design System

### Theme
- **Primary**: Navy #1B3A5C (professional)
- **Secondary**: Muted green #4A7C59 (accents)
- **Semantic**: success=#2E7D32, warning=#ED6C02, error=#D32F2F, info=#0288D1
- **Background**: #F5F6F8 (default), #FFFFFF (paper)
- **Typography**: System font stack, h1–h4 weights 600, body 0.875rem
- **Shape**: borderRadius 8, consistent spacing (8px grid)

### Shared Components
| Component | Purpose |
|-----------|---------|
| `PageHeader` | Consistent page title + breadcrumbs + action buttons |
| `KPICard` | Dashboard metric card with icon, value, trend |
| `StatusBadge` | Semantic colored chip for all entity statuses |
| `DataGrid` | Wrapper with pagination, sort, filter, empty/loading/error states |
| `DrawerForm` | Side drawer for create/edit with react-hook-form + zod validation |
| `ConfirmDialog` | Confirmation modal for destructive actions |
| `FilterChips` | Inline filter chips with clear-all |
| `EmptyState` | Consistent "no data" illustrations |
| `LoadingSkeleton` | Consistent loading placeholders |
| `InsightsRail` | Right-side panel for detail pages (completeness, KPIs) |

---

## Page-by-Page Checklist

### 1. Navigation & Layout Shell
- [x] Modern AppShell with collapsible sidebar + groups
- [x] App header: global search, quick-create, notifications, user menu, language switch, tenant badge
- [x] Role-based navigation items with icons
- [x] Breadcrumbs on all pages
- [x] PageHeader component on all pages

### 2. Landing Dashboards (role-based)
- [x] **Lawyer**: KPI cards (active cases, overdue tasks, upcoming sessions, recent docs) + task widget + sessions widget + recent cases + recent docs
- [x] **Accountant**: KPI cards (receivables, pending approvals, outstanding) + receivables chart + pending approvals + recent payments + invoices pending finalize
- [x] **Tenant Admin**: Configuration shortcuts + health summary + audit highlights

### 3. Reporting Charts
- [x] Operational: Cases by state/type/owner (bar/stacked), overdue tasks (trend), upcoming sessions (timeline), completeness distribution
- [x] Financial: Receivables aging (stacked bar), cashflow by month (line/area), expenses by category (donut/bar)
- [x] Date range filter, CSV export, loading/empty states, RTL support, responsive

### 4. Document Upload & Library
- [x] Drag & drop zone, multi-file upload queue
- [x] Per-file progress, retry/cancel, scan status indicators
- [x] Metadata panel (docType, confidentiality, tags, scope)
- [x] Checkout/checkin actions on detail
- [x] Sharing UI with expiry picker + active shares table
- [x] Library: sort, filter chips, badges (confidentiality, scan, lock)

### 5. Customer Detail Modernization
- [x] Tabbed layout with insights rail (completeness %, missing items, financial snapshot)
- [x] Timeline redesign with icons, filters, grouping
- [x] Inline drawers for contacts/addresses creation

### 6. Case Detail Modernization
- [x] Tabbed layout with insights rail (completeness %, overdue tasks, next session, financial snapshot)
- [x] Timeline redesign with icons, filters, grouping
- [x] Inline drawers for tasks/sessions/filings/comms creation

### 7. Admin / Master Data CRUD
- [x] Users: data grid + drawer form for create/edit
- [x] Master Data: data grid + drawer form for each category
- [x] Case Types: data grid + drawer form with template support
- [x] Settings: form with all tenant settings
- [x] Expense Workflow: visual config

### 8. Data Grids (all entity lists)
- [x] Customers list: modern data grid
- [x] Cases list: modern data grid
- [x] Documents list: modern data grid
- [x] Invoices tab: modern data grid
- [x] Expenses tab: modern data grid
- [x] Wages tab: modern data grid
- [x] Hearings list: modern data grid
- [x] Courts list: modern data grid
- [x] Calendar events: modern data grid
- [x] Time entries: modern data grid
- [x] Templates list: modern data grid

### 9. i18n Completion
- [x] All new components use i18n keys
- [x] EN translation complete
- [x] AR translation complete
- [x] RTL correctness verified
- [x] `make i18n-check` script passes

---

## Implementation Order
1. Shared components (PageHeader, KPICard, StatusBadge, DataGrid, DrawerForm, ConfirmDialog, FilterChips, EmptyState, InsightsRail)
2. AppShell modernization (sidebar groups, breadcrumbs, quick-create)
3. Dashboard (role-based landing)
4. Reports (chart library integration)
5. Documents (upload + library + detail)
6. Customer detail modernization
7. Case detail modernization
8. Admin CRUD pages
9. All entity list grids
10. i18n completion + coverage check
11. Testing + Docker deployment
