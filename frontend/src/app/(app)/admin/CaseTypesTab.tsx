'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, IconButton, List, ListItem, ListItemText, Stack, TextField, Tooltip, Card, CardContent,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { adminApi } from '@/api';
import type { CaseType } from '@/types';
import DrawerForm from '@/components/common/DrawerForm';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

export default function CaseTypesTab() {
  const { t } = useTranslation();
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ labelEn: '', labelAr: '', code: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listCaseTypes();
      setCaseTypes(Array.isArray(res) ? res : (res as any).data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await adminApi.createCaseType({ labelEn: form.labelEn, labelAr: form.labelAr, code: form.code });
      setDrawerOpen(false);
      setForm({ labelEn: '', labelAr: '', code: '' });
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await adminApi.deleteCaseType(id);
    load();
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} justifyContent="flex-end">
        <Tooltip title={t('common.refresh', 'Refresh')}>
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDrawerOpen(true)}>{t('common.add', 'Add')}</Button>
      </Stack>

      {loading && caseTypes.length === 0 ? <LoadingSkeleton variant="table" /> : caseTypes.length > 0 ? (
        <Card>
          <CardContent>
            <List dense>
              {caseTypes.map((ct: CaseType) => (
                <ListItem
                  key={ct.id}
                  secondaryAction={
                    <IconButton edge="end" size="small" color="error" onClick={() => handleDelete(ct.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText primary={ct.label_en} secondary={`${ct.label_ar || ''} ${ct.code ? `(${ct.code})` : ''}`} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('admin.noCaseTypes', 'No case types defined yet')} />
      )}

      <DrawerForm open={drawerOpen} title={t('admin.addCaseType', 'Add Case Type')} onClose={() => setDrawerOpen(false)} onSubmit={handleCreate} loading={saving}>
        <Stack spacing={2.5}>
          <TextField label="Name (EN)" fullWidth required value={form.labelEn} onChange={e => setForm(f => ({ ...f, labelEn: e.target.value }))} />
          <TextField label="Name (AR)" fullWidth value={form.labelAr} onChange={e => setForm(f => ({ ...f, labelAr: e.target.value }))} />
          <TextField label="Code" fullWidth value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
