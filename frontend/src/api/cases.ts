import { get, post, put, del } from './client';
import type {
  Case, Task, Session, Filing, Note, Communication,
  PaginatedResult, CompletenessResult,
} from '@/types';

export const caseApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<Case>> {
    return get<PaginatedResult<Case>>('/cases', params);
  },

  getById(id: string): Promise<Case> {
    return get(`/cases/${id}`);
  },

  create(data: Partial<Case>): Promise<Case> {
    return post<Case>('/cases', data);
  },

  transition(id: string, newState: string, rowVersion: string): Promise<Case> {
    return post<Case>(`/cases/${id}/transition`, { newState, rowVersion });
  },

  setOnHold(id: string, reason: string, rowVersion: string): Promise<Case> {
    return post<Case>(`/cases/${id}/on-hold`, { reason, rowVersion });
  },

  clearOnHold(id: string, rowVersion: string): Promise<Case> {
    return post<Case>(`/cases/${id}/clear-hold`, { rowVersion });
  },

  getCompleteness(id: string): Promise<CompletenessResult> {
    return get(`/cases/${id}/completeness`);
  },

  // Tasks
  listTasks(caseId: string, params?: Record<string, string>): Promise<PaginatedResult<Task>> {
    return get<PaginatedResult<Task>>(`/cases/${caseId}/tasks`, params);
  },

  createTask(caseId: string, data: Partial<Task>): Promise<Task> {
    return post<Task>(`/cases/${caseId}/tasks`, data);
  },

  updateTask(caseId: string, taskId: string, data: Partial<Task>): Promise<Task> {
    return put<Task>(`/cases/${caseId}/tasks/${taskId}`, data);
  },

  // Sessions
  listSessions(caseId: string, params?: Record<string, string>): Promise<PaginatedResult<Session>> {
    return get<PaginatedResult<Session>>(`/cases/${caseId}/sessions`, params);
  },

  createSession(caseId: string, data: Partial<Session>): Promise<Session> {
    return post<Session>(`/cases/${caseId}/sessions`, data);
  },

  rescheduleSession(caseId: string, sessionId: string, data: { newDate: string; reason: string }): Promise<Session> {
    return post<Session>(`/cases/${caseId}/sessions/${sessionId}/reschedule`, data);
  },

  // Filings
  listFilings(caseId: string): Promise<PaginatedResult<Filing>> {
    return get<PaginatedResult<Filing>>(`/cases/${caseId}/filings`);
  },

  createFiling(caseId: string, data: Partial<Filing>): Promise<Filing> {
    return post<Filing>(`/cases/${caseId}/filings`, data);
  },

  updateFiling(caseId: string, filingId: string, data: Partial<Filing>): Promise<Filing> {
    return put<Filing>(`/cases/${caseId}/filings/${filingId}`, data);
  },

  // Notes (append only)
  listNotes(caseId: string): Promise<PaginatedResult<Note>> {
    return get<PaginatedResult<Note>>(`/cases/${caseId}/notes`);
  },

  createNote(caseId: string, content: string): Promise<Note> {
    return post<Note>(`/cases/${caseId}/notes`, { content });
  },

  // Communications
  listCommunications(caseId: string): Promise<PaginatedResult<Communication>> {
    return get<PaginatedResult<Communication>>(`/cases/${caseId}/communications`);
  },

  createCommunication(caseId: string, data: Partial<Communication>): Promise<Communication> {
    return post<Communication>(`/cases/${caseId}/communications`, data);
  },

  // Memberships
  listMemberships(caseId: string): Promise<Array<{ userId: string; role: string; displayName: string }>> {
    return get(`/cases/${caseId}/memberships`);
  },

  addMembership(caseId: string, userId: string, role: string): Promise<void> {
    return post(`/cases/${caseId}/memberships`, { userId, role });
  },

  removeMembership(caseId: string, userId: string): Promise<void> {
    return del(`/cases/${caseId}/memberships/${userId}`);
  },

  // Case parties
  listParties(caseId: string): Promise<Array<{ id: string; party_id: string; role_in_case: string; party_name: string }>> {
    return get(`/cases/${caseId}/parties`);
  },

  addParty(caseId: string, data: { partyId: string; roleInCase: string }): Promise<void> {
    return post(`/cases/${caseId}/parties`, data);
  },
};
