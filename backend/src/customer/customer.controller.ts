import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto, CreateContactDto, CreateCustomerCommunicationDto } from './customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, AuditAction } from '../common/decorators';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @AuditAction({ eventType: 'CUSTOMER_CREATED', entityType: 'Customer' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() dto: CreateCustomerDto) {
    return this.customerService.create(req.user.tenantSlug, dto, req.user.id);
  }

  @Get()
  async list(
    @Request() req: any,
    @Query('query') query?: string,
    @Query('customerType') customerType?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customerService.list(
      req.user.tenantSlug,
      query,
      customerType,
      status,
      cursor,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':customerId')
  async getById(@Request() req: any, @Param('customerId') customerId: string) {
    return this.customerService.getById(req.user.tenantSlug, customerId);
  }

  @Patch(':customerId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @AuditAction({ eventType: 'CUSTOMER_UPDATED', entityType: 'Customer', entityIdParam: 'customerId' })
  async update(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerService.update(req.user.tenantSlug, customerId, dto, req.user.id);
  }

  @Post(':customerId/contacts')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.CREATED)
  async addContact(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.customerService.addContact(req.user.tenantSlug, customerId, dto, req.user.id);
  }

  @Patch(':customerId/contacts/:contactId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async updateContact(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Param('contactId') contactId: string,
    @Body() dto: Partial<CreateContactDto>,
  ) {
    await this.customerService.updateContact(req.user.tenantSlug, customerId, contactId, dto, req.user.id);
    return { success: true };
  }

  @Delete(':customerId/contacts/:contactId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async deleteContact(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Param('contactId') contactId: string,
  ) {
    await this.customerService.deleteContact(req.user.tenantSlug, customerId, contactId, req.user.id);
    return { success: true };
  }

  @Post(':customerId/addresses')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.CREATED)
  async addAddress(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Body() dto: any,
  ) {
    return this.customerService.addAddress(req.user.tenantSlug, customerId, dto, req.user.id);
  }

  @Patch(':customerId/addresses/:addressId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async updateAddress(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
    @Body() dto: any,
  ) {
    await this.customerService.updateAddress(req.user.tenantSlug, customerId, addressId, dto, req.user.id);
    return { success: true };
  }

  @Delete(':customerId/addresses/:addressId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async deleteAddress(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
  ) {
    await this.customerService.deleteAddress(req.user.tenantSlug, customerId, addressId, req.user.id);
    return { success: true };
  }

  @Get(':customerId/financial-summary')
  async getFinancialSummary(
    @Request() req: any,
    @Param('customerId') customerId: string,
  ) {
    return this.customerService.getFinancialSummary(req.user.tenantSlug, customerId);
  }

  @Get(':customerId/compliance-checklist')
  async getComplianceChecklist(
    @Request() req: any,
    @Param('customerId') customerId: string,
  ) {
    return this.customerService.getComplianceChecklist(req.user.tenantSlug, customerId);
  }

  @Patch(':customerId/compliance-checklist/:itemId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async updateChecklistItem(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Param('itemId') itemId: string,
    @Body() body: { isMet: boolean },
  ) {
    return this.customerService.updateChecklistItemStatus(
      req.user.tenantSlug,
      customerId,
      itemId,
      !!body.isMet,
      req.user.id,
    );
  }

  @Post(':customerId/communications')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.CREATED)
  async createCommunication(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Body() dto: CreateCustomerCommunicationDto,
  ) {
    return this.customerService.createCommunication(req.user.tenantSlug, customerId, dto, req.user.id);
  }

  @Get(':customerId/communications')
  async listCommunications(
    @Request() req: any,
    @Param('customerId') customerId: string,
  ) {
    return this.customerService.listCommunications(req.user.tenantSlug, customerId);
  }
}
