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
    originModule?: string;
    originEntityType?: string;
    originEntityId?: string;
    title: string;
    fileName: string;
    mimeType: string;
    docTypeId: string;
    confidentialityLevel: string;
    tags?: string[];
    description?: string;
    folderId?: string;
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
  }): Promise<{ versionId: string; uploadUrl: string }> {
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
    return post('/documents/bulk/delete', { documentIds: ids });
  },

  bulkMoveToFolder(ids: string[], folderId: string): Promise<void> {
    return post('/documents/bulk/move', { documentIds: ids, folderId });
  },

  bulkRestore(ids: string[]): Promise<void> {
    return post('/documents/bulk/restore', { documentIds: ids });
  },

  listByOrigin(originType: string, originId: string, params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Doc>> {
    return get<PaginatedResult<Doc>>(`/documents/by-origin/${originType}/${originId}`, params);
  },
};
