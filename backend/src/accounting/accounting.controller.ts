import { Controller, Post, Get, Patch, Param, Body, Query, Headers, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { StepUpGuard } from '../auth/step-up.guard';
import { Roles, RequireStepUp, CurrentUser } from '../common/decorators';
import {
  CreateInvoiceDto, VoidInvoiceDto,
  CreatePaymentDto, CreateExpenseDto,
  ApproveExpenseDto, RejectExpenseDto, CreateWageDto,
  UpdateWageDto, UpdateExpenseDto, UpdateInvoiceDto, UpdatePaymentDto,
  WageActionDto, RejectWageDto,
  InvoiceReviewActionDto, RejectInvoiceReviewDto,
} from './accounting.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // --- Invoices ---
  @Post('invoices')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  createInvoice(@CurrentUser() user: any, @Body() dto: CreateInvoiceDto) {
    return this.accountingService.createInvoice(user.tenantSlug, dto, user.sub, user.roles || []);
  }

  @Get('invoices')
  listInvoices(
    @CurrentUser() user: any,
    @Query('caseId') caseId?: string, @Query('customerId') customerId?: string,
    @Query('status') status?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string,
  ) {
    return this.accountingService.listInvoices(user.tenantSlug, caseId, customerId, status, cursor, limit ? parseInt(limit) : undefined);
  }

  @Get('invoices/:id')
  getInvoice(@CurrentUser() user: any, @Param('id') id: string) {
    return this.accountingService.getInvoiceById(user.tenantSlug, id);
  }

  @Post('invoices/:id/finalize')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  finalizeInvoice(@CurrentUser() user: any, @Param('id') id: string) {
    return this.accountingService.finalizeInvoice(user.tenantSlug, id, user.sub);
  }

  @Post('invoices/:id/send')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  sendInvoice(@CurrentUser() user: any, @Param('id') id: string) {
    return this.accountingService.markInvoiceSent(user.tenantSlug, id, user.sub);
  }

  @Post('invoices/:id/void')
  @Roles('TenantAdmin', 'SystemAdmin')
  voidInvoice(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: VoidInvoiceDto) {
    return this.accountingService.voidInvoice(user.tenantSlug, id, dto, user.sub);
  }

  @Post('invoices/:id/submit-for-review')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  submitInvoiceForReview(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: InvoiceReviewActionDto) {
    return this.accountingService.submitInvoiceForReview(user.tenantSlug, id, dto, user.sub);
  }

  @Post('invoices/:id/approve-review')
  @Roles('TenantAdmin', 'SystemAdmin')
  approveInvoiceReview(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: InvoiceReviewActionDto) {
    return this.accountingService.approveInvoiceReview(user.tenantSlug, id, dto, user.sub);
  }

  @Post('invoices/:id/reject-review')
  @Roles('TenantAdmin', 'SystemAdmin')
  rejectInvoiceReview(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RejectInvoiceReviewDto) {
    return this.accountingService.rejectInvoiceReview(user.tenantSlug, id, dto, user.sub);
  }

  @Get('invoices/:id/pdf')
  async downloadInvoicePdf(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.accountingService.generateInvoicePdf(user.tenantSlug, id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="invoice-${id}.pdf"` });
    res.send(pdfBuffer);
  }

  // --- Payments ---
  @Post('payments')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  createPayment(@CurrentUser() user: any, @Body() dto: CreatePaymentDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.accountingService.createPayment(user.tenantSlug, dto, user.sub, idempotencyKey);
  }

  // --- Expenses ---
  @Post('expenses')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  createExpense(@CurrentUser() user: any, @Body() dto: CreateExpenseDto) {
    return this.accountingService.createExpense(user.tenantSlug, dto, user.sub);
  }

  @Get('expenses')
  listExpenses(
    @CurrentUser() user: any,
    @Query('caseId') caseId?: string, @Query('status') status?: string,
    @Query('cursor') cursor?: string, @Query('limit') limit?: string,
  ) {
    return this.accountingService.listExpenses(user.tenantSlug, caseId, status, cursor, limit ? parseInt(limit) : undefined);
  }

  @Post('expenses/:id/approve')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  approveExpense(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ApproveExpenseDto) {
    return this.accountingService.approveExpense(user.tenantSlug, id, dto, user.sub, user.roles || []);
  }

  @Post('expenses/:id/reject')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  rejectExpense(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RejectExpenseDto) {
    return this.accountingService.rejectExpense(user.tenantSlug, id, dto, user.sub);
  }

  // --- Wages ---
  @Post('wages')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  createWage(@CurrentUser() user: any, @Body() dto: CreateWageDto) {
    return this.accountingService.createWage(user.tenantSlug, dto, user.sub);
  }

  @Get('wages')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  listWages(@CurrentUser() user: any, @Query('userId') userIdFilter?: string, @Query('period') period?: string) {
    return this.accountingService.listWages(user.tenantSlug, userIdFilter, period);
  }

  @Get('wages/export')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  @UseGuards(StepUpGuard)
  @RequireStepUp()
  async exportWagesCsv(@CurrentUser() user: any, @Query('period') period: string, @Res() res: Response) {
    const csv = await this.accountingService.exportWagesCsv(user.tenantSlug, period);
    res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="wages-${period || 'all'}.csv"` });
    res.send(csv);
  }

  @Post('wages/:id/submit')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  submitWage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: WageActionDto) {
    return this.accountingService.submitWage(user.tenantSlug, id, dto, user.sub);
  }

  @Post('wages/:id/approve')
  @Roles('TenantAdmin', 'SystemAdmin')
  approveWage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: WageActionDto) {
    return this.accountingService.approveWage(user.tenantSlug, id, dto, user.sub);
  }

  @Post('wages/:id/reject')
  @Roles('TenantAdmin', 'SystemAdmin')
  rejectWage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RejectWageDto) {
    return this.accountingService.rejectWage(user.tenantSlug, id, dto, user.sub);
  }

  @Post('wages/:id/mark-paid')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  markWagePaid(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: WageActionDto) {
    return this.accountingService.markWagePaid(user.tenantSlug, id, dto, user.sub);
  }

  // --- Update routes ---
  @Patch('wages/:id')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  updateWage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateWageDto) {
    return this.accountingService.updateWage(user.tenantSlug, id, dto, user.sub);
  }

  @Patch('expenses/:id')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  updateExpense(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.accountingService.updateExpense(user.tenantSlug, id, dto, user.sub);
  }

  @Patch('invoices/:id')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  updateInvoice(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.accountingService.updateInvoice(user.tenantSlug, id, dto, user.sub);
  }

  @Patch('payments/:id')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  updatePayment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.accountingService.updatePayment(user.tenantSlug, id, dto, user.sub);
  }
}
