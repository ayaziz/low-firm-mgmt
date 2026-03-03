'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Paper,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Download as DownloadIcon } from '@mui/icons-material';
import { accountingApi } from '@/api';
import DrawerForm from '@/components/common/DrawerForm';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

export default function WagesTab() {
  const { t } = useTranslation();
  const [wages, setWages] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ userId: '', period: '', amount: '' });

  const load = useCallback(async (c?: string | null) => {
    setLoading(true);
    try {
      const res = await accountingApi.listWages({ cursor: c ?? undefined, limit: 20 });
      const list = Array.isArray(res) ? res : res.data ?? [];
      if (c) setWages(prev => [...prev, ...list]);
      else setWages(list);
      setCursor(res.nextCursor ?? (res as any).next_cursor ?? null);
      setHasMore(!!(res.nextCursor ?? (res as any).next_cursor));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await accountingApi.createWage({ userId: form.userId, period: form.period, amount: Number(form.amount) });
      setDrawerOpen(false);
      setForm({ userId: '', period: '', amount: '' });
      load();
    } finally { setSaving(false); }
  };

  const handleExport = async () => {
    try {
      await accountingApi.exportWagesCsv();
    } catch { /* handled by api layer */ }
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} justifyContent="flex-end">
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>{t('accounting.exportCsv', 'Export CSV')}</Button>
        <IconButton onClick={() => load()}><RefreshIcon /></IconButton>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDrawerOpen(true)}>{t('common.create', 'Create')}</Button>
      </Stack>

      {loading && wages.length === 0 ? <LoadingSkeleton variant="table" /> : wages.length > 0 ? (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('accounting.employee', 'Employee')}</TableCell>
                  <TableCell>{t('accounting.period', 'Period')}</TableCell>
                  <TableCell>{t('accounting.baseSalary', 'Base Salary')}</TableCell>
                  <TableCell>{t('accounting.bonus', 'Bonus')}</TableCell>
                  <TableCell>{t('accounting.deductions', 'Deductions')}</TableCell>
                  <TableCell>{t('accounting.netPay', 'Net Pay')}</TableCell>
                  <TableCell>{t('common.date', 'Date')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {wages.map(w => (
                  <TableRow key={w.id} hover>
                    <TableCell>{w.employee_name ?? w.user_id}</TableCell>
                    <TableCell>{w.period}</TableCell>
                    <TableCell>{Number(w.base_amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(w.bonus_amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(w.deductions ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(w.net_amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{w.created_at ? new Date(w.created_at).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {hasMore && (
            <Stack alignItems="center" mt={2}>
              <Button onClick={() => load(cursor)} disabled={loading}>{t('common.loadMore', 'Load more')}</Button>
            </Stack>
          )}
        </>
      ) : (
        <EmptyState icon={<AddIcon />} title={t('accounting.noWages', 'No wages')} message={t('accounting.noWagesMsg', 'No wage records found')} />
      )}

      <DrawerForm open={drawerOpen} title={t('accounting.createWage', 'Create Wage')} onClose={() => setDrawerOpen(false)} onSubmit={handleCreate} loading={saving}>
        <Stack spacing={2.5}>
          <TextField label={t('accounting.userId', 'User ID')} fullWidth value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} />
          <TextField label={t('accounting.period', 'Period')} fullWidth placeholder="2024-01" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
          <TextField label={t('accounting.amount', 'Amount')} type="number" fullWidth value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
