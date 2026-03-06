import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Queue or directly process OCR for a document version.
   * In production this would call an external OCR service;
   * here we create a placeholder record and mark it Pending.
   */
  async triggerOcr(tenantSlug: string, documentId: string, versionId: string): Promise<string> {
    const id = uuidv4();
    await this.prisma.executeTenant(
      tenantSlug,
      `INSERT INTO document_ocr_text (id, document_id, version_id, ocr_status, created_at)
       VALUES ($1, $2, $3, 'Pending', NOW())
       ON CONFLICT (document_id, version_id) DO UPDATE SET ocr_status = 'Pending'`,
      [id, documentId, versionId],
    );
    return id;
  }

  /**
   * Simulate OCR completion — in a real system the worker would call this
   * after processing the file through Tesseract / Azure Form Recognizer.
   */
  async completeOcr(
    tenantSlug: string,
    documentId: string,
    versionId: string,
    rawText: string,
  ): Promise<void> {
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE document_ocr_text
       SET raw_text = $1, ocr_status = 'Done'
       WHERE document_id = $2 AND version_id = $3`,
      [rawText, documentId, versionId],
    );
  }

  async failOcr(
    tenantSlug: string,
    documentId: string,
    versionId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.executeTenant(
      tenantSlug,
      `UPDATE document_ocr_text
       SET ocr_status = 'Failed', error_message = $1
       WHERE document_id = $2 AND version_id = $3`,
      [errorMessage, documentId, versionId],
    );
  }

  async getOcrText(tenantSlug: string, documentId: string, versionId?: string) {
    let sql = `SELECT * FROM document_ocr_text WHERE document_id = $1`;
    const params: any[] = [documentId];
    if (versionId) {
      sql += ` AND version_id = $2`;
      params.push(versionId);
    }
    sql += ` ORDER BY created_at DESC LIMIT 1`;

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    if (!rows?.length) throw new NotFoundException('OCR data not found');
    return rows[0];
  }

  /**
   * Full-text search across all OCR text in tenant.
   */
  async searchOcr(
    tenantSlug: string,
    query: string,
    cursor?: string,
    limit = 20,
  ) {
    let sql = `SELECT o.document_id, o.version_id, o.ocr_status,
                      ts_headline('english', o.raw_text, plainto_tsquery('english', $1), 'MaxFragments=3, MaxWords=30') AS snippet,
                      ts_rank(o.search_vector, plainto_tsquery('english', $1)) AS rank
               FROM document_ocr_text o
               WHERE o.search_vector @@ plainto_tsquery('english', $1)`;
    const params: any[] = [query];
    let idx = 2;

    if (cursor) {
      sql += ` AND o.created_at < $${idx++}`;
      params.push(cursor);
    }

    sql += ` ORDER BY rank DESC, o.created_at DESC LIMIT $${idx}`;
    params.push(limit + 1);

    const rows: any[] = await this.prisma.queryTenant(tenantSlug, sql, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return {
      data,
      nextCursor: hasMore && data.length > 0 ? data[data.length - 1].created_at : null,
      hasMore,
    };
  }
}
