import { BadRequestException, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { DocumentService } from './document.service';

// Import the module-level validateFileUpload indirectly via create()
// We test validation through the service methods that call it

describe('DocumentService', () => {
  let service: DocumentService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockStorage: any;
  let mockScanQueue: any;

  beforeEach(() => {
    mockPrisma = {
      queryTenant: jest.fn(),
      executeTenant: jest.fn(),
    };
    mockAudit = {
      log: jest.fn(),
    };
    mockStorage = {
      buildKey: jest.fn().mockReturnValue('tenant/doc/key'),
      getUploadUrl: jest.fn().mockResolvedValue('https://upload-url'),
      getDownloadUrl: jest.fn().mockResolvedValue('https://download-url'),
    };
    mockScanQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };
    service = new DocumentService(mockPrisma, mockAudit, mockStorage, mockScanQueue);
  });

  // ── Upload validation (FR-DOC-04) ──

  describe('create – file validation', () => {
    const tenantSlug = 'test-firm';
    const tenantId = 'tenant-1';
    const userId = 'user-1';

    const validDto = {
      title: 'Contract',
      fileName: 'contract.pdf',
      mimeType: 'application/pdf',
      docTypeId: 'doctype-1',
      customerId: 'cust-1',
    };

    it('should accept valid PDF upload', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      const result = await service.create(tenantSlug, tenantId, validDto as any, userId);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('uploadUrl');
    });

    it('should accept valid DOCX upload', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      const result = await service.create(tenantSlug, tenantId, {
        ...validDto,
        fileName: 'doc.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      } as any, userId);
      expect(result).toHaveProperty('id');
    });

    it('should reject disallowed MIME type (exe)', async () => {
      await expect(
        service.create(tenantSlug, tenantId, {
          ...validDto,
          fileName: 'virus.exe',
          mimeType: 'application/x-msdownload',
        } as any, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject disallowed MIME type (zip)', async () => {
      await expect(
        service.create(tenantSlug, tenantId, {
          ...validDto,
          fileName: 'archive.zip',
          mimeType: 'application/zip',
        } as any, userId),
      ).rejects.toThrow(/not allowed/i);
    });

    it('should reject disallowed extension even with valid MIME', async () => {
      await expect(
        service.create(tenantSlug, tenantId, {
          ...validDto,
          fileName: 'script.bat',
          mimeType: 'text/plain', // valid MIME but bad extension
        } as any, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── HC step-up enforcement (FR-DOC-09) ──

  describe('getById – HC access control', () => {
    const tenantSlug = 'test-firm';
    const userId = 'user-1';
    const docId = 'doc-hc';

    const hcDoc = {
      id: docId,
      confidentiality_level: 'HighlyConfidential',
      is_deleted: false,
      created_by: 'other-user',
    };

    it('should deny access to HC doc without step-up', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([hcDoc]);

      await expect(
        service.getById(tenantSlug, docId, userId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should deny access to HC doc when step-up but no ACL and not creator', async () => {
      mockPrisma.queryTenant
        .mockResolvedValueOnce([hcDoc])     // document row
        .mockResolvedValueOnce([]);          // empty ACL

      await expect(
        service.getById(tenantSlug, docId, userId, true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow HC doc access when step-up and user is creator', async () => {
      mockPrisma.queryTenant
        .mockResolvedValueOnce([{ ...hcDoc, created_by: userId }])  // doc
        .mockResolvedValueOnce([])   // ACL check skipped (creator match)
        .mockResolvedValueOnce([]);  // versions
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.getById(tenantSlug, docId, userId, true);
      expect(result.id).toBe(docId);
    });

    it('should allow HC doc access when step-up and valid ACL', async () => {
      mockPrisma.queryTenant
        .mockResolvedValueOnce([hcDoc])
        .mockResolvedValueOnce([{ document_id: docId, user_id: userId }]) // ACL match
        .mockResolvedValueOnce([]); // versions
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.getById(tenantSlug, docId, userId, true);
      expect(result.id).toBe(docId);
    });

    it('should allow Standard doc access without step-up', async () => {
      const stdDoc = { id: 'doc-std', confidentiality_level: 'Standard', is_deleted: false };
      mockPrisma.queryTenant
        .mockResolvedValueOnce([stdDoc]) // doc
        .mockResolvedValueOnce([]);      // versions
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.getById(tenantSlug, 'doc-std', userId, false);
      expect(result.id).toBe('doc-std');
    });
  });

  // ── Share expiry (FR-DOC-10) ──

  describe('shareDocument', () => {
    it('should pass expiresAt to ACL insert', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.shareDocument('test-firm', 'doc-1', {
        userId: 'share-user',
        permission: 'Read',
        expiresAt: '2025-12-31T23:59:59Z',
      } as any, 'user-1');

      expect(result).toHaveProperty('id');
      expect(mockPrisma.executeTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.stringContaining('document_acl'),
        expect.arrayContaining(['2025-12-31T23:59:59Z']),
      );
    });

    it('should pass null expiresAt when not provided', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      await service.shareDocument('test-firm', 'doc-1', {
        userId: 'share-user',
        permission: 'Read',
      } as any, 'user-1');

      expect(mockPrisma.executeTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.stringContaining('document_acl'),
        expect.arrayContaining([null]),
      );
    });

    it('should audit share event with expiry', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      await service.shareDocument('test-firm', 'doc-1', {
        userId: 'share-user',
        expiresAt: '2025-06-30',
      } as any, 'user-1');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'DOC_SHARED',
          payload: expect.objectContaining({ expiresAt: '2025-06-30' }),
        }),
      );
    });
  });

  // ── Legal hold (FR-DOC-12) ──

  describe('legal hold – document level', () => {
    it('should set legal hold on a document', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.setLegalHold('test-firm', 'doc-1', 'user-1');
      expect(result.message).toContain('Legal hold placed');
      expect(mockPrisma.executeTenant).toHaveBeenCalledTimes(2); // update doc + insert hold
    });

    it('should remove legal hold from a document', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.removeLegalHold('test-firm', 'doc-1', 'user-1');
      expect(result.message).toContain('hold removed');
      expect(mockPrisma.executeTenant).toHaveBeenCalledTimes(2);
    });
  });

  describe('legal hold – case level', () => {
    it('should set legal hold on all case documents', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.setCaseLegalHold('test-firm', 'case-1', 'user-1');
      expect(result.message).toContain('all case documents');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'CASE_LEGAL_HOLD_PLACED', entityType: 'Case' }),
      );
    });

    it('should remove legal hold from all case documents', async () => {
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.removeCaseLegalHold('test-firm', 'case-1', 'user-1');
      expect(result.message).toContain('hold removed');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'CASE_LEGAL_HOLD_LIFTED', entityType: 'Case' }),
      );
    });
  });

  describe('softDelete – legal hold blocks deletion', () => {
    it('should block deletion when document has legal hold', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'doc-1', has_legal_hold: true }]);

      await expect(
        service.softDelete('test-firm', 'doc-1', 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should allow deletion when no legal hold', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'doc-1', has_legal_hold: false }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.softDelete('test-firm', 'doc-1', 'user-1');
      expect(result.message).toContain('deleted');
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(
        service.softDelete('test-firm', 'missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Checkout – legal hold blocks checkout ──

  describe('checkout – legal hold', () => {
    it('should block checkout when document has legal hold', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'doc-1', has_legal_hold: true, is_checked_out: false, is_deleted: false,
      }]);

      await expect(
        service.checkout('test-firm', 'doc-1', 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
