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
