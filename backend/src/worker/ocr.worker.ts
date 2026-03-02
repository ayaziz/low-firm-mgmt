import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface OcrJobData {
  tenantSlug: string;
  documentId: string;
  versionId: string;
  providerObjectKey: string;
  contentType: string;
  fileName: string;
  correlationId?: string;
}

// Supported MIME types for OCR / text extraction
const TEXT_EXTRACTABLE = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
  'text/plain',
  'text/html',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
@Processor('document-ocr')
export class OcrWorker extends WorkerHost {
  private readonly logger = new Logger(OcrWorker.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<OcrJobData>): Promise<void> {
    const data = job.data;
    this.logger.log(`OCR processing document ${data.documentId}, version ${data.versionId}`);

    // Check current OCR status for idempotency
    const docRows: any[] = await this.prisma.queryTenant(
      data.tenantSlug,
      `SELECT ocr_status FROM documents WHERE id = $1`,
      [data.documentId],
    );
    if (!docRows?.length) {
      this.logger.warn(`Document ${data.documentId} not found, skipping OCR`);
      return;
    }
    if (docRows[0].ocr_status !== 'Pending') {
      this.logger.log(`Document ${data.documentId} OCR already ${docRows[0].ocr_status}, skipping`);
      return;
    }

    // Check if content type is extractable
    if (!TEXT_EXTRACTABLE.has(data.contentType)) {
      this.logger.log(`Content type ${data.contentType} not extractable, marking Skipped`);
      await this.prisma.executeTenant(
        data.tenantSlug,
        `UPDATE documents SET ocr_status = 'Skipped', updated_at = NOW() WHERE id = $1`,
        [data.documentId],
      );
      return;
    }

    // Set Processing status
    await this.prisma.executeTenant(
      data.tenantSlug,
      `UPDATE documents SET ocr_status = 'Processing', updated_at = NOW() WHERE id = $1`,
      [data.documentId],
    );

    try {
      // ── Text Extraction ──
      // In production, this would call an external OCR service (e.g., Azure Document Intelligence).
      // For local development, we simulate extraction based on content type.
      let extractedText = '';

      if (data.contentType === 'text/plain' || data.contentType === 'text/html') {
        // For text files, the content IS the text — in production we'd download from storage
        extractedText = `[Extracted text from ${data.fileName}]`;
      } else if (data.contentType === 'application/pdf') {
        extractedText = `[PDF text extracted from ${data.fileName}]`;
      } else {
        // Image-based OCR simulation
        extractedText = `[OCR text extracted from image ${data.fileName}]`;
      }

      // Update document with extracted text
      // The trigger trg_doc_tsvector will automatically update full_text_tsvector
      await this.prisma.executeTenant(
        data.tenantSlug,
        `UPDATE documents SET full_text_content = $1, ocr_status = 'Completed', updated_at = NOW() WHERE id = $2`,
        [extractedText, data.documentId],
      );

      this.logger.log(`OCR completed for document ${data.documentId}: ${extractedText.length} chars`);
    } catch (error) {
      this.logger.error(`OCR failed for document ${data.documentId}: ${error.message}`);

      await this.prisma.executeTenant(
        data.tenantSlug,
        `UPDATE documents SET ocr_status = 'Failed', updated_at = NOW() WHERE id = $1`,
        [data.documentId],
      );
    }
  }
}
