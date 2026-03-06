'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Chip, IconButton, MenuItem, Stack, Switch, TextField, Tooltip,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
  AccessTime as TimeIcon, AttachMoney as MoneyIcon,
  Receipt as EntryIcon, Timer as BillableIcon,
} from '@mui/icons-material';
import { timeEntryApi, caseApi } from '@/api'
import type { TimeEntry, Case, Task } from '@/types';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';
import KPICard from '@/components/common/KPICard';

type TEStatus = 'Draft' | 'Submitted' | 'Approved' | 'Billed' | 'WriteOff';

const TIME_ENTRY_TRANSITIONS: Record<TEStatus, TEStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['Approved', 'Draft'],
  Approved: ['Billed', 'WriteOff'],
  Billed: [],
  WriteOff: [],
};

const STATUS_OPTIONS: TEStatus[] = ['Draft', 'Submitted', 'Approved', 'Billed', 'WriteOff'];

const ACTIVITY_TYPES = ['Research', 'Drafting', 'Court Appearance', 'Client Meeting', 'Filing', 'Review', 'Travel', 'Other'];

const formatHours = (h: number) => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

export default function TimeEntriesPage() {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const canApprove = hasAnyRole('TenantAdmin', 'SystemAdmin', 'Accountant');
  const [cases, setCases] = useState<Case[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState({
    case_id: '',
    date: '',
    hours: '1',
    rate: '',
    activity_type: '',
    description: '',
    billable: true,
    task_id: '',
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
      const list = Array.isArray(res) ? res : (res.data ?? [])

      setEntries(list);
      if (sum) setSummary(sum as any);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDrawer = async () => {
    setEditEntry(null);
    setForm({ case_id: '', date: '', hours: '1', rate: '', activity_type: '', description: '', billable: true, task_id: '' });
    setDrawerOpen(true);
    setTasks([]);
    const [caseRes] = await Promise.all([
      caseApi.list({ limit: 100 }).catch(() => ({ data: [], cursor: null })),
    ]);
    setCases(caseRes.data);
  };

  const openEdit = async (entry: TimeEntry) => {
    setEditEntry(entry);
    setForm({
      case_id: (entry as any).case_id || '',
      date: (entry as any).entry_date ? new Date((entry as any).entry_date).toISOString().slice(0, 10) : '',
      hours: String(entry.hours ?? '1'),
      rate: String((entry as any).rate_per_hour ?? (entry as any).rate ?? ''),
      activity_type: (entry as any).activity_type || '',
      description: (entry as any).description || '',
      billable: entry.billable ?? true,
      task_id: (entry as any).task_id || '',
    });
    setDrawerOpen(true);
    // Load tasks for the entry's case
    if ((entry as any).case_id) {
      caseApi.listTasks((entry as any).case_id).then(res => {
        setTasks(Array.isArray(res) ? res : res.data ?? []);
      }).catch(() => setTasks([]));
    } else {
      setTasks([]);
    }
    const [caseRes] = await Promise.all([
      caseApi.list({ limit: 100 }).catch(() => ({ data: [], cursor: null })),
    ]);
    setCases(caseRes.data);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
				case_id: form.case_id,
				entry_date: form.date,
				hours: parseFloat(form.hours),
				rate: form.rate ? parseFloat(form.rate) : undefined,
				activity_type: form.activity_type,
				description: form.description || undefined,
				billable: form.billable,
				taskId: form.task_id || undefined,
			} as any;
      if (editEntry) {
        await timeEntryApi.update(editEntry.id, payload);
      } else {
        await timeEntryApi.create(payload);
      }
      setDrawerOpen(false);
      setForm({ case_id: '', date: '', hours: '1', rate: '', activity_type: '', description: '', billable: true, task_id: '' });
      setEditEntry(null);
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
          if (ns === 'Approved' || ns === 'Billed' || ns === 'WriteOff') return canApprove;
          return false;
        });
        return (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {isOwner(row) && status === 'Draft' && (
              <Tooltip title={t('common.edit', 'Edit')}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
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
				subtitle={t(
					'timeEntries.subtitle',
					'Track billable and non-billable work time',
				)}
				breadcrumbs={[{ label: t('nav.timeEntries', 'Time Entries') }]}
				actions={
					<Button
						variant="contained"
						startIcon={<AddIcon />}
						onClick={openDrawer}
					>
						{t('timeEntries.create', 'New Entry')}
					</Button>
				}
			/>

			{/* Summary KPI row */}
			<Stack
				direction="row"
				spacing={2}
				sx={{ mb: 3 }}
				flexWrap="wrap"
				useFlexGap
			>
				<KPICard
					title={t('timeEntries.totalHours', 'Total Hours')}
					value={formatHours(summary.total_hours || 0)}
					icon={<TimeIcon />}
					color="primary"
				/>
				<KPICard
					title={t('timeEntries.billableHours', 'Billable')}
					value={formatHours(summary.billable_hours || 0)}
					icon={<BillableIcon />}
					color="success"
				/>
				<KPICard
					title={t('timeEntries.totalAmount', 'Total Amount')}
					value={`$${Number(summary.total_amount || 0).toFixed(2)}`}
					icon={<MoneyIcon />}
					color="info"
				/>
				<KPICard
					title={t('timeEntries.entries', 'Entries')}
					value={String(summary.entry_count || 0)}
					icon={<EntryIcon />}
					color="secondary"
				/>
			</Stack>

			{/* Status filter */}
			<Stack direction="row" spacing={2} sx={{ mb: 2, maxWidth: 280 }}>
				<TextField
					select
					fullWidth
					size="small"
					value={statusFilter}
					label={t('timeEntries.status', 'Status')}
					onChange={(e) => setStatusFilter(e.target.value)}
				>
					<MenuItem value="">{t('common.all', 'All')}</MenuItem>
					{STATUS_OPTIONS.map((s) => (
						<MenuItem key={s} value={s}>
							{s}
						</MenuItem>
					))}
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
					<Button
						variant="contained"
						startIcon={<AddIcon />}
						onClick={openDrawer}
					>
						{t('timeEntries.create', 'New Entry')}
					</Button>
				}
			/>

			{/* ----- Create/Edit Entry Drawer ----- */}
			<DrawerForm
				open={drawerOpen}
				title={editEntry ? t('timeEntries.edit', 'Edit Entry') : t('timeEntries.create', 'New Entry')}
				onClose={() => setDrawerOpen(false)}
				onSubmit={handleSave}
				loading={saving}
				submitLabel={t('common.save', 'Save')}
			>
				<Stack spacing={2.5}>
					<TextField
						label={t('case.title')}
						select
						fullWidth
						value={form.case_id}
						onChange={(e) => {
							const cid = e.target.value;
							setForm((f) => ({ ...f, case_id: cid, task_id: '' }));
							if (cid) {
								caseApi.listTasks(cid).then(res => {
									setTasks(Array.isArray(res) ? res : res.data ?? []);
								}).catch(() => setTasks([]));
							} else {
								setTasks([]);
							}
						}}
					>
						<MenuItem value="">— {t('common.noData')} —</MenuItem>
						{cases.map((c) => (
							<MenuItem key={c.id} value={c.id}>
								{c.title} ({c.system_case_ref})
							</MenuItem>
						))}
					</TextField>
					<TextField
						label={t('timeEntries.task', 'Task')}
						select
						fullWidth
						value={form.task_id}
						onChange={(e) => setForm((f) => ({ ...f, task_id: e.target.value }))}
						disabled={!form.case_id || tasks.length === 0}
					>
						<MenuItem value="">— {t('common.none', 'None')} —</MenuItem>
						{tasks.map((tk) => (
							<MenuItem key={tk.id} value={tk.id}>
								{tk.title}
							</MenuItem>
						))}
					</TextField>
					<TextField
						label={t('timeEntries.date', 'Date')}
						type="date"
						fullWidth
						required
						InputLabelProps={{ shrink: true }}
						value={form.date}
						onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
					/>
					<TextField
						label={t('timeEntries.hours', 'Hours')}
						type="number"
						fullWidth
						required
						inputProps={{ step: 0.25, min: 0.25 }}
						value={form.hours}
						onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
					/>
					<TextField
						label={t('timeEntries.rate', 'Rate ($/hr)')}
						type="number"
						fullWidth
						value={form.rate}
						onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
					/>
					<TextField
						label={t('timeEntries.activity', 'Activity Type')}
						select
						fullWidth
						required
						value={form.activity_type}
						onChange={(e) =>
							setForm((f) => ({ ...f, activity_type: e.target.value }))
						}
					>
						{ACTIVITY_TYPES.map(at => <MenuItem key={at} value={at}>{at}</MenuItem>)}
					</TextField>
					<TextField
						label={t('common.description', 'Description')}
						fullWidth
						multiline
						rows={3}
						value={form.description}
						onChange={(e) =>
							setForm((f) => ({ ...f, description: e.target.value }))
						}
					/>
					<FormControlLabel
						control={
							<Switch
								checked={form.billable}
								onChange={(e) =>
									setForm((f) => ({ ...f, billable: e.target.checked }))
								}
							/>
						}
						label={t('timeEntries.billable', 'Billable')}
					/>
				</Stack>
			</DrawerForm>
		</Box>
	)
}
