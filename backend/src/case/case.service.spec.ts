import { UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { CaseService } from './case.service';
import { VALID_STATE_TRANSITIONS, CaseState } from '../common/types';

describe('CaseService', () => {
  let service: CaseService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      queryTenant: jest.fn(),
      executeTenant: jest.fn(),
    };
    mockAudit = {
      log: jest.fn(),
    };
    mockNotifications = {
      send: jest.fn(),
    };
    service = new CaseService(mockPrisma, mockAudit, mockNotifications);
  });

  describe('VALID_STATE_TRANSITIONS map', () => {
    it('should allow Intake → Open', () => {
      expect(VALID_STATE_TRANSITIONS['Intake']).toContain('Open');
    });

    it('should allow Open → Active', () => {
      expect(VALID_STATE_TRANSITIONS['Open']).toContain('Active');
    });

    it('should allow Active → Pending', () => {
      expect(VALID_STATE_TRANSITIONS['Active']).toContain('Pending');
    });

    it('should allow Active → Closed', () => {
      expect(VALID_STATE_TRANSITIONS['Active']).toContain('Closed');
    });

    it('should allow Pending → Active', () => {
      expect(VALID_STATE_TRANSITIONS['Pending']).toContain('Active');
    });

    it('should allow Pending → Closed', () => {
      expect(VALID_STATE_TRANSITIONS['Pending']).toContain('Closed');
    });

    it('should allow Closed → Archived', () => {
      expect(VALID_STATE_TRANSITIONS['Closed']).toContain('Archived');
    });

    it('should not allow any transition from Archived', () => {
      expect(VALID_STATE_TRANSITIONS['Archived']).toEqual([]);
    });

    it('should not allow Intake → Active (skipping Open)', () => {
      expect(VALID_STATE_TRANSITIONS['Intake']).not.toContain('Active');
    });

    it('should not allow Open → Closed (skipping Active)', () => {
      expect(VALID_STATE_TRANSITIONS['Open']).not.toContain('Closed');
    });

    it('should not allow Closed → Active (backwards)', () => {
      expect(VALID_STATE_TRANSITIONS['Closed']).not.toContain('Active');
    });
  });

  describe('transition', () => {
    const tenantSlug = 'test-firm';
    const caseId = 'case-1';
    const userId = 'user-1';

    const makeCaseData = (state: string) => ({
      id: caseId,
      title: 'Test Case',
      state,
      system_case_ref: 'CASE-2024-001',
      memberships: [],
      customers: [],
      parties: [],
    });

    const setupGetById = (state: string) => {
      // getById calls 4 queries: case, memberships, customers, parties
      mockPrisma.queryTenant
        .mockResolvedValueOnce([makeCaseData(state)])  // case
        .mockResolvedValueOnce([])  // memberships
        .mockResolvedValueOnce([])  // customers
        .mockResolvedValueOnce([]); // parties
    };

    it('should transition from Active to Closed successfully', async () => {
      setupGetById('Active');
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // Return value after update (second getById call)
      mockPrisma.queryTenant
        .mockResolvedValueOnce([makeCaseData('Closed')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.transition(
        tenantSlug,
        caseId,
        { toState: 'Closed', reason: 'Resolved' },
        userId,
      );

      expect(result.state).toBe('Closed');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CASE_STATE_CHANGED',
          payload: expect.objectContaining({ from: 'Active', to: 'Closed' }),
        }),
      );
    });

    it('should reject invalid transition (Intake → Active)', async () => {
      setupGetById('Intake');

      await expect(
        service.transition(tenantSlug, caseId, { toState: 'Active' }, userId),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should include state names in invalid transition error', async () => {
      setupGetById('Intake');

      await expect(
        service.transition(tenantSlug, caseId, { toState: 'Active' }, userId),
      ).rejects.toThrow(/Cannot transition from Intake to Active/);
    });

    it('should reject invalid transition (Archived → anything)', async () => {
      setupGetById('Archived');

      await expect(
        service.transition(tenantSlug, caseId, { toState: 'Active' }, userId),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should reject invalid backward transition (Closed → Active)', async () => {
      setupGetById('Closed');

      await expect(
        service.transition(tenantSlug, caseId, { toState: 'Active' }, userId),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should allow Pending → Active (reactivation)', async () => {
      setupGetById('Pending');
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant
        .mockResolvedValueOnce([makeCaseData('Active')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.transition(
        tenantSlug,
        caseId,
        { toState: 'Active', reason: 'Resumed work' },
        userId,
      );

      expect(result.state).toBe('Active');
    });
  });
});
