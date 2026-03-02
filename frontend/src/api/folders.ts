import { get, post, patch, del } from './client';
import type { Folder, Document, PaginatedResult } from '@/types';

export const folderApi = {
  listByCase(caseId: string, params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Folder>> {
    return get<PaginatedResult<Folder>>(`/folders/case/${caseId}`, params);
  },

  getTree(caseId: string): Promise<Folder[]> {
    return get<Folder[]>(`/folders/case/${caseId}/tree`);
  },

  getById(id: string): Promise<Folder> {
    return get(`/folders/${id}`);
  },

  getDocuments(folderId: string, params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Document>> {
    return get<PaginatedResult<Document>>(`/folders/${folderId}/documents`, params);
  },

  create(data: Partial<Folder>): Promise<Folder> {
    return post<Folder>('/folders', data);
  },

  update(id: string, data: Partial<Folder>): Promise<Folder> {
    return patch<Folder>(`/folders/${id}`, data);
  },

  move(id: string, newParentId: string | null): Promise<Folder> {
    return post<Folder>(`/folders/${id}/move`, { newParentId });
  },

  moveDocument(folderId: string, documentId: string): Promise<void> {
    return post(`/folders/move-document`, { documentId, folderId });
  },

  createDefaults(caseId: string): Promise<Folder[]> {
    return post<Folder[]>(`/folders/case/${caseId}/defaults`);
  },

  delete(id: string): Promise<void> {
    return del(`/folders/${id}`);
  },
};
