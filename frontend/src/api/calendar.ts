import { get, post, patch, del } from './client';
import type { CalendarEvent, CalendarAttendee, CalendarReminder, PaginatedResult } from '@/types';

/** Map snake_case CalendarEvent fields → camelCase backend DTO */
function toCalendarDto(data: Partial<CalendarEvent>): Record<string, unknown> {
  return {
    title: data.title,
    startAt: data.start_at,
    endAt: data.end_at,
    eventType: data.event_type,
    caseId: data.case_id,
    hearingId: data.hearing_id,
    location: data.location,
    description: data.description,
    isAllDay: data.is_all_day,
  };
}

export const calendarApi = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<CalendarEvent>> {
    return get<PaginatedResult<CalendarEvent>>('/calendar', params);
  },

  getMyEvents(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<CalendarEvent>> {
    return get<PaginatedResult<CalendarEvent>>('/calendar/my-events', params);
  },

  getById(id: string): Promise<CalendarEvent> {
    return get(`/calendar/${id}`);
  },

  create(data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return post<CalendarEvent>('/calendar', toCalendarDto(data));
  },

  update(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return patch<CalendarEvent>(`/calendar/${id}`, toCalendarDto(data));
  },

  addAttendee(eventId: string, userId: string): Promise<CalendarAttendee> {
    return post<CalendarAttendee>(`/calendar/${eventId}/attendees`, { userId });
  },

  updateRsvp(eventId: string, rsvpStatus: string): Promise<CalendarAttendee> {
    return patch<CalendarAttendee>(`/calendar/${eventId}/rsvp`, { rsvp: rsvpStatus });
  },

  addReminder(eventId: string, data: Partial<CalendarReminder>): Promise<CalendarReminder> {
    return post<CalendarReminder>(`/calendar/${eventId}/reminders`, data);
  },

  delete(id: string): Promise<void> {
    return del(`/calendar/${id}`);
  },
};
