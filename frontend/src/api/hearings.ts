import { get, post, patch } from './client';
import type { Hearing, PaginatedResult } from '@/types';

/** Map snake_case Hearing fields → camelCase backend DTO */
function toHearingDto(data: Partial<Hearing>): Record<string, unknown> {
  return {
    caseId: data.case_id,
    courtId: data.court_id,
    judgeId: data.judge_id,
    hearingDate: data.hearing_date,
    hearingType: data.hearing_type,
    location: data.location,
    notes: data.notes,
    outcome: data.outcome,
  };
}

export const hearingApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Hearing>> {
    return get<PaginatedResult<Hearing>>('/hearings', params);
  },

  getById(id: string): Promise<Hearing> {
    return get(`/hearings/${id}`);
  },

  create(data: Partial<Hearing>): Promise<Hearing> {
    return post<Hearing>('/hearings', toHearingDto(data));
  },

  update(id: string, data: Partial<Hearing>): Promise<Hearing> {
    return patch<Hearing>(`/hearings/${id}`, toHearingDto(data));
  },

  transition(id: string, toStatus: string, opts?: { outcome?: string; reason?: string; newDate?: string }): Promise<Hearing> {
    return post<Hearing>(`/hearings/${id}/transition`, { toStatus, ...opts });
  },
};
