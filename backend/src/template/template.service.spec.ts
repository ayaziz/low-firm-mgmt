import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TemplateService } from './template.service';
import * as Handlebars from 'handlebars';

describe('TemplateService', () => {
  let service: TemplateService;
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
    service = new TemplateService(mockPrisma, mockAudit);
  });

  // ── Create ─────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a template with valid Handlebars body', async () => {
      const dto = {
        name: 'Contract',
        category: 'Contract' as const,
        templateBody: 'Dear {{clientName}}, your case {{caseRef}} is confirmed.',
        variableSchema: { clientName: 'string', caseRef: 'string' },
      };

      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.create('test-firm', dto, 'user-1');

      expect(result.id).toBeDefined();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'TEMPLATE_CREATED' }),
      );
    });

    it('should reject invalid Handlebars syntax', async () => {
      const spy = jest.spyOn(Handlebars, 'compile').mockImplementationOnce(() => {
        throw new Error('Parse error');
      });

      const dto = {
        name: 'Bad Template',
        category: 'Other' as const,
        templateBody: 'broken template',
      };

      await expect(
        service.create('test-firm', dto, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      spy.mockRestore();
    });
  });

  // ── List ───────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated templates', async () => {
      const rows = [
        { id: 't1', name: 'Template A', created_at: '2024-06-01' },
      ];
      mockPrisma.queryTenant.mockResolvedValueOnce(rows);

      const result = await service.list('test-firm', {});
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should detect hasMore', async () => {
      const rows = Array.from({ length: 21 }, (_, i) => ({ id: `t${i}`, created_at: `2024-01-${String(i + 1).padStart(2, '0')}` }));
      mockPrisma.queryTenant.mockResolvedValueOnce(rows);

      const result = await service.list('test-firm', { limit: 20 });
      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });
  });

  // ── GetById ────────────────────────────────────────────────────

  describe('getById', () => {
    it('should throw NotFoundException when template missing', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(service.getById('test-firm', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Update ─────────────────────────────────────────────────────

  describe('update', () => {
    it('should update name and audit', async () => {
      // getById (existence)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 't1', name: 'Old' }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getById (return)
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 't1', name: 'Renamed' }]);

      const result = await service.update('test-firm', 't1', { name: 'Renamed' }, 'user-1');
      expect(result.name).toBe('Renamed');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'TEMPLATE_UPDATED' }),
      );
    });

    it('should reject invalid Handlebars body on update', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 't1' }]);

      const spy = jest.spyOn(Handlebars, 'compile').mockImplementationOnce(() => {
        throw new Error('Parse error');
      });

      await expect(
        service.update('test-firm', 't1', { templateBody: 'broken' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      spy.mockRestore();
    });

    it('should throw BadRequestException when no fields provided', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 't1' }]);

      await expect(
        service.update('test-firm', 't1', {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Render ─────────────────────────────────────────────────────

  describe('render', () => {
    it('should render template with data', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 't1',
        name: 'Contract',
        category: 'Contract',
        is_active: true,
        template_body: 'Dear {{clientName}}, case {{caseRef}}.',
        variable_schema: { clientName: 'string', caseRef: 'string' },
      }]);

      const result = await service.render('test-firm', {
        templateId: 't1',
        data: { clientName: 'Alice', caseRef: 'C-001' },
      });

      expect(result.rendered).toBe('Dear Alice, case C-001.');
      expect(result.templateName).toBe('Contract');
    });

    it('should throw BadRequestException for inactive template', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 't1', is_active: false, template_body: '{{x}}', variable_schema: {},
      }]);

      await expect(
        service.render('test-firm', { templateId: 't1', data: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should report missing required variables', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 't1', is_active: true, template_body: '{{x}}',
        variable_schema: { clientName: 'string' },
      }]);

      await expect(
        service.render('test-firm', { templateId: 't1', data: {} }),
      ).rejects.toThrow(/Missing required variables/);
    });
  });

  // ── Generate ───────────────────────────────────────────────────

  describe('generate', () => {
    it('should throw BadRequestException when caseId missing', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 't1', is_active: true, template_body: '{{x}}',
        variable_schema: {}, name: 'Test',
      }]);

      await expect(
        service.generate('test-firm', { templateId: 't1', data: { x: '1' } }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate a document from template', async () => {
      // render getById
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 't1', name: 'Letter', category: 'Letter', is_active: true,
        template_body: 'Hello {{name}}',
        variable_schema: {},
      }]);
      // insert document
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.generate(
        'test-firm',
        { templateId: 't1', data: { name: 'Bob' }, caseId: 'case-1' },
        'user-1',
      );

      expect(result.documentId).toBeDefined();
      expect(result.rendered).toBe('Hello Bob');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'DOC_GENERATED_FROM_TEMPLATE' }),
      );
    });
  });

  // ── Deactivate ─────────────────────────────────────────────────

  describe('deactivate', () => {
    it('should soft-deactivate and audit', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 't1' }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.deactivate('test-firm', 't1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'TEMPLATE_DEACTIVATED' }),
      );
    });
  });
});
