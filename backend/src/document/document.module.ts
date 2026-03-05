import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { StorageService } from './storage.service';
import { ExternalShareService } from './external-share.service';
import { ExternalShareController } from './external-share.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'document-scan' }),
  ],
  controllers: [DocumentController, ExternalShareController],
  providers: [DocumentService, StorageService, ExternalShareService],
  exports: [DocumentService, StorageService, ExternalShareService],
})
export class DocumentModule {}
