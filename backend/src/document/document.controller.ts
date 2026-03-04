import { Controller, Post, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { StepUpGuard } from '../auth/step-up.guard';
import { Roles, RequireStepUp, CurrentUser, AuditAction } from '../common/decorators';
import { CreateDocumentDto, CheckinDocumentDto, ShareDocumentDto } from './document.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @AuditAction({ eventType: 'DOCUMENT_CREATED', entityType: 'Document' })
  create(@CurrentUser() user: any, @Body() dto: CreateDocumentDto) {
    return this.documentService.create(user.tenantSlug, user.tenantId, dto, user.sub);
  }

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('caseId') caseId?: string,
    @Query('customerId') customerId?: string,
    @Query('docTypeId') docTypeId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.documentService.list(user.tenantSlug, caseId, customerId, docTypeId, cursor, limit ? parseInt(limit) : undefined);
  }

  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.documentService.getById(user.tenantSlug, id, user.sub, !!user.stepUp);
  }

  @Get(':id/download')
  download(@CurrentUser() user: any, @Param('id') id: string, @Query('versionId') versionId?: string) {
    return this.documentService.download(user.tenantSlug, id, versionId || null, user.sub, !!user.stepUp);
  }

  @Post(':id/checkout')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  checkout(@CurrentUser() user: any, @Param('id') id: string) {
    return this.documentService.checkout(user.tenantSlug, id, user.sub);
  }

  @Post(':id/checkin')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  checkin(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CheckinDocumentDto) {
    return this.documentService.checkin(user.tenantSlug, user.tenantId, id, dto, user.sub);
  }

  @Post(':id/break-lock')
  @Roles('TenantAdmin', 'SystemAdmin')
  @UseGuards(StepUpGuard)
  @RequireStepUp()
  breakLock(@CurrentUser() user: any, @Param('id') id: string) {
    return this.documentService.breakLock(user.tenantSlug, id, user.sub);
  }

  @Post(':id/share')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  share(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ShareDocumentDto) {
    return this.documentService.shareDocument(user.tenantSlug, id, dto, user.sub);
  }

  @Post(':id/legal-hold')
  @Roles('TenantAdmin', 'SystemAdmin')
  @UseGuards(StepUpGuard)
  @RequireStepUp()
  setLegalHold(@CurrentUser() user: any, @Param('id') id: string) {
    return this.documentService.setLegalHold(user.tenantSlug, id, user.sub);
  }

  @Delete(':id/legal-hold')
  @Roles('TenantAdmin', 'SystemAdmin')
  @UseGuards(StepUpGuard)
  @RequireStepUp()
  removeLegalHold(@CurrentUser() user: any, @Param('id') id: string) {
    return this.documentService.removeLegalHold(user.tenantSlug, id, user.sub);
  }

  @Delete(':id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  softDelete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.documentService.softDelete(user.tenantSlug, id, user.sub);
  }

  @Post(':id/restore')
  @Roles('TenantAdmin', 'SystemAdmin')
  restore(@CurrentUser() user: any, @Param('id') id: string) {
    return this.documentService.restore(user.tenantSlug, id, user.sub);
  }

  /* ── Case-level legal hold ── */

  @Post('cases/:caseId/legal-hold')
  @Roles('TenantAdmin', 'SystemAdmin')
  @UseGuards(StepUpGuard)
  @RequireStepUp()
  setCaseLegalHold(@CurrentUser() user: any, @Param('caseId') caseId: string) {
    return this.documentService.setCaseLegalHold(user.tenantSlug, caseId, user.sub);
  }

  @Delete('cases/:caseId/legal-hold')
  @Roles('TenantAdmin', 'SystemAdmin')
  @UseGuards(StepUpGuard)
  @RequireStepUp()
  removeCaseLegalHold(@CurrentUser() user: any, @Param('caseId') caseId: string) {
    return this.documentService.removeCaseLegalHold(user.tenantSlug, caseId, user.sub);
  }
}
