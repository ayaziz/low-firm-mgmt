import { get, post, patch, del } from './client';
import type { DocumentTemplate, PaginatedResult } from '@/types';

export const templateApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<DocumentTemplate>> {
    return get<PaginatedResult<DocumentTemplate>>('/templates', params);
  },

  getById(id: string): Promise<DocumentTemplate> {
    return get(`/templates/${id}`);
  },

  create(data: Partial<DocumentTemplate>): Promise<DocumentTemplate> {
    return post<DocumentTemplate>('/templates', data);
  },

  update(id: string, data: Partial<DocumentTemplate>): Promise<DocumentTemplate> {
    return patch<DocumentTemplate>(`/templates/${id}`, data);
  },

  render(templateId: string, data: Record<string, unknown>): Promise<{ rendered: string }> {
    return post<{ rendered: string }>('/templates/render', { templateId, data });
  },

  generate(templateId: string, data: Record<string, unknown>, caseId: string, title: string): Promise<{ documentId: string; rendered: string }> {
    return post<{ documentId: string; rendered: string }>('/templates/generate', { templateId, data, caseId, title });
  },

  deactivate(id: string): Promise<void> {
    return del(`/templates/${id}`);
  },
};
