import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';
import { CurrentUser } from '../common/decorators';
import { HearingService } from './hearing.service';
import { CreateHearingDto, UpdateHearingDto, TransitionHearingDto } from './hearing.dto';

@Controller('hearings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HearingController {
  constructor(private readonly hearingService: HearingService) {}

  @Post()
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: any, @Body() dto: CreateHearingDto) {
    const data = await this.hearingService.create(user.tenantSlug, dto, user.sub);
    return { success: true, data };
  }

  @Get()
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async list(
    @CurrentUser() user: any,
    @Query('caseId') caseId?: string,
    @Query('status') status?: string,
    @Query('courtId') courtId?: string,
    @Query('judgeId') judgeId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.hearingService.list(
      user.tenantSlug, caseId, status, courtId, judgeId, cursor, limit ? parseInt(limit, 10) : 20,
    );
    return { success: true, ...data };
  }

  @Get(':id')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async getById(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.hearingService.getById(user.tenantSlug, id);
    return { success: true, data };
  }

  @Patch(':id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateHearingDto) {
    const data = await this.hearingService.update(user.tenantSlug, id, dto, user.sub);
    return { success: true, data };
  }

  @Post(':id/transition')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.OK)
  async transition(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: TransitionHearingDto) {
    const data = await this.hearingService.transition(user.tenantSlug, id, dto, user.sub);
    return { success: true, data };
  }
}
