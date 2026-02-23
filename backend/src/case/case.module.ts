import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { CompletenessService } from './completeness.service';

@Module({
  controllers: [CaseController],
  providers: [CaseService, CompletenessService],
  exports: [CaseService, CompletenessService],
})
export class CaseModule {}
