import { NotFoundException, ConflictException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  let service: CalendarService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      queryTenant: jest.fn(),
      executeTenant: jest.fn(),
    };
    mockAudit = {
      log: jest.fn(),
    };
    mockNotifications = {
      create: jest.fn(),
    };
    service = new CalendarService(mockPrisma, mockAudit, mockNotifications);
  });

  // ── Create ─────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an event when no conflicts', async () => {
      const dto = {
        title: 'Team Meeting',
        startAt: '2024-06-01T10:00:00Z',
        endAt: '2024-06-01T11:00:00Z',
        eventType: 'Custom' as const,
      };

      // conflict check
      mockPrisma.queryTenant.mockResolvedValueOnce([]);
      // insert event + attendee
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getById return
      mockPrisma.queryTenant.mockResolvedValueOnce([{
        id: 'ev1', title: 'Team Meeting', status: 'Active',
        attendees: [{ userId: 'user-1', rsvp: 'Accepted' }],
        reminders: null,
      }]);

      const result = await service.create('test-firm', dto, 'user-1');

      expect(result.title).toBe('Team Meeting');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'CALENDAR_EVENT_CREATED' }),
      );
    });

    it('should throw ConflictException when time conflicts exist', async () => {
      const dto = {
        title: 'Clash',
        startAt: '2024-06-01T10:00:00Z',
        endAt: '2024-06-01T11:00:00Z',
        eventType: 'Custom' as const,
      };

      mockPrisma.queryTenant.mockResolvedValueOnce([
        { id: 'existing', title: 'Other', start_at: '2024-06-01T09:30:00Z', end_at: '2024-06-01T10:30:00Z' },
      ]);

      await expect(
        service.create('test-firm', dto, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should notify additional attendees', async () => {
      const dto = {
        title: 'Review Session',
        startAt: '2024-06-01T10:00:00Z',
        endAt: '2024-06-01T11:00:00Z',
        eventType: 'Session' as const,
        attendeeUserIds: ['user-2', 'user-3'],
      };

      mockPrisma.queryTenant.mockResolvedValueOnce([]); // no conflicts
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'ev1', title: 'Review Session' }]);

      await service.create('test-firm', dto, 'user-1');

      // user-2 and user-3 should get notifications (2 calls)
      expect(mockNotifications.create).toHaveBeenCalledTimes(2);
      expect(mockNotifications.create).toHaveBeenCalledWith(
        'test-firm',
        expect.objectContaining({ userId: 'user-2', type: 'session' }),
      );
    });
  });

  // ── List ───────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated events', async () => {
      const rows = [
        { id: 'ev1', start_at: '2024-06-01T10:00:00Z' },
        { id: 'ev2', start_at: '2024-06-02T10:00:00Z' },
      ];
      mockPrisma.queryTenant.mockResolvedValueOnce(rows);

      const result = await service.list('test-firm', 'user-1');

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });
  });

  // ── getMyEvents ────────────────────────────────────────────────

  describe('getMyEvents', () => {
    it('should return events for the given user', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'ev1' }]);

      const result = await service.getMyEvents('test-firm', 'user-1');
      expect(result).toHaveLength(1);
    });
  });

  // ── getById ────────────────────────────────────────────────────

  describe('getById', () => {
    it('should throw NotFoundException when event missing', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]);

      await expect(service.getById('test-firm', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── addAttendee ────────────────────────────────────────────────

  describe('addAttendee', () => {
    it('should throw ConflictException if user already an attendee', async () => {
      // getById
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'ev1', title: 'Evt' }]);
      // existing check
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'a1' }]);

      await expect(
        service.addAttendee('test-firm', 'ev1', { userId: 'user-2' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should add attendee and notify', async () => {
      // getById
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'ev1', title: 'Evt' }]);
      // existing check — not found
      mockPrisma.queryTenant.mockResolvedValueOnce([]);
      // insert attendee
      mockPrisma.executeTenant.mockResolvedValue(undefined);
      // getById return
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'ev1', title: 'Evt', attendees: [] }]);

      await service.addAttendee('test-firm', 'ev1', { userId: 'user-2' }, 'user-1');

      expect(mockNotifications.create).toHaveBeenCalledWith(
        'test-firm',
        expect.objectContaining({ userId: 'user-2' }),
      );
    });
  });

  // ── updateRsvp ─────────────────────────────────────────────────

  describe('updateRsvp', () => {
    it('should throw NotFoundException if attendee row not found', async () => {
      mockPrisma.queryTenant.mockResolvedValueOnce([]); // UPDATE RETURNING nothing

      await expect(
        service.updateRsvp('test-firm', 'ev1', 'user-1', 'Accepted'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteEvent ────────────────────────────────────────────────

  describe('deleteEvent', () => {
    it('should soft-cancel the event', async () => {
      // getById
      mockPrisma.queryTenant.mockResolvedValueOnce([{ id: 'ev1' }]);
      mockPrisma.executeTenant.mockResolvedValue(undefined);

      const result = await service.deleteEvent('test-firm', 'ev1', 'user-1');

      expect(result).toEqual({ deleted: true });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'CALENDAR_EVENT_CANCELLED' }),
      );
    });
  });
});
