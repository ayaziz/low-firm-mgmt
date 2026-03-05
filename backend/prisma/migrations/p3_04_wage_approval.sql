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
  ADD COLUMN IF NOT EXISTS submitted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by   UUID,
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by    UUID,
  ADD COLUMN IF NOT EXISTS rejected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by    UUID,
  ADD COLUMN IF NOT EXISTS rejection_comment TEXT,
  ADD COLUMN IF NOT EXISTS paid_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by        UUID,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30),
  ADD COLUMN IF NOT EXISTS payment_ref    VARCHAR(300);

-- Migrate existing data: Planned → Draft, Pending → Draft
UPDATE wages SET payment_status = 'Draft' WHERE payment_status = 'Planned';
UPDATE wages SET payment_status = 'Draft' WHERE payment_status = 'Pending';

COMMIT;

-- ROLLBACK script:
-- UPDATE wages SET payment_status = 'Pending' WHERE payment_status = 'Draft';
-- ALTER TABLE wages DROP CONSTRAINT IF EXISTS wages_payment_status_check;
-- ALTER TABLE wages ADD CONSTRAINT wages_payment_status_check CHECK (payment_status IN ('Pending','Paid','Cancelled'));
-- ALTER TABLE wages DROP COLUMN IF EXISTS submitted_at, DROP COLUMN IF EXISTS submitted_by, DROP COLUMN IF EXISTS approved_at, DROP COLUMN IF EXISTS approved_by, DROP COLUMN IF EXISTS rejected_at, DROP COLUMN IF EXISTS rejected_by, DROP COLUMN IF EXISTS rejection_comment, DROP COLUMN IF EXISTS paid_at, DROP COLUMN IF EXISTS paid_by, DROP COLUMN IF EXISTS payment_method, DROP COLUMN IF EXISTS payment_ref;
