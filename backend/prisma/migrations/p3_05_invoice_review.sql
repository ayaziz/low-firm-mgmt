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
