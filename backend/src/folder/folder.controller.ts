import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuditAction } from '../common/decorators';
import { FolderService } from './folder.service';
import { CreateFolderDto, UpdateFolderDto, MoveFolderDto, MoveDocumentToFolderDto } from './folder.dto';

@Controller('folders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @AuditAction({ eventType: 'FOLDER_CREATED', entityType: 'Folder' })
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: any, @Body() dto: CreateFolderDto) {
    const data = await this.folderService.create(user.tenantSlug, dto, user.sub);
    return { success: true, data };
  }

  @Get('scope/:scopeType/:scopeId')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async listByScope(
    @CurrentUser() user: any,
    @Param('scopeType') scopeType: string,
    @Param('scopeId') scopeId: string,
  ) {
    const data = await this.folderService.listByScope(user.tenantSlug, scopeType, scopeId);
    return { success: true, data };
  }

  /** Backward-compatible route */
  @Get('case/:caseId')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async listByCase(@CurrentUser() user: any, @Param('caseId') caseId: string) {
    const data = await this.folderService.listByCase(user.tenantSlug, caseId);
    return { success: true, data };
  }

  @Get('scope/:scopeType/:scopeId/tree')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async getTree(
    @CurrentUser() user: any,
    @Param('scopeType') scopeType: string,
    @Param('scopeId') scopeId: string,
  ) {
    const data = await this.folderService.getTree(user.tenantSlug, scopeType, scopeId);
    return { success: true, data };
  }

  /** Backward-compatible route */
  @Get('case/:caseId/tree')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async getCaseTree(@CurrentUser() user: any, @Param('caseId') caseId: string) {
    const data = await this.folderService.getTree(user.tenantSlug, 'case', caseId);
    return { success: true, data };
  }

  @Get(':id')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async getById(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.folderService.getById(user.tenantSlug, id);
    return { success: true, data };
  }

  @Get(':id/documents')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async getDocuments(
    @CurrentUser() user: any, @Param('id') id: string,
    @Query('cursor') cursor?: string, @Query('limit') limit?: string,
  ) {
    const result = await this.folderService.getDocuments(
      user.tenantSlug, id, cursor, limit ? parseInt(limit, 10) : 20,
    );
    return { success: true, ...result };
  }

  @Patch(':id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateFolderDto) {
    const data = await this.folderService.update(user.tenantSlug, id, dto, user.sub);
    return { success: true, data };
  }

  @Post(':id/move')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async move(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: MoveFolderDto) {
    const data = await this.folderService.move(user.tenantSlug, id, dto, user.sub);
    return { success: true, data };
  }

  @Post('move-document')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async moveDocument(@CurrentUser() user: any, @Body() dto: MoveDocumentToFolderDto) {
    const data = await this.folderService.moveDocument(user.tenantSlug, dto, user.sub);
    return { success: true, data };
  }

  @Post('case/:caseId/defaults')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.CREATED)
  async createDefaults(@CurrentUser() user: any, @Param('caseId') caseId: string) {
    await this.folderService.createDefaultFolders(user.tenantSlug, caseId, user.sub);
    const data = await this.folderService.listByCase(user.tenantSlug, caseId);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.folderService.delete(user.tenantSlug, id, user.sub);
    return { success: true, data };
  }
}
