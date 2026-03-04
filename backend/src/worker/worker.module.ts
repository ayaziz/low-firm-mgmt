import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScanWorker } from './scan.worker';
import { OcrWorker } from './ocr.worker';
import { ScannerService } from './scanner.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'document-scan' }),
    BullModule.registerQueue({ name: 'document-ocr' }),
  ],
  providers: [ScannerService, ScanWorker, OcrWorker],
})
export class WorkerModule {}
