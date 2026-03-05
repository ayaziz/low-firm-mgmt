import { Controller, Get, Patch, Post, Body, Param, Query, Sse, UseGuards, Req, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { NotificationService } from './notification.service';
import { SseService } from './sse.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { IsBoolean, IsOptional, IsString, IsInt, Min } from 'class-validator';

class UpdatePreferencesDto {
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() inAppEnabled?: boolean;
  @IsOptional() @IsString() digestFrequency?: string;
  @IsOptional() @IsInt() @Min(1) hearingReminderHours?: number;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly sse: SseService,
  ) {}

  // ── SSE stream ─────────────────────────────────────────

  @Sse('stream')
  stream(@CurrentUser() user: any): Observable<MessageEvent> {
    return this.sse.streamForUser(user.tenantSlug, user.sub);
  }

  // ── CRUD ───────────────────────────────────────────────

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('isRead') isRead?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const isReadBool = isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notificationService.listForUser(
      user.tenantSlug, user.sub, isReadBool, cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: any) {
    const count = await this.notificationService.getUnreadCount(user.tenantSlug, user.sub);
    return { unreadCount: count };
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationService.markAsRead(user.tenantSlug, id, user.sub);
  }

  @Post('mark-all-read')
  markAllRead(@CurrentUser() user: any) {
    return this.notificationService.markAllRead(user.tenantSlug, user.sub);
  }

  // ── Preferences ────────────────────────────────────────

  @Get('preferences')
  getPreferences(@CurrentUser() user: any) {
    return this.notificationService.getPreferences(user.tenantSlug, user.sub);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: any, @Body() dto: UpdatePreferencesDto) {
    return this.notificationService.updatePreferences(user.tenantSlug, user.sub, dto);
  }
}
