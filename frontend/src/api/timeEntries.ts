import { get, post, patch, del } from './client';
import type { TimeEntry, TimeEntrySummary, PaginatedResult } from '@/types';

/** Map snake_case TimeEntry fields → camelCase backend DTO */
function toTimeEntryDto(data: Partial<TimeEntry>): Record<string, unknown> {
  return {
    caseId: data.case_id,
    hearingId: data.hearing_id,
    entryDate: data.entry_date,
    hours: data.hours,
    description: data.description,
    activityType: data.activity_type,
    ratePerHour: data.rate_per_hour,
    billable: data.billable,
  };
}

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
    return post<TimeEntry>('/time-entries', toTimeEntryDto(data));
  },

  update(id: string, data: Partial<TimeEntry>): Promise<TimeEntry> {
    return patch<TimeEntry>(`/time-entries/${id}`, toTimeEntryDto(data));
  },

  transition(id: string, toStatus: string): Promise<TimeEntry> {
    return post<TimeEntry>(`/time-entries/${id}/transition`, { toStatus });
  },

  delete(id: string): Promise<void> {
    return del(`/time-entries/${id}`);
  },
};
