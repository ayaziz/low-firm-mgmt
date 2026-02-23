import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import {
  CreateUserDto, UpdateUserDto,
  CreateMasterDataDto, UpdateMasterDataDto,
  SaveExpenseWorkflowDto, UpdateTenantSettingsDto,
} from './admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TenantAdmin', 'SystemAdmin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Users ---
  @Post('users')
  createUser(@CurrentUser() user: any, @Body() dto: CreateUserDto) {
    return this.adminService.createUser(user.tenantSlug, dto, user.sub);
  }

  @Get('users')
  listUsers(@CurrentUser() user: any) {
    return this.adminService.listUsers(user.tenantSlug);
  }

  @Patch('users/:userId')
  updateUser(@CurrentUser() user: any, @Param('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(user.tenantSlug, userId, dto, user.sub);
  }

  // --- Master Data ---
  @Get('master-data/:category')
  listMasterData(@CurrentUser() user: any, @Param('category') category: string) {
    return this.adminService.listMasterData(user.tenantSlug, category);
  }

  @Post('master-data/:category')
  createMasterData(@CurrentUser() user: any, @Param('category') category: string, @Body() dto: CreateMasterDataDto) {
    return this.adminService.createMasterData(user.tenantSlug, category, dto, user.sub);
  }

  @Patch('master-data/:category/:id')
  updateMasterData(@CurrentUser() user: any, @Param('category') category: string, @Param('id') id: string, @Body() dto: UpdateMasterDataDto) {
    return this.adminService.updateMasterData(user.tenantSlug, category, id, dto, user.sub);
  }

  // --- Case Types ---
  @Get('case-types')
  listCaseTypes(@CurrentUser() user: any) {
    return this.adminService.listCaseTypes(user.tenantSlug);
  }

  @Post('case-types')
  createCaseType(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.createCaseType(user.tenantSlug, body, user.sub);
  }

  @Patch('case-types/:id')
  updateCaseType(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateCaseType(user.tenantSlug, id, body, user.sub);
  }

  // --- Expense Approval Workflow ---
  @Get('expense-approval-workflow')
  getExpenseWorkflow(@CurrentUser() user: any) {
    return this.adminService.getExpenseWorkflow(user.tenantSlug);
  }

  @Post('expense-approval-workflow')
  saveExpenseWorkflow(@CurrentUser() user: any, @Body() dto: SaveExpenseWorkflowDto) {
    return this.adminService.saveExpenseWorkflow(user.tenantSlug, dto, user.sub);
  }

  // --- Tenant Settings ---
  @Get('settings')
  getTenantSettings(@CurrentUser() user: any) {
    return this.adminService.getTenantSettings(user.tenantSlug);
  }

  @Patch('settings')
  updateTenantSettings(@CurrentUser() user: any, @Body() dto: UpdateTenantSettingsDto) {
    return this.adminService.updateTenantSettings(user.tenantSlug, dto, user.sub);
  }
}
