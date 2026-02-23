# Wireframes & Information Architecture (IA)
## Law Office Management Web Application (LOMA) — Wave 1 MVP

**Version:** 1.0  
**Date:** 2026-02-23  
**Note:** Text wireframes define structure and behavior. Visual mockups can be derived from this IA.

---

## 1. Global Navigation

### 1.1 Layout
- **Top Bar**
  - Tenant switch (System Admin only) / Tenant name
  - Global Search (Customers, Cases, Documents metadata, Invoices)
  - Notifications bell (in-app)
  - Language switch (EN/AR)
  - User menu (profile, sign out)
- **Left Navigation (role-filtered)**
  - Dashboard
  - Customers
  - Cases
  - Documents
  - Accounting (Accountant + Tenant Admin; Lawyer limited)
  - Reports
  - Admin (Tenant Admin only)

### 1.2 Global Create Menu (role-gated)
- New Customer
- New Case
- Upload Document
- New Invoice (if allowed)

---

## 2. Lawyer IA

### 2.1 Dashboard (Lawyer)
**Widgets**
- My Tasks (Overdue / Due soon)
- Upcoming Sessions (next 7/14 days)
- Recently Updated Cases
- Recent Documents (within accessible scope)
**Actions**
- Quick create: Customer, Case, Upload Document

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
- Global Documents:
  - metadata search + filters: docType, confidentiality, uploader, date range
  - results permission-filtered
- Document Detail:
  - metadata panel: docType, confidentiality badge, tags
  - lock panel: checked-out by, expiry, actions (checkout/checkin)
  - versions list: only Passed visible by default
  - shares: internal shares list + create/revoke
  - access history (audit-limited)

### 2.5 Calendar
- My Calendar view:
  - list and calendar
  - filters: session type, case, status
  - reschedule history on session detail

---

## 3. Accountant IA

### 3.1 Dashboard (Accountant)
- Receivables summary
- Recent payments
- Pending expense approvals
- Invoices pending finalize

### 3.2 Accounting
- Invoices:
  - list filters: status, date range, customer, case
  - invoice detail: finalize/send/void actions
- Payments:
  - record payment against invoice (single invoice)
- Expenses:
  - list + approval queue (multi-step)
- Wages:
  - list by period + CSV export

### 3.3 Customers
- Customer list with finance-focused columns.
- Customer detail: finance tab + finance attachments only.

---

## 4. Admin IA (Tenant Admin)

### 4.1 Users and Memberships
- Users list + create user (manual)
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

### 4.3 Governance
- Legal holds (case/document)
- Lock breaks
- Invoice void actions
- View retention policies (seeded, view-only)

