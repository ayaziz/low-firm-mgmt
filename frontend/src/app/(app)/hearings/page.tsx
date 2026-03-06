'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { hearingApi, courtApi, caseApi } from '@/api';
import type { Hearing, Court, Case, Judge } from '@/types';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import StatusBadge from '@/components/common/StatusBadge';
import DrawerForm from '@/components/common/DrawerForm';

const HEARING_TYPES = ['Initial', 'Continuation', 'Ruling', 'Appeal', 'Procedural'];

const HEARING_TRANSITIONS: Record<string, string[]> = {
  Scheduled: ['Confirmed', 'Postponed', 'Cancelled'],
  Confirmed: ['InProgress', 'Adjourned', 'Postponed', 'Cancelled'],
  InProgress: ['Adjourned', 'Completed', 'Postponed', 'Cancelled'],
  Adjourned: ['Scheduled', 'Cancelled'],
  Postponed: ['Scheduled', 'Cancelled'],
};

const emptyForm = { case_id: '', court_id: '', judge_id: '', hearing_date: '', hearing_type: 'Initial', location: '', notes: '' };

export default function HearingsPage() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [editHearing, setEditHearing] = useState<Hearing | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hearingApi.list({ limit: 50 });
      const items = Array.isArray(res) ? res : ((res as any).data ?? []);
      setHearings(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDropdowns = async () => {
    const [courtRes, caseRes, judgeRes] = await Promise.all([
      courtApi.list({ limit: 100 }).catch(() => ({ data: [] as Court[] })),
      caseApi.list({ limit: 200 }).catch(() => ({ data: [] as Case[] })),
      courtApi.listJudges(undefined, { limit: 200 }).catch(() => ({ data: [] as Judge[] })),
    ]);
    setCourts((courtRes as any).data || []);
    setCases((caseRes as any).data || []);
    setJudges((judgeRes as any).data || []);
  };

  const openCreate = async () => {
    setEditHearing(null);
    setForm({ ...emptyForm });
    setDrawerOpen(true);
    await loadDropdowns();
  };

  const openEdit = async (h: Hearing) => {
    setEditHearing(h);
    setForm({
      case_id: h.case_id || '',
      court_id: h.court_id || '',
      judge_id: h.judge_id || '',
      hearing_date: h.hearing_date ? new Date(h.hearing_date).toISOString().slice(0, 16) : '',
      hearing_type: h.hearing_type || 'Initial',
      location: (h as any).location || '',
      notes: (h as any).notes || '',
    });
    setDrawerOpen(true);
    await loadDropdowns();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        case_id: form.case_id,
        court_id: form.court_id || undefined,
        judge_id: form.judge_id || undefined,
        hearing_date: form.hearing_date,
        hearing_type: form.hearing_type,
        location: form.location || undefined,
        notes: form.notes || undefined,
      };
      if (editHearing) {
        await hearingApi.update(editHearing.id, payload);
      } else {
        await hearingApi.create(payload);
      }
      setDrawerOpen(false);
      setForm({ ...emptyForm });
      setEditHearing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (hearingId: string, toStatus: string) => {
    try {
      await hearingApi.transition(hearingId, toStatus);
      load();
    } catch {
      // handled by API error
    }
  };

  const canManage = hasAnyRole('Lawyer', 'TenantAdmin', 'SystemAdmin');
  const caseLookup = new Map(cases.map((item) => [item.id, item.title]));
  const courtLookup = new Map(courts.map((item) => [item.id, item.name]));
  const judgeLookup = new Map(judges.map((item) => [item.id, item.full_name || item.name || '']));
  const visibleJudges = form.court_id ? judges.filter((j) => j.court_id === form.court_id) : judges;

  const columns: Column<Hearing>[] = [
    {
      field: 'case_title',
      headerName: t('hearing.case', 'Case'),
      sortable: true,
      renderCell: (row) => row.case_title || caseLookup.get(row.case_id) || '—',
    },
    {
      field: 'court_name',
      headerName: t('hearing.court', 'Court'),
      renderCell: (row) => row.court_name || (row.court_id ? courtLookup.get(row.court_id) || '—' : '—'),
    },
    {
      field: 'judge_name',
      headerName: t('hearing.judge', 'Judge'),
      width: 140,
      renderCell: (row) => row.judge_name || (row.judge_id ? judgeLookup.get(row.judge_id) || '—' : '—'),
    },
    { field: 'hearing_type', headerName: t('hearing.type', 'Type'), width: 120 },
    {
      field: 'hearing_date',
      headerName: t('hearing.date', 'Date'),
      width: 160,
      sortable: true,
      renderCell: (row) => new Date(row.hearing_date).toLocaleString(),
    },
    {
      field: 'status',
      headerName: t('hearing.status', 'Status'),
      width: 120,
      renderCell: (row) => <StatusBadge status={row.status} size="small" />,
    },
    {
      field: '_actions',
      headerName: t('common.actions', 'Actions'),
      width: 180,
      renderCell: (row) => {
        const transitions = HEARING_TRANSITIONS[row.status] || [];
        return (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {canManage && (
              <Tooltip title={t('common.edit', 'Edit')}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canManage && transitions.length > 0 && (
              <TextField
                select
                size="small"
                value=""
                label="→"
                sx={{ minWidth: 110 }}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleTransition(row.id, e.target.value)}
              >
                {transitions.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('nav.hearings', 'Hearings')}
        actions={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {t('hearing.add', 'New Hearing')}
            </Button>
          ) : undefined
        }
      />

      <DataGrid<Hearing>
        columns={columns}
        rows={hearings}
        loading={loading}
        getRowId={(r) => r.id}
        onRefresh={load}
        emptyMessage={t('common.noData')}
      />

      <DrawerForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editHearing ? t('hearing.edit', 'Edit Hearing') : t('hearing.add', 'New Hearing')}
        onSubmit={handleSave}
        loading={saving}
      >
        <Stack spacing={2}>
          <TextField
            label={t('hearing.case', 'Case')}
            select
            fullWidth
            required
            value={form.case_id}
            onChange={(e) => setForm((f) => ({ ...f, case_id: e.target.value }))}
          >
            <MenuItem value="">— {t('common.select', 'Select')} —</MenuItem>
            {cases.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.title} ({c.system_case_ref})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('hearing.court', 'Court')}
            select
            fullWidth
            required
            value={form.court_id}
            onChange={(e) => setForm((f) => ({ ...f, court_id: e.target.value, judge_id: '' }))}
          >
            <MenuItem value="">— {t('common.none', 'None')} —</MenuItem>
            {courts.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('hearing.judge', 'Judge')}
            select
            fullWidth
            value={form.judge_id}
            onChange={(e) => setForm((f) => ({ ...f, judge_id: e.target.value }))}
          >
            <MenuItem value="">— {t('common.none', 'None')} —</MenuItem>
            {visibleJudges.map((j) => (
              <MenuItem key={j.id} value={j.id}>{j.full_name || j.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('hearing.date', 'Hearing Date')}
            type="datetime-local"
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
            value={form.hearing_date}
            onChange={(e) => setForm((f) => ({ ...f, hearing_date: e.target.value }))}
          />
          <TextField
            label={t('hearing.type', 'Type')}
            select
            fullWidth
            required
            value={form.hearing_type}
            onChange={(e) => setForm((f) => ({ ...f, hearing_type: e.target.value }))}
          >
            {HEARING_TYPES.map((ht) => (
              <MenuItem key={ht} value={ht}>{ht}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('hearing.location', 'Location')}
            fullWidth
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
          <TextField
            label={t('hearing.notes', 'Notes')}
            fullWidth
            multiline
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
