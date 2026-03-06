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
    const { template_body, variable_schema, ...rest } = data as any;
    const payload: Record<string, unknown> = { ...rest };
    if (template_body !== undefined) payload.templateBody = template_body;
    if (variable_schema !== undefined) payload.variableSchema = variable_schema;
    return post<DocumentTemplate>('/templates', payload);
  },

  update(id: string, data: Partial<DocumentTemplate>): Promise<DocumentTemplate> {
    const { template_body, variable_schema, is_active, ...rest } = data as any;
    const payload: Record<string, unknown> = { ...rest };
    if (template_body !== undefined) payload.templateBody = template_body;
    if (variable_schema !== undefined) payload.variableSchema = variable_schema;
    if (is_active !== undefined) payload.isActive = is_active;
    return patch<DocumentTemplate>(`/templates/${id}`, payload);
  },

  render(templateId: string, data: Record<string, unknown>): Promise<{ rendered: string; templateName?: string; category?: string }> {
    return post<{ rendered: string; templateName?: string; category?: string }>('/templates/render', { templateId, data });
  },

  generate(templateId: string, data: Record<string, unknown>, caseId: string, title: string): Promise<{ documentId: string; rendered: string }> {
    return post<{ documentId: string; rendered: string }>('/templates/generate', { templateId, data, caseId, title });
  },

  deactivate(id: string): Promise<void> {
    return del(`/templates/${id}`);
  },
};
