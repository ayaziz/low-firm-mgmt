-- Tenant Schema Template Migration
-- This SQL is executed per tenant schema to create business tables
-- Usage: SET search_path TO tenant_{slug}; then run this file

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('Individual', 'Organization')),
  name VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Prospect')),
  national_id VARCHAR(100),
  passport_number VARCHAR(100),
  registration_id VARCHAR(100),
  tax_id VARCHAR(100),
  notes TEXT,
  completeness_pct DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_national_id ON customers (national_id) WHERE national_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_passport ON customers (passport_number) WHERE passport_number IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_reg_id ON customers (registration_id) WHERE registration_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tax_id ON customers (tax_id) WHERE tax_id IS NOT NULL AND deleted_at IS NULL;

-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  address_type VARCHAR(20) NOT NULL DEFAULT 'Office' CHECK (address_type IN ('Billing', 'Office', 'Home', 'Other')),
  is_primary BOOLEAN DEFAULT FALSE,
  line1 VARCHAR(500),
  line2 VARCHAR(500),
  city VARCHAR(200),
  state VARCHAR(200),
  postal_code VARCHAR(50),
  country VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  name VARCHAR(500) NOT NULL,
  email VARCHAR(300),
  phone VARCHAR(100),
  role_id UUID,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parties (reusable for opposing/external)
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('Individual', 'Organization')),
  name VARCHAR(500) NOT NULL,
  national_id VARCHAR(100),
  passport_number VARCHAR(100),
  registration_id VARCHAR(100),
  tax_id VARCHAR(100),
  email VARCHAR(300),
  phone VARCHAR(100),
  address_text TEXT,
  notes TEXT,
  customer_id UUID REFERENCES customers(id), -- link if party is also a customer
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Party Relationships
CREATE TABLE IF NOT EXISTS party_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_party_id UUID NOT NULL REFERENCES parties(id),
  to_party_id UUID NOT NULL REFERENCES parties(id),
  relationship_type_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master Data: Configurable Types/Roles
CREATE TABLE IF NOT EXISTS master_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL, -- contactRole, participantRole, relationshipType, communicationType, filingType, sessionType, expenseCategory, paymentMethod, docType
  code VARCHAR(100) NOT NULL,
  label_en VARCHAR(300) NOT NULL,
  label_ar VARCHAR(300),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  config JSONB DEFAULT '{}', -- extra config per category
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category, code)
);

-- Case Types
CREATE TABLE IF NOT EXISTS case_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  label_en VARCHAR(300) NOT NULL,
  label_ar VARCHAR(300),
  is_active BOOLEAN DEFAULT TRUE,
  required_docs_template JSONB DEFAULT '[]',
  default_task_template JSONB DEFAULT '[]',
  session_placeholders JSONB DEFAULT '[]',
  participant_placeholders JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compliance Checklist Templates
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]', -- [{label_en, label_ar, required}]
  scope VARCHAR(20) NOT NULL DEFAULT 'customer', -- customer | case
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer Checklist Instances
CREATE TABLE IF NOT EXISTS customer_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  template_id UUID NOT NULL REFERENCES checklist_templates(id),
  items JSONB NOT NULL DEFAULT '[]', -- [{label, status: Pending/Complete/NA, dueDate, completedAt}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Required Document Templates
CREATE TABLE IF NOT EXISTS doc_requirement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'customer', -- customer | case
  items JSONB NOT NULL DEFAULT '[]', -- [{docTypeCode, label_en, label_ar, required}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer Doc Requirement Instances
CREATE TABLE IF NOT EXISTS customer_doc_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  doc_type_code VARCHAR(100) NOT NULL,
  label VARCHAR(300) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Missing' CHECK (status IN ('Missing', 'Provided', 'Expired', 'Rejected')),
  document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cases
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_case_ref VARCHAR(50) NOT NULL UNIQUE,
  court_case_number VARCHAR(200),
  case_type_id UUID NOT NULL REFERENCES case_types(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  state VARCHAR(20) NOT NULL DEFAULT 'Intake' CHECK (state IN ('Intake', 'Open', 'Active', 'Pending', 'Closed', 'Archived')),
  on_hold BOOLEAN DEFAULT FALSE,
  on_hold_reason TEXT,
  on_hold_start TIMESTAMPTZ,
  on_hold_end TIMESTAMPTZ,
  assigned_lawyer_user_id UUID,
  completeness_pct DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

-- Case Sequence Counter
CREATE TABLE IF NOT EXISTS case_sequences (
  year INT PRIMARY KEY,
  last_value INT NOT NULL DEFAULT 0
);

-- Invoice Sequence Counter
CREATE TABLE IF NOT EXISTS invoice_sequences (
  year INT PRIMARY KEY,
  last_value INT NOT NULL DEFAULT 0
);

-- Case ↔ Customer join
CREATE TABLE IF NOT EXISTS case_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  role VARCHAR(50) DEFAULT 'Client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(case_id, customer_id)
);

-- Case Memberships (user access)
CREATE TABLE IF NOT EXISTS case_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  user_id UUID NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'CaseMember' CHECK (role IN ('CaseOwner', 'CaseMember', 'ReadOnly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(case_id, user_id)
);

-- Case Parties (opponents, external)
CREATE TABLE IF NOT EXISTS case_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  party_role_type VARCHAR(50) NOT NULL DEFAULT 'Opposing' CHECK (party_role_type IN ('Customer', 'Opposing', 'ExternalCounsel', 'Other')),
  participant_role_id UUID,
  visibility_scope VARCHAR(30) DEFAULT 'LegalOnly' CHECK (visibility_scope IN ('LegalOnly', 'FinanceAllowed')),
  notes TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Courts
CREATE TABLE IF NOT EXISTS courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  notes TEXT,
  address_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions (Hearings/Appointments)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  session_type_id UUID,
  title VARCHAR(500) NOT NULL,
  start_date_time TIMESTAMPTZ NOT NULL,
  end_date_time TIMESTAMPTZ,
  location TEXT,
  court_id UUID REFERENCES courts(id),
  status VARCHAR(30) NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned', 'Completed', 'Postponed', 'Cancelled')),
  outcome_notes TEXT,
  linked_document_ids UUID[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session Reschedule History
CREATE TABLE IF NOT EXISTS session_reschedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  original_date_time TIMESTAMPTZ NOT NULL,
  new_date_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  customer_id UUID REFERENCES customers(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  assignee_user_id UUID NOT NULL,
  reviewer_user_id UUID,
  priority VARCHAR(10) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'InProgress', 'Blocked', 'Done', 'Cancelled')),
  due_date DATE,
  start_date DATE,
  tags TEXT[] DEFAULT '{}',
  linked_document_ids UUID[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notes (append-only)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id),
  customer_id UUID REFERENCES customers(id),
  title VARCHAR(500),
  body TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  visibility_scope VARCHAR(30) DEFAULT 'LegalOnly',
  linked_document_ids UUID[] DEFAULT '{}',
  references_note_id UUID REFERENCES notes(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Filings
CREATE TABLE IF NOT EXISTS filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  filing_type_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Filed', 'Accepted', 'Rejected', 'Withdrawn')),
  filed_date DATE,
  court_case_number VARCHAR(200),
  reference_number VARCHAR(200),
  notes TEXT,
  linked_document_ids UUID[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Communications Log
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id),
  customer_id UUID REFERENCES customers(id),
  comm_type_id UUID NOT NULL,
  date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction VARCHAR(10) NOT NULL DEFAULT 'Outbound' CHECK (direction IN ('Inbound', 'Outbound')),
  participants TEXT,
  summary TEXT NOT NULL,
  next_steps TEXT,
  visibility_scope VARCHAR(30) DEFAULT 'LegalOnly',
  linked_document_ids UUID[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case Doc Requirement Instances
CREATE TABLE IF NOT EXISTS case_doc_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  doc_type_code VARCHAR(100) NOT NULL,
  label VARCHAR(300) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Missing' CHECK (status IN ('Missing', 'Provided', 'Expired', 'Rejected')),
  document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  case_id UUID REFERENCES cases(id),
  doc_type_id UUID,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  confidentiality VARCHAR(30) NOT NULL DEFAULT 'Normal' CHECK (confidentiality IN ('Normal', 'Confidential', 'HighlyConfidential')),
  current_version_id UUID,
  locked_by_user_id UUID,
  lock_expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document Versions
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  version_number INT NOT NULL DEFAULT 1,
  provider_object_key TEXT NOT NULL,
  content_type VARCHAR(200),
  size_bytes BIGINT,
  checksum_sha256 VARCHAR(128),
  scan_status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (scan_status IN ('Pending', 'Passed', 'Failed')),
  original_filename VARCHAR(500),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document ACL Entries
CREATE TABLE IF NOT EXISTS document_acl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  principal_type VARCHAR(10) NOT NULL CHECK (principal_type IN ('User', 'Role')),
  principal_id VARCHAR(100) NOT NULL,
  permission VARCHAR(30) NOT NULL CHECK (permission IN ('View', 'Download', 'UploadNewVersion', 'Share', 'Admin')),
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document Shares
CREATE TABLE IF NOT EXISTS document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  shared_with_user_id UUID NOT NULL,
  permission VARCHAR(30) NOT NULL DEFAULT 'View',
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legal Holds
CREATE TABLE IF NOT EXISTS legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  case_id UUID REFERENCES cases(id),
  reason TEXT NOT NULL,
  applied_by UUID NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_by UUID,
  released_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  case_id UUID REFERENCES cases(id),
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final', 'Sent', 'Paid', 'Voided')),
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_rate_pct DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate_pct DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  due_date DATE,
  void_reason TEXT,
  created_by UUID NOT NULL,
  finalized_by UUID,
  finalized_at TIMESTAMPTZ,
  voided_by UUID,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount DECIMAL(15,2) NOT NULL,
  method VARCHAR(30) NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash', 'BankTransfer', 'Cheque', 'Card', 'Other')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference VARCHAR(300),
  idempotency_key VARCHAR(200),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(idempotency_key)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id),
  customer_id UUID REFERENCES customers(id),
  category VARCHAR(30) NOT NULL DEFAULT 'Other' CHECK (category IN ('Travel', 'FilingFees', 'Courier', 'Office', 'Other')),
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  submitted_by_user_id UUID NOT NULL,
  beneficiary_user_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'PendingApproval', 'Approved', 'Rejected')),
  linked_document_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expense Approval Steps
CREATE TABLE IF NOT EXISTS expense_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id),
  step_order INT NOT NULL DEFAULT 1,
  approver_role VARCHAR(50) NOT NULL,
  approver_user_id UUID,
  decision VARCHAR(20) CHECK (decision IN ('Approved', 'Rejected')),
  comment TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expense Approval Workflow Config
CREATE TABLE IF NOT EXISTS expense_approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL DEFAULT 'Default',
  steps JSONB NOT NULL DEFAULT '[{"stepOrder":1,"approverRole":"Accountant"}]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wages
CREATE TABLE IF NOT EXISTS wages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_user_id UUID,
  staff_name VARCHAR(300),
  period VARCHAR(7) NOT NULL, -- YYYY-MM
  gross_amount DECIMAL(15,2) NOT NULL,
  deductions DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'Planned' CHECK (payment_status IN ('Planned', 'Paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  actor_user_id UUID,
  entity_type VARCHAR(50),
  entity_id UUID,
  payload JSONB DEFAULT '{}',
  correlation_id VARCHAR(100),
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events (created_at);

-- Notifications (in-app)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'info', -- task, session, approval, system
  entity_type VARCHAR(50),
  entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);

-- Retention Policies (seeded, view-only in MVP)
CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type_code VARCHAR(100) NOT NULL,
  retention_days INT NOT NULL DEFAULT 2555, -- ~7 years default
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
