import { Controller, Get, Query, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { StepUpGuard } from '../auth/step-up.guard';
import { Roles, RequireStepUp, CurrentUser } from '../common/decorators';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // --- Operational ---
  @Get('cases-by-state')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  casesByState(@CurrentUser() user: any, @Query('caseTypeId') caseTypeId?: string, @Query('assignedLawyerUserId') lawyer?: string) {
    return this.reportService.casesByState(user.tenantSlug, { caseTypeId, assignedLawyerUserId: lawyer });
  }

  @Get('cases-by-type')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  casesByType(@CurrentUser() user: any) {
    return this.reportService.casesByType(user.tenantSlug);
  }

  @Get('cases-by-owner')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  casesByOwner(@CurrentUser() user: any) {
    return this.reportService.casesByOwner(user.tenantSlug);
  }

  @Get('overdue-tasks')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  overdueTasks(@CurrentUser() user: any, @Query('assigneeUserId') assignee?: string, @Query('caseId') caseId?: string, @Query('priority') priority?: string) {
    return this.reportService.overdueTasks(user.tenantSlug, { assigneeUserId: assignee, caseId, priority });
  }

  @Get('upcoming-sessions')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  upcomingSessions(@CurrentUser() user: any, @Query('days') days?: string, @Query('caseId') caseId?: string, @Query('userId') userId?: string) {
    return this.reportService.upcomingSessions(user.tenantSlug, days ? parseInt(days, 10) : 7, { caseId, userId });
  }

  @Get('completeness-gaps')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  completenessGaps(@CurrentUser() user: any, @Query('entityType') entityType?: string, @Query('thresholdPct') threshold?: string) {
    return this.reportService.completenessGaps(user.tenantSlug, entityType || 'customer', threshold ? parseInt(threshold, 10) : 80);
  }

  // --- Financial ---
  @Get('receivables')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  receivables(@CurrentUser() user: any, @Query('customerId') customerId?: string, @Query('status') status?: string) {
    return this.reportService.receivables(user.tenantSlug, { customerId, status });
  }

  @Get('cashflow')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  cashflow(@CurrentUser() user: any, @Query('startMonth') startMonth?: string, @Query('endMonth') endMonth?: string) {
    return this.reportService.cashflow(user.tenantSlug, startMonth, endMonth);
  }

  @Get('expenses-by-category')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  expensesByCategory(@CurrentUser() user: any, @Query('status') status?: string) {
    return this.reportService.expensesByCategory(user.tenantSlug, { status });
  }

  // --- CSV Export ---
  @Get(':reportType/export')
  @Roles('Accountant', 'TenantAdmin', 'SystemAdmin')
  @UseGuards(StepUpGuard)
  @RequireStepUp()
  async exportCsv(
    @CurrentUser() user: any,
    @Param('reportType') reportType: string,
    @Query() filters: any,
    @Res() res: Response,
  ) {
    const csv = await this.reportService.exportCsv(user.tenantSlug, reportType, filters, user.sub);
    res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${reportType}.csv"` });
    res.send(csv);
  }
}
