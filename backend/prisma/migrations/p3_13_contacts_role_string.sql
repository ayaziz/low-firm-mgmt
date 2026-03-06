-- Phase 3 Migration: Contacts role_id type fix
-- file: p3_13_contacts_role_string.sql
-- Changes contacts.role_id from UUID to VARCHAR(100) so the frontend
-- can store role labels (Owner, Manager, etc.) instead of a UUID FK.

BEGIN;

ALTER TABLE contacts
  ALTER COLUMN role_id TYPE VARCHAR(100) USING role_id::text;

COMMIT;

-- ROLLBACK script (only if role_id values are valid UUIDs):
-- ALTER TABLE contacts ALTER COLUMN role_id TYPE UUID USING role_id::uuid;
