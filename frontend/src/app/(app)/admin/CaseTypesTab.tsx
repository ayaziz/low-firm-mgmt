'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
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
import type { CaseType } from '@/types';

export default function CaseTypesTab() {
  const { t } = useTranslation();
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ labelEn: '', labelAr: '', code: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listCaseTypes();
      setCaseTypes(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await adminApi.createCaseType({
      labelEn: form.labelEn,
      labelAr: form.labelAr,
      code: form.code,
    });
    setDialogOpen(false);
    setForm({ labelEn: '', labelAr: '', code: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    await adminApi.deleteCaseType(id);
    load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" spacing={1} mb={2}>
        <Tooltip title={t('common.refresh')}>
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          {t('admin.createCaseType')}
        </Button>
      </Stack>

      <Card>
        {caseTypes.length > 0 ? (
          <List dense>
            {caseTypes.map(ct => (
              <ListItem
                key={ct.id}
                secondaryAction={
                  <IconButton edge="end" size="small" color="error" onClick={() => handleDelete(ct.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={ct.label_en}
                  secondary={`${ct.label_ar || ''} — Code: ${ct.code || '—'}`}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Box p={3}>
            <Typography variant="body2" color="text.secondary">
              {loading ? t('common.loading') : t('common.noData')}
            </Typography>
          </Box>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('admin.createCaseType')}</DialogTitle>
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
