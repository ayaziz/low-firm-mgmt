# Phase 2 Implementation Tracker
## LOMA — Law Office Management Application

**Started:** 2026-03-02
**Status:** In Progress

---

## Epic 1: Foundation & Schema Migration

- [x] Read existing codebase structure and patterns
- [x] Read all Phase 2 documentation
- [x] Create this task tracker
- [ ] Phase 2 tenant-schema migration SQL (judges, hearings, calendar_events, calendar_reminders, calendar_event_attendees, folders, document_templates, time_entries, notification_subscriptions)
- [ ] Update seed.ts with Phase 2 master data
- [ ] Extend common/types.ts with Phase 2 enums and types

## Epic 2: Court & Judge Module

- [ ] Court entity extensions (department, circuit, jurisdiction_level, is_active)
- [ ] Court CRUD controller + service
- [ ] Judge entity + CRUD controller + service
- [ ] Case ↔ Court/Judge FK linking (primary_court_id, primary_judge_id)
- [ ] Admin UI: Court list + detail + Judge management
- [ ] E2E tests for Court/Judge CRUD

## Epic 3: Hearing Module

- [ ] Hearing entity + state machine (Scheduled→Completed/Postponed/Cancelled)
- [ ] Hearing CRUD + transition API
- [ ] Hearing → CalendarEvent auto-creation
- [ ] Hearing list + detail UI
- [ ] E2E tests for Hearing CRUD and state transitions

## Epic 4: Calendar Module

- [ ] CalendarEvent entity + CRUD API
- [ ] CalendarEventAttendee entity
- [ ] CalendarReminder entity + CronJob scheduler
- [ ] Conflict detection API
- [ ] Recurring events (RRULE parsing + instance generation)
- [ ] Calendar frontend (Month/Week/Day/Agenda views)
- [ ] Calendar event CRUD dialogs
- [ ] Case-filtered calendar view
- [ ] E2E tests for Calendar API

## Epic 5: Folder & Document Management v2

- [ ] Folder entity + CRUD API
- [ ] Folder permission inheritance (ACL resolution)
- [ ] Default folder templates (auto-create on case creation)
- [ ] Folder tree UI (recursive tree, context menu)
- [ ] Multi-file upload UI (drag-drop, parallel upload, progress bars)
- [ ] Document OCR status + full_text_content fields
- [ ] Storage provider abstraction extensions (copy, move, list)
- [ ] E2E tests for Folder CRUD

## Epic 6: OCR & Full-Text Search

- [ ] OCR Worker (Tesseract.js + BullMQ queue)
- [ ] Full-text search (tsvector/GIN index, search API with ts_headline)
- [ ] Document search UI (OCR search bar + filters)
- [ ] E2E tests for OCR pipeline and search

## Epic 7: Document Templates

- [ ] DocumentTemplate entity + CRUD API
- [ ] Handlebars template engine + variable schema
- [ ] Template preview + generate API (PDF output)
- [ ] Template editor UI (variable picker)
- [ ] E2E tests for template CRUD and generation

## Epic 8: Time Entry & Billing

- [ ] TimeEntry entity + CRUD + state machine
- [ ] Time entry submit/approve/reject API
- [ ] Time entry → Invoice line item population
- [ ] Timesheet UI (entry list, form)
- [ ] E2E tests for TimeEntry CRUD and state machine

## Epic 9: Notifications & Real-Time

- [ ] WebSocket gateway (Socket.IO + Redis adapter)
- [ ] NotificationSubscription entity + preferences API
- [ ] NotificationBell UI + dropdown
- [ ] E2E tests for notification endpoints

## Epic 10: Hardening & Verification

- [ ] Docker build verification (all services healthy)
- [ ] Demo data seeded and accessible
- [ ] All E2E tests passing
- [ ] API documentation updated (Swagger annotations)

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-03-02 | Codebase scan completed | ✅ |
| 2026-03-02 | Phase 2 docs reviewed | ✅ |
| 2026-03-02 | Task tracker created | ✅ |
