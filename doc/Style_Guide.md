# UI Style Guide & Interaction Standards
## Law Office Management Web Application (LOMA) — Wave 1 MVP

**Version:** 1.0  
**Date:** 2026-02-23  

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
- Success: Paid, Scan Passed, Approved
- Warning: Due soon, Pending approval, On Hold, Scanning
- Danger: Scan Failed, Overdue tasks, Rejected, Voided
- Info: Draft, Planned, Pending

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
  - grouped by type (tasks, sessions, approvals)
- Fixed reminder policy in MVP.

## 6. Accessibility
- Keyboard navigation for tables and forms.
- Visible focus states.
- Screen reader labels for icon-only buttons.
- Sufficient contrast for statuses.

## 7. Interaction Rules (MVP)
- No optimistic updates for:
  - financial writes (invoices finalize/void, payments, approvals)
  - document version operations
- Optimistic updates allowed for:
  - simple note creation, non-critical list interactions (with server confirmation).

