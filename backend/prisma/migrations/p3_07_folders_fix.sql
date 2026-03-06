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
