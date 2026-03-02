'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Add as AddIcon, Refresh as RefreshIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { caseApi, customerApi, adminApi } from '@/api';
import type { Case, Customer, CaseType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { CAPABILITIES } from '@/auth/capabilities';

const STATE_COLORS: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  Intake: 'default',
  Open: 'info',
  Active: 'primary',
  Pending: 'warning',
  Closed: 'success',
  Archived: 'default',
};

export default function CaseListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [form, setForm] = useState({
    title: '',
    customerId: '',
    caseTypeId: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await caseApi.list({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setCases(prev => [...prev, ...res.data]);
      } else {
        setCases(res.data);
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
    const [custRes, ctRes] = await Promise.all([
      customerApi.list({ limit: 100 }).catch(() => ({ data: [] as Customer[], cursor: null })),
      adminApi.listCaseTypes().catch(() => [] as CaseType[]),
    ]);
    setCustomers(custRes.data);
    setCaseTypes(ctRes.filter(ct => ct.is_active));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await caseApi.create({
        title: form.title,
        description: form.description || undefined,
        caseTypeId: form.caseTypeId,
        customerIds: [form.customerId],
      } as any);
      setDialogOpen(false);
      setForm({ title: '', customerId: '', caseTypeId: '', description: '' });
      router.push(`/cases/${created.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={600}>
          {t('case.title')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={() => load()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {hasAnyRole(...CAPABILITIES.canCreateCase) && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              {t('case.add')}
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('case.caseNumber')}</TableCell>
                <TableCell>{t('case.caseTitle')}</TableCell>
                <TableCell>{t('case.state')}</TableCell>
                <TableCell>{t('case.completeness')}</TableCell>
                <TableCell>{t('common.createdAt')}</TableCell>
                <TableCell width={60} />
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.map(c => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/cases/${c.id}`)}
                >
                  <TableCell sx={{ fontFamily: 'monospace' }}>{c.system_case_ref}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>
                    <Chip label={c.state} size="small" color={STATE_COLORS[c.state] || 'default'} />
                  </TableCell>
                  <TableCell>{c.completeness != null ? `${c.completeness}%` : '—'}</TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <IconButton size="small">
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {cases.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={4}>
                      {t('common.noData')}
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
              {t('common.loadMore')}
            </Button>
          </Box>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('case.add')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('case.caseTitle')}
              fullWidth
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <TextField
              label={t('case.customer')}
              select
              fullWidth
              required
              value={form.customerId}
              onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
            >
              {customers.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('case.caseType')}
              select
              fullWidth
              required
              value={form.caseTypeId}
              onChange={e => setForm(f => ({ ...f, caseTypeId: e.target.value }))}
            >
              {caseTypes.map(ct => (
                <MenuItem key={ct.id} value={ct.id}>
                  {ct.label_en}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('case.description')}
              fullWidth
              multiline
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !form.title || !form.customerId || !form.caseTypeId}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
