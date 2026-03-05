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
