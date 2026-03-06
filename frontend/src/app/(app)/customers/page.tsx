'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { customerApi } from '@/api';
import type { Customer, CustomerStatus, CustomerType } from '@/types';
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
  const [form, setForm] = useState({
    name: '',
    customer_type: 'Individual' as CustomerType,
    status: 'Active' as CustomerStatus,
    national_id: '',
    passport_number: '',
    registration_id: '',
    tax_id: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const isIndividual = form.customer_type === 'Individual';
  const isOrganization = form.customer_type === 'Organization';
  const hasIndividualIdentity = !!form.national_id.trim() || !!form.passport_number.trim();
  const hasOrganizationIdentity = !!form.registration_id.trim() && !!form.tax_id.trim();
  const canSubmit =
    !!form.name.trim() &&
    (isIndividual ? hasIndividualIdentity : true) &&
    (isOrganization ? hasOrganizationIdentity : true);

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
    if (!canSubmit) return;
    setSaving(true);
    try {
      const created = await customerApi.create(form);
      setDrawerOpen(false);
      setForm({
        name: '',
        customer_type: 'Individual',
        status: 'Active',
        national_id: '',
        passport_number: '',
        registration_id: '',
        tax_id: '',
        notes: '',
      });
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
        submitDisabled={!canSubmit}
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
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                customer_type: e.target.value as CustomerType,
                national_id: '',
                passport_number: '',
                registration_id: '',
                tax_id: '',
              }))
            }
          >
            <MenuItem value="Individual">{t('customer.individual')}</MenuItem>
            <MenuItem value="Organization">{t('customer.organization')}</MenuItem>
          </TextField>
          <TextField
            label={t('customer.status', 'Status')}
            select
            fullWidth
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CustomerStatus }))}
          >
            <MenuItem value="Active">{t('common.active', 'Active')}</MenuItem>
            <MenuItem value="Inactive">{t('common.inactive', 'Inactive')}</MenuItem>
            <MenuItem value="Prospect">{t('customer.prospect', 'Prospect')}</MenuItem>
          </TextField>
          <TextField
            label={t('customer.nationalId')}
            fullWidth
            required={isIndividual && !form.passport_number.trim()}
            value={form.national_id}
            onChange={(e) => setForm((f) => ({ ...f, national_id: e.target.value }))}
            disabled={!isIndividual}
            helperText={isIndividual ? t('customer.identityHint', 'Provide national ID or passport number') : ''}
          />
          <TextField
            label={t('customer.passportNumber', 'Passport Number')}
            fullWidth
            required={isIndividual && !form.national_id.trim()}
            value={form.passport_number}
            onChange={(e) => setForm((f) => ({ ...f, passport_number: e.target.value }))}
            disabled={!isIndividual}
          />
          <TextField
            label={t('customer.registrationId', 'Registration ID')}
            fullWidth
            required={isOrganization}
            value={form.registration_id}
            onChange={(e) => setForm((f) => ({ ...f, registration_id: e.target.value }))}
            disabled={!isOrganization}
          />
          <TextField
            label={t('customer.taxId', 'Tax ID')}
            fullWidth
            required={isOrganization}
            value={form.tax_id}
            onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
            disabled={!isOrganization}
          />
          <TextField
            label={t('customer.notes', 'Notes')}
            fullWidth
            multiline
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          {!canSubmit && (
            <Box sx={{ color: 'error.main', fontSize: 13 }}>
              {isIndividual
                ? t('customer.individualIdentityRequired', 'Individual customers require national ID or passport number.')
                : t('customer.organizationIdentityRequired', 'Organization customers require registration ID and tax ID.')}
            </Box>
          )}
        </Stack>
      </DrawerForm>
    </Box>
  );
}
