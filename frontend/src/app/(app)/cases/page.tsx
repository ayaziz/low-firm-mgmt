'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { caseApi, customerApi, adminApi } from '@/api';
import type { Case, Customer, CaseType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { CAPABILITIES } from '@/auth/capabilities';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import StatusBadge from '@/components/common/StatusBadge';
import DrawerForm from '@/components/common/DrawerForm';

export default function CaseListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasAnyRole } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [form, setForm] = useState({ title: '', customerId: '', caseTypeId: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await caseApi.list({ limit: 50 });
      setCases(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Handle ?action=new from SpeedDial
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openDrawer();
      router.replace('/cases');
    }
  }, [searchParams]);

  const openDrawer = async () => {
    setDrawerOpen(true);
    const [custRes, ctRes] = await Promise.all([
      customerApi.list({ limit: 100 }).catch(() => ({ data: [] as Customer[], cursor: null })),
      adminApi.listCaseTypes().catch(() => [] as CaseType[]),
    ]);
    setCustomers(custRes.data);
    setCaseTypes(ctRes.filter((ct: CaseType) => ct.is_active));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await caseApi.create({
        title: form.title,
        description: form.description || undefined,
        caseTypeId: form.caseTypeId,
        customerIds: [form.customerId],
      } as any);
      setDrawerOpen(false);
      setForm({ title: '', customerId: '', caseTypeId: '', description: '' });
      router.push(`/cases/${created.id}`);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Case>[] = [
    {
      field: 'system_case_ref',
      headerName: t('case.caseNumber'),
      width: 150,
      renderCell: (row) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{row.system_case_ref}</Typography>
      ),
    },
    { field: 'title', headerName: t('case.caseTitle'), sortable: true },
    {
      field: 'state',
      headerName: t('case.state'),
      width: 120,
      renderCell: (row) => <StatusBadge status={row.state} size="small" />,
    },
    {
      field: 'completeness',
      headerName: t('case.completeness'),
      width: 120,
      renderCell: (row) => (row.completeness != null ? `${row.completeness}%` : '—'),
    },
    {
      field: 'created_at',
      headerName: t('common.createdAt'),
      width: 120,
      sortable: true,
      renderCell: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('case.title')}
        actions={
          hasAnyRole(...CAPABILITIES.canCreateCase) ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openDrawer}>
              {t('case.add')}
            </Button>
          ) : undefined
        }
      />

      <DataGrid<Case>
        columns={columns}
        rows={cases}
        loading={loading}
        getRowId={(r) => r.id}
        onRowClick={(row) => router.push(`/cases/${row.id}`)}
        onRefresh={load}
        emptyMessage={t('common.noData')}
      />

      <DrawerForm
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setForm({ title: '', customerId: '', caseTypeId: '', description: '' }); }}
        title={t('case.create')}
        onSubmit={handleCreate}
        loading={saving}
      >
        <Stack spacing={2}>
          <TextField
            label={t('case.caseTitle')}
            fullWidth
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <TextField
            label={t('case.customer')}
            select
            fullWidth
            required
            value={form.customerId}
            onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
          >
            {customers.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('case.caseType')}
            select
            fullWidth
            required
            value={form.caseTypeId}
            onChange={(e) => setForm((f) => ({ ...f, caseTypeId: e.target.value }))}
          >
            {caseTypes.map((ct) => (
              <MenuItem key={ct.id} value={ct.id}>{ct.label_en}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('case.description')}
            fullWidth
            multiline
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
