# Phase 2 Domain Model & Workflows
## Law Office Management Application (LOMA)

**Date:** 2026-02-25  
**Baseline:** PHASE1_BASELINE_SUMMARY.md, Phase 1 ERD (TDD §4.2)  
**Scope:** New entities, extended entities, relationships, state machines, and workflow definitions for Phase 2

---

## 1. Entity Inventory

### 1.1 New Entities (Phase 2)

| Entity | Module | Description |
|---|---|---|
| **Judge** | Admin/Case | Court-affiliated judge with contact details and specializations |
| **Hearing** | Case/Calendar | Court hearing with date, court, judge, case, parties, outcome |
| **CalendarEvent** | Calendar | Unified calendar entry (hearing, session, task deadline, custom) |
| **CalendarReminder** | Calendar | Scheduled reminder linked to CalendarEvent |
| **Folder** | Document | Hierarchical folder within a document library |
| **DocumentTemplate** | Document | Reusable template for document generation |
| **TimeEntry** | Accounting | Billable/non-billable time record linked to case/task |
| **NotificationSubscription** | Notification | User subscription preferences for event types |

### 1.2 Extended Entities (Phase 2 Modifications)

| Entity | Changes |
|---|---|
| **Court** | Add: `department`, `circuit`, `jurisdiction_level` (enum), `is_active` flag, `judge_ids[]` relationship |
| **Session** | Add: `calendar_event_id` FK, deprecate standalone scheduling fields |
| **Task** | Add: `calendar_event_id` FK for deadline on calendar, `estimated_hours` |
| **Document** | Add: `folder_id` FK (nullable for root-level docs), `full_text_content` (extracted), `ocr_status` |
| **DocumentVersion** | Add: `checksum_sha256`, `storage_provider` enum |
| **Case** | Add: `primary_court_id` FK, `primary_judge_id` FK |
| **CaseType** | Add: `task_template_json`, `session_template_json`, `participant_template_json` (instantiated on create) |
| **Invoice** | Add: generated `time_entry_ids[]` for auto-populated line items |
| **Note** | Remove append-only constraint; add `updated_at`, `updated_by`, `edit_history_json` |
| **User** | Add: `oidc_subject`, `oidc_issuer` for OIDC mapping |

---

## 2. Phase 2 ERD

```mermaid
erDiagram
  TENANT ||--o{ USER : has
  TENANT ||--o{ CUSTOMER : owns
  TENANT ||--o{ COURT : manages
  TENANT ||--o{ JUDGE : manages
  TENANT ||--o{ FOLDER : owns

  COURT ||--o{ JUDGE : employs
  COURT {
    uuid id PK
    string name
    string city
    string jurisdiction
    string department
    string circuit
    enum jurisdiction_level "District|Appeal|Supreme|Specialized"
    string address
    string phone
    boolean is_active
    timestamp created_at
    timestamp updated_at
  }

  JUDGE {
    uuid id PK
    uuid court_id FK
    string full_name
    string title
    string specialization
    string phone
    string email
    boolean is_active
    timestamp created_at
    timestamp updated_at
  }

  CASE ||--o{ HEARING : schedules
  HEARING {
    uuid id PK
    uuid case_id FK
    uuid court_id FK
    uuid judge_id FK
    timestamp hearing_date
    string location
    enum hearing_type "Initial|Continuation|Ruling|Appeal|Procedural"
    enum status "Scheduled|Completed|Postponed|Cancelled"
    string outcome
    string notes
    uuid calendar_event_id FK
    uuid created_by FK
    timestamp created_at
    timestamp updated_at
  }

  CALENDAR_EVENT {
    uuid id PK
    uuid tenant_id FK
    string title
    text description
    timestamp start_at
    timestamp end_at
    boolean all_day
    enum event_type "Hearing|Session|TaskDeadline|Custom|Reminder"
    enum recurrence "None|Daily|Weekly|Monthly"
    string recurrence_rule
    uuid case_id FK "nullable"
    uuid hearing_id FK "nullable"
    uuid session_id FK "nullable"
    uuid task_id FK "nullable"
    string location
    uuid created_by FK
    timestamp created_at
    timestamp updated_at
  }

  CALENDAR_EVENT ||--o{ CALENDAR_REMINDER : triggers
  CALENDAR_REMINDER {
    uuid id PK
    uuid calendar_event_id FK
    int minutes_before
    enum channel "InApp|Email"
    boolean sent
    timestamp sent_at
  }

  CALENDAR_EVENT ||--o{ CALENDAR_EVENT_ATTENDEE : includes
  CALENDAR_EVENT_ATTENDEE {
    uuid id PK
    uuid calendar_event_id FK
    uuid user_id FK
    enum rsvp "Pending|Accepted|Declined|Tentative"
  }

  FOLDER {
    uuid id PK
    uuid tenant_id FK
    uuid parent_folder_id FK "nullable - root if null"
    string name
    string path "materialized path e.g. /clients/acme/contracts"
    enum scope "Customer|Case|Tenant"
    uuid scope_id FK "customer_id or case_id"
    uuid created_by FK
    enum confidentiality_default "Normal|Confidential|HighlyConfidential"
    boolean inherit_permissions
    timestamp created_at
    timestamp updated_at
  }

  FOLDER ||--o{ FOLDER : contains
  FOLDER ||--o{ DOCUMENT : contains

  DOCUMENT_TEMPLATE {
    uuid id PK
    uuid tenant_id FK
    string name
    string description
    enum category "Contract|Letter|Petition|Motion|Filing|Other"
    text template_body "Handlebars/Mustache template"
    jsonb variable_schema "JSON Schema for template variables"
    boolean is_active
    uuid created_by FK
    timestamp created_at
    timestamp updated_at
  }

  TIME_ENTRY {
    uuid id PK
    uuid tenant_id FK
    uuid case_id FK
    uuid task_id FK "nullable"
    uuid user_id FK
    date entry_date
    decimal hours
    string description
    boolean billable
    decimal hourly_rate "nullable - from user/case config"
    enum status "Draft|Submitted|Approved|Billed|WriteOff"
    uuid invoice_line_id FK "nullable - linked when billed"
    timestamp created_at
    timestamp updated_at
  }

  NOTIFICATION_SUBSCRIPTION {
    uuid id PK
    uuid user_id FK
    enum event_type "TaskAssigned|SessionScheduled|HearingScheduled|ApprovalRequired|DocumentShared|Custom"
    enum channel "InApp|Email|Both"
    boolean enabled
    timestamp created_at
  }

  CASE }|--|| COURT : "primary court"
  CASE }|--|| JUDGE : "primary judge"
  DOCUMENT }|--o| FOLDER : "organized in"
  TASK }|--o| CALENDAR_EVENT : "deadline"
  SESSION }|--o| CALENDAR_EVENT : "scheduled"
  HEARING }|--o| CALENDAR_EVENT : "court date"
  TIME_ENTRY }|--|| CASE : "tracked against"
  TIME_ENTRY }|--o| INVOICE_LINE : "billed via"
```

---

## 3. State Machines

### 3.1 Hearing State Machine

```mermaid
stateDiagram-v2
  [*] --> Scheduled : createHearing
  Scheduled --> Completed : recordOutcome
  Scheduled --> Postponed : postpone(reason, newDate)
  Scheduled --> Cancelled : cancel(reason)
  Postponed --> Scheduled : reschedule(newDate)
  Postponed --> Cancelled : cancel(reason)
  Completed --> [*]
  Cancelled --> [*]
```

**Rules:**
- Hearing creation requires `case_id`, `court_id`, `hearing_date`; `judge_id` recommended
- Postpone creates a new CalendarEvent for the new date; original event marked Cancelled
- Completed requires `outcome` text
- All transitions audited: `HEARING_CREATED`, `HEARING_COMPLETED`, `HEARING_POSTPONED`, `HEARING_CANCELLED`

### 3.2 CalendarEvent Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Active : create
  Active --> Updated : update(fields)
  Updated --> Active : save
  Active --> Cancelled : cancel
  Active --> Completed : markComplete (auto for past events)
  Cancelled --> [*]
  Completed --> [*]
```

**Rules:**
- Events linked to Hearing/Session inherit state from parent entity
- Standalone (Custom) events are managed independently
- Recurring events generate instances; modifications to a single instance create an exception
- Conflict detection runs on create/update: `overlapping(start_at, end_at, attendee_user_ids)` returns boolean

### 3.3 TimeEntry State Machine

```mermaid
stateDiagram-v2
  [*] --> Draft : create
  Draft --> Submitted : submit
  Draft --> Draft : edit
  Submitted --> Approved : approve(approver)
  Submitted --> Draft : reject(reason)
  Approved --> Billed : linkToInvoiceLine
  Approved --> WriteOff : writeOff(reason)
  Billed --> [*]
  WriteOff --> [*]
```

**Rules:**
- Lawyer creates time entries (own entries only in MVP)
- TenantAdmin or designated approver approves
- Approved entries can be linked to invoice line items (auto-populate)
- Billed entries are immutable
- WriteOff requires reason and audit

### 3.4 Folder Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Active : create
  Active --> Active : rename / move
  Active --> Archived : archive
  Archived --> Active : unarchive
  Active --> Deleted : softDelete (empty only)
  Deleted --> [*]
```

**Rules:**
- Folders inherit confidentiality_default to new child documents (overridable)
- `inherit_permissions = true` → child docs inherit folder ACL
- Move folder updates materialized path for all descendants
- Cannot soft-delete folder with documents (must be empty)
- Archive makes folder and contents read-only (like case archiving)

---

## 4. Workflows

### 4.1 Case Creation with Template Instantiation

```mermaid
sequenceDiagram
  actor Lawyer
  participant API
  participant CaseService
  participant TemplateEngine
  participant CalendarService
  participant AuditService

  Lawyer->>API: POST /cases {caseTypeId, customerId, courtId, judgeId, ...}
  API->>CaseService: createCase(dto)
  CaseService->>CaseService: validate + insert case record
  CaseService->>TemplateEngine: instantiateTemplates(caseTypeId, caseId)
  TemplateEngine->>CaseService: create default tasks from task_template_json
  TemplateEngine->>CaseService: create placeholder sessions from session_template_json
  TemplateEngine->>CaseService: create participant placeholders from participant_template_json
  CaseService->>CalendarService: createEvents(sessions, taskDeadlines)
  CalendarService-->>CaseService: calendarEventIds
  CaseService->>AuditService: emit CASE_CREATED + TEMPLATE_INSTANTIATED
  CaseService-->>API: case + generated items
  API-->>Lawyer: 201 Created
```

### 4.2 Document Upload to Folder with OCR

```mermaid
sequenceDiagram
  actor User
  participant API
  participant DocService
  participant StorageProvider
  participant ScanWorker
  participant OCRWorker
  participant SearchIndex

  User->>API: POST /documents {folderId, metadata, file}
  API->>DocService: requestUpload(dto)
  DocService->>DocService: validate file type + size
  DocService->>DocService: resolve folder path + inherited permissions
  DocService->>StorageProvider: createUploadUrl(hierarchicalPath)
  StorageProvider-->>DocService: signedUrl
  DocService-->>API: {signedUrl, docId, versionId}
  API-->>User: upload URL

  User->>StorageProvider: PUT file (direct upload)
  StorageProvider->>ScanWorker: scan event (queue)
  ScanWorker->>ScanWorker: malware scan (ClamAV)
  ScanWorker->>DocService: updateStatus(Passed/Failed)

  alt Passed + PDF/image
    DocService->>OCRWorker: extractText(versionId)
    OCRWorker->>OCRWorker: OCR extraction
    OCRWorker->>DocService: updateFullText(text)
    DocService->>SearchIndex: indexDocument(docId, fullText, metadata)
  end
```

### 4.3 Hearing Scheduling with Calendar

```mermaid
sequenceDiagram
  actor Lawyer
  participant API
  participant CaseService
  participant CalendarService
  participant NotificationService

  Lawyer->>API: POST /cases/{caseId}/hearings {courtId, judgeId, hearingDate, type}
  API->>CaseService: createHearing(dto)
  CaseService->>CaseService: validate case not archived, court/judge exist
  CaseService->>CalendarService: createEvent({type: Hearing, start: hearingDate, attendees})
  CalendarService->>CalendarService: check conflicts for attendees
  alt Conflict detected
    CalendarService-->>CaseService: conflict warning (non-blocking)
  end
  CalendarService-->>CaseService: calendarEventId
  CaseService->>CaseService: insert hearing with calendar_event_id
  CaseService->>NotificationService: notifyCaseMembers(HEARING_SCHEDULED)
  CaseService-->>API: hearing
  API-->>Lawyer: 201 Created
```

### 4.4 Time Entry to Invoice Flow

```mermaid
sequenceDiagram
  actor Lawyer
  actor Accountant
  participant API
  participant TimeService
  participant InvoiceService

  Lawyer->>API: POST /time-entries {caseId, hours, description, billable}
  API->>TimeService: create(dto)
  TimeService-->>API: timeEntry (Draft)

  Lawyer->>API: POST /time-entries/{id}/submit
  TimeService->>TimeService: validate → Submitted

  Accountant->>API: POST /time-entries/{id}/approve
  TimeService->>TimeService: validate approver → Approved

  Accountant->>API: POST /invoices {caseId, timeEntryIds[]}
  API->>InvoiceService: createFromTimeEntries(dto)
  InvoiceService->>TimeService: getApprovedEntries(timeEntryIds)
  InvoiceService->>InvoiceService: generate line items from entries (hours × rate)
  InvoiceService->>TimeService: markAsBilled(timeEntryIds, invoiceLineIds)
  InvoiceService-->>API: invoice with auto-populated lines
```

---

## 5. RBAC Extensions

### 5.1 New Permissions Matrix

| Action | Lawyer | Accountant | TenantAdmin | SystemAdmin |
|---|---|---|---|---|
| **Court** CRUD | Read | — | Full | Read |
| **Judge** CRUD | Read | — | Full | Read |
| **Hearing** Create/Update | ✅ (own cases) | — | ✅ | — |
| **Hearing** Read | ✅ (case member) | ✅ (FinanceAllowed) | ✅ | — |
| **Calendar** View own | ✅ | ✅ | ✅ | — |
| **Calendar** View all | — | — | ✅ | — |
| **Calendar** Custom event CRUD | ✅ (own) | ✅ (own) | ✅ | — |
| **Folder** Create/Rename/Move | ✅ (case/customer scope) | — | ✅ | — |
| **Folder** Delete (empty) | — | — | ✅ | — |
| **Folder** Archive | — | — | ✅ | — |
| **Document Template** CRUD | — | — | ✅ | — |
| **Document Template** Use | ✅ | — | ✅ | — |
| **Time Entry** Create/Edit own | ✅ | — | — | — |
| **Time Entry** Submit | ✅ (own) | — | — | — |
| **Time Entry** Approve | — | ✅ | ✅ | — |
| **Time Entry** Read (case) | ✅ (case member) | ✅ | ✅ | — |
| **Invoice from Time** | — | ✅ | ✅ | — |
| **Numbering Scheme** Config | — | — | ✅ | ✅ |
| **OIDC Tenant Config** | — | — | — | ✅ |

### 5.2 ABAC Extensions

| Rule | Enforcement Point | Phase 1 Status | Phase 2 Change |
|---|---|---|---|
| Case membership on READ | CaseService.getById, CaseController.* | ⚠️ Write-only | Enforce on all GETs |
| visibilityScope on participant | CaseService.get*, financial endpoints | ⚠️ Schema only | Wire into authorization |
| Folder permission inheritance | DocumentService.getById, folder endpoints | N/A | New — folder ACL inherits to docs |
| Time entry ownership | TimeEntryService.* | N/A | New — Lawyer edits own entries only |
| Calendar event visibility | CalendarService.getEvents | N/A | New — user sees own events + case events for membered cases |

---

## 6. Audit Event Catalog (Phase 2 Additions)

| Event Type | Entity | Trigger |
|---|---|---|
| JUDGE_CREATED | Judge | Admin creates judge |
| JUDGE_UPDATED | Judge | Admin updates judge |
| HEARING_CREATED | Hearing | Lawyer/Admin creates hearing |
| HEARING_COMPLETED | Hearing | Outcome recorded |
| HEARING_POSTPONED | Hearing | Hearing postponed with reason |
| HEARING_CANCELLED | Hearing | Hearing cancelled |
| CALENDAR_EVENT_CREATED | CalendarEvent | Any event created |
| CALENDAR_EVENT_UPDATED | CalendarEvent | Event modified |
| CALENDAR_EVENT_CANCELLED | CalendarEvent | Event cancelled |
| FOLDER_CREATED | Folder | User creates folder |
| FOLDER_RENAMED | Folder | User renames folder |
| FOLDER_MOVED | Folder | User moves folder |
| FOLDER_ARCHIVED | Folder | Admin archives folder |
| FOLDER_DELETED | Folder | Admin deletes empty folder |
| DOCUMENT_GENERATED | Document | Document generated from template |
| TEMPLATE_CREATED | DocumentTemplate | Admin creates template |
| TEMPLATE_UPDATED | DocumentTemplate | Admin updates template |
| TEMPLATE_INSTANTIATED | CaseType | Templates instantiated on case create |
| TIME_ENTRY_CREATED | TimeEntry | Lawyer creates entry |
| TIME_ENTRY_SUBMITTED | TimeEntry | Lawyer submits entry |
| TIME_ENTRY_APPROVED | TimeEntry | Approver approves entry |
| TIME_ENTRY_REJECTED | TimeEntry | Approver rejects entry |
| TIME_ENTRY_BILLED | TimeEntry | Entry linked to invoice |
| TIME_ENTRY_WRITTEN_OFF | TimeEntry | Entry written off |
| NOTE_EDITED | Note | User edits note (was append-only) |
| OIDC_CONFIG_UPDATED | Tenant | OIDC configuration changed |
| NUMBERING_SCHEME_UPDATED | Tenant | Numbering format changed |
| EXTERNAL_SHARE_CREATED | Document | External sharing link created |
| EXTERNAL_SHARE_REVOKED | Document | External sharing link revoked |
