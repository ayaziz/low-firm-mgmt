-- Phase 2 Schema Migration — LOMA
-- Run per tenant schema after setting search_path
-- Adds: judges, hearings, calendar_events, calendar_reminders,
--        calendar_event_attendees, folders, document_templates,
--        time_entries, notification_subscriptions
-- Alters: courts, cases, documents, document_versions, sessions, tasks, notes

-- ─── Court Extensions ──────────────────────────────────────────

ALTER TABLE courts ADD COLUMN IF NOT EXISTS department VARCHAR(300);
ALTER TABLE courts ADD COLUMN IF NOT EXISTS circuit VARCHAR(300);
ALTER TABLE courts ADD COLUMN IF NOT EXISTS jurisdiction_level VARCHAR(30) DEFAULT 'District'
  CHECK (jurisdiction_level IN ('District', 'Appeal', 'Supreme', 'Specialized'));
ALTER TABLE courts ADD COLUMN IF NOT EXISTS city VARCHAR(200);
ALTER TABLE courts ADD COLUMN IF NOT EXISTS phone VARCHAR(100);
ALTER TABLE courts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ─── Judges ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID REFERENCES courts(id),
  full_name VARCHAR(500) NOT NULL,
  title VARCHAR(200),
  specialization VARCHAR(300),
  phone VARCHAR(100),
  email VARCHAR(300),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_judges_court ON judges (court_id);

-- ─── Case Extensions (Court/Judge FK) ──────────────────────────

ALTER TABLE cases ADD COLUMN IF NOT EXISTS primary_court_id UUID REFERENCES courts(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS primary_judge_id UUID REFERENCES judges(id);

-- ─── Hearings ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  court_id UUID REFERENCES courts(id),
  judge_id UUID REFERENCES judges(id),
  hearing_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  hearing_type VARCHAR(30) NOT NULL DEFAULT 'Initial'
    CHECK (hearing_type IN ('Initial', 'Continuation', 'Ruling', 'Appeal', 'Procedural')),
  status VARCHAR(20) NOT NULL DEFAULT 'Scheduled'
    CHECK (status IN ('Scheduled', 'Completed', 'Postponed', 'Cancelled')),
  outcome TEXT,
  notes TEXT,
  calendar_event_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hearings_case ON hearings (case_id);
CREATE INDEX IF NOT EXISTS idx_hearings_date ON hearings (hearing_date);
CREATE INDEX IF NOT EXISTS idx_hearings_status ON hearings (status);

-- ─── Calendar Events ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT FALSE,
  event_type VARCHAR(30) NOT NULL DEFAULT 'Other'
    CHECK (event_type IN ('Hearing', 'Meeting', 'Deadline', 'Task', 'Reminder', 'Other')),
  recurrence VARCHAR(20) DEFAULT 'None'
    CHECK (recurrence IN ('None', 'Daily', 'Weekly', 'Monthly', 'Yearly')),
  recurrence_end_date DATE,
  recurrence_rule TEXT,
  case_id UUID REFERENCES cases(id),
  hearing_id UUID REFERENCES hearings(id),
  session_id UUID REFERENCES sessions(id),
  task_id UUID REFERENCES tasks(id),
  location TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Scheduled'
    CHECK (status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events (start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_case ON calendar_events (case_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events (event_type);

-- ─── Calendar Event Attendees ──────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rsvp VARCHAR(20) NOT NULL DEFAULT 'Pending'
    CHECK (rsvp IN ('Pending', 'Accepted', 'Declined', 'Tentative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(calendar_event_id, user_id)
);

-- ─── Calendar Reminders ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  minutes_before INT NOT NULL DEFAULT 30,
  channel VARCHAR(10) NOT NULL DEFAULT 'InApp'
    CHECK (channel IN ('InApp', 'Email')),
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  trigger_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_trigger ON calendar_reminders (trigger_at) WHERE sent = FALSE;

-- ─── Folders ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_folder_id UUID REFERENCES folders(id),
  name VARCHAR(500) NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  scope VARCHAR(20) NOT NULL DEFAULT 'Case'
    CHECK (scope IN ('Customer', 'Case', 'Tenant')),
  scope_id UUID,
  confidentiality_default VARCHAR(30) NOT NULL DEFAULT 'Normal'
    CHECK (confidentiality_default IN ('Normal', 'Confidential', 'HighlyConfidential')),
  inherit_permissions BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders (parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_scope ON folders (scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders (path);

-- ─── Document Extensions (Folder + OCR) ───────────────────────

ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS full_text_content TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(20) DEFAULT 'Pending'
  CHECK (ocr_status IN ('Pending', 'Processing', 'Completed', 'Failed', 'Skipped'));

-- Full-text search index
ALTER TABLE documents ADD COLUMN IF NOT EXISTS full_text_tsvector tsvector;
CREATE INDEX IF NOT EXISTS idx_doc_fulltext ON documents USING GIN (full_text_tsvector);

-- ─── Document Version Extensions ───────────────────────────────

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(20) DEFAULT 's3';

-- ─── Session Extensions (calendar link) ────────────────────────

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS calendar_event_id UUID;

-- ─── Task Extensions (calendar + hours) ────────────────────────

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS calendar_event_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(6,2);

-- ─── Note Extensions (editable) ───────────────────────────────

ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]';

-- ─── Document Templates ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(30) NOT NULL DEFAULT 'Other'
    CHECK (category IN ('Contract', 'Letter', 'Petition', 'Motion', 'Filing', 'Other')),
  template_body TEXT NOT NULL,
  variable_schema JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Time Entries ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  task_id UUID REFERENCES tasks(id),
  hearing_id UUID REFERENCES hearings(id),
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  hours DECIMAL(6,2) NOT NULL,
  description TEXT,
  activity_type VARCHAR(100) NOT NULL DEFAULT 'General',
  billable BOOLEAN DEFAULT TRUE,
  rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Billed', 'WriteOff')),
  invoice_line_id UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_case ON time_entries (case_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries (status);

-- ─── Notification Subscriptions ────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  channel VARCHAR(10) NOT NULL DEFAULT 'InApp'
    CHECK (channel IN ('InApp', 'Email', 'Both')),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_type)
);

-- ─── Trigger: Update full_text_tsvector on document content change ──

CREATE OR REPLACE FUNCTION update_doc_tsvector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_text_tsvector := to_tsvector('simple', COALESCE(NEW.full_text_content, '') || ' ' || COALESCE(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doc_tsvector ON documents;
CREATE TRIGGER trg_doc_tsvector
  BEFORE INSERT OR UPDATE OF full_text_content, title ON documents
  FOR EACH ROW EXECUTE FUNCTION update_doc_tsvector();
