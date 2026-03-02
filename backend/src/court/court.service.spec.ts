import { NotFoundException } from '@nestjs/common';
import { CourtService } from './court.service';

describe('CourtService', () => {
  let service: CourtService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      queryTenant: jest.fn(),
      executeTenant: jest.fn(),
    };
    mockAudit = {
      log: jest.fn(),
    };
    service = new CourtService(mockPrisma, mockAudit);
  });

  // ── Courts ─────────────────────────────────────────────────────

  describe('createCourt', () => {
    it('should create a court, audit it, and return it', async () => {
      const dto = { name: 'District Court A', city: 'Riyadh', jurisdictionLevel: 'District' as const };
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getCourtById calls: court query + judge count
      mockPrisma.queryTenant
        .mockResolvedValueOnce([{ id: 'c1', name: 'District Court A', city: 'Riyadh' }]) // court row
        .mockResolvedValueOnce([{ count: 0 }]); // judge count

      const result = await service.createCourt('test-firm', dto, 'user-1');

      expect(result.name).toBe('District Court A');
      expect(mockPrisma.executeTenant).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'COURT_CREATED',
          entityType: 'Court',
        }),
      );
    });
  });

  describe('listCourts', () => {
    it('should return paginated courts', async () => {
      const rows = [
        { id: 'c1', name: 'Court A', created_at: '2024-01-01' },
        { id: 'c2', name: 'Court B', created_at: '2024-01-02' },
      ];
      mockPrisma.queryTenant.mockResolvedValueOnce(rows);

      const result = await service.listCourts('test-firm', undefined, undefined, undefined, undefined, 20);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should detect hasMore when rows exceed limit', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, name: `Court ${i}`, created_at: `2024-0${i + 1}-01` }));
      mockPrisma.queryTenant.mockResolvedValueOnce(rows);

      const result = await service.listCourts('test-firm', undefined, undefined, undefined, undefined, 2);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeTruthy();
    });
  });

  describe('getCourtById', () => {
    it('should return a court with activeJudgeCount', async () => {
      mockPrisma.queryTenant
        .mockResolvedValueOnce([{ id: 'c1', name: 'Main Court' }])
        .mockResolvedValueOnce([{ count: 3 }]);

      const result = await service.getCourtById('test-firm', 'c1');

      expect(result.name).toBe('Main Court');
      expect(result.activeJudgeCount).toBe(3);
    });

    it('should throw NotFoundException when court missing', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(service.getCourtById('test-firm', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCourt', () => {
    it('should update and return court', async () => {
      // getCourtById (existence check) — court + judge count
      mockPrisma.queryTenant
        .mockResolvedValueOnce([{ id: 'c1', name: 'Old' }])
        .mockResolvedValueOnce([{ count: 0 }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getCourtById (return after update)
      mockPrisma.queryTenant
        .mockResolvedValueOnce([{ id: 'c1', name: 'New' }])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await service.updateCourt('test-firm', 'c1', { name: 'New' }, 'user-1');

      expect(result.name).toBe('New');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'COURT_UPDATED' }),
      );
    });
  });

  // ── Judges ─────────────────────────────────────────────────────

  describe('createJudge', () => {
    it('should create a judge after verifying court exists', async () => {
      // getCourtById (court verification) — court + judge count
      mockPrisma.queryTenant
        .mockResolvedValueOnce([{ id: 'c1', name: 'Court' }])
        .mockResolvedValueOnce([{ count: 0 }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getJudgeById (return)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'j1', full_name: 'Judge X', court_name: 'Court' }]);

      const result = await service.createJudge('test-firm', { courtId: 'c1', fullName: 'Judge X' }, 'user-1');

      expect(result.full_name).toBe('Judge X');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'JUDGE_CREATED' }),
      );
    });

    it('should throw if court does not exist', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]); // court not found

      await expect(
        service.createJudge('test-firm', { courtId: 'bad', fullName: 'J' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listJudges', () => {
    it('should return paginated judges', async () => {
      const rows = [{ id: 'j1', full_name: 'Judge A' }];
      mockPrisma.queryTenant.mockResolvedValueOnce(rows);

      const result = await service.listJudges('test-firm');

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getJudgeById', () => {
    it('should throw NotFoundException when judge missing', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(service.getJudgeById('test-firm', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateJudge', () => {
    it('should update judge and audit', async () => {
      // getJudgeById (existence)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'j1', full_name: 'Old', court_name: 'C' }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getJudgeById (return)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'j1', full_name: 'New', court_name: 'C' }]);

      const result = await service.updateJudge('test-firm', 'j1', { fullName: 'New' }, 'user-1');

      expect(result.full_name).toBe('New');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'JUDGE_UPDATED' }),
      );
    });
  });
});
