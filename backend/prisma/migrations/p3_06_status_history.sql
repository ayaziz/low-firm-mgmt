-- Phase 3 Migration: Status History (Generic)
-- file: p3_06_status_history.sql
-- Creates generic status_history table for all status-bearing entities.

BEGIN;

CREATE TABLE IF NOT EXISTS status_history (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(50)  NOT NULL,
  entity_id     UUID         NOT NULL,
  from_status   VARCHAR(50),
  to_status     VARCHAR(50)  NOT NULL,
  actor_user_id UUID,
  comment       TEXT,
  metadata      JSONB        DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_entity ON status_history (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_actor  ON status_history (actor_user_id);

COMMIT;

-- ROLLBACK script:
-- DROP TABLE IF EXISTS status_history;
