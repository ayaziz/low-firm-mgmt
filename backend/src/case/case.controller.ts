import { Controller, Post, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CaseService } from './case.service';
import { CompletenessService } from './completeness.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuditAction } from '../common/decorators';
import {
  CreateCaseDto, TransitionCaseDto, SetOnHoldDto, ReopenCaseDto,
  CreateMembershipDto, AddCaseCustomerDto, CreateTaskDto, UpdateTaskDto,
  CreateSessionDto, UpdateSessionDto, RescheduleSessionDto,
  CreateNoteDto, UpdateNoteDto, CreateFilingDto, UpdateFilingDto,
  CreateCommunicationDto, UpdateCommunicationDto, AddCasePartyDto,
  UpdateCasePartyDto,
} from './case.dto';

@Controller('cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CaseController {
  constructor(
    private readonly caseService: CaseService,
    private readonly completenessService: CompletenessService,
  ) {}

  @Post()
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @AuditAction({ eventType: 'CASE_CREATED', entityType: 'Case' })
  create(@CurrentUser() user: any, @Body() dto: CreateCaseDto) {
    return this.caseService.create(user.tenantSlug, dto, user.sub);
  }

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('state') state?: string,
    @Query('caseTypeId') caseTypeId?: string,
    @Query('assignedLawyer') assignedLawyer?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.caseService.list(user.tenantSlug, state, caseTypeId, assignedLawyer, cursor, limit ? parseInt(limit) : undefined);
  }

  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.getById(user.tenantSlug, id);
  }

  @Post(':id/transition')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @AuditAction({ eventType: 'CASE_TRANSITIONED', entityType: 'Case', entityIdParam: 'id' })
  transition(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: TransitionCaseDto) {
    return this.caseService.transition(user.tenantSlug, id, dto, user.sub);
  }

  @Post(':id/on-hold')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  setOnHold(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SetOnHoldDto) {
    return this.caseService.setOnHold(user.tenantSlug, id, dto, user.sub);
  }

  @Delete(':id/on-hold')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  clearOnHold(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.clearOnHold(user.tenantSlug, id, user.sub);
  }

  @Post(':id/reopen')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  reopen(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReopenCaseDto) {
    return this.caseService.reopen(user.tenantSlug, id, dto, user.sub);
  }

  @Get(':id/completeness')
  completeness(@CurrentUser() user: any, @Param('id') id: string) {
    return this.completenessService.calculate(user.tenantSlug, id);
  }

  // --- Memberships ---
  @Post(':id/memberships')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  addMembership(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateMembershipDto) {
    return this.caseService.addMembership(user.tenantSlug, id, dto, user.sub);
  }

  @Get(':id/memberships')
  listMemberships(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.listMemberships(user.tenantSlug, id);
  }

  @Delete(':id/memberships/:userId')
  @Roles('TenantAdmin', 'SystemAdmin')
  removeMembership(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') membershipUserId: string) {
    return this.caseService.removeMembershipByUser(user.tenantSlug, id, membershipUserId, user.sub);
  }

  @Patch(':id/memberships/:membershipId')
  @Roles('TenantAdmin', 'SystemAdmin')
  updateMembership(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() body: { role: string },
  ) {
    return this.caseService.updateMembership(user.tenantSlug, id, membershipId, body.role, user.sub);
  }

  // --- Case Customers ---
  @Post(':id/customers')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  addCaseCustomer(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AddCaseCustomerDto) {
    return this.caseService.addCaseCustomer(user.tenantSlug, id, dto, user.sub);
  }

  // --- Tasks ---
  @Post(':id/tasks')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  createTask(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateTaskDto) {
    return this.caseService.createTask(user.tenantSlug, id, dto, user.sub);
  }

  @Patch(':id/tasks/:taskId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  updateTask(@CurrentUser() user: any, @Param('id') id: string, @Param('taskId') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.caseService.updateTask(user.tenantSlug, id, taskId, dto, user.sub);
  }

  @Get(':id/tasks')
  listTasks(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.listTasks(user.tenantSlug, id);
  }

  // --- Sessions ---
  @Post(':id/sessions')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  createSession(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateSessionDto) {
    return this.caseService.createSession(user.tenantSlug, id, dto, user.sub);
  }

  @Patch(':id/sessions/:sessionId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  updateSession(@CurrentUser() user: any, @Param('id') id: string, @Param('sessionId') sessionId: string, @Body() dto: UpdateSessionDto) {
    return this.caseService.updateSession(user.tenantSlug, id, sessionId, dto, user.sub);
  }

  @Post(':id/sessions/:sessionId/reschedule')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  rescheduleSession(@CurrentUser() user: any, @Param('id') id: string, @Param('sessionId') sessionId: string, @Body() dto: RescheduleSessionDto) {
    return this.caseService.rescheduleSession(user.tenantSlug, id, sessionId, dto, user.sub);
  }

  @Get(':id/sessions')
  listSessions(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.listSessions(user.tenantSlug, id);
  }

  // --- Notes ---
  @Post(':id/notes')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  createNote(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateNoteDto) {
    return this.caseService.createNote(user.tenantSlug, id, dto, user.sub);
  }

  @Get(':id/notes')
  listNotes(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.listNotes(user.tenantSlug, id);
  }

  @Patch(':id/notes/:noteId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  updateNote(@CurrentUser() user: any, @Param('id') id: string, @Param('noteId') noteId: string, @Body() dto: UpdateNoteDto) {
    return this.caseService.updateNote(user.tenantSlug, id, noteId, dto, user.sub);
  }

  // --- Filings ---
  @Post(':id/filings')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  createFiling(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateFilingDto) {
    return this.caseService.createFiling(user.tenantSlug, id, dto, user.sub);
  }

  @Patch(':id/filings/:filingId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  updateFiling(@CurrentUser() user: any, @Param('id') id: string, @Param('filingId') filingId: string, @Body() dto: UpdateFilingDto) {
    return this.caseService.updateFiling(user.tenantSlug, id, filingId, dto, user.sub);
  }

  @Get(':id/filings')
  listFilings(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.listFilings(user.tenantSlug, id);
  }

  // --- Communications ---
  @Post(':id/communications')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  createCommunication(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateCommunicationDto) {
    return this.caseService.createCommunication(user.tenantSlug, id, dto, user.sub);
  }

  @Get(':id/communications')
  listCommunications(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.listCommunications(user.tenantSlug, id);
  }

  @Patch(':id/communications/:commId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  updateCommunication(@CurrentUser() user: any, @Param('id') id: string, @Param('commId') commId: string, @Body() dto: UpdateCommunicationDto) {
    return this.caseService.updateCommunication(user.tenantSlug, id, commId, dto, user.sub);
  }

  // --- Case Parties ---
  @Post(':id/parties')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  addCaseParty(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AddCasePartyDto) {
    return this.caseService.addCaseParty(user.tenantSlug, id, dto, user.sub);
  }

  @Get(':id/parties')
  listCaseParties(@CurrentUser() user: any, @Param('id') id: string) {
    return this.caseService.listCaseParties(user.tenantSlug, id);
  }

  @Patch(':id/parties/:partyLinkId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  updateCaseParty(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('partyLinkId') partyLinkId: string,
    @Body() dto: UpdateCasePartyDto,
  ) {
    return this.caseService.updateCaseParty(user.tenantSlug, id, partyLinkId, dto, user.sub);
  }

  @Delete(':id/parties/:partyLinkId')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  deleteCaseParty(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('partyLinkId') partyLinkId: string,
  ) {
    return this.caseService.deleteCaseParty(user.tenantSlug, id, partyLinkId, user.sub);
  }
}
