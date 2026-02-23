import { get, post, patch } from './client';
import type { Notification, PaginatedResult, SearchResult, AuditEvent, ReportResult } from '@/types';
import { downloadBlob } from './client';

// ── Search ──
export const searchApi = {
  search(params: { q: string; type?: string; cursor?: string; limit?: number }): Promise<PaginatedResult<SearchResult>> {
    return get<PaginatedResult<SearchResult>>('/search', params);
  },
};

// ── Notifications ──
export const notificationApi = {
  list(params?: { cursor?: string; limit?: number; isRead?: boolean }): Promise<PaginatedResult<Notification>> {
    return get<PaginatedResult<Notification>>('/notifications', params);
  },

  getUnreadCount(): Promise<{ count: number }> {
    return get('/notifications/unread-count');
  },

  markAsRead(id: string): Promise<void> {
    return patch('/notifications/' + id + '/read', {});
  },

  markAllRead(): Promise<void> {
    return post('/notifications/mark-all-read');
  },
};

// ── Audit ──
export const auditApi = {
  list(params?: { cursor?: string; limit?: number }): Promise<PaginatedResult<AuditEvent>> {
    return get<PaginatedResult<AuditEvent>>('/audit', params);
  },

  getByEntity(entityType: string, entityId: string, params?: { cursor?: string; limit?: number }): Promise<PaginatedResult<AuditEvent>> {
    return get<PaginatedResult<AuditEvent>>('/audit/entity', { entityType, entityId, ...params });
  },
};

// ── Reports ──
export const reportApi = {
  generate(reportType: string, filters?: Record<string, string | number | boolean>): Promise<ReportResult> {
    return get<ReportResult>(`/reports/${reportType}`, filters);
  },

  exportCsv(reportType: string, filters?: Record<string, string | number | boolean>): Promise<void> {
    const queryEntries = filters ? Object.entries(filters).filter(([, v]) => v !== undefined) : [];
    const query = queryEntries.length
      ? '?' + new URLSearchParams(queryEntries.map(([k, v]) => [k, String(v)])).toString()
      : '';
    return downloadBlob(`/reports/${reportType}/export${query}`, `${reportType}.csv`);
  },
};
