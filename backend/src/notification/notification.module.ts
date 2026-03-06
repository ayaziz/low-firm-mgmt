import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EmailService } from './email.service';
import { SseService } from './sse.service';

@Global()
@Module({
  providers: [NotificationService, EmailService, SseService],
  controllers: [NotificationController],
  exports: [NotificationService, EmailService, SseService],
})
export class NotificationModule {}
