'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { adminApi } from '@/api';
import type { TenantSettings } from '@/types';

export default function SettingsTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [workflow, setWorkflow] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, w] = await Promise.all([
        adminApi.getTenantSettings(),
        adminApi.getExpenseWorkflow().catch(() => null),
      ]);
      setSettings(s);
      setWorkflow(w);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await adminApi.updateTenantSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!workflow) return;
    setSaving(true);
    try {
      await adminApi.saveExpenseWorkflow(workflow);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <Typography color="text.secondary">{t('common.loading')}</Typography>;
  }

  return (
    <Box>
      {saved && <Alert severity="success" sx={{ mb: 2 }}>{t('common.saved')}</Alert>}

      <Grid container spacing={3}>
        {/* Tenant Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title={t('admin.tenantSettings')} />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label={t('admin.firmName')}
                  fullWidth
                  value={settings.firmName || ''}
                  onChange={e => setSettings(s => s ? { ...s, firmName: e.target.value } : s)}
                />
                <TextField
                  label={t('admin.timezone')}
                  fullWidth
                  value={settings.timezone || ''}
                  onChange={e => setSettings(s => s ? { ...s, timezone: e.target.value } : s)}
                />
                <TextField
                  label={t('admin.currency')}
                  fullWidth
                  value={settings.defaultCurrency || ''}
                  onChange={e => setSettings(s => s ? { ...s, defaultCurrency: e.target.value } : s)}
                />
                <TextField
                  label={t('admin.invoicePrefix')}
                  fullWidth
                  value={settings.invoicePrefix || ''}
                  onChange={e => setSettings(s => s ? { ...s, invoicePrefix: e.target.value } : s)}
                />
                <TextField
                  label="Invoice Footer"
                  fullWidth
                  multiline
                  rows={2}
                  value={settings.invoiceFooter || ''}
                  onChange={e => setSettings(s => s ? { ...s, invoiceFooter: e.target.value } : s)}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoScan ?? true}
                      onChange={e => setSettings(s => s ? { ...s, autoScan: e.target.checked } : s)}
                    />
                  }
                  label="Auto-scan uploaded documents"
                />
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveSettings}
                  disabled={saving}
                >
                  {t('common.save')}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Expense Approval Workflow */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title={t('admin.expenseWorkflow')} />
            <CardContent>
              {workflow ? (
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={workflow.requiresApproval ?? true}
                        onChange={e => setWorkflow((w: any) => ({ ...w, requiresApproval: e.target.checked }))}
                      />
                    }
                    label="Require approval"
                  />
                  <TextField
                    label="Auto-approve threshold ($)"
                    type="number"
                    fullWidth
                    value={workflow.autoApproveThreshold ?? 0}
                    onChange={e => setWorkflow((w: any) => ({ ...w, autoApproveThreshold: Number(e.target.value) }))}
                  />
                  <TextField
                    label="Approver Roles (comma-separated)"
                    fullWidth
                    value={workflow.approverRoles?.join(', ') || ''}
                    onChange={e => setWorkflow((w: any) => ({
                      ...w,
                      approverRoles: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean),
                    }))}
                  />
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveWorkflow}
                    disabled={saving}
                  >
                    {t('common.save')}
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No workflow configuration found
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
