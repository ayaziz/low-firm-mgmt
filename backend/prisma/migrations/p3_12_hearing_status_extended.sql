-- Phase 3 Migration: Extended Hearing Status Workflow
-- file: p3_12_hearing_status_extended.sql
-- Extends hearings.status CHECK to support full lifecycle:
-- Scheduled → Confirmed → InProgress → Completed
-- Scheduled/Confirmed/InProgress → Postponed/Cancelled

BEGIN;

ALTER TABLE hearings
  DROP CONSTRAINT IF EXISTS hearings_status_check;

ALTER TABLE hearings
  ADD CONSTRAINT hearings_status_check
  CHECK (status IN ('Scheduled','Confirmed','InProgress','Adjourned','Completed','Postponed','Cancelled'));

COMMIT;

-- ROLLBACK script:
-- ALTER TABLE hearings DROP CONSTRAINT IF EXISTS hearings_status_check;
-- ALTER TABLE hearings ADD CONSTRAINT hearings_status_check CHECK (status IN ('Scheduled','Completed','Postponed','Cancelled'));
