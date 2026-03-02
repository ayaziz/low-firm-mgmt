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
    return get<PaginatedResult<CalendarEvent>>('/calendar/events', params);
  },

  getMyEvents(params?: Record<string, string | number | boolean | undefined>): Promise<PaginatedResult<CalendarEvent>> {
    return get<PaginatedResult<CalendarEvent>>('/calendar/my-events', params);
  },

  getById(id: string): Promise<CalendarEvent> {
    return get(`/calendar/events/${id}`);
  },

  create(data: Partial<CalendarEvent>): Promise<CalendarEvent> {
<<<<<<< HEAD
    return post<CalendarEvent>('/calendar', toCalendarDto(data));
  },

  update(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return patch<CalendarEvent>(`/calendar/${id}`, toCalendarDto(data));
=======
    return post<CalendarEvent>('/calendar/events', data);
  },

  update(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return patch<CalendarEvent>(`/calendar/events/${id}`, data);
>>>>>>> da422d6fe0707d6f320fd0d42b16d1e32a3feb85
  },

  addAttendee(eventId: string, userId: string): Promise<CalendarAttendee> {
    return post<CalendarAttendee>(`/calendar/events/${eventId}/attendees`, { userId });
  },

  updateRsvp(eventId: string, rsvpStatus: string): Promise<CalendarAttendee> {
<<<<<<< HEAD
    return patch<CalendarAttendee>(`/calendar/${eventId}/rsvp`, { rsvp: rsvpStatus });
=======
    return patch<CalendarAttendee>(`/calendar/events/${eventId}/rsvp`, { rsvp: rsvpStatus });
>>>>>>> da422d6fe0707d6f320fd0d42b16d1e32a3feb85
  },

  addReminder(eventId: string, data: Partial<CalendarReminder>): Promise<CalendarReminder> {
    return post<CalendarReminder>(`/calendar/events/${eventId}/reminders`, data);
  },

  delete(id: string): Promise<void> {
    return del(`/calendar/events/${id}`);
  },
};
