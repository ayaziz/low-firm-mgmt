import { get, post, patch } from './client';
import type { Court, Judge, PaginatedResult } from '@/types';

export const courtApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Court>> {
    return get<PaginatedResult<Court>>('/courts', params);
  },

  getById(id: string): Promise<Court> {
    return get(`/courts/${id}`);
  },

  create(data: Partial<Court>): Promise<Court> {
    return post<Court>('/courts', data);
  },

  update(id: string, data: Partial<Court>): Promise<Court> {
    return patch<Court>(`/courts/${id}`, data);
  },

  // Judges
  listJudges(courtId?: string, params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Judge>> {
    return get<PaginatedResult<Judge>>(`/courts/judges`, { ...params, courtId });
  },

  createJudge(courtId: string, data: {
    fullName: string;
    title?: string;
    specialization?: string;
    phone?: string;
    email?: string;
  }): Promise<Judge> {
    return post<Judge>(`/courts/judges`, { ...data, courtId });
  },

  updateJudge(courtId: string, judgeId: string, data: {
    fullName?: string;
    title?: string;
    specialization?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
  }): Promise<Judge> {
    return patch<Judge>(`/courts/judges/${judgeId}`, data);
  },
};
