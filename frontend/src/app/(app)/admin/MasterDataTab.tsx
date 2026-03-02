'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { adminApi } from '@/api';
import type { MasterDataItem } from '@/types';

const CATEGORIES = [
	'contactRole',
	'participantRole',
	'relationshipType',
	'communicationType',
	'filingType',
	'sessionType',
	'expenseCategory',
	'paymentMethod',
	'docType',
	'nationalities',
	'currencies',
]

export default function MasterDataTab() {
  const { t } = useTranslation();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [items, setItems] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ labelEn: '', labelAr: '', code: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listMasterData(category);
      setItems(res);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await adminApi.createMasterData({
      category,
      code: form.code,
      labelEn: form.labelEn,
      labelAr: form.labelAr,
    });
    setDialogOpen(false);
    setForm({ labelEn: '', labelAr: '', code: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    await adminApi.deleteMasterData(category, id);
    load();
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField
          select
          label={t('admin.category')}
          value={category}
          onChange={e => setCategory(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {CATEGORIES.map(c => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>
        <Box flex={1} />
        <Tooltip title={t('common.refresh')}>
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          {t('common.add')}
        </Button>
      </Stack>

      <Card>
        <CardHeader title={category} />
        <CardContent>
          {items.length > 0 ? (
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
                  <ListItemText
                    primary={item.label_en}
                    secondary={`${item.label_ar || ''} ${item.code ? `(${item.code})` : ''}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {loading ? t('common.loading') : t('common.noData')}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('common.add')} — {category}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Name (EN)"
              fullWidth
              required
              value={form.labelEn}
              onChange={e => setForm(f => ({ ...f, labelEn: e.target.value }))}
            />
            <TextField
              label="Name (AR)"
              fullWidth
              value={form.labelAr}
              onChange={e => setForm(f => ({ ...f, labelAr: e.target.value }))}
            />
            <TextField
              label="Code"
              fullWidth
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.labelEn}>
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
