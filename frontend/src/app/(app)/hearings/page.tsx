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
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Gavel as HearingIcon,
} from '@mui/icons-material';
import { hearingApi, courtApi } from '@/api';
import type { Hearing, HearingStatus, Court } from '@/types';
import { useAuth } from '@/context/AuthContext';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  Scheduled: 'info',
  Confirmed: 'primary',
  InProgress: 'warning',
  Adjourned: 'default',
  Completed: 'success',
  Cancelled: 'error',
};

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
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await hearingApi.list({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setHearings(prev => [...prev, ...res.data]);
      } else {
        setHearings(res.data);
      }
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreateDialog = async () => {
    setDialogOpen(true);
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
      setDialogOpen(false);
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

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={600}>
          <HearingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('nav.hearings', 'Hearings')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('common.refresh', 'Refresh')}>
            <IconButton onClick={() => load()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              {t('hearing.add', 'New Hearing')}
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('hearing.case', 'Case')}</TableCell>
                <TableCell>{t('hearing.court', 'Court')}</TableCell>
                <TableCell>{t('hearing.judge', 'Judge')}</TableCell>
                <TableCell>{t('hearing.type', 'Type')}</TableCell>
                <TableCell>{t('hearing.date', 'Date')}</TableCell>
                <TableCell>{t('hearing.status', 'Status')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hearings.map(h => {
                const transitions = HEARING_TRANSITIONS[h.status] || [];
                return (
                  <TableRow key={h.id} hover>
                    <TableCell>{h.case_title || h.case_id}</TableCell>
                    <TableCell>{h.court_name || h.court_id}</TableCell>
                    <TableCell>{h.judge_name || '—'}</TableCell>
                    <TableCell>{h.hearing_type}</TableCell>
                    <TableCell>{new Date(h.hearing_date).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip label={h.status} size="small" color={STATUS_COLORS[h.status] || 'default'} />
                    </TableCell>
                    <TableCell>
                      {canManage && transitions.length > 0 && (
                        <TextField
                          select
                          size="small"
                          value=""
                          label="→"
                          sx={{ minWidth: 120 }}
                          onChange={e => handleTransition(h.id, e.target.value)}
                        >
                          {transitions.map(s => (
                            <MenuItem key={s} value={s}>{s}</MenuItem>
                          ))}
                        </TextField>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {hearings.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
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

      {/* Create Hearing Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('hearing.add', 'New Hearing')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('hearing.caseId', 'Case ID')}
              fullWidth
              required
              value={form.case_id}
              onChange={e => setForm(f => ({ ...f, case_id: e.target.value }))}
              helperText="Enter the case ID"
            />
            <TextField
              label={t('hearing.court', 'Court')}
              select
              fullWidth
              required
              value={form.court_id}
              onChange={e => setForm(f => ({ ...f, court_id: e.target.value }))}
            >
              {courts.map(c => (
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
              onChange={e => setForm(f => ({ ...f, hearing_date: e.target.value }))}
            />
            <TextField
              label={t('hearing.type', 'Type')}
              fullWidth
              value={form.hearing_type}
              onChange={e => setForm(f => ({ ...f, hearing_type: e.target.value }))}
            />
            <TextField
              label={t('hearing.location', 'Location')}
              fullWidth
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            />
            <TextField
              label={t('hearing.notes', 'Notes')}
              fullWidth
              multiline
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !form.case_id || !form.court_id || !form.hearing_date}
          >
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
