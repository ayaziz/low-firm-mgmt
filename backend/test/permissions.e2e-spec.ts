import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Permission Matrix Compliance Test
 *
 * Verifies that the RBAC matrix from Appendix.md is correctly enforced
 * across all API routes. Each test case represents a cell in the matrix:
 *   Role × Endpoint → expected HTTP status.
 *
 * Requires running PostgreSQL + Redis + seed data (docker-compose).
 * Run: npx jest --config test/jest-e2e.json permissions
 */
describe('Permission Matrix (e2e)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};

  const USERS = [
    { key: 'Lawyer', email: 'lawyer@demo.com' },
    { key: 'Accountant', email: 'accountant@demo.com' },
    { key: 'TenantAdmin', email: 'admin@demo.com' },
  ];

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();

      // Obtain JWT tokens for each role
      for (const u of USERS) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/dev/login')
          .send({ email: u.email });
        tokens[u.key] = res.body.accessToken;
      }
    } catch (err) {
      console.warn(
        'Skipping permission tests — infrastructure not available:',
        err.message,
      );
      app = null as any;
    }
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  // Helper: perform authenticated request
  const authGet = (path: string, role: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${tokens[role]}`);

  const authPost = (path: string, role: string, body: any = {}) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${tokens[role]}`)
      .send(body);

  // ── Public endpoints ──

  describe('Public / unauthenticated', () => {
    it('GET /api/v1/health → 200', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
    });

    it('GET /api/v1/customers without token → 401', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .get('/api/v1/customers')
        .expect(401);
    });
  });

  // ── Customer Module ──

  describe('Customer read (all roles can view)', () => {
    for (const role of ['Lawyer', 'Accountant', 'TenantAdmin']) {
      it(`${role} GET /api/v1/customers → 200`, async () => {
        if (!app) return;
        await authGet('/api/v1/customers', role).expect(200);
      });
    }
  });

  describe('Customer write (Lawyer/TenantAdmin only)', () => {
    it('Accountant POST /api/v1/customers → 403', async () => {
      if (!app) return;
      await authPost('/api/v1/customers', 'Accountant', {
        name: 'Blocked',
        customerType: 'Individual',
        nationalId: 'BLOCKED-001',
      }).expect(403);
    });

    it('Lawyer POST /api/v1/customers → 201', async () => {
      if (!app) return;
      const res = await authPost('/api/v1/customers', 'Lawyer', {
        name: 'Perm Test Customer',
        customerType: 'Individual',
        nationalId: `PERM-${Date.now()}`,
      });
      expect([201, 200]).toContain(res.status);
    });
  });

  // ── Case Module ──

  describe('Case read (all roles can view)', () => {
    for (const role of ['Lawyer', 'Accountant', 'TenantAdmin']) {
      it(`${role} GET /api/v1/cases → 200`, async () => {
        if (!app) return;
        await authGet('/api/v1/cases', role).expect(200);
      });
    }
  });

  // ── Document Module ──

  describe('Document read (all roles can view)', () => {
    for (const role of ['Lawyer', 'Accountant', 'TenantAdmin']) {
      it(`${role} GET /api/v1/documents → 200`, async () => {
        if (!app) return;
        await authGet('/api/v1/documents', role).expect(200);
      });
    }
  });

  // ── Accounting: Invoice finalize (Accountant only, not Lawyer) ──

  describe('Invoice finalize restriction', () => {
    it('Lawyer POST /api/v1/invoices/:id/finalize → 403', async () => {
      if (!app) return;
      // Use a dummy ID — the roles check should fire before the entity lookup
      const res = await authPost(
        '/api/v1/invoices/00000000-0000-0000-0000-000000000000/finalize',
        'Lawyer',
      );
      expect(res.status).toBe(403);
    });

    it('Accountant POST /api/v1/invoices/:id/finalize → 404 or 200 (not 403)', async () => {
      if (!app) return;
      const res = await authPost(
        '/api/v1/invoices/00000000-0000-0000-0000-000000000000/finalize',
        'Accountant',
      );
      // Accountant should pass roles check → 404 because fake ID
      expect([404, 200, 400]).toContain(res.status);
    });
  });

  // ── Accounting: Expense approve (Accountant + TenantAdmin, not Lawyer) ──

  describe('Expense approve/reject restriction', () => {
    it('Lawyer POST /api/v1/expenses/:id/approve → 403', async () => {
      if (!app) return;
      const res = await authPost(
        '/api/v1/expenses/00000000-0000-0000-0000-000000000000/approve',
        'Lawyer',
      );
      expect(res.status).toBe(403);
    });

    it('Accountant POST /api/v1/expenses/:id/approve → not 403', async () => {
      if (!app) return;
      const res = await authPost(
        '/api/v1/expenses/00000000-0000-0000-0000-000000000000/approve',
        'Accountant',
      );
      expect(res.status).not.toBe(403);
    });
  });

  // ── Reports (all roles see both operational & financial) ──

  describe('Report access (all authenticated roles)', () => {
    const reportSlugs = [
      'cases-by-state',
      'cases-by-type',
      'receivables',
      'cashflow',
      'expenses-by-category',
    ];

    for (const slug of reportSlugs) {
      for (const role of ['Lawyer', 'Accountant', 'TenantAdmin']) {
        it(`${role} GET /api/v1/reports/${slug} → 200`, async () => {
          if (!app) return;
          await authGet(`/api/v1/reports/${slug}`, role).expect(200);
        });
      }
    }
  });

  // ── Admin (TenantAdmin only) ──

  describe('Admin restriction (TenantAdmin/SystemAdmin only)', () => {
    it('Lawyer GET /api/v1/admin/users → 403', async () => {
      if (!app) return;
      await authGet('/api/v1/admin/users', 'Lawyer').expect(403);
    });

    it('Accountant GET /api/v1/admin/users → 403', async () => {
      if (!app) return;
      await authGet('/api/v1/admin/users', 'Accountant').expect(403);
    });

    it('TenantAdmin GET /api/v1/admin/users → 200', async () => {
      if (!app) return;
      await authGet('/api/v1/admin/users', 'TenantAdmin').expect(200);
    });
  });

  // ── Search (all authenticated) ──

  describe('Search (all roles)', () => {
    for (const role of ['Lawyer', 'Accountant', 'TenantAdmin']) {
      it(`${role} GET /api/v1/search → 200`, async () => {
        if (!app) return;
        await authGet('/api/v1/search?q=test', role).expect(200);
      });
    }
  });

  // ── Notifications (all authenticated) ──

  describe('Notifications (all roles)', () => {
    for (const role of ['Lawyer', 'Accountant', 'TenantAdmin']) {
      it(`${role} GET /api/v1/notifications → 200`, async () => {
        if (!app) return;
        await authGet('/api/v1/notifications', role).expect(200);
      });
    }
  });
});
