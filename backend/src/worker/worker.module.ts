import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScanWorker } from './scan.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'document-scan' }),
  ],
  providers: [ScanWorker],
})
export class WorkerModule {}
