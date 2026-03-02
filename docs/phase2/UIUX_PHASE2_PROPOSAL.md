# UI/UX Phase 2 Proposal
## Law Office Management Application (LOMA and) — Phase 2

**Date:** 2026-02-25  
**Baseline:** Phase 1 UI (14 pages), Style Guide, Wireframes & IA  
**Drivers:** D4 — Poor UI (no responsiveness, no mobile, limited dashboard); D2 — No Calendar  
**Depends on:** DOC_MGMT_V2_SPEC.md, CALENDAR_SPEC.md, PHASE2_DOMAIN_MODEL_AND_WORKFLOWS.md

---

## 1. Design Goals

| Goal | Description |
|---|---|
| **Responsive first** | All screens work at 1024px, 768px, and 375px breakpoints |
| **Productive dashboards** | Role-specific dashboards with actionable widgets, not just tables |
| **Visual hierarchy** | Clear information architecture with consistent navigation patterns |
| **Full RTL** | Every new component tested in both LTR (EN) and RTL (AR) modes |
| **Accessibility** | WCAG 2.1 AA compliance on all new screens |
| **Progressive disclosure** | Complex forms use stepper/wizard pattern; detail views use tabs |

---

## 2. Navigation Redesign

### 2.1 Global Navigation (Updated)

**Phase 1:** Simple left sidebar with 5 items (Dashboard, Customers, Cases, Documents, Admin).

**Phase 2:** Collapsible left sidebar with grouped sections:

```
┌──────────────────────────┐
│ 🏛️  LOMA                │  ← Tenant logo + name
├──────────────────────────┤
│ ▸ Dashboard              │
│ ▸ Calendar          NEW  │
├──────────────────────────┤
│   CASE MANAGEMENT        │
│ ▸ Customers              │
│ ▸ Cases                  │
│ ▸ Hearings          NEW  │
├──────────────────────────┤
│   DOCUMENTS              │
│ ▸ Document Library   NEW │
│ ▸ Templates          NEW │
├──────────────────────────┤
│   FINANCE                │
│ ▸ Time Tracking     NEW  │
│ ▸ Invoices               │
│ ▸ Payments               │
│ ▸ Expenses               │
│ ▸ Wages                  │
├──────────────────────────┤
│   ADMIN (role-gated)     │
│ ▸ Users                  │
│ ▸ Courts & Judges   NEW  │
│ ▸ Master Data            │
│ ▸ Settings          NEW  │
└──────────────────────────┘
```

### 2.2 Top Bar

```
┌─────────────────────────────────────────────────────────┐
│  ☰  Global Search [____________________________] 🔍    │
│                                    🔔(3)  🌐 EN  👤    │
└─────────────────────────────────────────────────────────┘
```

- **Global Search:** Unified search across customers, cases, documents (full-text), hearings
- **Notification Bell:** Badge count + dropdown (see CALENDAR_SPEC §6.3)
- **Language Toggle:** EN ↔ AR with instant RTL flip
- **User Avatar:** Profile menu (settings, logout)

### 2.3 Responsive Behavior

| Breakpoint | Navigation | Content |
|---|---|---|
| ≥1280px (Desktop) | Full sidebar (240px) | 2–3 column layouts |
| 1024–1279px (Tablet landscape) | Collapsed sidebar (icons only, 64px) | 2-column layouts |
| 768–1023px (Tablet portrait) | Hidden sidebar (hamburger toggle) | Single column + tabs |
| <768px (Mobile) | Bottom tab bar (5 items: Dashboard, Calendar, Cases, Docs, More) | Single column, stacked |

---

## 3. Dashboard Redesign

### 3.1 Lawyer Dashboard

```
┌──────────────────────────────────────────────────────┐
│  Good morning, Ahmad                    Feb 25, 2026 │
├──────────────┬───────────────┬───────────────────────┤
│ Active Cases │ Upcoming      │ Overdue Tasks         │
│    12        │ Hearings: 3   │    5                  │
│              │ Sessions: 7   │                       │
├──────────────┴───────────────┴───────────────────────┤
│                                                      │
│  📅 Today's Schedule (timeline view)                 │
│  ─────────────────────────────────                   │
│  09:00  🔴 Hearing — Case C-2026-031 (Court 3)      │
│  11:00  🔵 Client Session — Ahmad Corp              │
│  14:00  🟢 Internal Meeting — Team Sync             │
│  16:30  🟠 Task Due — Submit Filing (C-2026-028)    │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📋 My Tasks (top 5, sortable)                       │
│  ┌──────────────┬───────────┬──────────┬──────────┐ │
│  │ Task         │ Case      │ Due      │ Status   │ │
│  ├──────────────┼───────────┼──────────┼──────────┤ │
│  │ Submit brief │ C-026-031 │ Today    │ 🔴       │ │
│  │ Review docs  │ C-026-028 │ Tomorrow │ 🟡       │ │
│  └──────────────┴───────────┴──────────┴──────────┘ │
│                                                      │
├──────────────┬───────────────────────────────────────┤
│ Billable     │ Recent Documents                      │
│ This Week    │ ┌────────────┬──────────┬──────────┐ │
│ ██████░░ 28h │ │ Name       │ Case     │ Updated  │ │
│ Target: 35h  │ │ Contract…  │ C-026-28 │ 2h ago   │ │
│              │ │ Petition…  │ C-026-31 │ 5h ago   │ │
│              │ └────────────┴──────────┴──────────┘ │
└──────────────┴───────────────────────────────────────┘
```

### 3.2 Accountant Dashboard

```
┌──────────────────────────────────────────────────────┐
│  Finance Overview                       Feb 25, 2026 │
├──────────────┬───────────────┬───────────────────────┤
│ Outstanding  │ Overdue       │ Pending Approvals     │
│ Invoices     │ Invoices      │                       │
│ 45,000 SAR   │ 12,500 SAR    │ 8 Time Entries        │
│              │               │ 2 Expenses            │
├──────────────┴───────────────┴───────────────────────┤
│                                                      │
│  📊 Revenue Chart (bar, last 6 months)               │
│  ┌──────────────────────────────────────────────┐   │
│  │  ██                                          │   │
│  │  ██  ██      ██                              │   │
│  │  ██  ██  ██  ██  ██  ██                      │   │
│  │  Sep Oct Nov Dec Jan Feb                     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Time Entries Pending Approval (table)                │
│ Expenses Pending Approval (table)                    │
└──────────────────────────────────────────────────────┘
```

### 3.3 TenantAdmin Dashboard

```
┌──────────────────────────────────────────────────────┐
│  System Overview                        Feb 25, 2026 │
├──────────────┬───────────────┬───────────────────────┤
│ Total Users  │ Active Cases  │ Storage Used          │
│    8         │    47         │ 2.3 GB / 10 GB        │
├──────────────┴───────────────┴───────────────────────┤
│ Recent Audit Events (last 10)                        │
│ User Activity (logins last 7 days chart)             │
│ System Health (API response time, error rate)        │
└──────────────────────────────────────────────────────┘
```

---

## 4. New Screens

### 4.1 Calendar Page

See `CALENDAR_SPEC.md §5` for full view specifications. Key wireframe:

```
┌──────────────────────────────────────────────────────┐
│  ◀ Feb 2026 ▶     Day  Week  [Month]  Agenda        │
├──────────────────────────────────────────────────────┤
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun            │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐       │
│  │     │     │     │     │     │     │  1  │       │
│  │     │     │     │     │     │     │     │       │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤       │
│  │  2  │  3  │  4  │  5  │  6  │  7  │  8  │       │
│  │     │🔴H  │     │🔵S  │     │     │     │       │
│  ├─────... (etc)                                     │
│  │ 23  │ 24  │ 25  │ 26  │ 27  │ 28  │     │       │
│  │🟠T  │     │🔴H  │🔵S  │     │     │     │       │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘       │
└──────────────────────────────────────────────────────┘
```

### 4.2 Document Library Browser

```
┌──────────────────────────────────────────────────────┐
│  Document Library    [Search documents...]     + New │
├───────────────┬──────────────────────────────────────┤
│  📁 Folder    │  📄 Documents in: Court Filings      │
│  Tree         │  ──────────────────────────────      │
│               │  ☐  Name        Size  Date   Status  │
│  📁 C-2026-031│  ☐  petition.pdf 2MB  Feb 24  ✅    │
│   ├📁 Court   │  ☐  response.docx 1MB Feb 23  ✅    │
│   │  Filings  │  ☐  exhibit-a.pdf 5MB Feb 22  🔍    │
│   ├📁 Contracts│                                     │
│   ├📁 Evidence │  ┌──────────────────────────────┐   │
│   └📁 Memos   │  │  Drop files here to upload   │   │
│  📁 C-2026-028│  │  or click to browse           │   │
│   ├📁 ...     │  └──────────────────────────────┘   │
│               │                                      │
│  [+ New Folder]│ Showing 3 of 12  ◀ 1 2 3 4 ▶      │
└───────────────┴──────────────────────────────────────┘
```

### 4.3 Hearing Management

**Hearing List (within Case)**

```
┌──────────────────────────────────────────────────────┐
│  Hearings — Case C-2026-031              + New       │
├──────────────────────────────────────────────────────┤
│  Date        Court         Judge       Type    Status│
│  2026-03-04  District Ct 3  Judge Ali  Initial  📅  │
│  2026-02-15  District Ct 3  Judge Ali  Proced.  ✅  │
│  2026-01-20  District Ct 3  Judge Ali  Initial  ⏸️  │
└──────────────────────────────────────────────────────┘
```

**Hearing Detail / Form**

```
┌──────────────────────────────────────────────────────┐
│  ◀ Back to Hearings            [Postpone] [Complete] │
├─────────────────────────┬────────────────────────────┤
│  Case:     C-2026-031   │  Status: Scheduled         │
│  Court:    [District ▾]  │  Type:   [Initial ▾]      │
│  Judge:    [Judge Ali ▾] │  Date:   [2026-03-04]     │
│  Location: [Room 3A   ] │  Time:   [09:00]          │
├─────────────────────────┴────────────────────────────┤
│  Notes:                                              │
│  [                                                 ] │
│  Outcome: (visible when completing)                  │
│  [                                                 ] │
├──────────────────────────────────────────────────────┤
│  📅 Calendar Event: Hearing — C-2026-031 (linked)    │
│  👥 Attendees: Ahmad (Lawyer), Salem (Lawyer)        │
└──────────────────────────────────────────────────────┘
```

### 4.4 Time Tracking

**Time Entry List**

```
┌──────────────────────────────────────────────────────┐
│  Time Tracking       [This Week ▾]  [+ New Entry]    │
├──────────────────────────────────────────────────────┤
│  Date    Case       Description       Hours  Status  │
│  Feb 25  C-026-031  Draft petition    2.5    Draft   │
│  Feb 25  C-026-028  Client call       0.5    Submitted│
│  Feb 24  C-026-031  Court prep        3.0    Approved │
│  Feb 24  C-026-015  Research          1.5    Billed  │
├──────────────────────────────────────────────────────┤
│  Weekly Total: 28.0h (Billable: 24.5h)               │
│  ████████████████████████░░░░░░░░░░ 70% of 35h target│
└──────────────────────────────────────────────────────┘
```

**Time Entry Form (Quick Entry)**

```
┌──────────────────────────────────────────────────────┐
│  New Time Entry                                      │
├──────────────────────────────────────────────────────┤
│  Date:        [2026-02-25]                           │
│  Case:        [C-2026-031 — Ahmad v. Corp ▾]         │
│  Task:        [Draft Petition ▾]  (optional)         │
│  Hours:       [2.5    ]                              │
│  Description: [Drafted initial petition sections...] │
│  Billable:    [✅]                                   │
│  Rate:        250.00 SAR/hr (from case config)       │
│                                                      │
│  [Save as Draft]  [Submit for Approval]              │
└──────────────────────────────────────────────────────┘
```

### 4.5 Court & Judge Management (Admin)

```
┌──────────────────────────────────────────────────────┐
│  Courts & Judges                        [+ New Court]│
├──────────────────────────────────────────────────────┤
│  🏛️ District Court — Riyadh                   Active │
│     Jurisdiction: District  │  Circuit: First        │
│     📋 Judges (3):                                   │
│     ├── Judge Ali Mohammad     (Civil)     Active    │
│     ├── Judge Sara Al-Rashid   (Commercial) Active   │
│     └── Judge Omar Hassan      (Family)    Inactive  │
│  ──────────────────────────────────────────────────  │
│  🏛️ Appeal Court — Riyadh                     Active │
│     Jurisdiction: Appeal  │  Circuit: First          │
│     📋 Judges (2):                                   │
│     ├── Judge Khalid Al-Faisal (General)   Active    │
│     └── Judge Nora Al-Saud     (Commercial) Active   │
└──────────────────────────────────────────────────────┘
```

### 4.6 Settings Page (Admin)

```
┌──────────────────────────────────────────────────────┐
│  Tenant Settings                                     │
├─────────┬────────────────────────────────────────────┤
│  General│  Tenant Name:  [Al-Rashid Law Firm       ] │
│  Auth   │  Timezone:     [Asia/Riyadh ▾]             │
│  Numbers│  Week Start:   [Sunday ▾]                  │
│  Storage│  Locale:       [ar-SA ▾]                   │
│  OIDC   │                                            │
│         │  Logo:   [Upload]  [Preview]               │
│         │                                            │
│         │  [Save Changes]                            │
└─────────┴────────────────────────────────────────────┘
```

---

## 5. Updated Existing Screens

### 5.1 Case Detail — Tab Expansion

**Phase 1 Tabs:** Overview, Parties, Sessions, Tasks, Documents, Notes, Financial

**Phase 2 Tabs (12):**
1. **Overview** — Summary card with court/judge, key dates, status
2. **Parties** — Participants with roles and visibility scope (now enforced)
3. **Hearings** ← NEW — Hearing list + create/manage
4. **Sessions** — Updated: linked to CalendarEvent
5. **Tasks** — Updated: due dates on calendar, estimated hours
6. **Documents** — Updated: folder tree browser (not flat list)
7. **Notes** — Updated: editable (no longer append-only), with edit history
8. **Time Entries** ← NEW — Billable hours for this case
9. **Calendar** ← NEW — Mini calendar filtered to case events
10. **Financial** — Updated: invoices auto-populated from approved time entries
11. **Timeline** — Chronological view of all case events/changes
12. **Audit** — Admin-only: audit log for this case

### 5.2 Customer Detail — Tab Expansion

**Phase 1 Tabs:** Details, Contacts, Cases, Communications, Documents, Notes, Financial

**Phase 2 Tabs (8):**
1. **Details** — Updated: linked GlobalContact if applicable
2. **Contacts** — Contact persons (existing)
3. **Cases** — Case list (existing)
4. **Communications** — Updated: comms now functional (was partially wired)
5. **Documents** — Updated: folder tree scoped to customer
6. **Notes** — Updated: editable
7. **Financial** — Invoice/payment summary
8. **Timeline** ← NEW — Customer interaction history

### 5.3 Document List → Document Library

Phase 1 flat list is replaced by the folder-based library browser (see §4.2). The global `/documents` route becomes the tenant-level document library.

---

## 6. Component Library Additions

### 6.1 New Components

| Component | Usage |
|---|---|
| `FolderTree` | Collapsible tree navigation for document folders |
| `FileDropZone` | Multi-file drag-and-drop upload area |
| `UploadProgressList` | List of files with progress bars during upload |
| `CalendarGrid` | Reusable calendar grid (day/week/month) |
| `EventChip` | Color-coded event indicator |
| `EventDetailDrawer` | Slide-in drawer for event details |
| `QuickCreatePopover` | Popover for rapid event creation |
| `TimeEntryRow` | Inline time entry with quick-edit |
| `WeeklyHoursBar` | Progress bar for weekly billable target |
| `NotificationBell` | Bell icon with badge + dropdown |
| `NotificationList` | Grouped notification list |
| `AuditTimeline` | Vertical timeline for audit events |
| `StepperForm` | Multi-step wizard for complex forms |
| `MiniCalendar` | Compact month calendar widget |
| `SearchBar` | Global unified search with type-ahead |
| `StatCard` | Dashboard metric card with icon + trend |
| `ChartWidget` | Wrapper for bar/line/pie charts (Chart.js) |

### 6.2 Design Tokens (Additions)

```css
/* Calendar event colors */
--calendar-hearing: #D32F2F;
--calendar-session: #1976D2;
--calendar-deadline: #F57C00;
--calendar-custom: #388E3C;
--calendar-reminder: #7B1FA2;
--calendar-cancelled: #9E9E9E;

/* Dashboard */
--stat-positive: #2E7D32;
--stat-negative: #C62828;
--stat-neutral: #616161;

/* Folder tree */
--folder-icon: #FFA000;
--folder-active-bg: rgba(25, 118, 210, 0.08);

/* Notification */
--notification-unread-bg: #E3F2FD;
--notification-badge: #F44336;
```

---

## 7. Responsive Breakpoint Details

### 7.1 Mobile (< 768px) Adaptations

| Screen | Mobile Adaptation |
|---|---|
| Dashboard | Stack all cards vertically; horizontal scroll for tables |
| Calendar | Default to Agenda view; swipe for day navigation |
| Case detail | Bottom tab bar for sub-sections (horizontal scroll tabs) |
| Document library | Full-width folder list → drill into folder → full-width doc list |
| Time entry | Simplified form; timer button for live tracking |
| Hearing form | Full-screen dialog |
| Navigation | Bottom bar: Dashboard, Calendar, Cases, Documents, More |

### 7.2 Tablet (768–1279px) Adaptations

| Screen | Tablet Adaptation |
|---|---|
| Dashboard | 2 columns for stat cards, full-width for tables/charts |
| Calendar | Week view default; side panel hidden until event click |
| Case detail | Tabs as horizontal scroll strip |
| Document library | Split pane: 30% tree / 70% content |

---

## 8. Accessibility Checklist (Phase 2 Additions)

| Item | Standard | Implementation |
|---|---|---|
| Calendar keyboard navigation | WCAG 2.1 2.1.1 | Arrow keys, Enter to select, Esc to close |
| Calendar screen reader | WCAG 2.1 1.3.1 | `role="grid"`, `aria-label` on events |
| Folder tree | WCAG 2.1 1.3.1 | `role="tree"`, `aria-expanded` on folders |
| Notification badge | WCAG 2.1 4.1.3 | `aria-live="polite"` on count change |
| Drag-and-drop | WCAG 2.1 2.1.1 | Keyboard alternative for all DnD operations |
| Color coding | WCAG 2.1 1.4.1 | Event types have icon + color (never color-only) |
| Chart data | WCAG 2.1 1.1.1 | All charts have data table alternative |
| Focus management | WCAG 2.1 2.4.3 | Dialog/drawer focus trap and return |
