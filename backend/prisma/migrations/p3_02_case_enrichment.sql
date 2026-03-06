-- Phase 3 Migration: Case Enrichment
-- file: p3_02_case_enrichment.sql
-- Adds risk, priority, legal/judgment, and team assignment fields to cases.
-- Also enriches case_parties with opposing counsel fields.

BEGIN;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS risk_level           VARCHAR(10)  DEFAULT 'Low'
                                                CHECK (risk_level IN ('Low','Medium','High','Critical')),
  ADD COLUMN IF NOT EXISTS priority             VARCHAR(10)  DEFAULT 'Normal'
                                                CHECK (priority IN ('Normal','Urgent','Emergency')),
  ADD COLUMN IF NOT EXISTS source               VARCHAR(20)
                                                CHECK (source IN ('Referral','Direct','Government','Repeat')),
  ADD COLUMN IF NOT EXISTS estimated_value      DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS legal_acts           JSONB        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS judgment_date        DATE,
  ADD COLUMN IF NOT EXISTS judgment_outcome     TEXT,
  ADD COLUMN IF NOT EXISTS judgment_reference   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS appeal_deadline      DATE,
  ADD COLUMN IF NOT EXISTS lead_lawyer_user_id  UUID,
  ADD COLUMN IF NOT EXISTS junior_lawyers       UUID[]       NOT NULL DEFAULT '{}';

ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS opposing_counsel_name   VARCHAR(300),
  ADD COLUMN IF NOT EXISTS opposing_counsel_firm   VARCHAR(300),
  ADD COLUMN IF NOT EXISTS opposing_counsel_email  VARCHAR(300),
  ADD COLUMN IF NOT EXISTS opposing_counsel_phone  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS opposing_counsel_bar_no VARCHAR(100);

COMMIT;

-- ROLLBACK script:
-- ALTER TABLE cases DROP COLUMN IF EXISTS risk_level, DROP COLUMN IF EXISTS priority, DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS estimated_value, DROP COLUMN IF EXISTS legal_acts, DROP COLUMN IF EXISTS judgment_date, DROP COLUMN IF EXISTS judgment_outcome, DROP COLUMN IF EXISTS judgment_reference, DROP COLUMN IF EXISTS appeal_deadline, DROP COLUMN IF EXISTS lead_lawyer_user_id, DROP COLUMN IF EXISTS junior_lawyers;
-- ALTER TABLE case_parties DROP COLUMN IF EXISTS opposing_counsel_name, DROP COLUMN IF EXISTS opposing_counsel_firm, DROP COLUMN IF EXISTS opposing_counsel_email, DROP COLUMN IF EXISTS opposing_counsel_phone, DROP COLUMN IF EXISTS opposing_counsel_bar_no;
