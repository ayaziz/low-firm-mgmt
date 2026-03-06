# Implementation Tasks

Status values: TODO | IN PROGRESS | BLOCKED | DONE

## Phase 0 — Planning & Contract Baseline
- [ ] T001 (TODO) Align shared frontend types to backend DTO/controller outputs. [F001]
- [ ] T002 (TODO) Centralize adapter response normalization and remove page-level shape repair where touched. [F002]

## Batch 1 — Critical functional gaps & broken contracts
### Documents
- [x] T003 (DONE) Fix document share payload to send backend-required `userId` UUID and update UI input pattern. [F003]
- [x] T004 (DONE) Fix document bulk payload key mismatch (`documentIds`). [F004]
- [x] T005 (DONE) Complete check-in replacement upload after upload URL handshake. [F005]

### Time Entries / Search / Templates / Admin
- [x] T015 (DONE) Preserve time-entry `taskId` and align rate naming between page and API mapper. [F015]
- [x] T017 (DONE) Align search response/result typing and rendering with `entityId`. [F017]
- [x] T018 (DONE) Fix template render response parsing and category options. [F018]
- [x] T012 (DONE) Align admin workflow settings payload to backend `steps`. [F012]
- [x] T014 (DONE) Remove unsupported password fields/submit mapping from admin users UI. [F014]

## Batch 2 — Validation & field correctness
### Customers / Cases / Time Entries / Admin
- [x] T009 (DONE) Implement conditional customer identity field validation and capture. [F009]
- [x] T010 (DONE) Normalize customer address payload names + validation surfacing. [F010]
- [x] T016 (DONE) Remove unsupported time-entry transition option(s) and align UI actions. [F016]
- [x] T007 (DONE) Expand case create form to required/recommended backend fields. [F007]
- [x] T013 (DONE) Remove unsupported tenant settings fields from admin settings UI. [F013]

## Batch 3 — Lookup/reference-data correctness
- [x] T021 (DONE) Add edit support to master data and case types pages. [F021]
- [x] T022 (DONE) Replace raw relationship IDs with resolved labels where available. [F022]
- [x] T019 (DONE) Align court/judge frontend fields with backend names. [F019]
- [x] T020 (DONE) Add hearing judge lookup + status alignment. [F020]
- [x] T024 (DONE) Extend document upload source options (case/customer/origin). [F024]

## Batch 4 — Relationship handling & CRUD completeness
- [x] T011 (DONE) Add customer communications API integration and UI tab. [F011]
- [x] T025 (DONE) Improve case party/membership management (add/edit/remove coverage). [F025]
- [x] T028 (DONE) Close high-value CRUD gaps in matrix by module priority order. [F028]
- [ ] T008 (BLOCKED) Honor case transition concurrency/version field in adapter calls. [F008]
- [x] T023 (DONE) Expose calendar attendees/reminders/recurrence/delete + linked records. [F023]

## Batch 5 — Operational UX & UI modernization
- [x] T026 (DONE) Standardize loading/empty/error states for touched modules. [F026]
- [x] T027 (DONE) Improve localization/RTL/currency formatting in touched modules. [F027]

## Verification & Closeout
- [x] T029 (DONE) Run frontend build/typecheck, targeted tests, and update traceability evidence.
- [x] T030 (DONE) Document deferred/blocked findings with explicit reason and next action.
