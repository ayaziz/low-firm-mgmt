'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Chip, IconButton, MenuItem, Stack, Switch, TextField, Tooltip,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon,
  AccessTime as TimeIcon, AttachMoney as MoneyIcon,
  Receipt as EntryIcon, Timer as BillableIcon,
} from '@mui/icons-material';
import { timeEntryApi } from '@/api';
import type { TimeEntry } from '@/types';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';
import KPICard from '@/components/common/KPICard';

type TEStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

const TIME_ENTRY_TRANSITIONS: Record<TEStatus, TEStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['Approved', 'Rejected'],
  Rejected: ['Draft'],
  Approved: [],
};

const STATUS_OPTIONS: TEStatus[] = ['Draft', 'Submitted', 'Approved', 'Rejected'];

const formatHours = (h: number) => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

export default function TimeEntriesPage() {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const canApprove = hasAnyRole('TenantAdmin', 'SystemAdmin', 'Accountant');

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Summary KPIs
  const [summary, setSummary] = useState<any>({
    total_hours: 0,
    billable_hours: 0,
    total_amount: 0,
    entry_count: 0,
  });

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    case_id: '',
    date: '',
    hours: '1',
    rate: '',
    activity_type: '',
    description: '',
    billable: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const [res, sum] = await Promise.all([
        timeEntryApi.list(params as any),
        timeEntryApi.summary().catch(() => null),
      ]);
      setEntries(res.data);
      if (sum) setSummary(sum as any);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await timeEntryApi.create({
        case_id: form.case_id,
        date: form.date,
        hours: parseFloat(form.hours),
        rate: form.rate ? parseFloat(form.rate) : undefined,
        activity_type: form.activity_type,
        description: form.description || undefined,
        billable: form.billable,
      } as any);
      setDrawerOpen(false);
      setForm({ case_id: '', date: '', hours: '1', rate: '', activity_type: '', description: '', billable: true });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (entry: TimeEntry, newStatus: TEStatus) => {
    try {
      await timeEntryApi.transition(entry.id, newStatus);
      load();
    } catch { /* will show toast via global handler */ }
  };

  const handleDelete = async (id: string) => {
    await timeEntryApi.delete(id);
    load();
  };

  const isOwner = (entry: TimeEntry) => (entry as any).user_id === user?.id;

  const columns: Column<TimeEntry>[] = [
    {
      field: 'entry_date',
      headerName: t('timeEntries.date', 'Date'),
      width: 120,
      sortable: true,
      renderCell: (row) => new Date((row as any).entry_date || (row as any).date).toLocaleDateString(),
    },
    {
      field: 'user_name',
      headerName: t('timeEntries.user', 'User'),
      width: 150,
      renderCell: (row) => (row as any).user_name || '—',
    },
    { field: 'description', headerName: t('common.description', 'Description'), flex: 2 },
    {
      field: 'activity_type',
      headerName: t('timeEntries.activity', 'Activity'),
      width: 130,
    },
    {
      field: 'hours',
      headerName: t('timeEntries.duration', 'Duration'),
      width: 130,
      sortable: true,
      renderCell: (row) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <span>{formatHours(row.hours)}</span>
          {row.billable && <Chip label={t('timeEntries.billable', 'Billable')} size="small" color="success" variant="outlined" />}
        </Stack>
      ),
    },
    {
      field: 'amount',
      headerName: t('timeEntries.amount', 'Amount'),
      width: 110,
      sortable: true,
      renderCell: (row) => (row as any).amount != null ? `$${Number((row as any).amount).toFixed(2)}` : '—',
    },
    {
      field: 'status',
      headerName: t('timeEntries.status', 'Status'),
      width: 120,
      renderCell: (row) => <StatusBadge status={row.status} />,
    },
    {
      field: 'actions',
      headerName: '',
      width: 180,
      renderCell: (row) => {
        const status = row.status as TEStatus;
        const transitions = TIME_ENTRY_TRANSITIONS[status] || [];
        const allowed = transitions.filter(ns => {
          if (ns === 'Submitted' || ns === 'Draft') return isOwner(row);
          if (ns === 'Approved' || ns === 'Rejected') return canApprove;
          return false;
        });
        return (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {allowed.length > 0 && (
              <TextField
                select size="small"
                value=""
                onChange={e => handleTransition(row, e.target.value as TEStatus)}
                sx={{ minWidth: 100 }}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value="" disabled>{t('common.actions', 'Actions')}</MenuItem>
                {allowed.map(ns => <MenuItem key={ns} value={ns}>{ns}</MenuItem>)}
              </TextField>
            )}
            {status === 'Draft' && isOwner(row) && (
              <Tooltip title={t('common.delete', 'Delete')}>
                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('timeEntries.title', 'Time Entries')}
        subtitle={t('timeEntries.subtitle', 'Track billable and non-billable work time')}
        breadcrumbs={[{ label: t('nav.timeEntries', 'Time Entries') }]}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDrawerOpen(true)}>
            {t('timeEntries.create', 'New Entry')}
          </Button>
        }
      />

      {/* Summary KPI row */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <KPICard title={t('timeEntries.totalHours', 'Total Hours')} value={formatHours(summary.total_hours || 0)} icon={<TimeIcon />} color="primary" />
        <KPICard title={t('timeEntries.billableHours', 'Billable')} value={formatHours(summary.billable_hours || 0)} icon={<BillableIcon />} color="success" />
        <KPICard title={t('timeEntries.totalAmount', 'Total Amount')} value={`$${Number(summary.total_amount || 0).toFixed(2)}`} icon={<MoneyIcon />} color="info" />
        <KPICard title={t('timeEntries.entries', 'Entries')} value={String(summary.entry_count || 0)} icon={<EntryIcon />} color="secondary" />
      </Stack>

      {/* Status filter */}
      <Stack direction="row" spacing={2} sx={{ mb: 2, maxWidth: 280 }}>
        <TextField
          select fullWidth size="small"
          value={statusFilter}
          label={t('timeEntries.status', 'Status')}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <MenuItem value="">{t('common.all', 'All')}</MenuItem>
          {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </Stack>

      <DataGrid<TimeEntry>
        columns={columns}
        rows={entries}
        loading={loading}
        getRowId={(r) => r.id}
        searchPlaceholder={t('timeEntries.search', 'Search time entries…')}
        onRefresh={load}
        emptyMessage={t('timeEntries.empty', 'No time entries found')}
        emptyAction={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDrawerOpen(true)}>
            {t('timeEntries.create', 'New Entry')}
          </Button>
        }
      />

      {/* ----- Create Entry Drawer ----- */}
      <DrawerForm
        open={drawerOpen}
        title={t('timeEntries.create', 'New Entry')}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleCreate}
        loading={saving}
        submitLabel={t('common.save', 'Save')}
      >
        <Stack spacing={2.5}>
          <TextField
            label={t('timeEntries.caseId', 'Case ID')}
            fullWidth required
            value={form.case_id}
            onChange={e => setForm(f => ({ ...f, case_id: e.target.value }))}
          />
          <TextField
            label={t('timeEntries.date', 'Date')}
            type="date"
            fullWidth required
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
          <TextField
            label={t('timeEntries.hours', 'Hours')}
            type="number"
            fullWidth required
            inputProps={{ step: 0.25, min: 0.25 }}
            value={form.hours}
            onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
          />
          <TextField
            label={t('timeEntries.rate', 'Rate ($/hr)')}
            type="number"
            fullWidth
            value={form.rate}
            onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
          />
          <TextField
            label={t('timeEntries.activity', 'Activity Type')}
            fullWidth required
            value={form.activity_type}
            onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
          />
          <TextField
            label={t('common.description', 'Description')}
            fullWidth multiline rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.billable}
                onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))}
              />
            }
            label={t('timeEntries.billable', 'Billable')}
          />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
