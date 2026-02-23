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
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { accountingApi, caseApi } from '@/api';
import type { Expense, Case } from '@/types';
import { useAuth } from '@/context/AuthContext';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Submitted: 'info',
  Approved: 'success',
  Rejected: 'error',
  Paid: 'success',
};

export default function ExpensesTab() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [form, setForm] = useState({ caseId: '', category: '', description: '', amount: 0, receiptRef: '' });
  const [saving, setSaving] = useState(false);
  const canApprove = hasAnyRole('TenantAdmin', 'Accountant');

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await accountingApi.listExpenses({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setExpenses(prev => [...prev, ...res.data]);
      } else {
        setExpenses(res.data);
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
    const res = await caseApi.list({ limit: 100 }).catch(() => ({ data: [], cursor: null }));
    setCases(res.data);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await accountingApi.createExpense({
        caseId: form.caseId || undefined,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
      });
      setDialogOpen(false);
      setForm({ caseId: '', category: '', description: '', amount: 0, receiptRef: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    await accountingApi.approveExpense(id);
    load();
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt(t('accounting.rejectReason', 'Reason for rejection'));
    if (!reason) return;
    await accountingApi.rejectExpense(id, reason);
    load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" spacing={1} mb={2}>
        <Tooltip title={t('common.refresh')}>
          <IconButton onClick={() => load()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          {t('accounting.createExpense')}
        </Button>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('accounting.category')}</TableCell>
                <TableCell>{t('accounting.description')}</TableCell>
                <TableCell>{t('accounting.amount')}</TableCell>
                <TableCell>{t('accounting.status')}</TableCell>
                <TableCell>{t('common.createdAt')}</TableCell>
                {canApprove && <TableCell width={120}>{t('common.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map(exp => (
                <TableRow key={exp.id}>
                  <TableCell>{exp.category}</TableCell>
                  <TableCell>{exp.description}</TableCell>
                  <TableCell>${exp.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip label={exp.status} size="small" color={STATUS_COLORS[exp.status] || 'default'} />
                  </TableCell>
                  <TableCell>{new Date(exp.created_at).toLocaleDateString()}</TableCell>
                  {canApprove && (
                    <TableCell>
                      {exp.status === 'Submitted' && (
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title={t('accounting.approve')}>
                            <IconButton size="small" color="success" onClick={() => handleApprove(exp.id)}>
                              <ApproveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('accounting.reject')}>
                            <IconButton size="small" color="error" onClick={() => handleReject(exp.id)}>
                              <RejectIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {expenses.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={canApprove ? 6 : 5} align="center">
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

      {/* Create Expense Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('accounting.createExpense')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('case.title')}
              select
              fullWidth
              required
              value={form.caseId}
              onChange={e => setForm(f => ({ ...f, caseId: e.target.value }))}
            >
              {cases.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.title} ({c.system_case_ref})</MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('accounting.category')}
              fullWidth
              required
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            />
            <TextField
              label={t('accounting.description')}
              fullWidth
              multiline
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <TextField
              label={t('accounting.amount')}
              type="number"
              fullWidth
              required
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
            />
            <TextField
              label="Receipt Reference"
              fullWidth
              value={form.receiptRef}
              onChange={e => setForm(f => ({ ...f, receiptRef: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !form.caseId || !form.category || form.amount <= 0}
          >
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
