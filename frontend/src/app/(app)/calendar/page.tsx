'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Event as EventIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { calendarApi } from '@/api';
import type { CalendarEvent, CalendarEventType, CalendarEventStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  Scheduled: 'info',
  Confirmed: 'primary',
  Cancelled: 'error',
  Completed: 'success',
};

const EVENT_TYPE_COLORS: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  Hearing: 'error',
  Meeting: 'primary',
  Deadline: 'warning',
  Task: 'info',
  Reminder: 'default',
  Other: 'default',
};

export default function CalendarPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState(0); // 0 = all, 1 = my events
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    event_type: 'Meeting' as CalendarEventType,
    start_at: '',
    end_at: '',
    location: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const fetcher = tab === 1 ? calendarApi.getMyEvents : calendarApi.list;
      const res = await fetcher({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setEvents(prev => [...prev, ...res.data]);
      } else {
        setEvents(res.data);
      }
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await calendarApi.create({
        title: form.title,
        event_type: form.event_type,
        start_at: form.start_at,
        end_at: form.end_at,
        location: form.location || undefined,
        description: form.description || undefined,
      });
      setDialogOpen(false);
      setForm({ title: '', event_type: 'Meeting', start_at: '', end_at: '', location: '', description: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={600}>
          <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('nav.calendar', 'Calendar')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('common.refresh', 'Refresh')}>
            <IconButton onClick={() => load()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            {t('calendar.addEvent', 'New Event')}
          </Button>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('calendar.allEvents', 'All Events')} />
        <Tab label={t('calendar.myEvents', 'My Events')} />
      </Tabs>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('calendar.eventTitle', 'Title')}</TableCell>
                <TableCell>{t('calendar.type', 'Type')}</TableCell>
                <TableCell>{t('calendar.status', 'Status')}</TableCell>
                <TableCell>{t('calendar.startTime', 'Start')}</TableCell>
                <TableCell>{t('calendar.endTime', 'End')}</TableCell>
                <TableCell>{t('calendar.location', 'Location')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map(ev => (
                <TableRow key={ev.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{ev.title}</Typography>
                    {ev.case_title && (
                      <Typography variant="caption" color="text.secondary">{ev.case_title}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={ev.event_type} size="small" color={EVENT_TYPE_COLORS[ev.event_type] || 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={ev.status} size="small" color={STATUS_COLORS[ev.status] || 'default'} />
                  </TableCell>
                  <TableCell>{new Date(ev.start_at).toLocaleString()}</TableCell>
                  <TableCell>{new Date(ev.end_at).toLocaleString()}</TableCell>
                  <TableCell>{ev.location || '—'}</TableCell>
                </TableRow>
              ))}
              {events.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={4}>
                      {t('common.noData', 'No data found')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {hasMore && (
          <Box textAlign="center" py={2}>
            <Button onClick={() => load(cursor)} disabled={loading}>
              {t('common.loadMore', 'Load More')}
            </Button>
          </Box>
        )}
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('calendar.addEvent', 'New Event')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('calendar.eventTitle', 'Title')}
              fullWidth
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <TextField
              label={t('calendar.type', 'Type')}
              select
              fullWidth
              value={form.event_type}
              onChange={e => setForm(f => ({ ...f, event_type: e.target.value as CalendarEventType }))}
            >
              {['Meeting', 'Deadline', 'Task', 'Reminder', 'Other'].map(t => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('calendar.startTime', 'Start')}
              type="datetime-local"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              value={form.start_at}
              onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
            />
            <TextField
              label={t('calendar.endTime', 'End')}
              type="datetime-local"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              value={form.end_at}
              onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
            />
            <TextField
              label={t('calendar.location', 'Location')}
              fullWidth
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            />
            <TextField
              label={t('common.description', 'Description')}
              fullWidth
              multiline
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !form.title || !form.start_at || !form.end_at}
          >
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
