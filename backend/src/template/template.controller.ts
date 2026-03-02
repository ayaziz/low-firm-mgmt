import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { JwtPayload } from '../common/types';
import { TemplateService } from './template.service';
import { CreateTemplateDto, UpdateTemplateDto, RenderTemplateDto } from './template.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplateController {
  constructor(private readonly service: TemplateService) {}

  @Post()
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTemplateDto) {
    return this.service.create(user.tenantSlug, dto, user.sub);
  }

  @Get()
  @Roles('Lawyer', 'TenantAdmin', 'Accountant', 'SystemAdmin')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('category') category?: string,
    @Query('is_active') is_active?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(user.tenantSlug, {
      category,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      search,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Roles('Lawyer', 'TenantAdmin', 'Accountant', 'SystemAdmin')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getById(user.tenantSlug, id);
  }

  @Patch(':id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.service.update(user.tenantSlug, id, dto, user.sub);
  }

  @Post('render')
  @Roles('Lawyer', 'TenantAdmin', 'Accountant', 'SystemAdmin')
  render(@CurrentUser() user: JwtPayload, @Body() dto: RenderTemplateDto) {
    return this.service.render(user.tenantSlug, dto);
  }

  @Post('generate')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  generate(@CurrentUser() user: JwtPayload, @Body() dto: RenderTemplateDto) {
    return this.service.generate(user.tenantSlug, dto, user.sub);
  }

  @Delete(':id')
  @Roles('TenantAdmin', 'SystemAdmin')
  deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.deactivate(user.tenantSlug, id, user.sub);
  }
}
