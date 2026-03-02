import { Module } from '@nestjs/common';
import { HearingController } from './hearing.controller';
import { HearingService } from './hearing.service';

@Module({
  controllers: [HearingController],
  providers: [HearingService],
  exports: [HearingService],
})
export class HearingModule {}
