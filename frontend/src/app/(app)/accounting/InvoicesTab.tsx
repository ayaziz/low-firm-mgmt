'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import {
  Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, Typography, Paper,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { accountingApi, caseApi, customerApi } from '@/api';
import DrawerForm from '@/components/common/DrawerForm';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import StatusBadge from '@/components/common/StatusBadge';

interface LineItem { description: string; quantity: number; unitPrice: number; }

export default function InvoicesTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ caseId: '', customerId: '', dueDate: '' });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  const load = useCallback(async (c?: string | null) => {
    setLoading(true);
    try {
      const res = await accountingApi.listInvoices({ cursor: c ?? undefined, limit: 20 });
      const list = Array.isArray(res) ? res : res.data ?? [];
      if (c) setInvoices(prev => [...prev, ...list]);
      else setInvoices(list);
      setCursor(res.nextCursor ?? (res as any).next_cursor ?? null);
      setHasMore(!!(res.nextCursor ?? (res as any).next_cursor));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([caseApi.list({ limit: 100 }), customerApi.list({ limit: 100 })]).then(([c, cu]) => {
      setCases(Array.isArray(c) ? c : c.data ?? []);
      setCustomers(Array.isArray(cu) ? cu : cu.data ?? []);
    });
  }, []);

  const openDrawer = () => {
    setForm({ caseId: '', customerId: '', dueDate: '' });
    setLineItems([{ description: '', quantity: 1, unitPrice: 0 }]);
    setDrawerOpen(true);
  };

  const updateLine = (i: number, key: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: value } : l));
  };

  const addLine = () => setLineItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  const removeLine = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i));

  const total = lineItems.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await accountingApi.createInvoice({ caseId: form.caseId, customerId: form.customerId, dueDate: form.dueDate, lineItems });
      setDrawerOpen(false);
      load();
    } finally { setSaving(false); }
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} justifyContent="flex-end">
        <IconButton onClick={() => load()}><RefreshIcon /></IconButton>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openDrawer}>{t('common.create', 'Create')}</Button>
      </Stack>

      {loading && invoices.length === 0 ? <LoadingSkeleton variant="table" /> : invoices.length > 0 ? (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>{t('accounting.customer', 'Customer')}</TableCell>
                  <TableCell>{t('accounting.amount', 'Amount')}</TableCell>
                  <TableCell>{t('common.status', 'Status')}</TableCell>
                  <TableCell>{t('accounting.dueDate', 'Due Date')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/accounting/invoices/${inv.id}`)}>
                    <TableCell>{inv.invoice_number ?? inv.id?.slice(0, 8)}</TableCell>
                    <TableCell>{inv.customer_name ?? inv.customerId}</TableCell>
                    <TableCell>{Number(inv.total_amount ?? inv.total ?? 0).toFixed(2)}</TableCell>
                    <TableCell><StatusBadge status={inv.status ?? 'Draft'} /></TableCell>
                    <TableCell>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</TableCell>
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
        <EmptyState icon={<AddIcon />} title={t('accounting.noInvoices', 'No invoices')} message={t('accounting.noInvoicesMsg', 'Create your first invoice to get started')} />
      )}

      <DrawerForm open={drawerOpen} title={t('accounting.createInvoice', 'Create Invoice')} width={560} onClose={() => setDrawerOpen(false)} onSubmit={handleCreate} loading={saving}>
        <Stack spacing={2.5}>
          <TextField select label={t('accounting.case', 'Case')} fullWidth value={form.caseId} onChange={e => setForm(f => ({ ...f, caseId: e.target.value }))}>
            {cases.map(c => <MenuItem key={c.id} value={c.id}>{c.title ?? c.case_number}</MenuItem>)}
          </TextField>
          <TextField select label={t('accounting.customer', 'Customer')} fullWidth value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
            {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField label={t('accounting.dueDate', 'Due Date')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />

          <Typography variant="subtitle2">{t('accounting.lineItems', 'Line Items')}</Typography>
          {lineItems.map((li, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <TextField label="Description" size="small" sx={{ flex: 2 }} value={li.description} onChange={e => updateLine(i, 'description', e.target.value)} />
              <TextField label="Qty" size="small" type="number" sx={{ width: 80 }} value={li.quantity} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} />
              <TextField label="Price" size="small" type="number" sx={{ width: 100 }} value={li.unitPrice} onChange={e => updateLine(i, 'unitPrice', Number(e.target.value))} />
              {lineItems.length > 1 && (
                <IconButton size="small" color="error" onClick={() => removeLine(i)}><DeleteIcon fontSize="small" /></IconButton>
              )}
            </Stack>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addLine}>{t('accounting.addLine', 'Add Line')}</Button>
          <Typography variant="body2" textAlign="right" fontWeight={600}>
            {t('accounting.total', 'Total')}: {total.toFixed(2)}
          </Typography>
        </Stack>
      </DrawerForm>
    </Box>
  );
}
