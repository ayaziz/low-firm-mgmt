import { NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { TimeEntryService } from './time-entry.service';
import { VALID_TIME_ENTRY_TRANSITIONS, TimeEntryStatus } from '../common/types';

describe('TimeEntryService', () => {
  let service: TimeEntryService;
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
      create: jest.fn(),
    };
    service = new TimeEntryService(mockPrisma, mockAudit, mockNotifications);
  });

  // ── State Machine ──────────────────────────────────────────────

  describe('VALID_TIME_ENTRY_TRANSITIONS map', () => {
    it('should allow Draft → Submitted', () => {
      expect(VALID_TIME_ENTRY_TRANSITIONS['Draft']).toContain('Submitted');
    });

    it('should allow Submitted → Approved', () => {
      expect(VALID_TIME_ENTRY_TRANSITIONS['Submitted']).toContain('Approved');
    });

    it('should allow Submitted → Draft (rejection)', () => {
      expect(VALID_TIME_ENTRY_TRANSITIONS['Submitted']).toContain('Draft');
    });

    it('should allow Approved → Billed', () => {
      expect(VALID_TIME_ENTRY_TRANSITIONS['Approved']).toContain('Billed');
    });

    it('should allow Approved → WriteOff', () => {
      expect(VALID_TIME_ENTRY_TRANSITIONS['Approved']).toContain('WriteOff');
    });

    it('should not allow any transition from Billed', () => {
      expect(VALID_TIME_ENTRY_TRANSITIONS['Billed']).toEqual([]);
    });

    it('should not allow any transition from WriteOff', () => {
      expect(VALID_TIME_ENTRY_TRANSITIONS['WriteOff']).toEqual([]);
    });
  });

  // ── Create ─────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a time entry with calculated amount', async () => {
      const dto = { caseId: 'case-1', entryDate: '2024-06-01', hours: 2, description: 'Research', ratePerHour: 100 };

      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'case-1', title: 'Test Case' }]); // case exists
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'te1', status: 'Draft', hours: 2, total_amount: 200, case_title: 'Test Case',
      }]);

      const result = await service.create('test-firm', dto, 'user-1');

      expect(result.status).toBe('Draft');
      expect(result.total_amount).toBe(200);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'TIME_ENTRY_CREATED' }),
      );
    });

    it('should throw NotFoundException if case does not exist', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(
        service.create('test-firm', { caseId: 'bad', entryDate: '2024-06-01', hours: 1, description: 'x' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── List ───────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated time entries', async () => {
      const rows = [
        { id: 'te1', created_at: '2024-06-01' },
        { id: 'te2', created_at: '2024-06-02' },
      ];
      mockPrisma.queryTenant.mockResolvedValueOnce(rows);

      const result = await service.list('test-firm');
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });
  });

  // ── Summary ────────────────────────────────────────────────────

  describe('summary', () => {
    it('should return aggregate summary', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        total_entries: 5,
        total_hours: 10,
        total_amount: 2000,
        billable_hours: 8,
        billable_amount: 1600,
        non_billable_hours: 2,
      }]);

      const result = await service.summary('test-firm');
      expect(result.total_entries).toBe(5);
      expect(result.total_hours).toBe(10);
    });
  });

  // ── Update ─────────────────────────────────────────────────────

  describe('update', () => {
    it('should reject update for non-Draft entries', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'te1', status: 'Submitted', user_id: 'user-1' }]);

      await expect(
        service.update('test-firm', 'te1', { hours: 3 }, 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should reject update from non-owner', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'te1', status: 'Draft', user_id: 'user-1' }]);

      await expect(
        service.update('test-firm', 'te1', { hours: 3 }, 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update and recalculate total_amount', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'te1', status: 'Draft', user_id: 'user-1', hours: 2, rate_per_hour: 100,
      }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'te1', status: 'Draft', hours: 4, total_amount: 400,
      }]);

      const result = await service.update('test-firm', 'te1', { hours: 4 }, 'user-1');
      expect(result.hours).toBe(4);
    });
  });

  // ── Transition ─────────────────────────────────────────────────

  describe('transition', () => {
    const tenantSlug = 'test-firm';

    const makeEntry = (status: TimeEntryStatus, userId = 'user-1') => ({
      id: 'te1',
      status,
      user_id: userId,
      hours: 2,
      entry_date: '2024-06-01',
    });

    it('should transition Draft → Submitted by owner', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeEntry('Draft')]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{ ...makeEntry('Submitted'), status: 'Submitted' }]);

      const result = await service.transition(tenantSlug, 'te1', { toStatus: 'Submitted' }, 'user-1', ['Lawyer']);
      expect(result.status).toBe('Submitted');
    });

    it('should reject Submit from non-owner', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeEntry('Draft', 'user-1')]);

      await expect(
        service.transition(tenantSlug, 'te1', { toStatus: 'Submitted' }, 'user-2', ['Lawyer']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Approve by TenantAdmin', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeEntry('Submitted')]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{ ...makeEntry('Approved'), status: 'Approved' }]);

      const result = await service.transition(tenantSlug, 'te1', { toStatus: 'Approved' }, 'admin-1', ['TenantAdmin']);
      expect(result.status).toBe('Approved');
    });

    it('should reject Approve from Lawyer role', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeEntry('Submitted')]);

      await expect(
        service.transition(tenantSlug, 'te1', { toStatus: 'Approved' }, 'user-1', ['Lawyer']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject invalid transition Draft → Approved', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeEntry('Draft')]);

      await expect(
        service.transition(tenantSlug, 'te1', { toStatus: 'Approved' }, 'admin-1', ['TenantAdmin']),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should include status names in invalid transition error', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeEntry('Billed')]);

      await expect(
        service.transition(tenantSlug, 'te1', { toStatus: 'Draft' }, 'user-1', ['Lawyer']),
      ).rejects.toThrow(/Cannot transition time entry from Billed to Draft/);
    });

    it('should notify owner when entry is approved by another user', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeEntry('Submitted', 'user-1')]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{ ...makeEntry('Approved'), status: 'Approved' }]);

      await service.transition(tenantSlug, 'te1', { toStatus: 'Approved' }, 'admin-1', ['TenantAdmin']);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        tenantSlug,
        expect.objectContaining({
          userId: 'user-1',
          type: 'approval',
          entityType: 'TimeEntry',
        }),
      );
    });
  });

  // ── Delete ─────────────────────────────────────────────────────

  describe('delete', () => {
    it('should reject delete for non-Draft entries', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'te1', status: 'Submitted', user_id: 'user-1' }]);

      await expect(service.delete('test-firm', 'te1', 'user-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should reject delete from non-owner', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'te1', status: 'Draft', user_id: 'user-1' }]);

      await expect(service.delete('test-firm', 'te1', 'user-2')).rejects.toThrow(ForbiddenException);
    });

    it('should delete Draft entry by owner', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'te1', status: 'Draft', user_id: 'user-1', hours: 2, entry_date: '2024-06-01',
      }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.delete('test-firm', 'te1', 'user-1');

      expect(result).toEqual({ deleted: true });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'TIME_ENTRY_DELETED' }),
      );
    });
  });
});
