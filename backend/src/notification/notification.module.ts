import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EmailService } from './email.service';

@Global()
@Module({
  providers: [NotificationService, EmailService],
  controllers: [NotificationController],
  exports: [NotificationService, EmailService],
})
export class NotificationModule {}
