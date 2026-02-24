import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      queryTenant: jest.fn(),
      executeTenant: jest.fn(),
    };
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    service = new AdminService(mockPrisma, mockAudit);
  });

  // ── Retention Policies (FR-DOC-11) ──

  describe('retention policies', () => {
    it('should list retention policies', async () => {
      const policies = [
        { id: '1', doc_type_code: 'Contract', retention_days: 365 },
        { id: '2', doc_type_code: 'Invoice', retention_days: 2555 },
      ];
      mockPrisma.queryTenant.mockResolvedValueOnce(policies);

      const result = await service.listRetentionPolicies('test-firm');
      expect(result).toEqual(policies);
      expect(mockPrisma.queryTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.stringContaining('retention_policies'),
      );
    });

    it('should upsert a retention policy', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.upsertRetentionPolicy(
        'test-firm', 'Contract', 365, 'Keep contracts for 1 year', 'admin-1',
      );

      expect(result).toHaveProperty('id');
      expect(result.docTypeCode).toBe('Contract');
      expect(result.retentionDays).toBe(365);
      expect(mockPrisma.executeTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.stringContaining('retention_policies'),
        expect.any(Array),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'RETENTION_POLICY_CREATED' }),
      );
    });
  });

  // ── Courts CRUD (FR-CASE-11) ──

  describe('courts CRUD', () => {
    it('should list courts', async () => {
      const courts = [
        { id: '1', name: 'Supreme Court', notes: null },
        { id: '2', name: 'District Court', notes: 'Main branch' },
      ];
      mockPrisma.queryTenant.mockResolvedValueOnce(courts);

      const result = await service.listCourts('test-firm');
      expect(result).toEqual(courts);
    });

    it('should create a court', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.createCourt(
        'test-firm',
        { name: 'Appeals Court', notes: 'Level 2', addressText: '123 Main St' },
        'admin-1',
      );

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Appeals Court');
      expect(mockPrisma.executeTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.stringContaining('courts'),
        expect.any(Array),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'COURT_CREATED' }),
      );
    });

    it('should update a court', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.updateCourt(
        'test-firm',
        'court-1',
        { name: 'Updated Court', notes: 'Updated notes' },
        'admin-1',
      );

      expect(result).toHaveProperty('id', 'court-1');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'COURT_UPDATED' }),
      );
    });
  });
});
