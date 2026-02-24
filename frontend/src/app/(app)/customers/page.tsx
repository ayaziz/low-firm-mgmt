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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  MenuItem,
  Stack,
} from '@mui/material';
import { Add as AddIcon, Visibility as ViewIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { customerApi } from '@/api';
import type { Customer, CustomerType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { CAPABILITIES } from '@/auth/capabilities';

export default function CustomerListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', customer_type: 'Individual' as CustomerType, national_id: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await customerApi.list({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setCustomers(prev => [...prev, ...res.data]);
      } else {
        setCustomers(res.data);
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
      const created = await customerApi.create(form);
      setDialogOpen(false);
      setForm({ full_name: '', customer_type: 'Individual' as CustomerType, national_id: '' });
      router.push(`/customers/${created.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={600}>
          {t('customer.title')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={() => load()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {hasAnyRole(...CAPABILITIES.canCreateCustomer) && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              {t('customer.add')}
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('customer.name')}</TableCell>
                <TableCell>{t('customer.type')}</TableCell>
                <TableCell>{t('customer.nationalId')}</TableCell>
                <TableCell>{t('customer.status')}</TableCell>
                <TableCell width={60} />
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.map(c => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/customers/${c.id}`)}
                >
                  <TableCell>{c.full_name}</TableCell>
                  <TableCell>
                    <Chip label={c.customer_type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{c.national_id}</TableCell>
                  <TableCell>
                    <Chip label={c.status} size="small" color={c.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small">
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
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
        <DialogTitle>{t('customer.add')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('customer.name')}
              fullWidth
              required
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
            <TextField
              label={t('customer.type')}
              select
              fullWidth
              value={form.customer_type}
              onChange={e => setForm(f => ({ ...f, customer_type: e.target.value as CustomerType }))}
            >
              <MenuItem value="Individual">{t('customer.individual')}</MenuItem>
              <MenuItem value="Corporate">{t('customer.corporate')}</MenuItem>
            </TextField>
            <TextField
              label={t('customer.nationalId')}
              fullWidth
              value={form.national_id}
              onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.full_name}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
