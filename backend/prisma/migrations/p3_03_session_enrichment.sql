-- Phase 3 Migration: Session Enrichment
-- file: p3_03_session_enrichment.sql
-- Adds judge, witness, billable, and postponement chain fields to sessions.

BEGIN;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS judge_id                   UUID,
  ADD COLUMN IF NOT EXISTS witness_list               JSONB  NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS actual_outcome             TEXT,
  ADD COLUMN IF NOT EXISTS actual_start_time          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end_time            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_billable                BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billable_duration_minutes  INT,
  ADD COLUMN IF NOT EXISTS postponed_from_session_id  UUID;

-- Add FK constraints (allow graceful failure if judges table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'judges') THEN
    BEGIN
      ALTER TABLE sessions ADD CONSTRAINT fk_sessions_judge FOREIGN KEY (judge_id) REFERENCES judges(id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  BEGIN
    ALTER TABLE sessions ADD CONSTRAINT fk_sessions_postponed_from FOREIGN KEY (postponed_from_session_id) REFERENCES sessions(id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMIT;

-- ROLLBACK script:
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_judge;
-- ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_postponed_from;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS judge_id, DROP COLUMN IF EXISTS witness_list, DROP COLUMN IF EXISTS actual_outcome, DROP COLUMN IF EXISTS actual_start_time, DROP COLUMN IF EXISTS actual_end_time, DROP COLUMN IF EXISTS is_billable, DROP COLUMN IF EXISTS billable_duration_minutes, DROP COLUMN IF EXISTS postponed_from_session_id;
