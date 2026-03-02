import { get, post, patch, del } from './client';
import type { CalendarEvent, CalendarAttendee, CalendarReminder, PaginatedResult } from '@/types';

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
    return post<CalendarEvent>('/calendar/events', data);
  },

  update(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return patch<CalendarEvent>(`/calendar/events/${id}`, data);
  },

  addAttendee(eventId: string, userId: string): Promise<CalendarAttendee> {
    return post<CalendarAttendee>(`/calendar/events/${eventId}/attendees`, { userId });
  },

  updateRsvp(eventId: string, rsvpStatus: string): Promise<CalendarAttendee> {
    return patch<CalendarAttendee>(`/calendar/events/${eventId}/rsvp`, { rsvp: rsvpStatus });
  },

  addReminder(eventId: string, data: Partial<CalendarReminder>): Promise<CalendarReminder> {
    return post<CalendarReminder>(`/calendar/events/${eventId}/reminders`, data);
  },

  delete(id: string): Promise<void> {
    return del(`/calendar/events/${id}`);
  },
};
