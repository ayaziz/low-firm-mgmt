import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

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
    { id: 'u-lawyer-1', email: 'lawyer@demo.com', displayName: 'Ahmed Lawyer', roles: ['Lawyer'], tenantId: tenant.id },
    { id: 'u-lawyer-2', email: 'lawyer2@demo.com', displayName: 'Sara Lawyer', roles: ['Lawyer'], tenantId: tenant.id },
    { id: 'u-accountant-1', email: 'accountant@demo.com', displayName: 'Omar Accountant', roles: ['Accountant'], tenantId: tenant.id },
    { id: 'u-admin-1', email: 'admin@demo.com', displayName: 'Fatima Admin', roles: ['TenantAdmin'], tenantId: tenant.id },
    { id: 'u-sysadmin-1', email: 'sysadmin@demo.com', displayName: 'System Admin', roles: ['SystemAdmin'], tenantId: tenant.id },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: u.tenantId, email: u.email } },
      update: { roles: u.roles },
      create: { ...u, passwordHash: 'dev' },
    });
  }

  // Create tenant schema and business tables
  const schemaName = `tenant_${tenant.slug.replace(/-/g, '_')}`;
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  
  const tenantSql = fs.readFileSync(path.join(__dirname, 'tenant-schema.sql'), 'utf-8');
  
  // Split by semicolons and execute each statement
  const statements = tenantSql.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
      await prisma.$executeRawUnsafe(stmt);
    } catch (e: any) {
      // Ignore if already exists
      if (!e.message?.includes('already exists')) {
        console.warn('Statement warning:', e.message?.substring(0, 100));
      }
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
    await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
    await prisma.$executeRawUnsafe(
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
    await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO case_types (id, code, label_en, label_ar) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT (code) DO UPDATE SET label_en = $2, label_ar = $3`,
      ct.code, ct.label_en, ct.label_ar
    );
  }

  // Seed checklist template
  await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
  await prisma.$executeRawUnsafe(
    `INSERT INTO checklist_templates (id, name, items, scope) VALUES (gen_random_uuid(), 'Default Customer Checklist', $1::jsonb, 'customer') ON CONFLICT DO NOTHING`,
    JSON.stringify([
      { label_en: 'ID Verified', label_ar: 'تم التحقق من الهوية', required: true },
      { label_en: 'KYC Complete', label_ar: 'اعرف عميلك مكتمل', required: true },
      { label_en: 'Engagement Letter Signed', label_ar: 'تم توقيع خطاب التعاقد', required: true },
    ])
  );

  // Seed doc requirement template
  await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
  await prisma.$executeRawUnsafe(
    `INSERT INTO doc_requirement_templates (id, name, items, scope) VALUES (gen_random_uuid(), 'Default Customer Documents', $1::jsonb, 'customer') ON CONFLICT DO NOTHING`,
    JSON.stringify([
      { docTypeCode: 'id_document', label_en: 'National ID / Passport', label_ar: 'هوية وطنية / جواز سفر', required: true },
      { docTypeCode: 'contract', label_en: 'Engagement Letter', label_ar: 'خطاب التعاقد', required: true },
    ])
  );

  // Seed expense approval workflow
  await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
  await prisma.$executeRawUnsafe(
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
    await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO retention_policies (id, doc_type_code, retention_days, description) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT DO NOTHING`,
      rp.doc_type_code, rp.retention_days, rp.description
    );
  }

  console.log('Seed completed successfully');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
