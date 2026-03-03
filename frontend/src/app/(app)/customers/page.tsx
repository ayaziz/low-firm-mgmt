'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { customerApi } from '@/api';
import type { Customer, CustomerType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { CAPABILITIES } from '@/auth/capabilities';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import StatusBadge from '@/components/common/StatusBadge';
import DrawerForm from '@/components/common/DrawerForm';

export default function CustomerListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasAnyRole } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ name: '', customer_type: 'Individual' as CustomerType, national_id: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customerApi.list({ limit: 50 });
      setCustomers(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Handle ?action=new from SpeedDial
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setDrawerOpen(true);
      router.replace('/customers');
    }
  }, [searchParams, router]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await customerApi.create(form);
      setDrawerOpen(false);
      setForm({ name: '', customer_type: 'Individual', national_id: '' });
      router.push(`/customers/${created.id}`);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Customer>[] = [
    { field: 'name', headerName: t('customer.name'), sortable: true },
    {
      field: 'customer_type',
      headerName: t('customer.type'),
      width: 140,
      renderCell: (row) => <StatusBadge status={row.customer_type} size="small" variant="outlined" />,
    },
    {
      field: 'national_id',
      headerName: t('customer.nationalId'),
      width: 180,
      renderCell: (row) => (
        <span style={{ fontFamily: 'monospace' }}>{row.national_id || '—'}</span>
      ),
    },
    {
      field: 'status',
      headerName: t('customer.status'),
      width: 120,
      renderCell: (row) => <StatusBadge status={row.status} size="small" />,
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('customer.title')}
        actions={
          hasAnyRole(...CAPABILITIES.canCreateCustomer) ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDrawerOpen(true)}>
              {t('customer.add')}
            </Button>
          ) : undefined
        }
      />

      <DataGrid<Customer>
        columns={columns}
        rows={customers}
        loading={loading}
        getRowId={(r) => r.id}
        onRowClick={(row) => router.push(`/customers/${row.id}`)}
        onRefresh={load}
        emptyMessage={t('common.noData')}
      />

      <DrawerForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('customer.add')}
        onSubmit={handleCreate}
        loading={saving}
      >
        <Stack spacing={2}>
          <TextField
            label={t('customer.name')}
            fullWidth
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label={t('customer.type')}
            select
            fullWidth
            value={form.customer_type}
            onChange={(e) => setForm((f) => ({ ...f, customer_type: e.target.value as CustomerType }))}
          >
            <MenuItem value="Individual">{t('customer.individual')}</MenuItem>
            <MenuItem value="Organization">{t('customer.organization')}</MenuItem>
          </TextField>
          <TextField
            label={t('customer.nationalId')}
            fullWidth
            value={form.national_id}
            onChange={(e) => setForm((f) => ({ ...f, national_id: e.target.value }))}
          />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
