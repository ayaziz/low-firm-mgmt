# Wireframes & Information Architecture (IA)
## Law Office Management Web Application (LOMA) — Phase 2

**Version:** 2.0  
**Date:** 2026-02-25  
**Note:** Text wireframes define structure and behavior. Visual mockups can be derived from this IA.

---

## 1. Global Navigation

### 1.1 Layout
- **Top Bar**
  - Tenant switch (System Admin only) / Tenant name
  - Global Search (Customers, Cases, Documents metadata, Invoices, Calendar Events)
  - Notifications bell (in-app + unread badge; live via WebSocket)
  - Language switch (EN/AR)
  - User menu (profile, notification preferences, sign out)
- **Left Sidebar (grouped, role-filtered)**
  - **Main**
    - Dashboard
    - Calendar
  - **Case Management**
    - Customers
    - Cases
    - Hearings
  - **Documents**
    - Document Library (folder browser)
    - Templates (Admin only)
  - **Finance**
    - Time Tracking
    - Invoices
    - Payments
    - Expenses
    - Wages (Accountant + Admin)
  - **Insights**
    - Reports
  - **Administration** (Tenant Admin only)
    - Users & Roles
    - Master Data
    - Courts & Judges
    - Settings
- **Mobile** (≤ 768 px)
  - Sidebar collapses to bottom tab bar: Dashboard, Calendar, Cases, Documents, More (…)

### 1.2 Global Create Menu (role-gated)
- New Customer
- New Case
- Upload Document
- New Calendar Event
- New Time Entry
- New Invoice (if allowed)

---

## 2. Lawyer IA

### 2.1 Dashboard (Lawyer)
**Layout:** 2-column responsive grid (single column on mobile).

**Left Column**
- **Today’s Agenda** — next 5 calendar events / hearings, colour-coded by type
- **My Tasks** (Overdue / Due soon) — sortable table
- **Recent Documents** (last 5, within accessible scope)

**Right Column**
- **Case Distribution** — doughnut chart (active cases by type)
- **Upcoming Hearings** — next 7 days, with court + judge badge
- **Hours This Week** — horizontal bar (logged vs. target)

**Actions**
- Quick create: Customer, Case, Upload Document, Calendar Event, Time Entry

### 2.2 Customers
- Customer List:
  - search + filters (type, status)
  - columns: Name, Type, Primary Contact, Active Cases, Outstanding (if permitted), Last Activity
- Customer Detail (tabs):
  - Overview (identity, primary contacts, completeness, financial summary headers)
  - Contacts & Parties
  - Addresses
  - Documents
  - Compliance Checklist
  - Activity
  - Audit (limited)

### 2.3 Cases
- Case List:
  - filters: state, type, owner, completeness range
  - columns: System Ref, Title, Type, State, Owner, Next Session, Overdue Tasks, Completeness
- Case Detail:
  - Header: System Ref, Court Case Number, State, OnHold flag, Owner, Completeness % + missing items indicator
  - Tabs:
    - Timeline (merged: tasks/sessions/filings/notes/comms/docs)
    - Tasks
    - Sessions
    - Filings
    - Participants
    - Notes
    - Communications
    - Documents
    - Financial Summary (invoice headers only)
    - Audit (limited)

### 2.4 Documents
- **Document Library (Folder Browser)**
  - Left panel: folder tree (collapsible, drag-to-move)
  - Right panel: file list in selected folder
  - Breadcrumb trail above file list
  - Actions: create folder, upload file(s), generate from template
  - Filters: docType, confidentiality, uploader, date range, OCR text search
  - Multi-select: bulk download, bulk move, bulk archive
- **Document Detail**
  - metadata panel: docType, confidentiality badge, tags, folder path
  - lock panel: checked-out by, expiry, actions (checkout/checkin)
  - OCR text preview (collapsible; shows extracted text)
  - versions list: only Passed visible by default
  - shares: internal shares + external share links (create/revoke)
  - access history (audit-limited)

### 2.5 Calendar
- **Views:** Month (default) | Week | Day | Agenda list
- **Calendar Grid**
  - Events colour-coded by type: Session (blue), Hearing (red), Deadline (orange), Reminder (yellow), Personal (grey)
  - Click event → detail popover with: title, time, case link, location, attendees
  - Click empty slot → quick-create event form
- **Side Panel (Day/Week views)**
  - Upcoming reminders
  - Conflict warnings (overlapping events highlighted)
- **Filters:** Event type, Case, My events / All (role-gated)
- **Recurring Events:** Badge icon; edit single occurrence or series
- **Responsive:** Month view collapses to agenda list on mobile

### 2.6 Hearings
- **Hearing List** (under Cases or standalone)
  - Filters: case, court, judge, state (Scheduled/InProgress/Completed/Adjourned/Cancelled), date range
  - Columns: Case Ref, Court, Judge, Date/Time, State, Outcome
- **Hearing Detail**
  - Header: case link, court, judge, state badge
  - Tabs: Details, Reschedule History, Related Documents, Outcome Notes
  - Actions: Transition state, Reschedule (opens date/reason form)

### 2.7 Time Tracking
- **Timesheet View** (weekly grid)
  - Rows: cases worked on
  - Columns: Mon–Sun + Total
  - Inline entry: click cell → hours + description
  - Row actions: start timer, manual entry
- **Time Entry List**
  - Filters: case, status (Draft/Submitted/Approved/Rejected/WrittenOff), date range
  - Bulk submit selected drafts
- **Running Timer** (persistent top bar widget)
  - Shows active case + elapsed time
  - Actions: pause, stop (creates draft entry), discard

---

## 3. Accountant IA

### 3.1 Dashboard (Accountant)
**Layout:** 2-column responsive grid.

**Left Column**
- **Receivables Summary** — stat cards: Total Outstanding, Overdue, This Month Collected
- **Pending Expense Approvals** — count badge + list (top 5)
- **Time Entries Pending Approval** — count badge + list (top 5)

**Right Column**
- **Revenue Trend** — line chart (last 6 months)
- **Invoices by Status** — stacked bar (Draft/Sent/Paid/Void)
- **Recent Payments** — last 5 with customer + amount

### 3.2 Accounting
- **Invoices:**
  - list filters: status, date range, customer, case
  - invoice detail: finalize/send/void actions
  - auto-populated line items from approved time entries
- **Payments:**
  - record payment against invoice (single invoice)
- **Expenses:**
  - list + approval queue (multi-step)
- **Wages:**
  - list by period + CSV export

### 3.3 Time Entry Approval
- **Approval Queue**
  - Filters: user, case, date range
  - Columns: User, Case, Date, Hours, Description, Status
  - Bulk approve / reject selected entries
  - Inline reject reason

### 3.4 Customers
- Customer list with finance-focused columns.
- Customer detail: finance tab + finance attachments only.

---

## 4. Admin IA (Tenant Admin)

### 4.1 Users and Memberships
- Users list + create user (manual or invite via email)
- Assign role(s)
- Manage case memberships and case membership roles

### 4.2 Master Data
- Contact roles
- Participant roles
- Relationship types
- Communication types
- Filing types
- Case types + templates (task templates, required docs template links, placeholder sessions)
- docTypes + allowed file types + default confidentiality
- Expense approval workflow (role-based, multi-step)

### 4.3 Courts & Judges
- **Court List**
  - Columns: Name, Jurisdiction, Location, Type, Active Judges, Status
  - Actions: Create, Edit, Deactivate
- **Court Detail**
  - Info panel + assigned judges tab + upcoming hearings tab
- **Judge List** (within court or global)
  - Columns: Name, Title, Court, Specialization, Status
  - Actions: Assign to court, Edit, Deactivate

### 4.4 Document Templates
- **Template List**
  - Columns: Name, Category, Folder, Last Modified, Status
  - Actions: Create, Edit, Preview, Delete
- **Template Editor**
  - Rich text editor with Handlebars merge-field picker
  - Live preview panel with sample data
  - Assign to folder / category

### 4.5 Settings
- Tenant profile (name, logo, timezone)
- Notification defaults
- Document numbering pattern configuration (tokens: `{YEAR}`, `{SEQ}`, `{CASE_REF}`, etc.)
- Storage quota monitoring

### 4.6 Governance
- Legal holds (case/document)
- Lock breaks
- Invoice void actions
- View retention policies (seeded, view-only)

