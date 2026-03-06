SET search_path TO tenant_demo_firm, public;

-- Phase 3 Migration: Session Postponement Approval
-- file: p3_10_session_postponement.sql
-- Adds approval columns to session_reschedules table.

BEGIN;

ALTER TABLE session_reschedules
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'Pending'
    CHECK (approval_status IN ('Pending','Approved','Rejected')),
  ADD COLUMN IF NOT EXISTS approved_by     UUID, -- no FK: users.id is type text in public schema
  ADD COLUMN IF NOT EXISTS approval_comment TEXT,
  ADD COLUMN IF NOT EXISTS decided_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_session_reschedules_status ON session_reschedules(approval_status);

COMMIT;

-- ROLLBACK script:
-- ALTER TABLE session_reschedules DROP COLUMN IF EXISTS decided_at;
-- ALTER TABLE session_reschedules DROP COLUMN IF EXISTS approval_comment;
-- ALTER TABLE session_reschedules DROP COLUMN IF EXISTS approved_by;
-- ALTER TABLE session_reschedules DROP COLUMN IF EXISTS approval_status;

