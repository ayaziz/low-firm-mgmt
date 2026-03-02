import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { FolderService } from './folder.service';

describe('FolderService', () => {
  let service: FolderService;
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
    service = new FolderService(mockPrisma, mockAudit);
  });

  // ── Create ─────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a root folder for a case', async () => {
      const dto = { name: 'Pleadings', caseId: 'case-1', scope: 'Case' as const };

      // Duplicate check at root level
      mockPrisma.queryTenant.mockResolvedValueOnce([]); // no dupes
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getById (return)
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'f1', name: 'Pleadings', path: '/Pleadings', document_count: 0, child_count: 0,
      }]);

      const result = await service.create('test-firm', dto, 'user-1');

      expect(result.name).toBe('Pleadings');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'FOLDER_CREATED' }),
      );
    });

    it('should throw ConflictException for duplicate root folder', async () => {
      const dto = { name: 'Evidence', caseId: 'case-1', scope: 'Case' as const };

      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'existing' }]); // dupe found

      await expect(
        service.create('test-firm', dto, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a child folder with parent path', async () => {
      const dto = { name: 'Subfiles', parentId: 'f1' };

      // getById (parent)
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'f1', path: '/Pleadings', document_count: 0, child_count: 0,
      }]);
      // Duplicate check at parent level
      mockPrisma.queryTenant.mockResolvedValueOnce([]); // no dupes
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getById (return)
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'f2', name: 'Subfiles', path: '/Pleadings/Subfiles', document_count: 0, child_count: 0,
      }]);

      const result = await service.create('test-firm', dto, 'user-1');
      expect(result.path).toBe('/Pleadings/Subfiles');
    });
  });

  // ── listByCase ─────────────────────────────────────────────────

  describe('listByCase', () => {
    it('should return all folders for a case', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([
        { id: 'f1', path: '/Pleadings' },
        { id: 'f2', path: '/Evidence' },
      ]);

      const result = await service.listByCase('test-firm', 'case-1');
      expect(result).toHaveLength(2);
    });
  });

  // ── getById ────────────────────────────────────────────────────

  describe('getById', () => {
    it('should throw NotFoundException when folder missing', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(service.getById('test-firm', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getDocuments ───────────────────────────────────────────────

  describe('getDocuments', () => {
    it('should return paginated documents for a folder', async () => {
      // getById (verify folder)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'f1', document_count: 1, child_count: 0 }]);
      // documents query
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'd1', title: 'Doc 1' }]);

      const result = await service.getDocuments('test-firm', 'f1');
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });

  // ── Move folder ────────────────────────────────────────────────

  describe('move', () => {
    it('should prevent moving folder into own subtree', async () => {
      // getById (folder being moved)
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'f1', name: 'Parent', path: '/Parent', document_count: 0, child_count: 1,
      }]);
      // getById (target parent) — its path starts with folder's path
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'f2', name: 'Child', path: '/Parent/Child', document_count: 0, child_count: 0,
      }]);

      await expect(
        service.move('test-firm', 'f1', { newParentId: 'f2' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── MoveDocument ───────────────────────────────────────────────

  describe('moveDocument', () => {
    it('should throw NotFoundException if document missing', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]); // doc not found

      await expect(
        service.moveDocument('test-firm', { documentId: 'bad', folderId: 'f1' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should move a document and audit', async () => {
      // doc exists
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'd1' }]);
      // folder exists (getById)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'f1', document_count: 0, child_count: 0 }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.moveDocument('test-firm', { documentId: 'd1', folderId: 'f1' }, 'user-1');

      expect(result).toEqual({ success: true });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'DOCUMENT_MOVED' }),
      );
    });
  });

  // ── Delete ─────────────────────────────────────────────────────

  describe('delete', () => {
    it('should reject delete when folder has children', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'f1', child_count: 2, document_count: 0 }]);

      await expect(
        service.delete('test-firm', 'f1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject delete when folder has documents', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'f1', child_count: 0, document_count: 3 }]);

      await expect(
        service.delete('test-firm', 'f1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete empty folder and audit', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'f1', name: 'X', path: '/X', child_count: 0, document_count: 0 }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.delete('test-firm', 'f1', 'user-1');

      expect(result).toEqual({ deleted: true });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'FOLDER_DELETED' }),
      );
    });
  });
});
