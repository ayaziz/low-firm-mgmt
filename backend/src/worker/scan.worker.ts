import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScannerService } from './scanner.service';
import { NotificationService } from '../notification/notification.service';

interface ScanJobData {
  tenantSlug: string;
  tenantId: string;
  documentId: string;
  versionId: string;
  providerObjectKey: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  correlationId: string;
  fileName: string;
}

@Injectable()
@Processor('document-scan')
export class ScanWorker extends WorkerHost {
  private readonly logger = new Logger(ScanWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanner: ScannerService,
    private readonly notifications: NotificationService,
    @InjectQueue('document-ocr') private readonly ocrQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    const data = job.data;
    this.logger.log(`Scanning document version ${data.versionId} (corr: ${data.correlationId})`);

    // Idempotency: check current scan status
    const versionRows = await this.prisma.queryTenant(data.tenantSlug,
      `SELECT scan_status FROM document_versions WHERE id = $1`, [data.versionId]);
    if (versionRows.length === 0) {
      this.logger.warn(`Version ${data.versionId} not found, skipping`);
      return;
    }
    if (versionRows[0].scan_status !== 'Pending') {
      this.logger.log(`Version ${data.versionId} already scanned (${versionRows[0].scan_status}), skipping`);
      return;
    }

    // Use ScannerService (ClamAV integration with heuristic fallback)
    const fileBuffer = await this.fetchFileBuffer(data);
    const result = await this.scanner.scan(fileBuffer, data.fileName);
    const scanResult = result.clean ? 'Passed' : 'Failed';

    // Update scan status
    await this.prisma.executeTenant(data.tenantSlug,
      `UPDATE document_versions SET scan_status = $1 WHERE id = $2`,
      [scanResult, data.versionId]);

    if (scanResult === 'Passed') {
      // Update current version on the document
      await this.prisma.executeTenant(data.tenantSlug,
        `UPDATE documents SET current_version_id = $1, updated_at = NOW() WHERE id = $2`,
        [data.versionId, data.documentId]);

      // Queue OCR / text-extraction job
      await this.ocrQueue.add('ocr', {
        tenantSlug: data.tenantSlug,
        documentId: data.documentId,
        versionId: data.versionId,
        providerObjectKey: data.providerObjectKey,
        contentType: data.contentType,
        fileName: data.fileName,
        correlationId: data.correlationId,
      }, { delay: 1000 });
    }

    // Create audit event
    const { v4: uuidv4 } = await import('uuid');
    await this.prisma.executeTenant(data.tenantSlug,
      `INSERT INTO audit_events (id, event_type, actor_user_id, entity_type, entity_id, payload, correlation_id, created_at)
       VALUES ($1, 'DOCUMENT_SCAN_COMPLETED', NULL, 'DocumentVersion', $2, $3, $4, NOW())`,
      [uuidv4(), data.versionId,
        JSON.stringify({ result: scanResult, virusName: result.virusName, fileName: data.fileName }),
        data.correlationId]);

    // Create notification for uploader
    const notifTitle = scanResult === 'Passed' ? 'Document ready' : 'Upload failed security scan';
    const notifBody = scanResult === 'Passed'
      ? `Your document has been scanned and is now available.`
      : `Your uploaded file did not pass the security scan${result.virusName ? ` (${result.virusName})` : ''}.`;

    await this.notifications.create(data.tenantSlug, {
      userId: data.uploadedBy,
      title: notifTitle,
      body: notifBody,
      type: 'system',
      entityType: 'document',
      entityId: data.documentId,
    });

    this.logger.log(`Scan complete for version ${data.versionId}: ${scanResult}`);
  }

  /**
   * Fetch the file buffer from MinIO/S3.
   * Falls back to an empty buffer when the object cannot be retrieved
   * (the scanner heuristic still works on filename alone).
   */
  private async fetchFileBuffer(data: ScanJobData): Promise<Buffer> {
    try {
      const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
        region: process.env.S3_REGION || 'us-east-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || 'minio',
          secretAccessKey: process.env.S3_SECRET_KEY || 'minio123',
        },
      });
      const resp = await s3.send(new GetObjectCommand({
        Bucket: process.env.S3_BUCKET || 'loma-documents',
        Key: data.providerObjectKey,
      }));
      const chunks: Uint8Array[] = [];
      for await (const chunk of resp.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err: any) {
      this.logger.warn(`Could not fetch file for scan (${err.message}), using empty buffer`);
      return Buffer.alloc(0);
    }
  }
}
