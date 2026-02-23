import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('TenantAdmin', 'SystemAdmin')
  async getAuditEvents(
    @Request() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getByTenant(
      req.user.tenantSlug,
      cursor,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('entity')
  async getEntityAuditEvents(
    @Request() req: any,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getByEntity(
      req.user.tenantSlug,
      entityType,
      entityId,
      cursor,
      limit ? parseInt(limit) : 20,
    );
  }
}
