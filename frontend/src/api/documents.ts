import { get, post, put, del } from './client';
import type { Document as Doc, DocumentVersion, PaginatedResult } from '@/types';

export const documentApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Doc>> {
    return get<PaginatedResult<Doc>>('/documents', params);
  },

  getById(id: string): Promise<Doc & { versions: DocumentVersion[] }> {
    return get(`/documents/${id}`);
  },

  create(data: {
    caseId?: string;
    customerId?: string;
    title: string;
    fileName: string;
    mimeType: string;
    docTypeId: string;
    confidentialityLevel: string;
    tags?: string[];
    description?: string;
  }): Promise<{ document: Doc; uploadUrl: string }> {
    return post('/documents', data);
  },

  download(id: string): Promise<{ downloadUrl: string }> {
    return get(`/documents/${id}/download`);
  },

  checkout(id: string): Promise<Doc> {
    return post(`/documents/${id}/checkout`);
  },

  checkin(id: string, data: {
    fileName: string;
    mimeType: string;
  }): Promise<{ version: DocumentVersion; uploadUrl: string }> {
    return post(`/documents/${id}/checkin`, data);
  },

  breakLock(id: string): Promise<void> {
    return post(`/documents/${id}/break-lock`);
  },

  share(id: string, data: { targetUserId: string; permission: string }): Promise<void> {
    return post(`/documents/${id}/share`, {
      userId: data.targetUserId,
      permission: data.permission,
    });
  },

  setLegalHold(id: string): Promise<void> {
    return post(`/documents/${id}/legal-hold`);
  },

  removeLegalHold(id: string): Promise<void> {
    return del(`/documents/${id}/legal-hold`);
  },

  softDelete(id: string): Promise<void> {
    return del(`/documents/${id}`);
  },

  restore(id: string): Promise<void> {
    return post(`/documents/${id}/restore`);
  },

  // ── Bulk operations (Phase 3) ──
  bulkDelete(ids: string[]): Promise<void> {
    return post('/documents/bulk/delete', { ids });
  },

  bulkMoveToFolder(ids: string[], folderId: string): Promise<void> {
    return post('/documents/bulk/move', { ids, folderId });
  },

  bulkRestore(ids: string[]): Promise<void> {
    return post('/documents/bulk/restore', { ids });
  },

  listByOrigin(originType: string, originId: string, params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Doc>> {
    return get<PaginatedResult<Doc>>(`/documents/by-origin/${originType}/${originId}`, params);
  },
};
