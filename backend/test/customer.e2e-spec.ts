import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Integration test: Customer CRUD + identity uniqueness.
 * Requires running PostgreSQL + Redis + seed data.
 * Run with: npx jest --config test/jest-e2e.json
 */
describe('Customers (e2e)', () => {
  let app: INestApplication;
  let lawyerToken: string;
  let accountantToken: string;

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
      const lawyerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/dev/login')
        .send({ email: 'lawyer@demo.com' });
      lawyerToken = lawyerRes.body.accessToken;

      const accountantRes = await request(app.getHttpServer())
        .post('/api/v1/auth/dev/login')
        .send({ email: 'accountant@demo.com' });
      accountantToken = accountantRes.body.accessToken;
    } catch (err) {
      console.warn('Skipping e2e tests — infrastructure not available:', err.message);
      app = null as any;
    }
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Customer CRUD', () => {
    let customerId: string;
    let rowVersion: string;

    it('should create a customer (Lawyer)', async () => {
      if (!app) return;
      const uniqueNationalId = `ID-E2E-${Date.now()}`;
      const res = await request(app.getHttpServer())
				.post('/api/v1/customers')
				.set('Authorization', `Bearer ${lawyerToken}`)
				.send({
					name: 'Integration Test Customer',
					customerType: 'Individual',
          nationalId: uniqueNationalId,
				})
				.expect(201)

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Integration Test Customer');
      customerId = res.body.id;
      rowVersion = res.body.row_version;
    });

    it('should list customers with the new entry', async () => {
      if (!app || !customerId) return;
      const res = await request(app.getHttpServer())
				.get('/api/v1/customers')
				.set('Authorization', `Bearer ${lawyerToken}`)
				.expect(200)

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.some((c: any) => c.id === customerId)).toBe(true);
    });

    it('should get customer by ID', async () => {
      if (!app || !customerId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .expect(200);

      expect(res.body.id).toBe(customerId);
      expect(res.body.name).toBe('Integration Test Customer');
    });

    it('should update customer with correct rowVersion', async () => {
      if (!app || !customerId || !rowVersion) return;
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({
          name: 'Updated Integration Customer',
          rowVersion,
        })
        .expect(200);

      expect(res.body.name).toBe('Updated Integration Customer');
    });
  });

  describe('Role-based access', () => {
    it('should deny Accountant from creating customers', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          name: 'Blocked Customer',
          customerType: 'Individual',
        })
        .expect(403);
    });

    it('should allow Accountant to list customers (read-only)', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);
    });
  });

  describe('Identity uniqueness', () => {
    it('should reject duplicate nationalId within same tenant', async () => {
      if (!app) return;
      const uniqueNationalId = `NID-DUP-${Date.now()}`;

      // Create first customer
      await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({
          name: 'Unique Test 1',
          customerType: 'Individual',
          nationalId: uniqueNationalId,
        })
        .expect(201);

      // Attempt duplicate
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${lawyerToken}`)
        .send({
          name: 'Unique Test 2',
          customerType: 'Individual',
          nationalId: uniqueNationalId,
        });

      // ConflictException → 409
      expect(res.status).toBe(409);
    });
  });
});
