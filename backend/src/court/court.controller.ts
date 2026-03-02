import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CourtService } from './court.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { CreateCourtDto, UpdateCourtDto, CreateJudgeDto, UpdateJudgeDto } from './court.dto';

@Controller('courts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourtController {
  constructor(private readonly courtService: CourtService) {}

  // ── Courts ─────────────────────────────────────────────────────

  @Post()
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  createCourt(@CurrentUser() user: any, @Body() dto: CreateCourtDto) {
    return this.courtService.createCourt(user.tenantSlug, dto, user.sub);
  }

  @Get()
  listCourts(
    @CurrentUser() user: any,
    @Query('isActive') isActive?: string,
    @Query('city') city?: string,
    @Query('jurisdictionLevel') jurisdictionLevel?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    return this.courtService.listCourts(user.tenantSlug, active, city, jurisdictionLevel, cursor, limit ? parseInt(limit) : undefined);
  }

  @Get(':id')
  getCourtById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.courtService.getCourtById(user.tenantSlug, id);
  }

  @Patch(':id')
  @Roles('TenantAdmin', 'SystemAdmin')
  updateCourt(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCourtDto) {
    return this.courtService.updateCourt(user.tenantSlug, id, dto, user.sub);
  }

  // ── Judges ─────────────────────────────────────────────────────

  @Post('judges')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  createJudge(@CurrentUser() user: any, @Body() dto: CreateJudgeDto) {
    return this.courtService.createJudge(user.tenantSlug, dto, user.sub);
  }

  @Get('judges')
  listJudges(
    @CurrentUser() user: any,
    @Query('courtId') courtId?: string,
    @Query('isActive') isActive?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    return this.courtService.listJudges(user.tenantSlug, courtId, active, cursor, limit ? parseInt(limit) : undefined);
  }

  @Get('judges/:id')
  getJudgeById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.courtService.getJudgeById(user.tenantSlug, id);
  }

  @Patch('judges/:id')
  @Roles('TenantAdmin', 'SystemAdmin')
  updateJudge(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateJudgeDto) {
    return this.courtService.updateJudge(user.tenantSlug, id, dto, user.sub);
  }
}
