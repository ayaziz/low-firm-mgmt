import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import {
  CreateUserDto, UpdateUserDto,
  CreateMasterDataDto, UpdateMasterDataDto,
  SaveExpenseWorkflowDto, UpdateTenantSettingsDto,
  UpsertRetentionPolicyDto,
} from './admin.dto';
import { CreateCourtDto, UpdateCourtDto } from '../court/court.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TenantAdmin', 'SystemAdmin')
export class AdminController {
	constructor(private readonly adminService: AdminService) {}

	// --- Users ---
	@Post('users')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	createUser(@CurrentUser() user: any, @Body() dto: CreateUserDto) {
		return this.adminService.createUser(user.tenantSlug, dto, user.sub)
	}

	@Get('users')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	listUsers(@CurrentUser() user: any) {
		return this.adminService.listUsers(user.tenantSlug)
	}

	@Patch('users/:userId')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	updateUser(
		@CurrentUser() user: any,
		@Param('userId') userId: string,
		@Body() dto: UpdateUserDto,
	) {
		return this.adminService.updateUser(user.tenantSlug, userId, dto, user.sub)
	}

	// --- Master Data ---
	@Get('master-data/:category')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	listMasterData(
		@CurrentUser() user: any,
		@Param('category') category: string,
	) {
		return this.adminService.listMasterData(user.tenantSlug, category)
	}

	@Post('master-data/:category')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	createMasterData(
		@CurrentUser() user: any,
		@Param('category') category: string,
		@Body() dto: CreateMasterDataDto,
	) {
		return this.adminService.createMasterData(
			user.tenantSlug,
			category,
			dto,
			user.sub,
		)
	}

	@Patch('master-data/:category/:id')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	updateMasterData(
		@CurrentUser() user: any,
		@Param('category') category: string,
		@Param('id') id: string,
		@Body() dto: UpdateMasterDataDto,
	) {
		return this.adminService.updateMasterData(
			user.tenantSlug,
			category,
			id,
			dto,
			user.sub,
		)
	}

	// --- Case Types ---
	@Get('case-types')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	listCaseTypes(@CurrentUser() user: any) {
		return this.adminService.listCaseTypes(user.tenantSlug)
	}

	@Post('case-types')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	createCaseType(@CurrentUser() user: any, @Body() body: any) {
		return this.adminService.createCaseType(user.tenantSlug, body, user.sub)
	}

	@Patch('case-types/:id')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	updateCaseType(
		@CurrentUser() user: any,
		@Param('id') id: string,
		@Body() body: any,
	) {
		return this.adminService.updateCaseType(user.tenantSlug, id, body, user.sub)
	}

	// --- Expense Approval Workflow ---
	@Get('expense-approval-workflow')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	getExpenseWorkflow(@CurrentUser() user: any) {
		return this.adminService.getExpenseWorkflow(user.tenantSlug)
	}

	@Post('expense-approval-workflow')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	saveExpenseWorkflow(
		@CurrentUser() user: any,
		@Body() dto: SaveExpenseWorkflowDto,
	) {
		return this.adminService.saveExpenseWorkflow(user.tenantSlug, dto, user.sub)
	}

	// --- Tenant Settings ---
	@Get('settings')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	getTenantSettings(@CurrentUser() user: any) {
		return this.adminService.getTenantSettings(user.tenantSlug)
	}

	@Patch('settings')
	@Roles('SystemAdmin', 'TenantAdmin') // Only SystemAdmin can list all users
	updateTenantSettings(
		@CurrentUser() user: any,
		@Body() dto: UpdateTenantSettingsDto,
	) {
		return this.adminService.updateTenantSettings(
			user.tenantSlug,
			dto,
			user.sub,
		)
	}

	// --- Retention Policies ---
	@Get('retention-policies')
	listRetentionPolicies(@CurrentUser() user: any) {
		return this.adminService.listRetentionPolicies(user.tenantSlug);
	}

	@Post('retention-policies')
	upsertRetentionPolicy(@CurrentUser() user: any, @Body() dto: UpsertRetentionPolicyDto) {
		return this.adminService.upsertRetentionPolicy(user.tenantSlug, dto.docTypeCode, dto.retentionDays, dto.description, user.sub);
	}

	// --- Courts ---
	@Get('courts')
	listCourts(@CurrentUser() user: any) {
		return this.adminService.listCourts(user.tenantSlug);
	}

	@Post('courts')
	createCourt(@CurrentUser() user: any, @Body() dto: CreateCourtDto) {
		return this.adminService.createCourt(user.tenantSlug, dto, user.sub);
	}

	@Patch('courts/:id')
	updateCourt(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCourtDto) {
		return this.adminService.updateCourt(user.tenantSlug, id, dto, user.sub);
	}
}
