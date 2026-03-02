import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Arabic normalization: strip diacritics, normalize Hamza/Alef/Taa/Kashida
   */
  normalizeArabic(text: string): string {
    if (!text) return text;
    return text
      // Strip Arabic diacritics (Fathah, Dammah, Kasrah, Sukun, Shadda, Tanwin forms)
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Normalize Hamza forms → Alef
      .replace(/[\u0623\u0625\u0622]/g, '\u0627')
      // Taa Marbuta → Haa
      .replace(/\u0629/g, '\u0647')
      // Alef Maksura → Yaa
      .replace(/\u0649/g, '\u064A')
      // Strip Kashida
      .replace(/\u0640/g, '');
  }

  async globalSearch(
    tenantSlug: string,
    userId: string,
    query: string,
    entityType?: string,
    cursor?: string,
    limit = 20,
    hasStepUp = false,
  ) {
    if (!query || query.length < 2) return { results: [], cursor: null };
    const safeLimit = Math.min(limit, 50);
    const normalizedQuery = this.normalizeArabic(query);
    const likePattern = `%${normalizedQuery.toLowerCase()}%`;

    const results: any[] = [];

    // Search Customers
    if (!entityType || entityType === 'customer') {
      const customerResults = await this.prisma.queryTenant(tenantSlug,
        `SELECT id, name, customer_type, status
         FROM customers
         WHERE deleted_at IS NULL
           AND (LOWER(name) LIKE $1 OR LOWER(COALESCE(national_id,'')) LIKE $1
                OR LOWER(COALESCE(registration_id,'')) LIKE $1 OR LOWER(COALESCE(tax_id,'')) LIKE $1)
         ${cursor ? `AND id > $3` : ''}
         ORDER BY id LIMIT $2`,
        cursor ? [likePattern, safeLimit, cursor] : [likePattern, safeLimit]);

      for (const c of customerResults) {
        results.push({
          entityType: 'customer',
          entityId: c.id,
          title: c.name,
          subtitle: c.customer_type,
          matchField: 'name/id',
        });
      }
    }

    // Search Cases
    if (!entityType || entityType === 'case') {
      const caseResults = await this.prisma.queryTenant(tenantSlug,
        `SELECT c.id, c.title, c.system_case_ref, c.state, c.court_case_number
         FROM cases c
         WHERE 1=1
           AND (LOWER(c.title) LIKE $1 OR LOWER(COALESCE(c.system_case_ref,'')) LIKE $1
                OR LOWER(COALESCE(c.court_case_number,'')) LIKE $1)
         ${cursor ? `AND c.id > $3` : ''}
         ORDER BY c.id LIMIT $2`,
        cursor ? [likePattern, safeLimit, cursor] : [likePattern, safeLimit]);

      for (const cs of caseResults) {
        results.push({
          entityType: 'case',
          entityId: cs.id,
          title: cs.title,
          subtitle: cs.system_case_ref,
          matchField: 'title/ref/court_number',
        });
      }
    }

    // Search Documents (metadata only — filter HC if no step-up)
    if (!entityType || entityType === 'document') {
      const hcFilter = hasStepUp ? '' : `AND COALESCE(d.confidentiality_level, 'Normal') != 'HighlyConfidential'`;
      const docResults = await this.prisma.queryTenant(tenantSlug,
        `SELECT d.id, d.title, COALESCE(v.original_filename, '') AS file_name
         FROM documents d
         LEFT JOIN document_versions v ON v.id = d.current_version_id
         WHERE d.is_deleted = FALSE
           AND (LOWER(d.title) LIKE $1 OR LOWER(COALESCE(v.original_filename,'')) LIKE $1)
           ${hcFilter}
         ${cursor ? `AND d.id > $3` : ''}
         ORDER BY d.id LIMIT $2`,
        cursor ? [likePattern, safeLimit, cursor] : [likePattern, safeLimit]);

      for (const doc of docResults) {
        results.push({
          entityType: 'document',
          entityId: doc.id,
          title: doc.title,
          subtitle: doc.file_name,
          matchField: 'title/filename',
        });
      }
    }

    // Search Invoices
    if (!entityType || entityType === 'invoice') {
      const invResults = await this.prisma.queryTenant(tenantSlug,
        `SELECT i.id, i.invoice_number, i.status, i.total_amount
         FROM invoices i
         WHERE LOWER(i.invoice_number) LIKE $1
         ${cursor ? `AND i.id > $3` : ''}
         ORDER BY i.id LIMIT $2`,
        cursor ? [likePattern, safeLimit, cursor] : [likePattern, safeLimit]);

      for (const inv of invResults) {
        results.push({
          entityType: 'invoice',
          entityId: inv.id,
          title: inv.invoice_number,
          subtitle: `${inv.status} - ${inv.total_amount}`,
          matchField: 'invoice_number',
        });
      }
    }

    // Determine next cursor
    const nextCursor = results.length >= safeLimit ? results[results.length - 1]?.entityId : null;

    return { results, cursor: nextCursor, totalEstimate: results.length };
  }

  /**
   * Full-text search across document content using PostgreSQL tsvector/tsquery.
   * Leverages the full_text_tsvector column populated by the Phase 2 trigger.
   */
  async documentFulltextSearch(
    tenantSlug: string,
    query: string,
    opts: { caseId?: string; cursor?: string; limit?: number; hasStepUp?: boolean } = {},
  ) {
    if (!query || query.length < 2) return { data: [], hasMore: false, nextCursor: null };

    const limit = Math.min(opts.limit || 20, 50);
    const conditions: string[] = [`d.is_deleted = FALSE`];
    const params: any[] = [];
    let idx = 1;

    // Build tsquery — use plainto_tsquery for safe user input (handles Arabic too)
    conditions.push(`d.full_text_tsvector @@ plainto_tsquery('simple', $${idx})`);
    params.push(query);
    idx++;

    if (opts.caseId) {
      conditions.push(`d.case_id = $${idx++}`);
      params.push(opts.caseId);
    }

    if (!opts.hasStepUp) {
      conditions.push(`COALESCE(d.confidentiality_level, 'Normal') != 'HighlyConfidential'`);
    }

    if (opts.cursor) {
      conditions.push(`d.id > $${idx++}`);
      params.push(opts.cursor);
    }

    const where = conditions.join(' AND ');

    const rows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT d.id, d.title, d.case_id, d.ocr_status,
              ts_headline('simple', COALESCE(d.full_text_content, ''), plainto_tsquery('simple', $1),
                'MaxWords=35, MinWords=15, StartSel=<b>, StopSel=</b>') AS snippet,
              ts_rank(d.full_text_tsvector, plainto_tsquery('simple', $1)) AS rank
       FROM documents d
       WHERE ${where}
       ORDER BY rank DESC, d.id
       LIMIT $${idx}`,
      [...params, limit + 1],
    );

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    };
  }
}
