import { UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { AccountingService } from './accounting.service';

describe('AccountingService', () => {
  let service: AccountingService;
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
    service = new AccountingService(mockPrisma, mockAudit);
  });

  describe('createPayment', () => {
    const tenantSlug = 'test-firm';
    const userId = 'user-1';
    const baseDto = {
      invoiceId: 'inv-1',
      amount: 100,
      method: 'BankTransfer',
      paymentDate: '2024-06-01',
    };

    const makeInvoice = (overrides: any = {}) => ({
      id: 'inv-1',
      invoice_number: 'INV-001',
      status: 'Final',
      total_amount: '500.00',
      paid_amount: '200.00',
      ...overrides,
    });

    /**
     * getInvoiceById internally calls 3 queries:
     *   1. SELECT * FROM invoices WHERE id = $1
     *   2. SELECT * FROM invoice_line_items WHERE invoice_id = $1
     *   3. SELECT * FROM payments WHERE invoice_id = $1
     * So we must mock all 3 calls for each getInvoiceById invocation.
     */
    const mockGetInvoice = (invoice: any) => {
      mockPrisma.queryTenant
        .mockResolvedValueOnce([invoice])   // invoices row
        .mockResolvedValueOnce([])           // line_items
        .mockResolvedValueOnce([]);          // payments
    };

    it('should create payment successfully for a Final invoice', async () => {
      mockGetInvoice(makeInvoice());
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.createPayment(tenantSlug, baseDto, userId);

      expect(result).toHaveProperty('id');
      expect(result.invoiceStatus).toBe('Final'); // 200+100 = 300 < 500
      expect(mockPrisma.executeTenant).toHaveBeenCalledTimes(2); // INSERT + UPDATE
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PAYMENT_RECORDED' }),
      );
    });

    it('should auto-transition to Paid when fully paid', async () => {
      const invoice = makeInvoice({ total_amount: '300.00', paid_amount: '200.00' });
      mockGetInvoice(invoice);
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.createPayment(tenantSlug, baseDto, userId);

      expect(result.invoiceStatus).toBe('Paid');
      // Verify UPDATE was called with 'Paid' status
      expect(mockPrisma.executeTenant).toHaveBeenCalledWith(
        tenantSlug,
        expect.stringContaining('UPDATE invoices SET paid_amount'),
        expect.arrayContaining([300, 'Paid', 'inv-1']),
      );
    });

    it('should reject overpayment', async () => {
      const invoice = makeInvoice({ total_amount: '500.00', paid_amount: '450.00' });
      mockGetInvoice(invoice);

      await expect(
        service.createPayment(tenantSlug, baseDto, userId),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should include remaining balance in overpayment error message', async () => {
      const invoice = makeInvoice({ total_amount: '500.00', paid_amount: '450.00' });
      mockGetInvoice(invoice);

      await expect(
        service.createPayment(tenantSlug, baseDto, userId),
      ).rejects.toThrow(/Remaining balance: 50/);
    });

    it('should reject payment on Void invoice', async () => {
      const invoice = makeInvoice({ status: 'Void' });
      mockGetInvoice(invoice);

      await expect(
        service.createPayment(tenantSlug, baseDto, userId),
      ).rejects.toThrow(/void invoice/i);
    });

    it('should reject payment on Draft invoice', async () => {
      const invoice = makeInvoice({ status: 'Draft' });
      mockGetInvoice(invoice);

      await expect(
        service.createPayment(tenantSlug, baseDto, userId),
      ).rejects.toThrow(/finalized/i);
    });

    it('should return existing payment on idempotency key match', async () => {
      const existingPayment = { id: 'pay-existing', amount: 100 };
      mockPrisma.queryTenant.mockResolvedValueOnce([existingPayment]);

      const result = await service.createPayment(
        tenantSlug,
        baseDto,
        userId,
        'idem-key-123',
      );

      expect(result).toEqual(existingPayment);
      expect(mockPrisma.executeTenant).not.toHaveBeenCalled();
    });

    it('should proceed when idempotency key has no match', async () => {
      // First call: idempotency check returns empty
      mockPrisma.queryTenant.mockResolvedValueOnce([]); // idempotency check
      // Then getInvoiceById: 3 queries
      mockGetInvoice(makeInvoice());
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.createPayment(
        tenantSlug,
        baseDto,
        userId,
        'new-idem-key',
      );

      expect(result).toHaveProperty('id');
      expect(mockPrisma.executeTenant).toHaveBeenCalled();
    });

    it('should accept exact remaining amount (no overpayment)', async () => {
      const invoice = makeInvoice({ total_amount: '500.00', paid_amount: '400.00' });
      mockGetInvoice(invoice);
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.createPayment(tenantSlug, baseDto, userId);

      expect(result.invoiceStatus).toBe('Paid'); // 400+100 = 500 = total
    });
  });
});
