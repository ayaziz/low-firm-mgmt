import { Module, Global } from '@nestjs/common';
import { StatusHistoryService } from './status-history.service';
import { StatusHistoryController } from './status-history.controller';

@Global()
@Module({
  controllers: [StatusHistoryController],
  providers: [StatusHistoryService],
  exports: [StatusHistoryService],
})
export class StatusHistoryModule {}
