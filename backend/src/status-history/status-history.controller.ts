import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { StatusHistoryService } from './status-history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';

@Controller('status-history')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatusHistoryController {
  constructor(private readonly statusHistory: StatusHistoryService) {}

  @Get(':entityType/:entityId')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  getTimeline(
    @CurrentUser() user: any,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.statusHistory.getTimeline(
      user.tenantSlug,
      entityType,
      entityId,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
