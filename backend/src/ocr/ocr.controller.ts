import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';

@Controller('ocr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('documents/:docId/versions/:versionId/trigger')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  triggerOcr(
    @CurrentUser() user: any,
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.ocrService.triggerOcr(user.tenantSlug, docId, versionId);
  }

  @Get('documents/:docId')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  getOcrText(
    @CurrentUser() user: any,
    @Param('docId') docId: string,
    @Query('versionId') versionId?: string,
  ) {
    return this.ocrService.getOcrText(user.tenantSlug, docId, versionId);
  }

  @Get('search')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  searchOcr(
    @CurrentUser() user: any,
    @Query('q') query: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ocrService.searchOcr(
      user.tenantSlug,
      query,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
