import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { HearingService } from './hearing.service';
import { VALID_HEARING_TRANSITIONS, HearingStatus } from '../common/types';

describe('HearingService', () => {
  let service: HearingService;
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
    service = new HearingService(mockPrisma, mockAudit, mockNotifications);
  });

  // ── State Machine ──────────────────────────────────────────────

  describe('VALID_HEARING_TRANSITIONS map', () => {
    it('should allow Scheduled → Completed', () => {
      expect(VALID_HEARING_TRANSITIONS['Scheduled']).toContain('Completed');
    });

    it('should allow Scheduled → Postponed', () => {
      expect(VALID_HEARING_TRANSITIONS['Scheduled']).toContain('Postponed');
    });

    it('should allow Scheduled → Cancelled', () => {
      expect(VALID_HEARING_TRANSITIONS['Scheduled']).toContain('Cancelled');
    });

    it('should allow Postponed → Scheduled', () => {
      expect(VALID_HEARING_TRANSITIONS['Postponed']).toContain('Scheduled');
    });

    it('should not allow any transition from Completed', () => {
      expect(VALID_HEARING_TRANSITIONS['Completed']).toEqual([]);
    });

    it('should not allow any transition from Cancelled', () => {
      expect(VALID_HEARING_TRANSITIONS['Cancelled']).toEqual([]);
    });
  });

  // ── Create ─────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a hearing with calendar event and return it', async () => {
      const dto = { caseId: 'case-1', hearingDate: '2024-06-01T10:00:00Z', hearingType: 'Initial' as const };

      // Verify case
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'case-1', title: 'Test Case', assigned_lawyer_user_id: null }]);
      // calendar event insert + hearing insert + attendee insert + reminder insert
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getById (return): hearing row
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'h1', case_id: 'case-1', status: 'Scheduled', case_title: 'Test Case',
        court_name: null, judge_name: null, hearing_date: '2024-06-01T10:00:00Z',
      }]);

      const result = await service.create('test-firm', dto, 'user-1');

      expect(result.status).toBe('Scheduled');
      expect(mockPrisma.executeTenant).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'HEARING_CREATED' }),
      );
    });

    it('should throw NotFoundException if case does not exist', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(
        service.create('test-firm', { caseId: 'bad', hearingDate: '2024-06-01T10:00:00Z' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should notify assigned lawyer if different from creator', async () => {
      const dto = { caseId: 'case-1', hearingDate: '2024-06-01T10:00:00Z' };

      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'case-1', title: 'Test Case', assigned_lawyer_user_id: 'lawyer-2',
      }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'h1', status: 'Scheduled' }]);

      await service.create('test-firm', dto, 'user-1');

      expect(mockNotifications.create).toHaveBeenCalledWith(
        'test-firm',
        expect.objectContaining({
          userId: 'lawyer-2',
          type: 'session',
          entityType: 'Hearing',
        }),
      );
    });
  });

  // ── List ───────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated hearings', async () => {
      const rows = [
        { id: 'h1', hearing_date: '2024-06-01' },
        { id: 'h2', hearing_date: '2024-05-01' },
      ];
      mockPrisma.queryTenant.mockResolvedValueOnce(rows);

      const result = await service.list('test-firm');

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });
  });

  // ── getById ────────────────────────────────────────────────────

  describe('getById', () => {
    it('should throw NotFoundException when hearing missing', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(service.getById('test-firm', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Update ─────────────────────────────────────────────────────

  describe('update', () => {
    it('should reject update for non-Scheduled hearings', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'h1', status: 'Completed' }]);

      await expect(
        service.update('test-firm', 'h1', { location: 'Room B' }, 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should update a Scheduled hearing and sync calendar date', async () => {
      // getById
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'h1', status: 'Scheduled', calendar_event_id: 'ev1',
      }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getById (return)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'h1', status: 'Scheduled', hearing_date: '2024-07-01T10:00:00Z' }]);

      const result = await service.update('test-firm', 'h1', { hearingDate: '2024-07-01T10:00:00Z' }, 'user-1');

      expect(result.hearing_date).toBe('2024-07-01T10:00:00Z');
      // executeTenant called twice: update hearing + sync calendar event
      expect(mockPrisma.executeTenant).toHaveBeenCalledTimes(2);
    });
  });

  // ── Transition ─────────────────────────────────────────────────

  describe('transition', () => {
    const tenantSlug = 'test-firm';

    const makeHearing = (status: HearingStatus) => ({
      id: 'h1',
      status,
      calendar_event_id: 'ev1',
      case_id: 'case-1',
    });

    it('should transition Scheduled → Completed', async () => {
      // getById
      mockPrisma.queryTenant.mockResolvedValueOnce([makeHearing('Scheduled')]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getById (return)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ ...makeHearing('Completed'), status: 'Completed' }]);

      const result = await service.transition(tenantSlug, 'h1', { toStatus: 'Completed' }, 'user-1');

      expect(result.status).toBe('Completed');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'HEARING_STATUS_CHANGED',
          payload: expect.objectContaining({ from: 'Scheduled', to: 'Completed' }),
        }),
      );
    });

    it('should transition Scheduled → Cancelled', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeHearing('Scheduled')]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{ ...makeHearing('Cancelled'), status: 'Cancelled' }]);

      const result = await service.transition(tenantSlug, 'h1', { toStatus: 'Cancelled' }, 'user-1');
      expect(result.status).toBe('Cancelled');
    });

    it('should reject invalid transition Completed → Scheduled', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeHearing('Completed')]);

      await expect(
        service.transition(tenantSlug, 'h1', { toStatus: 'Scheduled' }, 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should reject invalid transition Cancelled → Scheduled', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeHearing('Cancelled')]);

      await expect(
        service.transition(tenantSlug, 'h1', { toStatus: 'Scheduled' }, 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should include status names in invalid transition error', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeHearing('Completed')]);

      await expect(
        service.transition(tenantSlug, 'h1', { toStatus: 'Scheduled' }, 'user-1'),
      ).rejects.toThrow(/Cannot transition hearing from Completed to Scheduled/);
    });

    it('should allow Postponed → Scheduled (reschedule)', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([makeHearing('Postponed')]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{ ...makeHearing('Scheduled'), status: 'Scheduled' }]);

      const result = await service.transition(tenantSlug, 'h1', { toStatus: 'Scheduled' }, 'user-1');
      expect(result.status).toBe('Scheduled');
    });
  });
});
