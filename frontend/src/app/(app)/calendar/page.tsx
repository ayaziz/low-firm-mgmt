'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Tooltip } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { calendarApi, caseApi } from '@/api';
import type { CalendarEvent, CalendarEventType, Case } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';

const EVENT_TYPES: CalendarEventType[] = ['Hearing', 'Meeting', 'Deadline', 'Task', 'Reminder', 'Other'];

const emptyForm = {
  title: '',
  event_type: 'Meeting' as CalendarEventType,
  start_at: '',
  end_at: '',
  location: '',
  description: '',
  case_id: '',
};

export default function CalendarPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [form, setForm] = useState({ ...emptyForm });

  const load = useCallback(
		async (c?: string | null) => {
			setLoading(true)
			try {
				const fetcher = tab === 1 ? calendarApi.getMyEvents : calendarApi.list
				const res = await fetcher({
					cursor: c ?? undefined,
					limit: 20,
				})
        const list = Array.isArray(res) ? res : (res.data ?? [])

        if (c) setEvents((prev) => [...prev, ...list])
      else setEvents(list)
      setCursor(res.nextCursor ?? (res as any).next_cursor ?? null);
      setHasMore(!!(res.nextCursor ?? (res as any).next_cursor));
			} finally {
				setLoading(false)
			}
		},
		[tab],
	)

  useEffect(() => { load(); }, [load]);

  const loadDropdowns = async () => {
    const res = await caseApi.list({ limit: 200 }).catch(() => ({ data: [] as Case[] }));
    setCases((res as any).data || []);
  };

  const openCreate = async () => {
    setEditEvent(null);
    setForm({ ...emptyForm });
    setDrawerOpen(true);
    await loadDropdowns();
  };

  const openEdit = async (ev: CalendarEvent) => {
    setEditEvent(ev);
    setForm({
      title: ev.title || '',
      event_type: ev.event_type || 'Meeting',
      start_at: ev.start_at ? new Date(ev.start_at).toISOString().slice(0, 16) : '',
      end_at: ev.end_at ? new Date(ev.end_at).toISOString().slice(0, 16) : '',
      location: ev.location || '',
      description: (ev as any).description || '',
      case_id: (ev as any).case_id || '',
    });
    setDrawerOpen(true);
    await loadDropdowns();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<CalendarEvent> = {
        title: form.title,
        event_type: form.event_type,
        start_at: form.start_at,
        end_at: form.end_at || undefined,
        location: form.location || undefined,
        description: form.description || undefined,
        case_id: form.case_id || undefined,
      } as any;
      if (editEvent) {
        await calendarApi.update(editEvent.id, payload);
      } else {
        await calendarApi.create(payload);
      }
      setDrawerOpen(false);
      setForm({ ...emptyForm });
      setEditEvent(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<CalendarEvent>[] = [
    {
      field: 'title',
      headerName: t('calendar.eventTitle', 'Title'),
      flex: 2,
      sortable: true,
      renderCell: (row) => (
        <Stack>
          <span style={{ fontWeight: 500 }}>{row.title}</span>
          {(row as any).case_title && (
            <span style={{ fontSize: '0.75rem', color: 'var(--mui-palette-text-secondary)' }}>
              {(row as any).case_title}
            </span>
          )}
        </Stack>
      ),
    },
    {
      field: 'event_type',
      headerName: t('calendar.type', 'Type'),
      width: 120,
      renderCell: (row) => <StatusBadge status={row.event_type} variant="outlined" />,
    },
    {
      field: 'status',
      headerName: t('calendar.status', 'Status'),
      width: 120,
      renderCell: (row) => <StatusBadge status={row.status} />,
    },
    {
      field: 'start_at',
      headerName: t('calendar.startTime', 'Start'),
      width: 180,
      sortable: true,
      renderCell: (row) => new Date(row.start_at).toLocaleString(),
    },
    {
      field: 'end_at',
      headerName: t('calendar.endTime', 'End'),
      width: 180,
      renderCell: (row) => new Date(row.end_at).toLocaleString(),
    },
    {
      field: 'location',
      headerName: t('calendar.location', 'Location'),
      flex: 1,
      renderCell: (row) => row.location || '—',
    },
    {
      field: '_actions',
      headerName: '',
      width: 60,
      renderCell: (row) => (
        <Tooltip title={t('common.edit', 'Edit')}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('calendar.title', 'Calendar')}
        subtitle={t('calendar.subtitle', 'Schedule and track events, deadlines, and meetings')}
        breadcrumbs={[{ label: t('nav.calendar', 'Calendar') }]}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t('calendar.addEvent', 'New Event')}
          </Button>
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('calendar.allEvents', 'All Events')} />
        <Tab label={t('calendar.myEvents', 'My Events')} />
      </Tabs>

      <DataGrid<CalendarEvent>
        columns={columns}
        rows={events}
        loading={loading}
        getRowId={(r) => r.id}
        searchPlaceholder={t('calendar.search', 'Search events…')}
        onRefresh={load}
        emptyMessage={t('calendar.empty', 'No events found')}
        emptyAction={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t('calendar.addEvent', 'New Event')}
          </Button>
        }
      />

      {/* ----- Create/Edit Event Drawer ----- */}
      <DrawerForm
        open={drawerOpen}
        title={editEvent ? t('calendar.editEvent', 'Edit Event') : t('calendar.addEvent', 'New Event')}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSave}
        loading={saving}
        submitLabel={t('common.save', 'Save')}
      >
        <Stack spacing={2.5}>
          <TextField
            label={t('calendar.eventTitle', 'Title')}
            fullWidth required
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <TextField
            label={t('calendar.type', 'Type')}
            select fullWidth
            value={form.event_type}
            onChange={e => setForm(f => ({ ...f, event_type: e.target.value as CalendarEventType }))}
          >
            {EVENT_TYPES.map(et => <MenuItem key={et} value={et}>{et}</MenuItem>)}
          </TextField>
          <TextField
            label={t('calendar.case', 'Case')}
            select fullWidth
            value={form.case_id}
            onChange={e => setForm(f => ({ ...f, case_id: e.target.value }))}
          >
            <MenuItem value="">— {t('common.none', 'None')} —</MenuItem>
            {cases.map(c => <MenuItem key={c.id} value={c.id}>{c.title} ({c.system_case_ref})</MenuItem>)}
          </TextField>
          <TextField
            label={t('calendar.startTime', 'Start')}
            type="datetime-local"
            fullWidth required
            InputLabelProps={{ shrink: true }}
            value={form.start_at}
            onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
          />
          <TextField
            label={t('calendar.endTime', 'End')}
            type="datetime-local"
            fullWidth
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
            fullWidth multiline rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
