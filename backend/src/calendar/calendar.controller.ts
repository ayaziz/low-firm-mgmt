import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuditAction } from '../common/decorators';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto, AddAttendeeDto, UpdateRsvpDto, AddReminderDto } from './calendar.dto';

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('events')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  @AuditAction({ eventType: 'CALENDAR_EVENT_CREATED', entityType: 'CalendarEvent' })
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: any, @Body() dto: CreateCalendarEventDto) {
    const data = await this.calendarService.create(user.tenantSlug, dto, user.sub);
    return { success: true, data };
  }

  @Get('events')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async list(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('caseId') caseId?: string,
    @Query('eventType') eventType?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.calendarService.list(
      user.tenantSlug, user.sub, startDate, endDate, caseId, eventType, cursor, limit ? parseInt(limit, 10) : 20,
    );
    return { success: true, ...data };
  }

  @Get('my-events')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async myEvents(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.calendarService.getMyEvents(
      user.tenantSlug, user.sub, startDate, endDate, limit ? parseInt(limit, 10) : 50,
    );
    return { success: true, data };
  }

  @Get('events/:id')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async getById(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.calendarService.getById(user.tenantSlug, id);
    return { success: true, data };
  }

  @Patch('events/:id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCalendarEventDto) {
    const data = await this.calendarService.update(user.tenantSlug, id, dto, user.sub);
    return { success: true, data };
  }

  @Delete('events/:id')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.calendarService.deleteEvent(user.tenantSlug, id, user.sub);
    return { success: true, data };
  }

  @Post('events/:id/attendees')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.CREATED)
  async addAttendee(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AddAttendeeDto) {
    const data = await this.calendarService.addAttendee(user.tenantSlug, id, dto, user.sub);
    return { success: true, data };
  }

  @Patch('events/:id/rsvp')
  @Roles('Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin')
  async updateRsvp(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateRsvpDto) {
    const data = await this.calendarService.updateRsvp(user.tenantSlug, id, user.sub, dto.rsvp);
    return { success: true, data };
  }

  @Post('events/:id/reminders')
  @Roles('Lawyer', 'TenantAdmin', 'SystemAdmin')
  @HttpCode(HttpStatus.CREATED)
  async addReminder(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AddReminderDto) {
    const data = await this.calendarService.addReminder(user.tenantSlug, id, dto, user.sub);
    return { success: true, data };
  }
}
