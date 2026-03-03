'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { hearingApi, courtApi } from '@/api';
import type { Hearing, Court } from '@/types';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import StatusBadge from '@/components/common/StatusBadge';
import DrawerForm from '@/components/common/DrawerForm';

const HEARING_TRANSITIONS: Record<string, string[]> = {
  Scheduled: ['Confirmed', 'Cancelled'],
  Confirmed: ['InProgress', 'Adjourned', 'Cancelled'],
  InProgress: ['Adjourned', 'Completed'],
  Adjourned: ['Scheduled', 'Cancelled'],
};

export default function HearingsPage() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [form, setForm] = useState({
    case_id: '',
    court_id: '',
    hearing_date: '',
    hearing_type: 'Regular',
    location: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hearingApi.list({ limit: 50 });
      setHearings(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDrawer = async () => {
    setDrawerOpen(true);
    const res = await courtApi.list({ limit: 100 }).catch(() => ({ data: [] as Court[] }));
    setCourts((res as any).data || []);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await hearingApi.create({
        case_id: form.case_id,
        court_id: form.court_id,
        hearing_date: form.hearing_date,
        hearing_type: form.hearing_type,
        location: form.location || undefined,
        notes: form.notes || undefined,
      });
      setDrawerOpen(false);
      setForm({ case_id: '', court_id: '', hearing_date: '', hearing_type: 'Regular', location: '', notes: '' });
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

  const columns: Column<Hearing>[] = [
    {
      field: 'case_title',
      headerName: t('hearing.case', 'Case'),
      sortable: true,
      renderCell: (row) => row.case_title || row.case_id,
    },
    {
      field: 'court_name',
      headerName: t('hearing.court', 'Court'),
      renderCell: (row) => row.court_name || row.court_id,
    },
    {
      field: 'judge_name',
      headerName: t('hearing.judge', 'Judge'),
      width: 140,
      renderCell: (row) => row.judge_name || '—',
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
      width: 140,
      renderCell: (row) => {
        const transitions = HEARING_TRANSITIONS[row.status] || [];
        if (!canManage || transitions.length === 0) return null;
        return (
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
            <Button variant="contained" startIcon={<AddIcon />} onClick={openDrawer}>
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
        title={t('hearing.add', 'New Hearing')}
        onSubmit={handleCreate}
        loading={saving}
      >
        <Stack spacing={2}>
          <TextField
            label={t('hearing.caseId', 'Case ID')}
            fullWidth
            required
            value={form.case_id}
            onChange={(e) => setForm((f) => ({ ...f, case_id: e.target.value }))}
            helperText={t('hearing.caseIdHelp', 'Enter the case ID')}
          />
          <TextField
            label={t('hearing.court', 'Court')}
            select
            fullWidth
            required
            value={form.court_id}
            onChange={(e) => setForm((f) => ({ ...f, court_id: e.target.value }))}
          >
            {courts.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
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
            fullWidth
            value={form.hearing_type}
            onChange={(e) => setForm((f) => ({ ...f, hearing_type: e.target.value }))}
          />
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
