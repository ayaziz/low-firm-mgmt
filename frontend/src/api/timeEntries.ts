import { get, post, patch, del } from './client';
import type { TimeEntry, TimeEntrySummary, PaginatedResult } from '@/types';

export const timeEntryApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<TimeEntry>> {
    return get<PaginatedResult<TimeEntry>>('/time-entries', params);
  },

  summary(params?: Record<string, string | number | boolean | undefined>): Promise<TimeEntrySummary> {
    return get<TimeEntrySummary>('/time-entries/summary', params);
  },

  getById(id: string): Promise<TimeEntry> {
    return get(`/time-entries/${id}`);
  },

  create(data: Partial<TimeEntry>): Promise<TimeEntry> {
    return post<TimeEntry>('/time-entries', data);
  },

  update(id: string, data: Partial<TimeEntry>): Promise<TimeEntry> {
    return patch<TimeEntry>(`/time-entries/${id}`, data);
  },

  transition(id: string, toStatus: string): Promise<TimeEntry> {
    return post<TimeEntry>(`/time-entries/${id}/transition`, { toStatus });
  },

  delete(id: string): Promise<void> {
    return del(`/time-entries/${id}`);
  },
};
