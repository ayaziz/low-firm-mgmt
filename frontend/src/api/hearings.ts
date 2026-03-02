import { get, post, patch } from './client';
import type { Hearing, PaginatedResult } from '@/types';

export const hearingApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Hearing>> {
    return get<PaginatedResult<Hearing>>('/hearings', params);
  },

  getById(id: string): Promise<Hearing> {
    return get(`/hearings/${id}`);
  },

  create(data: Partial<Hearing>): Promise<Hearing> {
    return post<Hearing>('/hearings', data);
  },

  update(id: string, data: Partial<Hearing>): Promise<Hearing> {
    return patch<Hearing>(`/hearings/${id}`, data);
  },

  transition(id: string, toStatus: string): Promise<Hearing> {
    return post<Hearing>(`/hearings/${id}/transition`, { toStatus });
  },
};
