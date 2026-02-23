import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {
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

    // Deterministic scanner: filename containing "EICAR" → Failed, else → Passed
    const scanResult = data.fileName && data.fileName.toUpperCase().includes('EICAR') ? 'Failed' : 'Passed';

    // Update scan status
    await this.prisma.executeTenant(data.tenantSlug,
      `UPDATE document_versions SET scan_status = $1 WHERE id = $2`,
      [scanResult, data.versionId]);

    if (scanResult === 'Passed') {
      // Update current version on the document
      await this.prisma.executeTenant(data.tenantSlug,
        `UPDATE documents SET current_version_id = $1, updated_at = NOW() WHERE id = $2`,
        [data.versionId, data.documentId]);
    }

    // Create audit event
    const { v4: uuidv4 } = await import('uuid');
    await this.prisma.executeTenant(data.tenantSlug,
      `INSERT INTO audit_events (id, event_type, actor_user_id, entity_type, entity_id, payload, correlation_id, created_at)
       VALUES ($1, 'DOCUMENT_SCAN_COMPLETED', NULL, 'DocumentVersion', $2, $3, $4, NOW())`,
      [uuidv4(), data.versionId, JSON.stringify({ result: scanResult, fileName: data.fileName }), data.correlationId]);

    // Create notification for uploader
    const notifTitle = scanResult === 'Passed' ? 'Document ready' : 'Upload failed security scan';
    const notifBody = scanResult === 'Passed'
      ? `Your document has been scanned and is now available.`
      : `Your uploaded file did not pass the security scan and cannot be accessed.`;

    await this.prisma.executeTenant(data.tenantSlug,
      `INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, 'system', 'document', $5, false, NOW())`,
      [uuidv4(), data.uploadedBy, notifTitle, notifBody, data.documentId]);

    this.logger.log(`Scan complete for version ${data.versionId}: ${scanResult}`);
  }
}
