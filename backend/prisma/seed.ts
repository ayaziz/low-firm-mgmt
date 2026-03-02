import { PrismaClient } from '@prisma/client';
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

  for (const u of users) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: u.tenantId, email: u.email } },
      update: { id: u.id, roles: u.roles },
      create: { ...u, passwordHash: 'dev' },
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
