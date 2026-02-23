import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'document-scan' }),
  ],
  controllers: [DocumentController],
  providers: [DocumentService, StorageService],
  exports: [DocumentService, StorageService],
})
export class DocumentModule {}
