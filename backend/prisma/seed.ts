import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const prisma = new PrismaClient();
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Seeding platform database...');

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-firm' },
    update: {},
    create: {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Demo Law Firm',
      slug: 'demo-firm',
      currency: 'USD',
      timezone: 'UTC',
      locale: 'en',
      planTier: 'Enterprise',
      lawyerCanDraft: true,
      storageMode: 'shared',
      storageProvider: 's3',
      storageBucket: 'loma-documents',
      storageEndpoint: 'http://minio:9000',
    },
  });

  // Create users
  const users = [
    { id: '0f2f4f6e-8e9d-4f1f-a4f7-6e4c5a7b8c91', email: 'lawyer@demo.com', displayName: 'Ahmed Lawyer', roles: ['Lawyer'], tenantId: tenant.id },
    { id: '2f6e1a9b-6c43-4b9a-a3ce-34f0cbe7d9ab', email: 'lawyer2@demo.com', displayName: 'Sara Lawyer', roles: ['Lawyer'], tenantId: tenant.id },
    { id: '8b77d2f4-3d09-4bc3-a0d8-6f8f3a0f2c66', email: 'accountant@demo.com', displayName: 'Omar Accountant', roles: ['Accountant'], tenantId: tenant.id },
    { id: 'ba0f2d55-2e84-48a8-b7d7-8ab94f6fe2c1', email: 'admin@demo.com', displayName: 'Fatima Admin', roles: ['TenantAdmin'], tenantId: tenant.id },
    { id: '31a9c68e-67d7-4c7b-9c17-8fd4dc41237d', email: 'sysadmin@demo.com', displayName: 'System Admin', roles: ['SystemAdmin'], tenantId: tenant.id },
  ];

  // Hash a default dev password for all seed users
  const devPasswordHash = await bcrypt.hash('Password1!', 12);

  for (const u of users) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: u.tenantId, email: u.email } },
      update: { id: u.id, roles: u.roles, passwordHash: devPasswordHash },
      create: { ...u, passwordHash: devPasswordHash },
    });
  }

  // Create tenant schema and business tables
  const schemaName = `tenant_${tenant.slug.replace(/-/g, '_')}`;
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  const execTenant = async (sql: string, ...params: any[]) => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schemaName}"`);
      await tx.$executeRawUnsafe(sql, ...params);
    });
  };

  const tenantSql = fs.readFileSync(path.join(__dirname, 'tenant-schema.sql'), 'utf-8');
  const phase2Sql = fs.readFileSync(path.join(__dirname, 'phase2-migration.sql'), 'utf-8');

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO "${schemaName}", public`);
    await client.query(tenantSql);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Apply Phase 2 migration
  const client2 = await pgPool.connect();
  try {
    await client2.query('BEGIN');
    await client2.query(`SET LOCAL search_path TO "${schemaName}", public`);
    await client2.query(phase2Sql);
    await client2.query('COMMIT');
    console.log('Phase 2 migration applied successfully');
  } catch (e) {
    await client2.query('ROLLBACK');
    throw e;
  } finally {
    client2.release();
  }

  // Apply Phase 3 migrations in order (skip p3_11 which is a seed/data file)
  const p3MigrationFiles = [
    'p3_01_customer_enrichment.sql',
    'p3_02_case_enrichment.sql',
    'p3_03_session_enrichment.sql',
    'p3_04_wage_approval.sql',
    'p3_05_invoice_review.sql',
    'p3_06_status_history.sql',
    'p3_07_folders_fix.sql',
    'p3_08_document_ocr.sql',
    'p3_09_external_shares.sql',
    'p3_10_session_postponement.sql',
    'p3_12_hearing_status_extended.sql',
    'p3_13_contacts_role_string.sql',
  ];

  for (const migFile of p3MigrationFiles) {
    const migSql = fs.readFileSync(path.join(__dirname, 'migrations', migFile), 'utf-8');
    const client3 = await pgPool.connect();
    try {
      await client3.query(`SET search_path TO "${schemaName}", public`);
      await client3.query(migSql);
      console.log(`Phase 3 migration applied: ${migFile}`);
    } catch (e: any) {
      // Ignore "already exists" errors to make this idempotent
      if (e.message && (e.message.includes('already exists') || e.message.includes('duplicate column'))) {
        console.log(`Phase 3 migration skipped (already applied): ${migFile}`);
      } else {
        console.error(`Failed to apply ${migFile}:`, e.message);
        throw e;
      }
    } finally {
      client3.release();
    }
  }

  // Seed master data
  const masterData = [
    // Contact roles
    { category: 'contactRole', code: 'primary', label_en: 'Primary Contact', label_ar: 'جهة الاتصال الرئيسية' },
    { category: 'contactRole', code: 'billing', label_en: 'Billing Contact', label_ar: 'جهة اتصال الفوترة' },
    { category: 'contactRole', code: 'legal', label_en: 'Legal Representative', label_ar: 'الممثل القانوني' },
    // Participant roles
    { category: 'participantRole', code: 'plaintiff', label_en: 'Plaintiff', label_ar: 'المدعي' },
    { category: 'participantRole', code: 'defendant', label_en: 'Defendant', label_ar: 'المدعى عليه' },
    { category: 'participantRole', code: 'witness', label_en: 'Witness', label_ar: 'شاهد' },
    { category: 'participantRole', code: 'expert', label_en: 'Expert Witness', label_ar: 'شاهد خبير' },
    // Relationship types
    { category: 'relationshipType', code: 'spouse', label_en: 'Spouse', label_ar: 'زوج/زوجة' },
    { category: 'relationshipType', code: 'parent', label_en: 'Parent', label_ar: 'والد/والدة' },
    { category: 'relationshipType', code: 'business_partner', label_en: 'Business Partner', label_ar: 'شريك تجاري' },
    // Communication types
    { category: 'communicationType', code: 'call', label_en: 'Phone Call', label_ar: 'مكالمة هاتفية' },
    { category: 'communicationType', code: 'email', label_en: 'Email', label_ar: 'بريد إلكتروني' },
    { category: 'communicationType', code: 'meeting', label_en: 'Meeting', label_ar: 'اجتماع' },
    { category: 'communicationType', code: 'message', label_en: 'Message', label_ar: 'رسالة' },
    // Filing types
    { category: 'filingType', code: 'complaint', label_en: 'Complaint', label_ar: 'شكوى' },
    { category: 'filingType', code: 'motion', label_en: 'Motion', label_ar: 'طلب' },
    { category: 'filingType', code: 'brief', label_en: 'Brief', label_ar: 'مذكرة' },
    { category: 'filingType', code: 'response', label_en: 'Response', label_ar: 'رد' },
    // Session types
    { category: 'sessionType', code: 'hearing', label_en: 'Hearing', label_ar: 'جلسة استماع' },
    { category: 'sessionType', code: 'session', label_en: 'Session', label_ar: 'جلسة' },
    { category: 'sessionType', code: 'meeting_session', label_en: 'Meeting', label_ar: 'اجتماع' },
    { category: 'sessionType', code: 'deadline', label_en: 'Deadline', label_ar: 'موعد نهائي' },
    // Expense categories
    { category: 'expenseCategory', code: 'travel', label_en: 'Travel', label_ar: 'سفر' },
    { category: 'expenseCategory', code: 'filing_fees', label_en: 'Filing Fees', label_ar: 'رسوم التسجيل' },
    { category: 'expenseCategory', code: 'courier', label_en: 'Courier', label_ar: 'بريد سريع' },
    { category: 'expenseCategory', code: 'office', label_en: 'Office', label_ar: 'مكتب' },
    // Payment methods
    { category: 'paymentMethod', code: 'cash', label_en: 'Cash', label_ar: 'نقدي' },
    { category: 'paymentMethod', code: 'bank_transfer', label_en: 'Bank Transfer', label_ar: 'تحويل بنكي' },
    { category: 'paymentMethod', code: 'cheque', label_en: 'Cheque', label_ar: 'شيك' },
    { category: 'paymentMethod', code: 'card', label_en: 'Card', label_ar: 'بطاقة' },
    // Doc types
    { category: 'docType', code: 'contract', label_en: 'Contract', label_ar: 'عقد', config: JSON.stringify({ allowedMimeTypes: ['application/pdf', 'application/msword'], defaultConfidentiality: 'Confidential', retentionDays: 2555 }) },
    { category: 'docType', code: 'pleading', label_en: 'Pleading', label_ar: 'مرافعة', config: JSON.stringify({ allowedMimeTypes: ['application/pdf'], defaultConfidentiality: 'Confidential', retentionDays: 2555 }) },
    { category: 'docType', code: 'evidence', label_en: 'Evidence', label_ar: 'دليل', config: JSON.stringify({ allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], defaultConfidentiality: 'HighlyConfidential', retentionDays: 3650 }) },
    { category: 'docType', code: 'correspondence', label_en: 'Correspondence', label_ar: 'مراسلات', config: JSON.stringify({ allowedMimeTypes: ['application/pdf', 'application/msword'], defaultConfidentiality: 'Normal', retentionDays: 1825 }) },
    { category: 'docType', code: 'receipt', label_en: 'Receipt', label_ar: 'إيصال', config: JSON.stringify({ allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], defaultConfidentiality: 'Normal', retentionDays: 2555 }) },
    { category: 'docType', code: 'id_document', label_en: 'ID Document', label_ar: 'وثيقة هوية', config: JSON.stringify({ allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], defaultConfidentiality: 'HighlyConfidential', retentionDays: 3650 }) },
  ];

  for (const md of masterData) {
    const configVal = (md as any).config || '{}';
    await execTenant(
      `INSERT INTO master_data (id, category, code, label_en, label_ar, config) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb) ON CONFLICT (category, code) DO UPDATE SET label_en = $3, label_ar = $4, config = $5::jsonb`,
      md.category, md.code, md.label_en, md.label_ar || '', configVal
    );
  }

  // Seed case types
  const caseTypes = [
    { code: 'civil', label_en: 'Civil Case', label_ar: 'قضية مدنية' },
    { code: 'criminal', label_en: 'Criminal Case', label_ar: 'قضية جنائية' },
    { code: 'family', label_en: 'Family Case', label_ar: 'قضية أسرية' },
    { code: 'commercial', label_en: 'Commercial Case', label_ar: 'قضية تجارية' },
    { code: 'labor', label_en: 'Labor Case', label_ar: 'قضية عمالية' },
  ];

  for (const ct of caseTypes) {
    await execTenant(
      `INSERT INTO case_types (id, code, label_en, label_ar) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT (code) DO UPDATE SET label_en = $2, label_ar = $3`,
      ct.code, ct.label_en, ct.label_ar
    );
  }

  // Seed checklist template
  await execTenant(
    `INSERT INTO checklist_templates (id, name, items, scope) VALUES (gen_random_uuid(), 'Default Customer Checklist', $1::jsonb, 'customer') ON CONFLICT DO NOTHING`,
    JSON.stringify([
      { label_en: 'ID Verified', label_ar: 'تم التحقق من الهوية', required: true },
      { label_en: 'KYC Complete', label_ar: 'اعرف عميلك مكتمل', required: true },
      { label_en: 'Engagement Letter Signed', label_ar: 'تم توقيع خطاب التعاقد', required: true },
    ])
  );

  // Seed doc requirement template
  await execTenant(
    `INSERT INTO doc_requirement_templates (id, name, items, scope) VALUES (gen_random_uuid(), 'Default Customer Documents', $1::jsonb, 'customer') ON CONFLICT DO NOTHING`,
    JSON.stringify([
      { docTypeCode: 'id_document', label_en: 'National ID / Passport', label_ar: 'هوية وطنية / جواز سفر', required: true },
      { docTypeCode: 'contract', label_en: 'Engagement Letter', label_ar: 'خطاب التعاقد', required: true },
    ])
  );

  // Seed expense approval workflow
  await execTenant(
    `INSERT INTO expense_approval_workflows (id, name, steps, is_active) VALUES (gen_random_uuid(), 'Default', $1::jsonb, true) ON CONFLICT DO NOTHING`,
    JSON.stringify([
      { stepOrder: 1, approverRole: 'Accountant' },
      { stepOrder: 2, approverRole: 'TenantAdmin' },
    ])
  );

  // Seed retention policies
  const retentionPolicies = [
    { doc_type_code: 'contract', retention_days: 2555, description: 'Contracts retained for 7 years' },
    { doc_type_code: 'pleading', retention_days: 2555, description: 'Pleadings retained for 7 years' },
    { doc_type_code: 'evidence', retention_days: 3650, description: 'Evidence retained for 10 years' },
    { doc_type_code: 'correspondence', retention_days: 1825, description: 'Correspondence retained for 5 years' },
    { doc_type_code: 'receipt', retention_days: 2555, description: 'Receipts retained for 7 years' },
    { doc_type_code: 'id_document', retention_days: 3650, description: 'ID Docs retained for 10 years' },
  ];

  for (const rp of retentionPolicies) {
    await execTenant(
      `INSERT INTO retention_policies (id, doc_type_code, retention_days, description) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT DO NOTHING`,
      rp.doc_type_code, rp.retention_days, rp.description
    );
  }

  // ─── Phase 2 Seed Data ─────────────────────────────────────────

  // Seed courts
  const courtIds = {
    civil: 'c1000000-0000-4000-a000-000000000001',
    criminal: 'c1000000-0000-4000-a000-000000000002',
    family: 'c1000000-0000-4000-a000-000000000003',
    appeal: 'c1000000-0000-4000-a000-000000000004',
  };

  const courts = [
    { id: courtIds.civil, name: 'Riyadh Civil Court - 1st Circuit', department: 'Civil Division', circuit: '1st', jurisdiction_level: 'District', city: 'Riyadh', phone: '+966-11-1234567', address_text: 'Riyadh, King Fahd Road' },
    { id: courtIds.criminal, name: 'Riyadh Criminal Court', department: 'Criminal Division', circuit: '1st', jurisdiction_level: 'District', city: 'Riyadh', phone: '+966-11-2345678', address_text: 'Riyadh, Olaya Street' },
    { id: courtIds.family, name: 'Jeddah Family Court', department: 'Family Division', circuit: '2nd', jurisdiction_level: 'District', city: 'Jeddah', phone: '+966-12-3456789', address_text: 'Jeddah, Al Madinah Road' },
    { id: courtIds.appeal, name: 'Riyadh Court of Appeal', department: 'Appeals Division', circuit: '1st', jurisdiction_level: 'Appeal', city: 'Riyadh', phone: '+966-11-4567890', address_text: 'Riyadh, Justice Palace' },
  ];

  for (const c of courts) {
    await execTenant(
      `INSERT INTO courts (id, name, department, circuit, jurisdiction_level, city, phone, address_text, is_active)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, true) ON CONFLICT (id) DO UPDATE SET name = $2, department = $3, circuit = $4, jurisdiction_level = $5, city = $6, phone = $7, address_text = $8`,
      c.id, c.name, c.department, c.circuit, c.jurisdiction_level, c.city, c.phone, c.address_text
    );
  }

  // Seed judges
  const judgeIds = {
    judge1: 'a1000000-0000-4000-b000-000000000001',
    judge2: 'a1000000-0000-4000-b000-000000000002',
    judge3: 'a1000000-0000-4000-b000-000000000003',
  };

  const judges = [
    { id: judgeIds.judge1, court_id: courtIds.civil, full_name: 'Judge Abdullah Al-Rashidi', title: 'Senior Judge', specialization: 'Civil Law', phone: '+966-50-1111111', email: 'judge.abdullah@court.sa' },
    { id: judgeIds.judge2, court_id: courtIds.criminal, full_name: 'Judge Nasser Al-Otaibi', title: 'Judge', specialization: 'Criminal Law', phone: '+966-50-2222222', email: 'judge.nasser@court.sa' },
    { id: judgeIds.judge3, court_id: courtIds.family, full_name: 'Judge Maha Al-Ghamdi', title: 'Judge', specialization: 'Family Law', phone: '+966-50-3333333', email: 'judge.maha@court.sa' },
  ];

  for (const j of judges) {
    await execTenant(
      `INSERT INTO judges (id, court_id, full_name, title, specialization, phone, email, is_active)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, true) ON CONFLICT (id) DO UPDATE SET court_id = $2::uuid, full_name = $3, title = $4, specialization = $5, phone = $6, email = $7`,
      j.id, j.court_id, j.full_name, j.title, j.specialization, j.phone, j.email
    );
  }

  // Seed document templates
  const templates = [
    {
      name: 'Client Engagement Letter',
      description: 'Standard engagement letter for new clients',
      category: 'Letter',
      template_body: `Dear {{clientName}},\n\nWe are pleased to confirm that {{firmName}} will represent you in the matter of {{caseName}}.\n\nOur agreed-upon fee structure is as follows:\n- Hourly Rate: {{hourlyRate}} {{currency}}/hr\n- Retainer: {{retainerAmount}} {{currency}}\n\nPlease sign below to confirm your agreement.\n\nSincerely,\n{{lawyerName}}\n{{firmName}}`,
      variable_schema: JSON.stringify({ clientName: 'string', firmName: 'string', caseName: 'string', hourlyRate: 'number', currency: 'string', retainerAmount: 'number', lawyerName: 'string' }),
    },
    {
      name: 'Motion to Dismiss',
      description: 'Standard motion to dismiss template',
      category: 'Motion',
      template_body: `IN THE {{courtName}}\n\nCase No. {{caseNumber}}\n\n{{plaintiffName}} v. {{defendantName}}\n\nMOTION TO DISMISS\n\nComes now the {{movingParty}}, by and through undersigned counsel, and hereby moves this Honorable Court to dismiss the above-captioned action for the following reasons:\n\n{{reasons}}\n\nWHEREFORE, the {{movingParty}} respectfully requests that this Court grant this Motion and dismiss the case.\n\nRespectfully submitted,\n{{lawyerName}}\nCounsel for {{movingParty}}`,
      variable_schema: JSON.stringify({ courtName: 'string', caseNumber: 'string', plaintiffName: 'string', defendantName: 'string', movingParty: 'string', reasons: 'string', lawyerName: 'string' }),
    },
    {
      name: 'Power of Attorney',
      description: 'General power of attorney template',
      category: 'Contract',
      template_body: `POWER OF ATTORNEY\n\nI, {{grantor}}, hereby appoint {{attorney}} as my true and lawful attorney-in-fact with full power to act on my behalf in all matters relating to {{caseDescription}}.\n\nThis power of attorney shall remain in effect until {{expiryDate}} unless revoked earlier in writing.\n\nDate: {{date}}\n\nSignature: ___________________\n{{grantor}}`,
      variable_schema: JSON.stringify({ grantor: 'string', attorney: 'string', caseDescription: 'string', expiryDate: 'string', date: 'string' }),
    },
  ];

  for (const t of templates) {
    await execTenant(
      `INSERT INTO document_templates (id, name, description, category, template_body, variable_schema, is_active, created_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, true, $6::uuid) ON CONFLICT DO NOTHING`,
      t.name, t.description, t.category, t.template_body, t.variable_schema, users[3].id // TenantAdmin
    );
  }

  // Seed notification subscriptions for demo users
  const eventTypes = ['HEARING_SCHEDULED', 'HEARING_POSTPONED', 'TASK_ASSIGNED', 'CASE_STATE_CHANGED', 'DOCUMENT_UPLOADED'];
  for (const u of users.slice(0, 4)) {
    for (const et of eventTypes) {
      await execTenant(
        `INSERT INTO notification_subscriptions (id, user_id, event_type, channel, enabled)
         VALUES (gen_random_uuid(), $1::uuid, $2, 'InApp', true) ON CONFLICT (user_id, event_type) DO NOTHING`,
        u.id, et
      );
    }
  }

  console.log('Phase 2 seed data completed');

  // ─── Enriched Seed Data (Customers, Cases, Tasks, etc.) ──────

  // --- Customers ---
  const customerIds = {
    individual: 'd1000000-0000-4000-a000-000000000001',
    org:        'd1000000-0000-4000-a000-000000000002',
    prospect:   'd1000000-0000-4000-a000-000000000003',
  };

  const customersData = [
    { id: customerIds.individual, customer_type: 'Individual', name: 'Khalid Al-Mansouri', status: 'Active', national_id: '1088765432' },
    { id: customerIds.org,        customer_type: 'Organization', name: 'Al-Noor Trading Co.', status: 'Active', registration_id: 'CR-12345678', tax_id: 'TAX-9876543' },
    { id: customerIds.prospect,   customer_type: 'Individual', name: 'Layla Hassan', status: 'Prospect', national_id: '1099876543' },
  ];

  for (const c of customersData) {
    await execTenant(
      `INSERT INTO customers (id, customer_type, name, status, national_id, registration_id, tax_id)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = $3, status = $4`,
      c.id, c.customer_type, c.name, c.status,
      (c as any).national_id || null, (c as any).registration_id || null, (c as any).tax_id || null
    );
  }

  // --- Contacts ---
  const contactsData = [
    { customer_id: customerIds.individual, name: 'Khalid Al-Mansouri', email: 'khalid@email.com', phone: '+966-55-1234567', is_primary: true },
    { customer_id: customerIds.org, name: 'Fahad Al-Noor', email: 'fahad@alnoor.com', phone: '+966-55-2345678', is_primary: true },
    { customer_id: customerIds.org, name: 'Nora Al-Noor', email: 'nora@alnoor.com', phone: '+966-55-3456789', is_primary: false },
    { customer_id: customerIds.prospect, name: 'Layla Hassan', email: 'layla@email.com', phone: '+966-55-4567890', is_primary: true },
  ];

  for (const ct of contactsData) {
    await execTenant(
      `INSERT INTO contacts (id, customer_id, name, email, phone, is_primary)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      ct.customer_id, ct.name, ct.email, ct.phone, ct.is_primary
    );
  }

  // --- Addresses ---
  const addressesData = [
    { customer_id: customerIds.individual, address_type: 'Home', is_primary: true, line1: '123 King Fahd Road', city: 'Riyadh', state: 'Riyadh', postal_code: '11564', country: 'Saudi Arabia' },
    { customer_id: customerIds.org, address_type: 'Office', is_primary: true, line1: '456 Olaya Street, Suite 200', city: 'Riyadh', state: 'Riyadh', postal_code: '11432', country: 'Saudi Arabia' },
    { customer_id: customerIds.org, address_type: 'Billing', is_primary: false, line1: 'PO Box 54321', city: 'Riyadh', state: 'Riyadh', postal_code: '11432', country: 'Saudi Arabia' },
    { customer_id: customerIds.prospect, address_type: 'Home', is_primary: true, line1: '789 Al Madinah Road', city: 'Jeddah', state: 'Makkah', postal_code: '21589', country: 'Saudi Arabia' },
  ];

  for (const a of addressesData) {
    await execTenant(
      `INSERT INTO addresses (id, customer_id, address_type, is_primary, line1, city, state, postal_code, country)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      a.customer_id, a.address_type, a.is_primary, a.line1, a.city, a.state, a.postal_code, a.country
    );
  }

  // --- Cases ---
  const caseIds = {
    civil1:   'd2000000-0000-4000-a000-000000000001',
    criminal1:'d2000000-0000-4000-a000-000000000002',
    family1:  'd2000000-0000-4000-a000-000000000003',
    labor1:   'd2000000-0000-4000-a000-000000000004',
  };

  // Insert case sequence counter so system_case_ref generation works
  await execTenant(
    `INSERT INTO case_sequences (year, last_seq) VALUES ($1, 4) ON CONFLICT (year) DO UPDATE SET last_seq = GREATEST(case_sequences.last_seq, 4)`,
    new Date().getFullYear()
  );

  const casesData = [
    { id: caseIds.civil1,    ref: `CASE-${new Date().getFullYear()}-0001`, court_case_number: 'CC-2024-1001', case_type_code: 'civil',    title: 'Al-Mansouri Property Dispute',       state: 'Active',  lawyer_id: users[0].id, court_id: courtIds.civil,   judge_id: judgeIds.judge1 },
    { id: caseIds.criminal1, ref: `CASE-${new Date().getFullYear()}-0002`, court_case_number: 'CR-2024-2001', case_type_code: 'criminal', title: 'Commercial Fraud Investigation',    state: 'Open',    lawyer_id: users[0].id, court_id: courtIds.criminal,judge_id: judgeIds.judge2 },
    { id: caseIds.family1,   ref: `CASE-${new Date().getFullYear()}-0003`, court_case_number: 'FM-2024-3001', case_type_code: 'family',   title: 'Hassan Custody Arrangement',        state: 'Pending', lawyer_id: users[1].id, court_id: courtIds.family,  judge_id: judgeIds.judge3 },
    { id: caseIds.labor1,    ref: `CASE-${new Date().getFullYear()}-0004`, court_case_number: null,           case_type_code: 'labor',    title: 'Al-Noor Employee Dispute',          state: 'Intake',  lawyer_id: users[1].id, court_id: null,             judge_id: null },
  ];

  for (const cs of casesData) {
    await execTenant(
      `INSERT INTO cases (id, system_case_ref, court_case_number, case_type_id, title, state, assigned_lawyer_user_id, primary_court_id, primary_judge_id)
       VALUES ($1::uuid, $2, $3,
         (SELECT id FROM case_types WHERE code = $4),
         $5, $6, $7::uuid, $8::uuid, $9::uuid)
       ON CONFLICT (id) DO UPDATE SET title = $5, state = $6`,
      cs.id, cs.ref, cs.court_case_number, cs.case_type_code,
      cs.title, cs.state, cs.lawyer_id, cs.court_id, cs.judge_id
    );
  }

  // --- Case-Customer links ---
  const caseCustomerLinks = [
    { case_id: caseIds.civil1,    customer_id: customerIds.individual, role: 'Client' },
    { case_id: caseIds.criminal1, customer_id: customerIds.org,        role: 'Client' },
    { case_id: caseIds.family1,   customer_id: customerIds.prospect,   role: 'Client' },
    { case_id: caseIds.labor1,    customer_id: customerIds.org,        role: 'Client' },
  ];

  for (const link of caseCustomerLinks) {
    await execTenant(
      `INSERT INTO case_customers (id, case_id, customer_id, role)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3)
       ON CONFLICT (case_id, customer_id) DO NOTHING`,
      link.case_id, link.customer_id, link.role
    );
  }

  // --- Case Memberships ---
  const caseMemberships = [
    { case_id: caseIds.civil1,    user_id: users[0].id, role: 'CaseOwner' },
    { case_id: caseIds.civil1,    user_id: users[1].id, role: 'CaseMember' },
    { case_id: caseIds.criminal1, user_id: users[0].id, role: 'CaseOwner' },
    { case_id: caseIds.family1,   user_id: users[1].id, role: 'CaseOwner' },
    { case_id: caseIds.labor1,    user_id: users[1].id, role: 'CaseOwner' },
  ];

  for (const cm of caseMemberships) {
    await execTenant(
      `INSERT INTO case_memberships (id, case_id, user_id, role)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3)
       ON CONFLICT (case_id, user_id) DO NOTHING`,
      cm.case_id, cm.user_id, cm.role
    );
  }

  // --- Tasks ---
  const tasksData = [
    { case_id: caseIds.civil1,    title: 'Draft property valuation request',    assignee: users[0].id, priority: 'High',   status: 'InProgress', due_days: 7 },
    { case_id: caseIds.civil1,    title: 'Prepare witness statement',           assignee: users[1].id, priority: 'Medium', status: 'Open',       due_days: 14 },
    { case_id: caseIds.criminal1, title: 'Review financial documents',          assignee: users[0].id, priority: 'High',   status: 'Open',       due_days: 5 },
    { case_id: caseIds.criminal1, title: 'File motion to compel discovery',     assignee: users[0].id, priority: 'High',   status: 'Done',       due_days: -3 },
    { case_id: caseIds.family1,   title: 'Prepare custody evaluation report',   assignee: users[1].id, priority: 'High',   status: 'InProgress', due_days: 10 },
    { case_id: caseIds.labor1,    title: 'Collect employment contracts',        assignee: users[1].id, priority: 'Medium', status: 'Open',       due_days: 21 },
  ];

  for (const t of tasksData) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + t.due_days);
    await execTenant(
      `INSERT INTO tasks (id, case_id, title, assignee_user_id, priority, status, due_date, created_by)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3::uuid, $4, $5, $6::date, $7::uuid)
       ON CONFLICT DO NOTHING`,
      t.case_id, t.title, t.assignee, t.priority, t.status,
      dueDate.toISOString().split('T')[0], users[3].id
    );
  }

  // --- Sessions ---
  const sessionsData = [
    { case_id: caseIds.civil1,    title: 'Initial Case Review',      court_id: courtIds.civil,   status: 'Completed', days_offset: -14, type_code: 'hearing' },
    { case_id: caseIds.civil1,    title: 'Evidence Submission',      court_id: courtIds.civil,   status: 'Planned',   days_offset: 7,   type_code: 'session' },
    { case_id: caseIds.criminal1, title: 'Preliminary Hearing',      court_id: courtIds.criminal,status: 'Planned',   days_offset: 10,  type_code: 'hearing' },
    { case_id: caseIds.family1,   title: 'Mediation Session',        court_id: courtIds.family,  status: 'Planned',   days_offset: 5,   type_code: 'meeting_session' },
  ];

  for (const s of sessionsData) {
    const dt = new Date();
    dt.setDate(dt.getDate() + s.days_offset);
    dt.setHours(10, 0, 0, 0);
    const endDt = new Date(dt);
    endDt.setHours(11, 30, 0, 0);
    await execTenant(
      `INSERT INTO sessions (id, case_id, type_id, title, start_date_time, end_date_time, court_id, status, created_by)
       VALUES (gen_random_uuid(), $1::uuid,
         (SELECT id FROM master_data WHERE category = 'sessionType' AND code = $2),
         $3, $4::timestamptz, $5::timestamptz, $6::uuid, $7, $8::uuid)
       ON CONFLICT DO NOTHING`,
      s.case_id, s.type_code, s.title, dt.toISOString(), endDt.toISOString(),
      s.court_id, s.status, users[0].id
    );
  }

  // --- Filings ---
  const filingsData = [
    { case_id: caseIds.civil1,    type_code: 'complaint', status: 'Filed',    filed_days_ago: 30, notes: 'Initial complaint filed' },
    { case_id: caseIds.civil1,    type_code: 'motion',    status: 'Draft',    filed_days_ago: null, notes: 'Motion for summary judgment - drafting' },
    { case_id: caseIds.criminal1, type_code: 'response',  status: 'Filed',    filed_days_ago: 10, notes: 'Defense response submitted' },
    { case_id: caseIds.family1,   type_code: 'brief',     status: 'Accepted', filed_days_ago: 20, notes: 'Custody brief accepted by court' },
  ];

  for (const f of filingsData) {
    const filedDate = f.filed_days_ago != null ? new Date(Date.now() - f.filed_days_ago * 86400000).toISOString().split('T')[0] : null;
    await execTenant(
      `INSERT INTO filings (id, case_id, type_id, status, filed_date, notes, created_by)
       VALUES (gen_random_uuid(), $1::uuid,
         (SELECT id FROM master_data WHERE category = 'filingType' AND code = $2),
         $3, $4::date, $5, $6::uuid)
       ON CONFLICT DO NOTHING`,
      f.case_id, f.type_code, f.status, filedDate, f.notes, users[0].id
    );
  }

  // --- Hearings ---
  const hearingsData = [
    { case_id: caseIds.civil1,    court_id: courtIds.civil,    judge_id: judgeIds.judge1, hearing_type: 'Initial',      status: 'Completed',  days_offset: -21 },
    { case_id: caseIds.civil1,    court_id: courtIds.civil,    judge_id: judgeIds.judge1, hearing_type: 'Continuation', status: 'Scheduled',  days_offset: 14 },
    { case_id: caseIds.criminal1, court_id: courtIds.criminal, judge_id: judgeIds.judge2, hearing_type: 'Initial',      status: 'Scheduled',  days_offset: 12 },
    { case_id: caseIds.family1,   court_id: courtIds.family,   judge_id: judgeIds.judge3, hearing_type: 'Procedural',   status: 'Scheduled',  days_offset: 8 },
  ];

  for (const h of hearingsData) {
    const dt = new Date();
    dt.setDate(dt.getDate() + h.days_offset);
    dt.setHours(9, 0, 0, 0);
    await execTenant(
      `INSERT INTO hearings (id, case_id, court_id, judge_id, hearing_date, hearing_type, status, created_by)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::timestamptz, $5, $6, $7::uuid)
       ON CONFLICT DO NOTHING`,
      h.case_id, h.court_id, h.judge_id, dt.toISOString(),
      h.hearing_type, h.status, users[0].id
    );
  }

  // --- Calendar Events ---
  const calendarEventsData = [
    { title: 'Property Dispute - Continuation Hearing', event_type: 'Hearing',  case_id: caseIds.civil1,    days_offset: 14, status: 'Scheduled', created_by: users[0].id },
    { title: 'Team Case Review Meeting',               event_type: 'Meeting',  case_id: null,              days_offset: 3,  status: 'Confirmed', created_by: users[3].id },
    { title: 'Filing Deadline - Criminal Response',     event_type: 'Deadline', case_id: caseIds.criminal1, days_offset: 5,  status: 'Scheduled', created_by: users[0].id },
    { title: 'Client Consultation - Layla Hassan',      event_type: 'Meeting',  case_id: caseIds.family1,   days_offset: 2,  status: 'Confirmed', created_by: users[1].id },
    { title: 'Monthly Staff Meeting',                   event_type: 'Other',    case_id: null,              days_offset: 7,  status: 'Scheduled', created_by: users[3].id },
    { title: 'Evidence Review Reminder',                event_type: 'Reminder', case_id: caseIds.criminal1, days_offset: 4,  status: 'Scheduled', created_by: users[0].id },
  ];

  for (const ce of calendarEventsData) {
    const start = new Date();
    start.setDate(start.getDate() + ce.days_offset);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);
    await execTenant(
      `INSERT INTO calendar_events (id, title, start_at, end_at, event_type, case_id, status, created_by)
       VALUES (gen_random_uuid(), $1, $2::timestamptz, $3::timestamptz, $4, $5::uuid, $6, $7::uuid)
       ON CONFLICT DO NOTHING`,
      ce.title, start.toISOString(), end.toISOString(),
      ce.event_type, ce.case_id, ce.status, ce.created_by
    );
  }

  // --- Time Entries ---
  const timeEntriesData = [
    { case_id: caseIds.civil1,    user_id: users[0].id, days_ago: 1, hours: 2.5,  activity_type: 'Research',      billable: true,  rate: 500, status: 'Submitted' },
    { case_id: caseIds.civil1,    user_id: users[0].id, days_ago: 3, hours: 1.0,  activity_type: 'Correspondence',billable: true,  rate: 500, status: 'Draft' },
    { case_id: caseIds.civil1,    user_id: users[1].id, days_ago: 2, hours: 3.0,  activity_type: 'Drafting',      billable: true,  rate: 450, status: 'Approved' },
    { case_id: caseIds.criminal1, user_id: users[0].id, days_ago: 0, hours: 4.0,  activity_type: 'Court Appearance', billable: true, rate: 500, status: 'Draft' },
    { case_id: caseIds.criminal1, user_id: users[0].id, days_ago: 5, hours: 1.5,  activity_type: 'Review',        billable: true,  rate: 500, status: 'Approved' },
    { case_id: caseIds.family1,   user_id: users[1].id, days_ago: 1, hours: 2.0,  activity_type: 'Consultation',  billable: true,  rate: 450, status: 'Draft' },
    { case_id: caseIds.family1,   user_id: users[1].id, days_ago: 4, hours: 0.5,  activity_type: 'General',       billable: false, rate: 0,   status: 'Submitted' },
    { case_id: caseIds.labor1,    user_id: users[1].id, days_ago: 2, hours: 1.0,  activity_type: 'Research',      billable: true,  rate: 450, status: 'Draft' },
  ];

  for (const te of timeEntriesData) {
    const entryDate = new Date();
    entryDate.setDate(entryDate.getDate() - te.days_ago);
    const totalAmount = te.hours * te.rate;
    await execTenant(
      `INSERT INTO time_entries (id, case_id, user_id, entry_date, hours, activity_type, billable, rate_per_hour, total_amount, status)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::date, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING`,
      te.case_id, te.user_id, entryDate.toISOString().split('T')[0],
      te.hours, te.activity_type, te.billable, te.rate, totalAmount, te.status
    );
  }

  // --- Expenses ---
  const expensesData = [
    { case_id: caseIds.civil1,    customer_id: customerIds.individual, amount: 1500, description: 'Court filing fees', expense_date_ago: 25, submitted_by: users[0].id, category_code: 'filing_fees', status: 'Approved' },
    { case_id: caseIds.civil1,    customer_id: customerIds.individual, amount: 350,  description: 'Courier service for documents', expense_date_ago: 10, submitted_by: users[0].id, category_code: 'courier', status: 'Pending' },
    { case_id: caseIds.criminal1, customer_id: customerIds.org,        amount: 2000, description: 'Expert witness consultation fee', expense_date_ago: 7, submitted_by: users[0].id, category_code: 'office', status: 'Submitted' },
  ];

  for (const exp of expensesData) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() - exp.expense_date_ago);
    await execTenant(
      `INSERT INTO expenses (id, case_id, customer_id, category_id, amount, description, expense_date, submitted_by, status)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid,
         (SELECT id FROM master_data WHERE category = 'expenseCategory' AND code = $3),
         $4, $5, $6::date, $7::uuid, $8)
       ON CONFLICT DO NOTHING`,
      exp.case_id, exp.customer_id, exp.category_code,
      exp.amount, exp.description, expDate.toISOString().split('T')[0],
      exp.submitted_by, exp.status
    );
  }

  // --- Invoices + Line Items ---
  const invoiceIds = {
    inv1: 'd3000000-0000-4000-a000-000000000001',
    inv2: 'd3000000-0000-4000-a000-000000000002',
    inv3: 'd3000000-0000-4000-a000-000000000003',
  };

  // Insert invoice sequence counter
  await execTenant(
    `INSERT INTO invoice_sequences (year, last_seq) VALUES ($1, 3) ON CONFLICT (year) DO UPDATE SET last_seq = GREATEST(invoice_sequences.last_seq, 3)`,
    new Date().getFullYear()
  );

  const invoicesData = [
    { id: invoiceIds.inv1, number: `INV-${new Date().getFullYear()}-0001`, customer_id: customerIds.individual, case_id: caseIds.civil1,    status: 'Finalized', subtotal: 3750, total: 3750, due_days: 30, created_by: users[2].id },
    { id: invoiceIds.inv2, number: `INV-${new Date().getFullYear()}-0002`, customer_id: customerIds.org,        case_id: caseIds.criminal1, status: 'Draft',     subtotal: 4500, total: 4500, due_days: 45, created_by: users[2].id },
    { id: invoiceIds.inv3, number: `INV-${new Date().getFullYear()}-0003`, customer_id: customerIds.individual, case_id: caseIds.family1,   status: 'Sent',      subtotal: 1350, total: 1350, due_days: 15, created_by: users[2].id },
  ];

  for (const inv of invoicesData) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + inv.due_days);
    await execTenant(
      `INSERT INTO invoices (id, invoice_number, customer_id, case_id, status, subtotal, total_amount, due_date, created_by)
       VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7, $8::date, $9::uuid)
       ON CONFLICT (id) DO UPDATE SET status = $5`,
      inv.id, inv.number, inv.customer_id, inv.case_id,
      inv.status, inv.subtotal, inv.total, dueDate.toISOString().split('T')[0], inv.created_by
    );
  }

  // Line items for invoices
  const lineItemsData = [
    // INV-1 (Finalized): legal services for property dispute
    { invoice_id: invoiceIds.inv1, description: 'Legal consultation (5 hrs @ 500 SAR)', quantity: 5, unit_price: 500, line_total: 2500, line_number: 1 },
    { invoice_id: invoiceIds.inv1, description: 'Document preparation',                  quantity: 1, unit_price: 750, line_total: 750,  line_number: 2 },
    { invoice_id: invoiceIds.inv1, description: 'Court filing fees',                      quantity: 1, unit_price: 500, line_total: 500,  line_number: 3 },
    // INV-2 (Draft): fraud investigation
    { invoice_id: invoiceIds.inv2, description: 'Case research & analysis (6 hrs @ 500 SAR)', quantity: 6, unit_price: 500, line_total: 3000, line_number: 1 },
    { invoice_id: invoiceIds.inv2, description: 'Expert witness coordination',                 quantity: 1, unit_price: 1500,line_total: 1500, line_number: 2 },
    // INV-3 (Sent): custody arrangement
    { invoice_id: invoiceIds.inv3, description: 'Custody consultation (3 hrs @ 450 SAR)', quantity: 3, unit_price: 450, line_total: 1350, line_number: 1 },
  ];

  for (const li of lineItemsData) {
    await execTenant(
      `INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price, line_total, line_number)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      li.invoice_id, li.description, li.quantity, li.unit_price, li.line_total, li.line_number
    );
  }

  // --- Payments ---
  const paymentsData = [
    { invoice_id: invoiceIds.inv1, amount: 2000, method: 'BankTransfer', days_ago: 5, reference: 'TRF-2024-001', created_by: users[2].id },
    { invoice_id: invoiceIds.inv3, amount: 1350, method: 'Cash',         days_ago: 1, reference: null,            created_by: users[2].id },
  ];

  for (const p of paymentsData) {
    const payDate = new Date();
    payDate.setDate(payDate.getDate() - p.days_ago);
    await execTenant(
      `INSERT INTO payments (id, invoice_id, amount, method, payment_date, reference, created_by)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4::timestamptz, $5, $6::uuid)
       ON CONFLICT DO NOTHING`,
      p.invoice_id, p.amount, p.method, payDate.toISOString(), p.reference, p.created_by
    );
  }

  // Update paid_amount on invoices that have payments
  await execTenant(
    `UPDATE invoices SET paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payments.invoice_id = invoices.id)
     WHERE id IN ($1::uuid, $2::uuid, $3::uuid)`,
    invoiceIds.inv1, invoiceIds.inv2, invoiceIds.inv3
  );

  // --- Wages ---
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const wagesData = [
    { user_id: users[0].id, staff_name: 'Ahmed Lawyer',     period: lastMonth,    amount: 15000, deductions: 1500, payment_status: 'Paid',    created_by: users[2].id },
    { user_id: users[1].id, staff_name: 'Sara Lawyer',      period: lastMonth,    amount: 14000, deductions: 1400, payment_status: 'Paid',    created_by: users[2].id },
    { user_id: users[2].id, staff_name: 'Omar Accountant',  period: lastMonth,    amount: 12000, deductions: 1200, payment_status: 'Paid',    created_by: users[3].id },
    { user_id: users[0].id, staff_name: 'Ahmed Lawyer',     period: currentMonth, amount: 15000, deductions: 1500, payment_status: 'Draft',   created_by: users[2].id },
    { user_id: users[1].id, staff_name: 'Sara Lawyer',      period: currentMonth, amount: 14000, deductions: 1400, payment_status: 'Draft',   created_by: users[2].id },
  ];

  for (const w of wagesData) {
    const grossAmount = w.amount;
    const netAmount = w.amount - w.deductions;
    await execTenant(
      `INSERT INTO wages (id, user_id, staff_name, period, amount, deductions, gross_amount, net_amount, payment_status, created_by)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid)
       ON CONFLICT DO NOTHING`,
      w.user_id, w.staff_name, w.period, w.amount, w.deductions,
      grossAmount, netAmount, w.payment_status, w.created_by
    );
  }

  console.log('Enriched seed data completed (customers, cases, tasks, sessions, filings, hearings, calendar, time entries, expenses, invoices, payments, wages)');
  console.log('Seed completed successfully');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pgPool.end();
    await prisma.$disconnect();
  });
