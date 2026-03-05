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
