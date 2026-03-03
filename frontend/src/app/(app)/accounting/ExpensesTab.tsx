'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, Paper,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Check as ApproveIcon, Close as RejectIcon } from '@mui/icons-material';
import { accountingApi, caseApi } from '@/api';
import { useAuth } from '@/context/AuthContext';
import DrawerForm from '@/components/common/DrawerForm';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function ExpensesTab() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canApprove = hasAnyRole('TenantAdmin', 'Accountant');

  const [expenses, setExpenses] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ caseId: '', categoryId: '', description: '', amount: '' });
  const [rejectTarget, setRejectTarget] = useState<any>(null);

  const load = useCallback(async (c?: string | null) => {
    setLoading(true);
    try {
      const res = await accountingApi.listExpenses({ cursor: c ?? undefined, limit: 20 });
      const list = Array.isArray(res) ? res : res.data ?? [];
      if (c) setExpenses(prev => [...prev, ...list]);
      else setExpenses(list);
      setCursor(res.nextCursor ?? (res as any).next_cursor ?? null);
      setHasMore(!!(res.nextCursor ?? (res as any).next_cursor));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { caseApi.list({ limit: 100 }).then(r => setCases(Array.isArray(r) ? r : r.data ?? [])); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await accountingApi.createExpense({
        caseId: form.caseId, categoryId: form.categoryId,
        description: form.description, amount: Number(form.amount),
      });
      setDrawerOpen(false);
      setForm({ caseId: '', categoryId: '', description: '', amount: '' });
      load();
    } finally { setSaving(false); }
  };

  const handleApprove = async (id: string) => {
    await accountingApi.approveExpense(id);
    load();
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const reason = window.prompt(t('accounting.rejectReason', 'Rejection reason:'));
    if (reason === null) { setRejectTarget(null); return; }
    await accountingApi.rejectExpense(rejectTarget.id, reason);
    setRejectTarget(null);
    load();
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} justifyContent="flex-end">
        <IconButton onClick={() => load()}><RefreshIcon /></IconButton>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDrawerOpen(true)}>{t('common.create', 'Create')}</Button>
      </Stack>

      {loading && expenses.length === 0 ? <LoadingSkeleton variant="table" /> : expenses.length > 0 ? (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('accounting.description', 'Description')}</TableCell>
                  <TableCell>{t('accounting.case', 'Case')}</TableCell>
                  <TableCell>{t('accounting.amount', 'Amount')}</TableCell>
                  <TableCell>{t('common.status', 'Status')}</TableCell>
                  <TableCell>{t('common.date', 'Date')}</TableCell>
                  {canApprove && <TableCell>{t('common.actions', 'Actions')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses.map(exp => (
                  <TableRow key={exp.id} hover>
                    <TableCell>{exp.description}</TableCell>
                    <TableCell>{exp.case_title ?? exp.caseId}</TableCell>
                    <TableCell>{Number(exp.amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell><StatusBadge status={exp.status ?? 'Submitted'} /></TableCell>
                    <TableCell>{exp.created_at ? new Date(exp.created_at).toLocaleDateString() : '—'}</TableCell>
                    {canApprove && (
                      <TableCell>
                        {exp.status === 'Submitted' && (
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" color="success" onClick={() => handleApprove(exp.id)}><ApproveIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => setRejectTarget(exp)}><RejectIcon fontSize="small" /></IconButton>
                          </Stack>
                        )}
                      </TableCell>
                    )}
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
        <EmptyState icon={<AddIcon />} title={t('accounting.noExpenses', 'No expenses')} message={t('accounting.noExpensesMsg', 'Submit your first expense report')} />
      )}

      <ConfirmDialog
        open={!!rejectTarget}
        title={t('accounting.rejectExpense', 'Reject Expense')}
        message={t('accounting.rejectConfirm', 'Are you sure you want to reject this expense?')}
        variant="danger"
        loading={false}
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
      />

      <DrawerForm open={drawerOpen} title={t('accounting.createExpense', 'Create Expense')} onClose={() => setDrawerOpen(false)} onSubmit={handleCreate} loading={saving}>
        <Stack spacing={2.5}>
          <TextField select label={t('accounting.case', 'Case')} fullWidth value={form.caseId} onChange={e => setForm(f => ({ ...f, caseId: e.target.value }))}>
            {cases.map(c => <MenuItem key={c.id} value={c.id}>{c.title ?? c.case_number}</MenuItem>)}
          </TextField>
          <TextField label={t('accounting.category', 'Category')} fullWidth value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} />
          <TextField label={t('accounting.description', 'Description')} fullWidth multiline rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <TextField label={t('accounting.amount', 'Amount')} type="number" fullWidth value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
