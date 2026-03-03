'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccountBalance as CourtIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { courtApi } from '@/api';
import type { Court, Judge, CourtType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';

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
  const [judges, setJudges] = useState<Record<string, Judge[]>>({});

  /* ----- Court drawer ----- */
  const [courtOpen, setCourtOpen] = useState(false);
  const [courtForm, setCourtForm] = useState({
    name: '', court_type: 'Civil' as CourtType, jurisdiction: '', address: '', phone: '', email: '',
  });
  const [courtSaving, setCourtSaving] = useState(false);

  /* ----- Judge drawer ----- */
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [judgeForm, setJudgeForm] = useState({ name: '', title: '', chamber: '', phone: '', email: '' });
  const [judgeSaving, setJudgeSaving] = useState(false);

  const canManage = hasAnyRole('TenantAdmin', 'SystemAdmin');

  /* ---------- loaders ---------- */
  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await courtApi.list({ cursor: cur || undefined, limit: 20 });
      if (cur) setCourts(prev => [...prev, ...res.data]);
      else setCourts(res.data);
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadJudges = async (courtId: string) => {
    try {
      const res = await courtApi.listJudges(courtId, { limit: 50 });
      setJudges(prev => ({ ...prev, [courtId]: res.data }));
    } catch { /* ignore */ }
  };

  /* ---------- court CRUD ---------- */
  const handleCreateCourt = async () => {
    setCourtSaving(true);
    try {
      await courtApi.create({
        name: courtForm.name,
        court_type: courtForm.court_type,
        jurisdiction: courtForm.jurisdiction || undefined,
        address: courtForm.address || undefined,
        phone: courtForm.phone || undefined,
        email: courtForm.email || undefined,
      });
      setCourtOpen(false);
      setCourtForm({ name: '', court_type: 'Civil', jurisdiction: '', address: '', phone: '', email: '' });
      load();
    } finally { setCourtSaving(false); }
  };

  /* ---------- judge CRUD ---------- */
  const handleCreateJudge = async () => {
    if (!selectedCourtId) return;
    setJudgeSaving(true);
    try {
      await courtApi.createJudge(selectedCourtId, {
        name: judgeForm.name,
        title: judgeForm.title || undefined,
        chamber: judgeForm.chamber || undefined,
        phone: judgeForm.phone || undefined,
        email: judgeForm.email || undefined,
      });
      setJudgeOpen(false);
      setJudgeForm({ name: '', title: '', chamber: '', phone: '', email: '' });
      loadJudges(selectedCourtId);
    } finally { setJudgeSaving(false); }
  };

  /* ---------- render ---------- */
  if (loading && courts.length === 0) return <LoadingSkeleton variant="cards" />;

  return (
    <Box>
      <PageHeader
        title={t('court.title', 'Courts & Judges')}
        subtitle={t('court.subtitle', 'Manage courts and their assigned judges')}
        breadcrumbs={[{ label: t('nav.courts', 'Courts') }]}
        actions={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCourtOpen(true)}>
              {t('court.add', 'Add Court')}
            </Button>
          ) : undefined
        }
      />

      {courts.length === 0 && !loading ? (
        <EmptyState
          icon={<CourtIcon sx={{ fontSize: 48 }} />}
          title={t('court.empty', 'No courts yet')}
          message={t('court.emptyMessage', 'Add a court to start managing judges')}
          action={
            canManage ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCourtOpen(true)}>
                {t('court.add', 'Add Court')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {courts.map(court => (
            <Accordion
              key={court.id}
              sx={{ mb: 1, '&:before': { display: 'none' }, borderRadius: 1 }}
              onChange={(_, expanded) => {
                if (expanded && !judges[court.id]) loadJudges(court.id);
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center" flex={1}>
                  <CourtIcon color="primary" fontSize="small" />
                  <Typography fontWeight={600}>{court.name}</Typography>
                  <StatusBadge status={court.court_type} variant="outlined" />
                  {court.jurisdiction && (
                    <Typography variant="body2" color="text.secondary">{court.jurisdiction}</Typography>
                  )}
                  {!court.is_active && <StatusBadge status="Inactive" />}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1} mb={2}>
                  {court.address && (
                    <Typography variant="body2">
                      <strong>{t('court.address', 'Address')}:</strong> {court.address}
                    </Typography>
                  )}
                  {court.phone && (
                    <Typography variant="body2">
                      <strong>{t('court.phone', 'Phone')}:</strong> {court.phone}
                    </Typography>
                  )}
                  {court.email && (
                    <Typography variant="body2">
                      <strong>{t('court.email', 'Email')}:</strong> {court.email}
                    </Typography>
                  )}
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('court.judges', 'Judges')}
                  </Typography>
                  {canManage && (
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => { setSelectedCourtId(court.id); setJudgeOpen(true); }}
                    >
                      {t('court.addJudge', 'Add Judge')}
                    </Button>
                  )}
                </Stack>

                {judges[court.id] && judges[court.id].length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('court.judgeName', 'Name')}</TableCell>
                        <TableCell>{t('court.judgeTitle', 'Title')}</TableCell>
                        <TableCell>{t('court.chamber', 'Chamber')}</TableCell>
                        <TableCell>{t('court.contact', 'Contact')}</TableCell>
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
                    {judges[court.id] ? t('court.noJudges', 'No judges found') : t('common.loading')}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          ))}

          {hasMore && (
            <Box textAlign="center" py={2}>
              <Button onClick={() => load(cursor)} disabled={loading}>
                {t('common.loadMore', 'Load More')}
              </Button>
            </Box>
          )}
        </>
      )}

      {/* ---------- Court Drawer ---------- */}
      <DrawerForm
        open={courtOpen}
        title={t('court.add', 'Add Court')}
        onClose={() => setCourtOpen(false)}
        onSubmit={handleCreateCourt}
        loading={courtSaving}
        submitLabel={t('common.save', 'Save')}
      >
        <Stack spacing={2.5}>
          <TextField
            label={t('court.courtName', 'Court Name')}
            fullWidth required
            value={courtForm.name}
            onChange={e => setCourtForm(f => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label={t('court.courtType', 'Court Type')}
            select fullWidth
            value={courtForm.court_type}
            onChange={e => setCourtForm(f => ({ ...f, court_type: e.target.value as CourtType }))}
          >
            {COURT_TYPES.map(ct => <MenuItem key={ct} value={ct}>{ct}</MenuItem>)}
          </TextField>
          <TextField
            label={t('court.jurisdiction', 'Jurisdiction')}
            fullWidth
            value={courtForm.jurisdiction}
            onChange={e => setCourtForm(f => ({ ...f, jurisdiction: e.target.value }))}
          />
          <TextField
            label={t('court.address', 'Address')}
            fullWidth
            value={courtForm.address}
            onChange={e => setCourtForm(f => ({ ...f, address: e.target.value }))}
          />
          <TextField
            label={t('court.phone', 'Phone')}
            fullWidth
            value={courtForm.phone}
            onChange={e => setCourtForm(f => ({ ...f, phone: e.target.value }))}
          />
          <TextField
            label={t('court.email', 'Email')}
            fullWidth
            value={courtForm.email}
            onChange={e => setCourtForm(f => ({ ...f, email: e.target.value }))}
          />
        </Stack>
      </DrawerForm>

      {/* ---------- Judge Drawer ---------- */}
      <DrawerForm
        open={judgeOpen}
        title={t('court.addJudge', 'Add Judge')}
        onClose={() => setJudgeOpen(false)}
        onSubmit={handleCreateJudge}
        loading={judgeSaving}
        submitLabel={t('common.save', 'Save')}
      >
        <Stack spacing={2.5}>
          <TextField
            label={t('court.judgeName', 'Judge Name')}
            fullWidth required
            value={judgeForm.name}
            onChange={e => setJudgeForm(f => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label={t('court.judgeTitle', 'Title')}
            fullWidth
            value={judgeForm.title}
            onChange={e => setJudgeForm(f => ({ ...f, title: e.target.value }))}
          />
          <TextField
            label={t('court.chamber', 'Chamber')}
            fullWidth
            value={judgeForm.chamber}
            onChange={e => setJudgeForm(f => ({ ...f, chamber: e.target.value }))}
          />
          <TextField
            label={t('court.phone', 'Phone')}
            fullWidth
            value={judgeForm.phone}
            onChange={e => setJudgeForm(f => ({ ...f, phone: e.target.value }))}
          />
          <TextField
            label={t('court.email', 'Email')}
            fullWidth
            value={judgeForm.email}
            onChange={e => setJudgeForm(f => ({ ...f, email: e.target.value }))}
          />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
