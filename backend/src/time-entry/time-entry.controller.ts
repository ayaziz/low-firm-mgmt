import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';
import { CurrentUser } from '../common/decorators';
import { TimeEntryService } from './time-entry.service';
import { CreateTimeEntryDto, UpdateTimeEntryDto, TransitionTimeEntryDto } from './time-entry.dto';

@Controller('time-entries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeEntryController {
  constructor(private readonly timeEntryService: TimeEntryService) {}

  @Post()
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: any, @Body() dto: CreateTimeEntryDto) {
    const data = await this.timeEntryService.create(user.tenantSlug, dto, user.sub);
    return { success: true, data };
  }

  @Get()
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async list(
    @CurrentUser() user: any,
    @Query('caseId') caseId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.timeEntryService.list(
      user.tenantSlug, caseId, userId, status, startDate, endDate, cursor, limit ? parseInt(limit, 10) : 20,
    );
    return { success: true, ...data };
  }

  @Get('summary')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async summary(
    @CurrentUser() user: any,
    @Query('caseId') caseId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.timeEntryService.summary(user.tenantSlug, caseId, userId, startDate, endDate);
    return { success: true, data };
  }

  @Get('my')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async myEntries(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.timeEntryService.list(
      user.tenantSlug, undefined, user.sub, status, startDate, endDate, cursor, limit ? parseInt(limit, 10) : 20,
    );
    return { success: true, ...data };
  }

  @Get(':id')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async getById(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.timeEntryService.getById(user.tenantSlug, id);
    return { success: true, data };
  }

  @Patch(':id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateTimeEntryDto) {
    const data = await this.timeEntryService.update(user.tenantSlug, id, dto, user.sub);
    return { success: true, data };
  }

  @Post(':id/transition')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.OK)
  async transition(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: TransitionTimeEntryDto) {
    const data = await this.timeEntryService.transition(user.tenantSlug, id, dto, user.sub, user.roles);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.timeEntryService.delete(user.tenantSlug, id, user.sub);
    return { success: true, data };
  }
}
