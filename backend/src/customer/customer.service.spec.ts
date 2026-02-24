import { CustomerService } from './customer.service';

describe('CustomerService', () => {
  let service: CustomerService;
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
    service = new CustomerService(mockPrisma, mockAudit);
  });

  // ── Customer Communications (FR-CASE-16) ──

  describe('createCommunication', () => {
    const tenantSlug = 'test-firm';
    const customerId = 'cust-1';
    const userId = 'user-1';

    const mockCustomer = {
      id: customerId,
      full_name: 'Test Customer',
      customer_type: 'Individual',
      is_deleted: false,
    };

    const validDto = {
      typeId: 'type-email',
      dateTime: '2024-06-15T10:00:00Z',
      direction: 'Outbound',
      summary: 'Follow-up email sent',
      visibilityScope: 'LegalOnly',
    };

    it('should create a communication for a customer', async () => {
      // getById queries: customer row, contacts, addresses
      mockPrisma.queryTenant
        .mockResolvedValueOnce([mockCustomer])
        .mockResolvedValueOnce([])  // contacts
        .mockResolvedValueOnce([]); // addresses
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.createCommunication(tenantSlug, customerId, validDto as any, userId);

      expect(result).toHaveProperty('id');
      expect(mockPrisma.executeTenant).toHaveBeenCalledWith(
        tenantSlug,
        expect.stringContaining('INSERT INTO communications'),
        expect.arrayContaining([customerId]),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'COMM_CREATED' }),
      );
    });

    it('should throw when customer does not exist', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]); // no customer

      await expect(
        service.createCommunication(tenantSlug, 'missing', validDto as any, userId),
      ).rejects.toThrow(); // NotFoundException from getById
    });
  });

  describe('listCommunications', () => {
    it('should list communications for a customer', async () => {
      const comms = [
        { id: 'c1', customer_id: 'cust-1', summary: 'Call', date_time: '2024-06-15' },
        { id: 'c2', customer_id: 'cust-1', summary: 'Email', date_time: '2024-06-14' },
      ];
      mockPrisma.queryTenant.mockResolvedValueOnce(comms);

      const result = await service.listCommunications('test-firm', 'cust-1');
      expect(result).toEqual(comms);
      expect(mockPrisma.queryTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.stringContaining('customer_id'),
        ['cust-1'],
      );
    });

    it('should return empty array when no communications', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      const result = await service.listCommunications('test-firm', 'cust-no-comms');
      expect(result).toEqual([]);
    });
  });
});
