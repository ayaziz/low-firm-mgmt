-- Phase 3 Migration: Seed Status History
-- file: p3_11_seed_status_history.sql
-- Backfills 'Created' events for existing entities into status_history.

BEGIN;

-- Backfill customers
INSERT INTO status_history (entity_type, entity_id, from_status, to_status, actor_user_id, comment, created_at)
SELECT 'customer', id, NULL, 'Active', created_by, 'Backfill: initial creation', created_at
FROM customers
WHERE NOT EXISTS (
  SELECT 1 FROM status_history sh
  WHERE sh.entity_type = 'customer' AND sh.entity_id = customers.id AND sh.from_status IS NULL
);

-- Backfill cases
INSERT INTO status_history (entity_type, entity_id, from_status, to_status, actor_user_id, comment, created_at)
SELECT 'case', id, NULL, status, created_by, 'Backfill: initial creation', created_at
FROM cases
WHERE NOT EXISTS (
  SELECT 1 FROM status_history sh
  WHERE sh.entity_type = 'case' AND sh.entity_id = cases.id AND sh.from_status IS NULL
);

-- Backfill invoices
INSERT INTO status_history (entity_type, entity_id, from_status, to_status, actor_user_id, comment, created_at)
SELECT 'invoice', id, NULL, status, created_by, 'Backfill: initial creation', created_at
FROM invoices
WHERE NOT EXISTS (
  SELECT 1 FROM status_history sh
  WHERE sh.entity_type = 'invoice' AND sh.entity_id = invoices.id AND sh.from_status IS NULL
);

-- Backfill wages
INSERT INTO status_history (entity_type, entity_id, from_status, to_status, actor_user_id, comment, created_at)
SELECT 'wage', id, NULL, payment_status, created_by, 'Backfill: initial creation', created_at
FROM wages
WHERE NOT EXISTS (
  SELECT 1 FROM status_history sh
  WHERE sh.entity_type = 'wage' AND sh.entity_id = wages.id AND sh.from_status IS NULL
);

-- Backfill documents
INSERT INTO status_history (entity_type, entity_id, from_status, to_status, actor_user_id, comment, created_at)
SELECT 'document', id, NULL, 'Uploaded', uploaded_by, 'Backfill: initial upload', created_at
FROM documents
WHERE NOT EXISTS (
  SELECT 1 FROM status_history sh
  WHERE sh.entity_type = 'document' AND sh.entity_id = documents.id AND sh.from_status IS NULL
);

COMMIT;

-- ROLLBACK script:
-- DELETE FROM status_history WHERE comment LIKE 'Backfill:%';
