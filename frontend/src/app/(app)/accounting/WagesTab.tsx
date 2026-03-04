'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Paper, Tooltip,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Download as DownloadIcon, Edit as EditIcon } from '@mui/icons-material';
import { accountingApi, adminApi } from '@/api';
import type { UserInfo } from '@/types';
import DrawerForm from '@/components/common/DrawerForm';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

const emptyForm = { userId: '', period: '', amount: '', staffName: '', deductions: '', grossAmount: '', netAmount: '', paymentStatus: 'Pending' };

export default function WagesTab() {
  const { t } = useTranslation();
  const [wages, setWages] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [editWage, setEditWage] = useState<any | null>(null);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editWage) {
        await accountingApi.updateWage(editWage.id, {
          amount: Number(form.amount),
          period: form.period,
          notes: '',
          staffName: form.staffName || undefined,
          deductions: form.deductions ? Number(form.deductions) : undefined,
          grossAmount: form.grossAmount ? Number(form.grossAmount) : undefined,
          netAmount: form.netAmount ? Number(form.netAmount) : undefined,
          paymentStatus: form.paymentStatus || undefined,
        });
      } else {
        await accountingApi.createWage({
          userId: form.userId,
          period: form.period,
          amount: Number(form.amount),
          staffName: form.staffName || undefined,
          deductions: form.deductions ? Number(form.deductions) : undefined,
          grossAmount: form.grossAmount ? Number(form.grossAmount) : undefined,
          netAmount: form.netAmount ? Number(form.netAmount) : undefined,
          paymentStatus: form.paymentStatus || undefined,
        });
      }
      setDrawerOpen(false);
      setForm({ ...emptyForm });
      setEditWage(null);
      load();
    } finally { setSaving(false); }
  };

  const loadUsers = async () => {
    const res = await adminApi.listUsers({ limit: '200' } as any).catch(() => ({ data: [] }));
    setUsers(Array.isArray(res) ? res : (res as any).data ?? []);
  };

  const openCreate = async () => {
    setEditWage(null);
    setForm({ ...emptyForm });
    setDrawerOpen(true);
    await loadUsers();
  };

  const openEdit = async (w: any) => {
    setEditWage(w);
    setForm({
      userId: w.user_id || '',
      period: w.period || '',
      amount: String(w.base_amount ?? w.amount ?? ''),
      staffName: w.staff_name || '',
      deductions: w.deductions != null ? String(w.deductions) : '',
      grossAmount: w.gross_amount != null ? String(w.gross_amount) : '',
      netAmount: w.net_amount != null ? String(w.net_amount) : '',
      paymentStatus: w.payment_status || 'Pending',
    });
    setDrawerOpen(true);
    await loadUsers();
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>{t('common.create', 'Create')}</Button>
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
                  <TableCell>{t('common.actions', 'Actions')}</TableCell>
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
                    <TableCell>
                      <IconButton size="small" onClick={() => openEdit(w)}><EditIcon fontSize="small" /></IconButton>
                    </TableCell>
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

      <DrawerForm open={drawerOpen} title={editWage ? t('accounting.editWage', 'Edit Wage') : t('accounting.createWage', 'Create Wage')} onClose={() => setDrawerOpen(false)} onSubmit={handleSave} loading={saving}>
        <Stack spacing={2.5}>
          <TextField label={t('accounting.employee', 'Employee')} select fullWidth required value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}>
            <MenuItem value="">— {t('common.select', 'Select')} —</MenuItem>
            {users.map(u => <MenuItem key={u.id} value={u.id}>{(u as any).display_name || (u as any).displayName || u.email}</MenuItem>)}
          </TextField>
          <TextField label={t('accounting.period', 'Period')} fullWidth placeholder="2024-01" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
          <TextField label={t('accounting.amount', 'Amount')} type="number" fullWidth value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <TextField label={t('accounting.staffName', 'Staff Name')} fullWidth value={form.staffName} onChange={e => setForm(f => ({ ...f, staffName: e.target.value }))} />
          <TextField label={t('accounting.deductions', 'Deductions')} type="number" fullWidth value={form.deductions} onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))} />
          <TextField label={t('accounting.grossAmount', 'Gross Amount')} type="number" fullWidth value={form.grossAmount} onChange={e => setForm(f => ({ ...f, grossAmount: e.target.value }))} />
          <TextField label={t('accounting.netAmount', 'Net Amount')} type="number" fullWidth value={form.netAmount} onChange={e => setForm(f => ({ ...f, netAmount: e.target.value }))} />
          <TextField label={t('accounting.paymentStatus', 'Payment Status')} select fullWidth value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))}>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Paid">Paid</MenuItem>
            <MenuItem value="Cancelled">Cancelled</MenuItem>
          </TextField>
        </Stack>
      </DrawerForm>
    </Box>
  );
}
