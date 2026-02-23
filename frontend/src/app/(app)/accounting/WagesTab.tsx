'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
  FileDownload as ExportIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { accountingApi } from '@/api';
import type { Wage } from '@/types';

export default function WagesTab() {
  const { t } = useTranslation();
  const [wages, setWages] = useState<Wage[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ userId: '', period: '', baseAmount: 0, bonusAmount: 0, deductions: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await accountingApi.listWages({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setWages(prev => [...prev, ...res.data]);
      } else {
        setWages(res.data);
      }
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await accountingApi.createWage({
        userId: form.userId,
        period: form.period,
        baseAmount: Number(form.baseAmount),
        bonusAmount: Number(form.bonusAmount),
        deductions: Number(form.deductions),
      });
      setDialogOpen(false);
      setForm({ userId: '', period: '', baseAmount: 0, bonusAmount: 0, deductions: 0 });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    await accountingApi.exportWagesCsv();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" spacing={1} mb={2}>
        <Tooltip title={t('common.refresh')}>
          <IconButton onClick={() => load()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport}>
          {t('accounting.exportCsv')}
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          {t('accounting.createWage')}
        </Button>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('accounting.employeeName')}</TableCell>
                <TableCell>{t('accounting.period')}</TableCell>
                <TableCell>{t('accounting.baseSalary')}</TableCell>
                <TableCell>{t('accounting.bonus')}</TableCell>
                <TableCell>{t('accounting.deductions')}</TableCell>
                <TableCell>{t('accounting.netPay')}</TableCell>
                <TableCell>{t('common.createdAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {wages.map(w => (
                <TableRow key={w.id}>
                  <TableCell>{w.user_id}</TableCell>
                  <TableCell>{w.period}</TableCell>
                  <TableCell>${w.base_amount.toFixed(2)}</TableCell>
                  <TableCell>${(w.bonus_amount ?? 0).toFixed(2)}</TableCell>
                  <TableCell>${(w.deductions ?? 0).toFixed(2)}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    ${w.net_amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{new Date(w.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {wages.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
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
            <Button onClick={() => load(cursor)} disabled={loading}>{t('common.loadMore')}</Button>
          </Box>
        )}
      </Card>

      {/* Create Wage Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('accounting.createWage')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('accounting.employeeName')}
              fullWidth
              required
              value={form.userId}
              onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
            />
            <TextField
              label={t('accounting.period')}
              fullWidth
              required
              placeholder="2024-01"
              value={form.period}
              onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
            />
            <TextField
              label={t('accounting.baseSalary')}
              type="number"
              fullWidth
              required
              value={form.baseAmount}
              onChange={e => setForm(f => ({ ...f, baseAmount: Number(e.target.value) }))}
            />
            <TextField
              label={t('accounting.bonus')}
              type="number"
              fullWidth
              value={form.bonusAmount}
              onChange={e => setForm(f => ({ ...f, bonusAmount: Number(e.target.value) }))}
            />
            <TextField
              label={t('accounting.deductions')}
              type="number"
              fullWidth
              value={form.deductions}
              onChange={e => setForm(f => ({ ...f, deductions: Number(e.target.value) }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !form.userId || !form.period || form.baseAmount <= 0}
          >
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
