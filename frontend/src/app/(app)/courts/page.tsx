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
  IconButton,
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
  Edit as EditIcon,
} from '@mui/icons-material';
import { courtApi } from '@/api';
import type { Court, Judge, JurisdictionLevel } from '@/types';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';

const JURISDICTION_LEVELS: JurisdictionLevel[] = [
  'District', 'Appeal', 'Supreme', 'Specialized',
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
    name: '',
    department: '',
    circuit: '',
    jurisdictionLevel: 'District' as JurisdictionLevel,
    city: '',
    addressText: '',
    phone: '',
    notes: '',
  });
  const [courtSaving, setCourtSaving] = useState(false);
  const [editCourt, setEditCourt] = useState<Court | null>(null);

  /* ----- Judge drawer ----- */
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [judgeForm, setJudgeForm] = useState({
		fullName: '',
		title: '',
		specialization: '',
		phone: '',
		email: '',
	})
  const [judgeSaving, setJudgeSaving] = useState(false);
  const [editJudge, setEditJudge] = useState<Judge | null>(null);

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
  const openCreateCourt = () => {
    setEditCourt(null);
    setCourtForm({
      name: '',
      department: '',
      circuit: '',
      jurisdictionLevel: 'District',
      city: '',
      addressText: '',
      phone: '',
      notes: '',
    });
    setCourtOpen(true);
  };

  const openEditCourt = (court: Court) => {
    setEditCourt(court);
    setCourtForm({
      name: court.name || '',
      department: court.department || '',
      circuit: court.circuit || '',
      jurisdictionLevel: (court.jurisdiction_level || 'District') as JurisdictionLevel,
      city: court.city || '',
      addressText: court.address_text || '',
      phone: court.phone || '',
      notes: court.notes || '',
    });
    setCourtOpen(true);
  };

  const handleSaveCourt = async () => {
    setCourtSaving(true);
    try {
      const courtPayload = {
        name: courtForm.name,
        department: courtForm.department || undefined,
        circuit: courtForm.circuit || undefined,
        jurisdictionLevel: courtForm.jurisdictionLevel || undefined,
        city: courtForm.city || undefined,
        addressText: courtForm.addressText || undefined,
        phone: courtForm.phone || undefined,
        notes: courtForm.notes || undefined,
      };
      if (editCourt) {
        await courtApi.update(editCourt.id, courtPayload as any);
      } else {
        await courtApi.create(courtPayload as any);
      }
      setCourtOpen(false);
      setEditCourt(null);
      setCourtForm({
        name: '',
        department: '',
        circuit: '',
        jurisdictionLevel: 'District',
        city: '',
        addressText: '',
        phone: '',
        notes: '',
      });
      load();
    } finally { setCourtSaving(false); }
  };

  /* ---------- judge CRUD ---------- */
  const openCreateJudge = (courtId: string) => {
    setEditJudge(null);
    setSelectedCourtId(courtId);
    setJudgeForm({ fullName: '', title: '', specialization: '', phone: '', email: '' });
    setJudgeOpen(true);
  };

  const openEditJudge = (courtId: string, judge: Judge) => {
    setEditJudge(judge);
    setSelectedCourtId(courtId);
    setJudgeForm({
      fullName: judge.full_name || judge.name || '',
			title: judge.title || '',
			specialization: judge.specialization || '',
			phone: judge.phone || '',
			email: judge.email || '',
		})
    setJudgeOpen(true);
  };

  const handleSaveJudge = async () => {
    if (!selectedCourtId) return;
    setJudgeSaving(true);
    try {
      if (editJudge) {
        await courtApi.updateJudge(selectedCourtId, editJudge.id, {
          fullName: judgeForm.fullName,
          title: judgeForm.title || undefined,
          specialization: judgeForm.specialization || undefined,
          phone: judgeForm.phone || undefined,
          email: judgeForm.email || undefined,
        });
      } else {
        await courtApi.createJudge(selectedCourtId, {
          fullName: judgeForm.fullName,
          title: judgeForm.title || undefined,
          specialization: judgeForm.specialization || undefined,
          phone: judgeForm.phone || undefined,
          email: judgeForm.email || undefined,
        });
      }
      setJudgeOpen(false);
      setEditJudge(null);
      setJudgeForm({ fullName: '', title: '', specialization: '', phone: '', email: '' });
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
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateCourt}>
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
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateCourt}>
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
                  <StatusBadge status={court.jurisdiction_level || court.department || '—'} variant="outlined" />
                  {court.city && (
                    <Typography variant="body2" color="text.secondary">{court.city}</Typography>
                  )}
                  {!court.is_active && <StatusBadge status="Inactive" />}
                  {canManage && (
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditCourt(court); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1} mb={2}>
                  {court.department && (
                    <Typography variant="body2">
                      <strong>{t('court.department', 'Department')}:</strong> {court.department}
                    </Typography>
                  )}
                  {court.circuit && (
                    <Typography variant="body2">
                      <strong>{t('court.circuit', 'Circuit')}:</strong> {court.circuit}
                    </Typography>
                  )}
                  {court.address_text && (
                    <Typography variant="body2">
                      <strong>{t('court.address', 'Address')}:</strong> {court.address_text}
                    </Typography>
                  )}
                  {court.phone && (
                    <Typography variant="body2">
                      <strong>{t('court.phone', 'Phone')}:</strong> {court.phone}
                    </Typography>
                  )}
                  {court.notes && (
                    <Typography variant="body2">
                      <strong>{t('court.notes', 'Notes')}:</strong> {court.notes}
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
                      onClick={() => openCreateJudge(court.id)}
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
                        {canManage && <TableCell>{t('common.actions', 'Actions')}</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {judges[court.id].map(j => (
                        <TableRow key={j.id}>
                          <TableCell>{j.full_name || j.name}</TableCell>
                          <TableCell>{j.title || '—'}</TableCell>
                          <TableCell>{j.specialization || '—'}</TableCell>
                          <TableCell>{j.email || j.phone || '—'}</TableCell>
                          {canManage && (
                            <TableCell>
                              <IconButton size="small" onClick={() => openEditJudge(court.id, j)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          )}
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
        title={editCourt ? t('court.editCourt', 'Edit Court') : t('court.add', 'Add Court')}
        onClose={() => { setCourtOpen(false); setEditCourt(null); }}
        onSubmit={handleSaveCourt}
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
            label={t('court.department', 'Department')}
            fullWidth
            value={courtForm.department}
            onChange={e => setCourtForm(f => ({ ...f, department: e.target.value }))}
          />
          <TextField
            label={t('court.circuit', 'Circuit')}
            fullWidth
            value={courtForm.circuit}
            onChange={e => setCourtForm(f => ({ ...f, circuit: e.target.value }))}
          />
          <TextField
            label={t('court.jurisdictionLevel', 'Jurisdiction Level')}
            select fullWidth
            value={courtForm.jurisdictionLevel}
            onChange={e => setCourtForm(f => ({ ...f, jurisdictionLevel: e.target.value as JurisdictionLevel }))}
          >
            {JURISDICTION_LEVELS.map(level => <MenuItem key={level} value={level}>{level}</MenuItem>)}
          </TextField>
          <TextField
            label={t('court.city', 'City')}
            fullWidth
            value={courtForm.city}
            onChange={e => setCourtForm(f => ({ ...f, city: e.target.value }))}
          />
          <TextField
            label={t('court.address', 'Address')}
            fullWidth
            value={courtForm.addressText}
            onChange={e => setCourtForm(f => ({ ...f, addressText: e.target.value }))}
          />
          <TextField
            label={t('court.phone', 'Phone')}
            fullWidth
            value={courtForm.phone}
            onChange={e => setCourtForm(f => ({ ...f, phone: e.target.value }))}
          />
          <TextField
            label={t('court.notes', 'Notes')}
            fullWidth
            multiline
            minRows={2}
            value={courtForm.notes}
            onChange={e => setCourtForm(f => ({ ...f, notes: e.target.value }))}
          />
        </Stack>
      </DrawerForm>

      {/* ---------- Judge Drawer ---------- */}
      <DrawerForm
        open={judgeOpen}
        title={editJudge ? t('court.editJudge', 'Edit Judge') : t('court.addJudge', 'Add Judge')}
        onClose={() => { setJudgeOpen(false); setEditJudge(null); }}
        onSubmit={handleSaveJudge}
        loading={judgeSaving}
        submitLabel={t('common.save', 'Save')}
      >
        <Stack spacing={2.5}>
          <TextField
            label={t('court.judgeName', 'Judge Name')}
            fullWidth required
            value={judgeForm.fullName}
            onChange={e => setJudgeForm(f => ({ ...f, fullName: e.target.value }))}
          />
          <TextField
            label={t('court.judgeTitle', 'Title')}
            fullWidth
            value={judgeForm.title}
            onChange={e => setJudgeForm(f => ({ ...f, title: e.target.value }))}
          />
          <TextField
            label={t('court.specialization', 'Specialization')}
            fullWidth
            value={judgeForm.specialization}
            onChange={e => setJudgeForm(f => ({ ...f, specialization: e.target.value }))}
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
