'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Card, CardContent, CardHeader, IconButton, List, ListItem, ListItemText,
  MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { adminApi } from '@/api';
import type { MasterDataItem } from '@/types';
import DrawerForm from '@/components/common/DrawerForm';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

const CATEGORIES = [
  'contactRole', 'participantRole', 'relationshipType', 'communicationType',
  'filingType', 'sessionType', 'expenseCategory', 'paymentMethod',
  'docType', 'nationalities', 'currencies',
];

export default function MasterDataTab() {
  const { t } = useTranslation();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [items, setItems] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ labelEn: '', labelAr: '', code: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listMasterData(category);
      setItems(res);
    } finally { setLoading(false); }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await adminApi.createMasterData({ category, code: form.code, labelEn: form.labelEn, labelAr: form.labelAr });
      setDrawerOpen(false);
      setForm({ labelEn: '', labelAr: '', code: '' });
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await adminApi.deleteMasterData(category, id);
    load();
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField select label={t('admin.category', 'Category')} value={category} onChange={e => setCategory(e.target.value)} sx={{ minWidth: 200 }}>
          {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <Box flex={1} />
        <Tooltip title={t('common.refresh', 'Refresh')}>
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDrawerOpen(true)}>{t('common.add', 'Add')}</Button>
      </Stack>

      {loading && items.length === 0 ? <LoadingSkeleton variant="table" /> : items.length > 0 ? (
        <Card>
          <CardHeader title={category} />
          <CardContent>
            <List dense>
              {items.map((item: MasterDataItem) => (
                <ListItem
                  key={item.id}
                  secondaryAction={
                    <IconButton edge="end" size="small" color="error" onClick={() => handleDelete(item.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText primary={item.label_en} secondary={`${item.label_ar || ''} ${item.code ? `(${item.code})` : ''}`} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('admin.noMasterData', 'No items in this category')} />
      )}

      <DrawerForm open={drawerOpen} title={`${t('common.add', 'Add')} — ${category}`} onClose={() => setDrawerOpen(false)} onSubmit={handleCreate} loading={saving}>
        <Stack spacing={2.5}>
          <TextField label="Name (EN)" fullWidth required value={form.labelEn} onChange={e => setForm(f => ({ ...f, labelEn: e.target.value }))} />
          <TextField label="Name (AR)" fullWidth value={form.labelAr} onChange={e => setForm(f => ({ ...f, labelAr: e.target.value }))} />
          <TextField label="Code" fullWidth value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
        </Stack>
      </DrawerForm>
    </Box>
  );
}
