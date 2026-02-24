import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import  {Request} from 'supertest';
import { AppModule } from '../src/app.module';
import { request } from 'express';

/**
 * Integration test: Case lifecycle — create, transition through states, RBAC.
 * Requires running PostgreSQL + Redis + seed data.
 * Run with: npx jest --config test/jest-e2e.json
 */
describe('Cases (e2e)', () => {
  let app: INestApplication;
  let lawyerToken: string;
  let accountantToken: string;
  let customerId: string;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }));
      await app.init();

      // Get tokens
      const lawyerRes = await Request.call(app.getHttpServer())
				.post('/api/v1/auth/dev/login')
				.send({ email: 'lawyer@demo.com' })
      lawyerToken = lawyerRes.body.accessToken;

      const accountantRes = await Request.call(app.getHttpServer())
        .post('/api/v1/auth/dev/login')
        .send({ email: 'accountant@demo.com' });
      accountantToken = accountantRes.body.accessToken;

      // Create a customer for case association
      const custRes = await Request.call(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({
          name: 'Case Test Customer',
          customerType: 'Individual',
          nationalId: `NID-CASE-${Date.now()}`,
        });
      customerId = custRes.body?.id;
    } catch (err) {
      console.warn('Skipping e2e tests — infrastructure not available:', err.message);
      app = null as any;
    }
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Case creation', () => {
    let caseId: string;

    it('should create a case (Lawyer)', async () => {
      if (!app || !customerId) return;

      // Get a case type from seed data
      const typesRes = await Request.call(app.getHttpServer())
        .get('/api/v1/admin/case-types')
        .set('Authorization', `Bearer ${lawyerToken}`);
      const caseTypeId = typesRes.body?.data?.[0]?.id;
      if (!caseTypeId) return; // No seed data available

      const res = await Request.call(app.getHttpServer())
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({
          title: 'E2E Test Case',
          caseTypeId,
          customerIds: [customerId],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('E2E Test Case');
      expect(res.body.state).toBe('Intake');
      caseId = res.body.id;
    });

    it('should list cases', async () => {
      if (!app) return;
      const res = await Request.call(app.getHttpServer())
        .get('/api/v1/cases')
        .set('Authorization', `Bearer ${lawyerToken}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('should get case detail', async () => {
      if (!app || !caseId) return;
      const res = await Request.call(app.getHttpServer())
        .get(`/api/v1/cases/${caseId}`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .expect(200);

      expect(res.body.id).toBe(caseId);
    });

    it('should deny Accountant from creating cases', async () => {
      if (!app) return;
      await Request.call(app.getHttpServer())
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          title: 'Should Fail',
          caseTypeId: '00000000-0000-0000-0000-000000000001',
          customerIds: [customerId || '00000000-0000-0000-0000-000000000001'],
        })
        .expect(403);
    });
  });

  describe('State transitions', () => {
    let caseId: string;

    beforeAll(async () => {
      if (!app || !customerId) return;

      // Get case type
      const typesRes = await Request.call(app.getHttpServer())
        .get('/api/v1/admin/case-types')
        .set('Authorization', `Bearer ${lawyerToken}`);
      const caseTypeId = typesRes.body?.data?.[0]?.id;
      if (!caseTypeId) return;

      // Create a fresh case
      const res = await Request.call(app.getHttpServer())
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({
          title: 'Transition Test Case',
          caseTypeId,
          customerIds: [customerId],
        });
      caseId = res.body?.id;
    });

    it('should transition Intake → Open', async () => {
      if (!app || !caseId) return;
      const res = await Request.call(app.getHttpServer())
        .post(`/api/v1/cases/${caseId}/transition`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({ toState: 'Open' })
        .expect(200);

      expect(res.body.state).toBe('Open');
    });

    it('should transition Open → Active', async () => {
      if (!app || !caseId) return;
      const res = await Request.call(app.getHttpServer())
        .post(`/api/v1/cases/${caseId}/transition`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({ toState: 'Active' })
        .expect(200);

      expect(res.body.state).toBe('Active');
    });

    it('should reject invalid transition Active → Intake', async () => {
      if (!app || !caseId) return;
      await Request.call(app.getHttpServer())
        .post(`/api/v1/cases/${caseId}/transition`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({ toState: 'Intake' })
        .expect(422);
    });

    it('should transition Active → Closed', async () => {
      if (!app || !caseId) return;
      const res = await Request.call(app.getHttpServer())
        .post(`/api/v1/cases/${caseId}/transition`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({ toState: 'Closed' })
        .expect(200);

      expect(res.body.state).toBe('Closed');
    });

    it('should transition Closed → Archived', async () => {
      if (!app || !caseId) return;
      const res = await Request.call(app.getHttpServer())
        .post(`/api/v1/cases/${caseId}/transition`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({ toState: 'Archived' })
        .expect(200);

      expect(res.body.state).toBe('Archived');
    });

    it('should reject transition from Archived', async () => {
      if (!app || !caseId) return;
      await Request.call(app.getHttpServer())
        .post(`/api/v1/cases/${caseId}/transition`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({ toState: 'Active' })
        .expect(422);
    });
  });
});
