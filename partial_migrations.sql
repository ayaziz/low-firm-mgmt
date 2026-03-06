SET search_path TO tenant_demo_firm, public;

-- === p3_04 ===
-- Phase 3 Migration: Wage Approval States
-- file: p3_04_wage_approval.sql
-- Extends wage payment_status enum to support approval workflow.
-- Migrates existing 'Planned' → 'Draft' and 'Pending' → 'Draft'.

BEGIN;

-- Drop old constraint
ALTER TABLE wages
  DROP CONSTRAINT IF EXISTS wages_payment_status_check;

-- Migrate existing data FIRST (before adding new constraint with stricter values)
UPDATE wages SET payment_status = 'Draft' WHERE payment_status = 'Planned';
UPDATE wages SET payment_status = 'Draft' WHERE payment_status NOT IN ('Draft','Submitted','Approved','Paid','Pending','Cancelled');

-- Add approval metadata columns
ALTER TABLE wages
  ADD COLUMN IF NOT EXISTS submitted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by      UUID,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by       UUID,
  ADD COLUMN IF NOT EXISTS approval_comment  TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by       UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by           UUID,
  ADD COLUMN IF NOT EXISTS payment_method    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS payment_ref       VARCHAR(300);

-- Add new constraint with 4-state approval flow
ALTER TABLE wages
  ADD CONSTRAINT wages_payment_status_check
  CHECK (payment_status IN ('Draft','Submitted','Approved','Paid','Pending','Cancelled'));

COMMIT;

-- ROLLBACK script:
-- UPDATE wages SET payment_status = 'Pending' WHERE payment_status = 'Draft';
-- ALTER TABLE wages DROP CONSTRAINT IF EXISTS wages_payment_status_check;
-- ALTER TABLE wages ADD CONSTRAINT wages_payment_status_check CHECK (payment_status IN ('Pending','Paid','Cancelled'));
-- ALTER TABLE wages DROP COLUMN IF EXISTS submitted_at, DROP COLUMN IF EXISTS submitted_by, DROP COLUMN IF EXISTS approved_at, DROP COLUMN IF EXISTS approved_by, DROP COLUMN IF EXISTS rejected_at, DROP COLUMN IF EXISTS rejected_by, DROP COLUMN IF EXISTS rejection_comment, DROP COLUMN IF EXISTS paid_at, DROP COLUMN IF EXISTS paid_by, DROP COLUMN IF EXISTS payment_method, DROP COLUMN IF EXISTS payment_ref;


-- === p3_09 ===
-- Phase 3 Migration: External Share Links
-- file: p3_09_external_shares.sql
-- Creates external_share_links and external_share_accesses tables.

BEGIN;

CREATE TABLE IF NOT EXISTS external_share_links (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID         NOT NULL REFERENCES documents(id),
  token           VARCHAR(128) NOT NULL UNIQUE,
  created_by      UUID         NOT NULL, -- no FK: users.id is type text in public schema, incompatible with UUID
  expires_at      TIMESTAMPTZ,
  password_hash   VARCHAR(255),
  max_downloads   INT,
  download_count  INT          NOT NULL DEFAULT 0,
  is_revoked      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_share_accesses (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id   UUID         NOT NULL REFERENCES external_share_links(id),
  accessed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ip_address      VARCHAR(45),
  user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON external_share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_document ON external_share_links(document_id);
CREATE INDEX IF NOT EXISTS idx_share_accesses_link ON external_share_accesses(share_link_id);

COMMIT;

-- ROLLBACK script:
-- DROP TABLE IF EXISTS external_share_accesses;
-- DROP TABLE IF EXISTS external_share_links;


-- === p3_10 ===
-- Phase 3 Migration: Session Postponement Approval
-- file: p3_10_session_postponement.sql
-- Adds approval columns to session_reschedules table.

BEGIN;

ALTER TABLE session_reschedules
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'Pending'
    CHECK (approval_status IN ('Pending','Approved','Rejected')),
  ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approval_comment TEXT,
  ADD COLUMN IF NOT EXISTS decided_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_session_reschedules_status ON session_reschedules(approval_status);

COMMIT;

-- ROLLBACK script:
-- ALTER TABLE session_reschedules DROP COLUMN IF EXISTS decided_at;
-- ALTER TABLE session_reschedules DROP COLUMN IF EXISTS approval_comment;
-- ALTER TABLE session_reschedules DROP COLUMN IF EXISTS approved_by;
-- ALTER TABLE session_reschedules DROP COLUMN IF EXISTS approval_status;


-- === p3_12 ===
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


