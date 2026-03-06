SET search_path TO tenant_demo_firm, public;
-- Phase 3 Migration: Customer Enrichment
-- file: p3_01_customer_enrichment.sql
-- Adds KYC, risk, communication, and identity fields to customers table.
-- Backward-compatible: all columns have defaults or are nullable.

BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS kyc_status           VARCHAR(20)  NOT NULL DEFAULT 'NotStarted'
                                                CHECK (kyc_status IN ('NotStarted','InProgress','Verified','Rejected')),
  ADD COLUMN IF NOT EXISTS kyc_verified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_rating        VARCHAR(10)
                                                CHECK (credit_rating IN ('AAA','AA','A','BBB','BB','B','Unrated')),
  ADD COLUMN IF NOT EXISTS preferred_language   VARCHAR(5)   DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_comm_channel VARCHAR(20)
                                                CHECK (preferred_comm_channel IN ('Email','Phone','WhatsApp','Post')),
  ADD COLUMN IF NOT EXISTS relationship_manager_user_id UUID,
  ADD COLUMN IF NOT EXISTS industry_sector      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS risk_profile         VARCHAR(10)
                                                CHECK (risk_profile IN ('Low','Medium','High')),
  ADD COLUMN IF NOT EXISTS date_of_birth        DATE,
  ADD COLUMN IF NOT EXISTS incorporation_date   DATE,
  ADD COLUMN IF NOT EXISTS gender               VARCHAR(15)
                                                CHECK (gender IN ('Male','Female','NotSpecified')),
  ADD COLUMN IF NOT EXISTS annual_revenue_band  VARCHAR(20)
                                                CHECK (annual_revenue_band IN ('<1M','1M-10M','10M-100M','>100M'));

COMMIT;

-- ROLLBACK script:
-- ALTER TABLE customers DROP COLUMN IF EXISTS kyc_status, DROP COLUMN IF EXISTS kyc_verified_at, DROP COLUMN IF EXISTS credit_rating, DROP COLUMN IF EXISTS preferred_language, DROP COLUMN IF EXISTS preferred_comm_channel, DROP COLUMN IF EXISTS relationship_manager_user_id, DROP COLUMN IF EXISTS industry_sector, DROP COLUMN IF EXISTS risk_profile, DROP COLUMN IF EXISTS date_of_birth, DROP COLUMN IF EXISTS incorporation_date, DROP COLUMN IF EXISTS gender, DROP COLUMN IF EXISTS annual_revenue_band;

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

-- Phase 3 Migration: Wage Approval States
-- file: p3_04_wage_approval.sql
-- Extends wage payment_status enum to support approval workflow.
-- Migrates existing 'Planned' → 'Draft' and 'Pending' → 'Draft'.

BEGIN;

-- Drop old constraint
ALTER TABLE wages
  DROP CONSTRAINT IF EXISTS wages_payment_status_check;

-- Add new constraint with 4-state approval flow
ALTER TABLE wages
  ADD CONSTRAINT wages_payment_status_check
  CHECK (payment_status IN ('Draft','Submitted','Approved','Paid','Pending','Cancelled'));

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

-- Migrate existing data: Planned → Draft, Pending → Draft
UPDATE wages SET payment_status = 'Draft' WHERE payment_status = 'Planned';
UPDATE wages SET payment_status = 'Draft' WHERE payment_status = 'Pending';

COMMIT;

-- ROLLBACK script:
-- UPDATE wages SET payment_status = 'Pending' WHERE payment_status = 'Draft';
-- ALTER TABLE wages DROP CONSTRAINT IF EXISTS wages_payment_status_check;
-- ALTER TABLE wages ADD CONSTRAINT wages_payment_status_check CHECK (payment_status IN ('Pending','Paid','Cancelled'));
-- ALTER TABLE wages DROP COLUMN IF EXISTS submitted_at, DROP COLUMN IF EXISTS submitted_by, DROP COLUMN IF EXISTS approved_at, DROP COLUMN IF EXISTS approved_by, DROP COLUMN IF EXISTS rejected_at, DROP COLUMN IF EXISTS rejected_by, DROP COLUMN IF EXISTS rejection_comment, DROP COLUMN IF EXISTS paid_at, DROP COLUMN IF EXISTS paid_by, DROP COLUMN IF EXISTS payment_method, DROP COLUMN IF EXISTS payment_ref;

-- Phase 3 Migration: Invoice Review Step
-- file: p3_05_invoice_review.sql
-- Adds Review and Approved states to invoice status CHECK.
-- Adds review workflow columns (submit/approve/decide).

BEGIN;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('Draft','Review','Approved','Finalized','Sent','Paid','Void'));

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS review_submitted_by  UUID,
  ADD COLUMN IF NOT EXISTS review_submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_approved_by   UUID,
  ADD COLUMN IF NOT EXISTS review_decided_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_comment       TEXT;

COMMIT;

-- ROLLBACK script:
-- ALTER TABLE invoices DROP COLUMN IF EXISTS review_submitted_by, DROP COLUMN IF EXISTS review_submitted_at, DROP COLUMN IF EXISTS review_approved_by, DROP COLUMN IF EXISTS review_decided_at, DROP COLUMN IF EXISTS review_comment;
-- ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
-- ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('Draft','Finalized','Sent','Paid','Void'));

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

-- Phase 3 Migration: Document Folder Hierarchy (Fix + Extend)
-- file: p3_07_folders_fix.sql
-- Drops broken folders table and recreates with correct schema.
-- Adds folder_id and expires_at to documents.
-- Adds origin-trace columns to documents.

BEGIN;

-- Drop broken folders table
DROP TABLE IF EXISTS folders CASCADE;

-- Recreate with correct schema
CREATE TABLE folders (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type       VARCHAR(20)  NOT NULL CHECK (scope_type IN ('case','customer','tenant')),
  scope_id         UUID         NOT NULL,
  parent_folder_id UUID         REFERENCES folders(id) ON DELETE CASCADE,
  name             VARCHAR(300) NOT NULL,
  is_deleted       BOOLEAN      DEFAULT FALSE,
  created_by       UUID         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (scope_type, scope_id, parent_folder_id, name)
);

CREATE INDEX IF NOT EXISTS idx_folders_scope ON folders (scope_type, scope_id);

-- Add folder_id and expires_at to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add origin-trace columns for rich upload
ALTER TABLE documents ADD COLUMN IF NOT EXISTS origin_module      VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS origin_entity_type VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS origin_entity_id   UUID;

-- Index for origin lookups
CREATE INDEX IF NOT EXISTS idx_documents_origin ON documents (origin_entity_type, origin_entity_id);

COMMIT;

-- ROLLBACK script:
-- ALTER TABLE documents DROP COLUMN IF EXISTS folder_id, DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS origin_module, DROP COLUMN IF EXISTS origin_entity_type, DROP COLUMN IF EXISTS origin_entity_id;
-- DROP INDEX IF EXISTS idx_documents_origin;
-- DROP TABLE IF EXISTS folders CASCADE;

-- Phase 3 Migration: Document OCR Text
-- file: p3_08_document_ocr.sql
-- Creates document_ocr_text table with full-text search support.

BEGIN;

CREATE TABLE IF NOT EXISTS document_ocr_text (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID         NOT NULL REFERENCES documents(id),
  version_id    UUID         NOT NULL,
  raw_text      TEXT,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(raw_text,''))
  ) STORED,
  ocr_status    VARCHAR(20)  NOT NULL DEFAULT 'Pending'
                             CHECK (ocr_status IN ('Pending','Processing','Done','Failed')),
  error_message TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, version_id)
);

CREATE INDEX IF NOT EXISTS idx_ocr_search ON document_ocr_text USING gin(search_vector);

COMMIT;

-- ROLLBACK script:
-- DROP TABLE IF EXISTS document_ocr_text;

-- Phase 3 Migration: External Share Links
-- file: p3_09_external_shares.sql
-- Creates external_share_links and external_share_accesses tables.

BEGIN;

CREATE TABLE IF NOT EXISTS external_share_links (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID         NOT NULL REFERENCES documents(id),
  token           VARCHAR(128) NOT NULL UNIQUE,
  created_by      UUID         NOT NULL REFERENCES users(id),
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

