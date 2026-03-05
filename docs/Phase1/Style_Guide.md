# UI Style Guide & Interaction Standards
## Law Office Management Web Application (LOMA) — Phase 2

**Version:** 2.0  
**Date:** 2026-02-25  

---

## 1. Design Principles
- Professional, low-noise interface suitable for legal workflows.
- Master-detail patterns for Customers and Cases.
- Information density balanced with clarity (filters, tabs, summaries).
- Accessibility target: WCAG 2.1 AA.

## 2. Internationalization (EN/AR) and RTL
- Full i18n with language toggle (tenant default + user preference).
- Arabic uses RTL layout:
  - navigation, tables, form labels align RTL
  - icons mirrored where appropriate
- Dates and numbers formatted by tenant locale.
- Store all text content in UTF-8 and ensure search normalization for Arabic.

## 3. Typography
- System UI font stack for performance.
- Heading hierarchy:
  - Page title (H1), section headers (H2), subheaders (H3)
- Monospace for IDs (CASE-2026-000123, INV-2026-000045).

## 4. Color & Status Tokens (Semantic)
- Success: Paid, Scan Passed, Approved, Completed
- Warning: Due soon, Pending approval, On Hold, Scanning, Adjourned
- Danger: Scan Failed, Overdue tasks, Rejected, Voided, Cancelled
- Info: Draft, Planned, Pending, Submitted

### 4.1 Calendar Event Colors
| Event Type | Color | Token |
|---|---|---|
| Session | Blue `#1976D2` | `--event-session` |
| Hearing | Red `#D32F2F` | `--event-hearing` |
| Deadline | Orange `#F57C00` | `--event-deadline` |
| Reminder | Yellow `#FBC02D` | `--event-reminder` |
| Personal | Grey `#757575` | `--event-personal` |

### 4.2 Dashboard Stat Colors
| Stat | Color | Token |
|---|---|---|
| Active Cases | Primary `#1565C0` | `--stat-cases` |
| Outstanding Receivables | Amber `#FF8F00` | `--stat-receivables` |
| Hours This Week | Teal `#00897B` | `--stat-hours` |
| Overdue Tasks | Red `#C62828` | `--stat-overdue` |

### 4.3 Folder Tree Colors
- Root folder: Primary bold
- Sub-folder: Default text
- Archive folder: Muted `opacity: 0.55`
- Selected folder: Primary background tint `#E3F2FD`
- Drag hover: Dashed primary border

## 5. Components and Patterns

### 5.1 Lists and Tables
- All lists use pagination (cursor-based).
- Sticky headers for long tables.
- Filters:
  - left filter rail or top filter bar depending on page
  - applied filters shown as removable chips
- Column set examples:
  - Case list: System Ref, Title, Type, State, Owner, Next Session, Overdue Tasks, Completeness
  - Invoice list: Invoice #, Customer, Case, Amount, Status, Due date

### 5.2 Master-Detail
- Customer and Case detail pages:
  - header summary + key actions
  - tabbed sections
  - right rail (optional) for completeness/missing items or activity/audit

### 5.3 Timeline
- Case timeline merges:
  - tasks, sessions, filings, notes, comms, documents
- Filter by event type.
- Each event shows: timestamp, actor, summary, link to source record.

### 5.4 Document UI
- Confidentiality badge visible on lists and detail.
- Scan status visible:
  - Pending (Scanning…)
  - Failed (Admin only, with quarantine)
- Lock status:
  - checked out by / expiry
  - actions: checkout/checkin, break lock (admin)

### 5.5 Forms and Validation
- Inline validation with clear error messages.
- Identity uniqueness errors must specify conflicting field (without exposing other customer details):
  - “Tax ID already exists in this tenant.”
- Confirmations for destructive actions:
  - delete document (soft delete), void invoice, reject expense, break lock, apply hold.

### 5.6 Notifications
- In-app notification center:
  - unread badge
  - grouped by type (tasks, sessions, approvals, hearings, calendar reminders)
  - live update via WebSocket (no page refresh)
- Notification preferences page: toggle per event type (in-app / email / both / none).
- Toast: non-blocking, auto-dismiss after 5 s, action button for navigation.

### 5.7 Calendar Grid (Phase 2)
- **CalendarGrid** (FullCalendar wrapper)
  - Views: Month / Week / Day / Agenda toggle buttons
  - Event chips: coloured pill with title + time; truncated to fit cell
  - Click event → popover detail; double-click → full edit dialog
  - Empty slot click → quick-create form (pre-fills date/time)
  - RTL: grid direction reversed; time axis flips for Week/Day
- **EventChip** — small coloured indicator for lists and timeline

### 5.8 Folder Tree (Phase 2)
- **FolderTree** (recursive collapsible tree)
  - Indented rows with expand/collapse chevron
  - Context menu (right-click): New subfolder, Rename, Move, Archive, Delete
  - Drag-and-drop: file → folder, folder → folder (re-parent)
  - Loading skeleton for lazy-loaded deep branches

### 5.9 Dashboard Widgets (Phase 2)
- **StatCard** — single-metric card: icon, value, label, trend arrow
- **ChartWidget** — wrapper for chart.js/recharts: line, bar, doughnut
- **AgendaWidget** — compact upcoming-events list (next 5 items)
- **ApprovalBadge** — count badge for pending approvals (expenses + time entries)

### 5.10 File Upload (Phase 2)
- **FileDropZone** — drag-and-drop area with dashed border; supports multi-file (≤ 10)
  - Progress bars per file during upload
  - File type / size validation with inline error
  - Click fallback opens native file picker

### 5.11 Stepper Forms (Phase 2)
- **StepperForm** — multi-step wizard (e.g., hearing reschedule, template generation)
  - Horizontal step indicator (top)
  - Back / Next / Submit buttons
  - Validation per step before advancing

### 5.12 Notification Bell (Phase 2)
- **NotificationBell** — top-bar icon with unread count badge
  - Click opens dropdown panel: grouped notifications, “Mark all read”, link to preferences
  - Bell animates (shake) on new notification arrival

## 6. Accessibility
- Keyboard navigation for tables, forms, calendar grid, and folder tree.
- Visible focus states.
- Screen reader labels for icon-only buttons.
- Sufficient contrast for statuses.

### 6.1 Calendar ARIA (Phase 2)
- Calendar grid uses `role="grid"` with `role="gridcell"` per day.
- Event chips: `role="button"` with `aria-label` including title + time.
- View toggle: `role="tablist"` with `aria-selected`.
- Keyboard: Arrow keys navigate days; Enter opens event; Escape closes popover.

### 6.2 Folder Tree ARIA (Phase 2)
- Tree uses `role="tree"` / `role="treeitem"`.
- `aria-expanded` on collapsible nodes.
- Keyboard: Arrow Up/Down navigates siblings; Left collapses; Right expands; Enter selects.

### 6.3 Notification Live Region (Phase 2)
- Notification panel uses `aria-live="polite"` to announce new notifications.
- Toast uses `role="alert"` for transient messages.

## 7. Interaction Rules
- No optimistic updates for:
  - financial writes (invoices finalize/void, payments, approvals)
  - document version operations
  - time entry approval / rejection
  - hearing state transitions
- Optimistic updates allowed for:
  - simple note creation, non-critical list interactions (with server confirmation)
  - calendar event drag-and-drop reschedule (revert on failure)
  - folder tree expand/collapse (local state)

### 7.1 Calendar Keyboard Navigation (Phase 2)
- **Month view:** Arrow keys move focus between days; Tab moves to event within focused day.
- **Week / Day view:** Up/Down moves between time slots; Left/Right moves between days.
- **Escape:** Closes any open popover or dialog.
- **Enter / Space:** Opens selected event detail.

### 7.2 Drag-and-Drop Rules (Phase 2)
- **Calendar:** Drag event to new time slot = reschedule; shows ghost preview; confirmation on drop.
- **Folder tree:** Drag file/folder to target folder; highlight valid drop targets; reject circular moves.
- **File upload:** Drag files onto FileDropZone; visual feedback (border highlight + count).
- All drag operations show cursor change (`grab` → `grabbing`).
- Keyboard alternative: context menu “Move to…” for non-mouse users.

### 7.3 Notification Behavior (Phase 2)
- Toast auto-dismiss: 5 seconds; hover pauses timer.
- Bell badge increments in real-time via WebSocket.
- Clicking a notification navigates to the related entity and marks it as read.
- “Do not disturb” mode suppresses toasts but still increments badge.

