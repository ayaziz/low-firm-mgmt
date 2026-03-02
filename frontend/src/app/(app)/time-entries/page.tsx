'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Timer as TimeIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { timeEntryApi } from '@/api';
import type { TimeEntry, TimeEntryStatus, TimeEntrySummary } from '@/types';
import { useAuth } from '@/context/AuthContext';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  Draft: 'default',
  Submitted: 'info',
  Approved: 'success',
  Rejected: 'error',
};

const TIME_ENTRY_TRANSITIONS: Record<string, string[]> = {
  Draft: ['Submitted'],
  Submitted: ['Approved', 'Rejected'],
  Rejected: ['Draft'],
};

export default function TimeEntriesPage() {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<TimeEntrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({
    case_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    hours: 1,
    rate_per_hour: 0,
    description: '',
    activity_type: 'Research',
    billable: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        cursor: cur || undefined,
        limit: 20,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await timeEntryApi.list(params);
      if (cur) {
        setEntries(prev => [...prev, ...res.data]);
      } else {
        setEntries(res.data);
      }
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadSummary = useCallback(async () => {
    try {
      const s = await timeEntryApi.summary(statusFilter ? { status: statusFilter } : undefined);
      setSummary(s);
    } catch {
      // ignore
    }
  }, [statusFilter]);

  useEffect(() => { load(); loadSummary(); }, [load, loadSummary]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await timeEntryApi.create({
        case_id: form.case_id,
        entry_date: form.entry_date,
        hours: form.hours,
        rate_per_hour: form.rate_per_hour,
        description: form.description,
        activity_type: form.activity_type,
        billable: form.billable,
      });
      setDialogOpen(false);
      setForm({ case_id: '', entry_date: new Date().toISOString().split('T')[0], hours: 1, rate_per_hour: 0, description: '', activity_type: 'Research', billable: true });
      load();
      loadSummary();
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (id: string, toStatus: string) => {
    try {
      await timeEntryApi.transition(id, toStatus);
      load();
      loadSummary();
    } catch {
      // error handled
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await timeEntryApi.delete(id);
      load();
      loadSummary();
    } catch {
      // error handled
    }
  };

  const formatHours = (h: number) => {
    if (!h) return '0h';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  const canManage = hasAnyRole('Lawyer', 'TenantAdmin', 'SystemAdmin');
  const canApprove = hasAnyRole('TenantAdmin', 'SystemAdmin', 'Accountant');

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={600}>
          <TimeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('nav.timeEntries', 'Time Entries')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label={t('timeEntry.status', 'Status')}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Draft">Draft</MenuItem>
            <MenuItem value="Submitted">Submitted</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
          </TextField>
          <Tooltip title={t('common.refresh', 'Refresh')}>
            <IconButton onClick={() => { load(); loadSummary(); }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              {t('timeEntry.add', 'Log Time')}
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Summary Cards */}
      {summary && (
        <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
          <Card sx={{ flex: 1, minWidth: 140 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Total Hours</Typography>
              <Typography variant="h6" fontWeight={600}>
                {formatHours(summary.total_hours)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 140 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Billable</Typography>
              <Typography variant="h6" fontWeight={600}>
                {formatHours(summary.billable_hours)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 140 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Total Amount</Typography>
              <Typography variant="h6" fontWeight={600}>
                ${Number(summary.total_amount || 0).toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 140 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Entries</Typography>
              <Typography variant="h6" fontWeight={600}>
                {summary.total_entries}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      )}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('timeEntry.date', 'Date')}</TableCell>
                <TableCell>{t('timeEntry.user', 'User')}</TableCell>
                <TableCell>{t('timeEntry.description', 'Description')}</TableCell>
                <TableCell>{t('timeEntry.activity', 'Activity')}</TableCell>
                <TableCell>{t('timeEntry.duration', 'Duration')}</TableCell>
                <TableCell>{t('timeEntry.amount', 'Amount')}</TableCell>
                <TableCell>{t('timeEntry.status', 'Status')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(entry => {
                const isOwner = entry.user_id === user?.id;
                const transitions = isOwner
                  ? (TIME_ENTRY_TRANSITIONS[entry.status] || []).filter(s => s === 'Submitted' || s === 'Draft')
                  : canApprove
                    ? (TIME_ENTRY_TRANSITIONS[entry.status] || []).filter(s => s === 'Approved' || s === 'Rejected')
                    : [];

                return (
                  <TableRow key={entry.id} hover>
                    <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.user_name || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>{entry.description}</Typography>
                    </TableCell>
                    <TableCell>{entry.activity_type}</TableCell>
                    <TableCell>
                      {formatHours(entry.hours)}
                      {entry.billable && <Chip label="$" size="small" sx={{ ml: 0.5 }} color="success" variant="outlined" />}
                    </TableCell>
                    <TableCell>${Number(entry.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip label={entry.status} size="small" color={STATUS_COLORS[entry.status] || 'default'} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {transitions.length > 0 && (
                          <TextField
                            select
                            size="small"
                            value=""
                            label="→"
                            sx={{ minWidth: 110 }}
                            onChange={e => handleTransition(entry.id, e.target.value)}
                          >
                            {transitions.map(s => (
                              <MenuItem key={s} value={s}>{s}</MenuItem>
                            ))}
                          </TextField>
                        )}
                        {isOwner && entry.status === 'Draft' && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(entry.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {entries.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
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

      {/* Create Time Entry Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('timeEntry.add', 'Log Time')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Case ID" fullWidth required value={form.case_id} onChange={e => setForm(f => ({ ...f, case_id: e.target.value }))} />
            <TextField label="Date" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
            <TextField label="Duration (hours)" type="number" fullWidth required inputProps={{ step: 0.25, min: 0.25 }} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: Number(e.target.value) }))} />
            <TextField label="Hourly Rate" type="number" fullWidth value={form.rate_per_hour} onChange={e => setForm(f => ({ ...f, rate_per_hour: Number(e.target.value) }))} />
            <TextField label="Activity Type" fullWidth value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))} />
            <TextField label="Description" fullWidth required multiline rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <FormControlLabel
              control={<Switch checked={form.billable} onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))} />}
              label="Billable"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.case_id || !form.description}>{t('common.save', 'Save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
