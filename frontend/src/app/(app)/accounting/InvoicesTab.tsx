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
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { accountingApi, caseApi, customerApi } from '@/api';
import type { Invoice, Case, Customer } from '@/types';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Draft: 'default',
  Finalized: 'info',
  Sent: 'warning',
  Paid: 'success',
  Overdue: 'error',
  Void: 'default',
};

export default function InvoicesTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    caseId: '',
    customerId: '',
    dueDate: '',
    lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await accountingApi.listInvoices({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setInvoices(prev => [...prev, ...res.data]);
      } else {
        setInvoices(res.data);
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
    const [casesRes, custRes] = await Promise.all([
      caseApi.list({ limit: 100 }).catch(() => ({ data: [] as Case[], nextCursor: null })),
      customerApi.list({ limit: 100 }).catch(() => ({ data: [] as Customer[], nextCursor: null })),
    ]);
    setCases(casesRes.data);
    setCustomers(custRes.data);
  };

  const addLineItem = () => {
    setForm(f => ({
      ...f,
      lineItems: [...f.lineItems, { description: '', quantity: 1, unitPrice: 0 }],
    }));
  };

  const updateLineItem = (idx: number, field: string, value: string | number) => {
    setForm(f => ({
      ...f,
      lineItems: f.lineItems.map((li, i) => (i === idx ? { ...li, [field]: value } : li)),
    }));
  };

  const removeLineItem = (idx: number) => {
    setForm(f => ({
      ...f,
      lineItems: f.lineItems.filter((_, i) => i !== idx),
    }));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await accountingApi.createInvoice({
        caseId: form.caseId,
        customerId: form.customerId,
        dueDate: form.dueDate,
        lineItems: form.lineItems.map(li => ({
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
        })),
      });
      setDialogOpen(false);
      setForm({ caseId: '', customerId: '', dueDate: '', lineItems: [{ description: '', quantity: 1, unitPrice: 0 }] });
      load();
    } finally {
      setSaving(false);
    }
  };

  const total = (inv: Invoice) =>
    inv.line_items?.reduce((s, li) => s + li.quantity * li.unit_price, 0) ?? inv.total_amount ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" spacing={1} mb={2}>
        <Tooltip title={t('common.refresh')}>
          <IconButton onClick={() => load()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          {t('accounting.createInvoice')}
        </Button>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('accounting.invoiceNumber')}</TableCell>
                <TableCell>{t('accounting.amount')}</TableCell>
                <TableCell>{t('accounting.status')}</TableCell>
                <TableCell>{t('accounting.dueDate')}</TableCell>
                <TableCell>{t('common.createdAt')}</TableCell>
                <TableCell width={60} />
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map(inv => (
                <TableRow
                  key={inv.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/accounting/invoices/${inv.id}`)}
                >
                  <TableCell sx={{ fontFamily: 'monospace' }}>{inv.invoice_number}</TableCell>
                  <TableCell>${total(inv).toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip label={inv.status} size="small" color={STATUS_COLORS[inv.status] || 'default'} />
                  </TableCell>
                  <TableCell>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <IconButton size="small"><ViewIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && !loading && (
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
            <Button onClick={() => load(cursor)} disabled={loading}>{t('common.loadMore')}</Button>
          </Box>
        )}
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('accounting.createInvoice')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('customer.title')}
              select
              fullWidth
              required
              value={form.customerId}
              onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
            >
              {customers.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.full_name}</MenuItem>
              ))}
            </TextField>
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
              label={t('accounting.dueDate')}
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
            <Typography variant="subtitle2">{t('accounting.lineItems')}</Typography>
            {form.lineItems.map((li, idx) => (
              <Stack key={idx} direction="row" spacing={1} alignItems="center">
                <TextField
                  label={t('accounting.description')}
                  size="small"
                  value={li.description}
                  onChange={e => updateLineItem(idx, 'description', e.target.value)}
                  sx={{ flex: 2 }}
                />
                <TextField
                  label={t('accounting.quantity')}
                  type="number"
                  size="small"
                  value={li.quantity}
                  onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                  sx={{ width: 100 }}
                />
                <TextField
                  label={t('accounting.unitPrice')}
                  type="number"
                  size="small"
                  value={li.unitPrice}
                  onChange={e => updateLineItem(idx, 'unitPrice', e.target.value)}
                  sx={{ width: 120 }}
                />
                <Typography variant="body2" sx={{ width: 80 }}>
                  ${(Number(li.quantity) * Number(li.unitPrice)).toFixed(2)}
                </Typography>
                {form.lineItems.length > 1 && (
                  <Button size="small" color="error" onClick={() => removeLineItem(idx)}>✕</Button>
                )}
              </Stack>
            ))}
            <Button size="small" onClick={addLineItem}>{t('common.add')} +</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !form.caseId || form.lineItems.every(li => !li.description)}
          >
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
