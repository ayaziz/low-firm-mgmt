import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ExternalShareService } from './external-share.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { IsOptional, IsString, IsDateString, IsInt } from 'class-validator';
import { Request } from 'express';

export class CreateShareLinkDto {
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsInt() maxDownloads?: number;
}

export class AccessShareLinkDto {
  @IsOptional() @IsString() password?: string;
}

@Controller('documents')
export class ExternalShareController {
  constructor(private readonly shareService: ExternalShareService) {}

  // ── Authenticated endpoints ──

  @Post(':docId/share-links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  createShareLink(
    @CurrentUser() user: any,
    @Param('docId') docId: string,
    @Body() dto: CreateShareLinkDto,
  ) {
    return this.shareService.createShareLink(user.tenantSlug, docId, user.sub, dto);
  }

  @Get(':docId/share-links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  listShareLinks(
    @CurrentUser() user: any,
    @Param('docId') docId: string,
  ) {
    return this.shareService.listShareLinks(user.tenantSlug, docId);
  }

  @Delete('share-links/:linkId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  revokeShareLink(
    @CurrentUser() user: any,
    @Param('linkId') linkId: string,
  ) {
    return this.shareService.revokeShareLink(user.tenantSlug, linkId, user.sub);
  }

  // ── Public access endpoint (no auth) ──
  // NOTE: In production, external share access goes through a different
  // route prefix that knows the tenant from the token.
  // For now, tenant slug is derived from query param.

  @Post('share-links/:token/access')
  async accessShareLink(
    @Param('token') token: string,
    @Query('tenant') tenantSlug: string,
    @Body() dto: AccessShareLinkDto,
    @Req() req: Request,
  ) {
    return this.shareService.accessShareLink(
      tenantSlug,
      token,
      dto.password,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
