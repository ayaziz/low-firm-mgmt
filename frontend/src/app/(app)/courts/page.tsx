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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  AccountBalance as CourtIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { courtApi } from '@/api';
import type { Court, Judge, CourtType } from '@/types';
import { useAuth } from '@/context/AuthContext';

const COURT_TYPES: CourtType[] = [
  'Civil', 'Criminal', 'Family', 'Commercial', 'Administrative',
  'Labor', 'Constitutional', 'Appeal', 'Cassation', 'Other',
];

export default function CourtsPage() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [judgeDialogOpen, setJudgeDialogOpen] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [judges, setJudges] = useState<Record<string, Judge[]>>({});
  const [form, setForm] = useState({
    name: '',
    court_type: 'Civil' as CourtType,
    jurisdiction: '',
    address: '',
    phone: '',
    email: '',
  });
  const [judgeForm, setJudgeForm] = useState({
    name: '',
    title: '',
    chamber: '',
    phone: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await courtApi.list({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setCourts(prev => [...prev, ...res.data]);
      } else {
        setCourts(res.data);
      }
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadJudges = async (courtId: string) => {
    try {
      const res = await courtApi.listJudges(courtId, { limit: 50 });
      setJudges(prev => ({ ...prev, [courtId]: res.data }));
    } catch {
      // ignore
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await courtApi.create({
        name: form.name,
        court_type: form.court_type,
        jurisdiction: form.jurisdiction || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
      });
      setDialogOpen(false);
      setForm({ name: '', court_type: 'Civil', jurisdiction: '', address: '', phone: '', email: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateJudge = async () => {
    if (!selectedCourtId) return;
    setSaving(true);
    try {
      await courtApi.createJudge(selectedCourtId, {
        name: judgeForm.name,
        title: judgeForm.title || undefined,
        chamber: judgeForm.chamber || undefined,
        phone: judgeForm.phone || undefined,
        email: judgeForm.email || undefined,
      });
      setJudgeDialogOpen(false);
      setJudgeForm({ name: '', title: '', chamber: '', phone: '', email: '' });
      loadJudges(selectedCourtId);
    } finally {
      setSaving(false);
    }
  };

  const canManage = hasAnyRole('TenantAdmin', 'SystemAdmin');

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={600}>
          <CourtIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('nav.courts', 'Courts & Judges')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('common.refresh', 'Refresh')}>
            <IconButton onClick={() => load()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              {t('court.add', 'Add Court')}
            </Button>
          )}
        </Stack>
      </Stack>

      {courts.map(court => (
        <Accordion
          key={court.id}
          onChange={(_, expanded) => { if (expanded && !judges[court.id]) loadJudges(court.id); }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={2} alignItems="center" flex={1}>
              <Typography fontWeight={600}>{court.name}</Typography>
              <Chip label={court.court_type} size="small" variant="outlined" />
              {court.jurisdiction && (
                <Typography variant="body2" color="text.secondary">{court.jurisdiction}</Typography>
              )}
              {!court.is_active && (
                <Chip label="Inactive" size="small" color="default" />
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1} mb={2}>
              {court.address && <Typography variant="body2"><strong>Address:</strong> {court.address}</Typography>}
              {court.phone && <Typography variant="body2"><strong>Phone:</strong> {court.phone}</Typography>}
              {court.email && <Typography variant="body2"><strong>Email:</strong> {court.email}</Typography>}
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2">Judges</Typography>
              {canManage && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => { setSelectedCourtId(court.id); setJudgeDialogOpen(true); }}
                >
                  {t('court.addJudge', 'Add Judge')}
                </Button>
              )}
            </Stack>
            {judges[court.id] && judges[court.id].length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Chamber</TableCell>
                    <TableCell>Contact</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {judges[court.id].map(j => (
                    <TableRow key={j.id}>
                      <TableCell>{j.name}</TableCell>
                      <TableCell>{j.title || '—'}</TableCell>
                      <TableCell>{j.chamber || '—'}</TableCell>
                      <TableCell>{j.email || j.phone || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {judges[court.id] ? 'No judges found' : 'Loading...'}
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      ))}

      {courts.length === 0 && !loading && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('common.noData', 'No data found')}</Typography>
        </Card>
      )}

      {hasMore && (
        <Box textAlign="center" py={2}>
          <Button onClick={() => load(cursor)} disabled={loading}>
            {t('common.loadMore', 'Load More')}
          </Button>
        </Box>
      )}

      {/* Create Court Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('court.add', 'Add Court')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Court Name" fullWidth required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <TextField label="Court Type" select fullWidth value={form.court_type} onChange={e => setForm(f => ({ ...f, court_type: e.target.value as CourtType }))}>
              {COURT_TYPES.map(ct => <MenuItem key={ct} value={ct}>{ct}</MenuItem>)}
            </TextField>
            <TextField label="Jurisdiction" fullWidth value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} />
            <TextField label="Address" fullWidth value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            <TextField label="Phone" fullWidth value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <TextField label="Email" fullWidth value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.name}>{t('common.save', 'Save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Create Judge Dialog */}
      <Dialog open={judgeDialogOpen} onClose={() => setJudgeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('court.addJudge', 'Add Judge')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Judge Name" fullWidth required value={judgeForm.name} onChange={e => setJudgeForm(f => ({ ...f, name: e.target.value }))} />
            <TextField label="Title" fullWidth value={judgeForm.title} onChange={e => setJudgeForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label="Chamber" fullWidth value={judgeForm.chamber} onChange={e => setJudgeForm(f => ({ ...f, chamber: e.target.value }))} />
            <TextField label="Phone" fullWidth value={judgeForm.phone} onChange={e => setJudgeForm(f => ({ ...f, phone: e.target.value }))} />
            <TextField label="Email" fullWidth value={judgeForm.email} onChange={e => setJudgeForm(f => ({ ...f, email: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJudgeDialogOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" onClick={handleCreateJudge} disabled={saving || !judgeForm.name}>{t('common.save', 'Save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
