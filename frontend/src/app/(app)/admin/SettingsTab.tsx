'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Grid, Stack, Switch, TextField, FormControlLabel,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { adminApi } from '@/api';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

export default function SettingsTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [workflow, setWorkflow] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, w] = await Promise.all([adminApi.getTenantSettings(), adminApi.getExpenseWorkflow()]);
      setSettings(s);
      setWorkflow(w);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!settings || !workflow) return;
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([adminApi.updateTenantSettings(settings), adminApi.saveExpenseWorkflow(workflow as any)]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSkeleton variant="detail" />;
  if (!settings || !workflow) return null;

  const updateSetting = (key: string, value: any) => setSettings((s: any) => ({ ...s, [key]: value }));
  const updateWorkflow = (key: string, value: any) => setWorkflow((w: any) => ({ ...w, [key]: value }));

  return (
    <Box>
      {saved && <Alert severity="success" sx={{ mb: 2 }}>{t('admin.settingsSaved', 'Settings saved successfully')}</Alert>}

      <Grid container spacing={3}>
        {/* Tenant Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title={t('admin.tenantSettings', 'Tenant Settings')} />
            <CardContent>
              <Stack spacing={2.5}>
                <TextField label={t('admin.firmName', 'Firm Name')} fullWidth value={settings.firmName ?? settings.firm_name ?? ''} onChange={e => updateSetting('firmName', e.target.value)} />
                <TextField label={t('admin.timezone', 'Timezone')} fullWidth value={settings.timezone ?? ''} onChange={e => updateSetting('timezone', e.target.value)} />
                <TextField label={t('admin.defaultCurrency', 'Default Currency')} fullWidth value={settings.defaultCurrency ?? settings.default_currency ?? ''} onChange={e => updateSetting('defaultCurrency', e.target.value)} />
                <TextField label={t('admin.invoicePrefix', 'Invoice Prefix')} fullWidth value={settings.invoicePrefix ?? settings.invoice_prefix ?? ''} onChange={e => updateSetting('invoicePrefix', e.target.value)} />
                <TextField label={t('admin.invoiceFooter', 'Invoice Footer')} fullWidth multiline rows={3} value={settings.invoiceFooter ?? settings.invoice_footer ?? ''} onChange={e => updateSetting('invoiceFooter', e.target.value)} />
                <FormControlLabel control={<Switch checked={!!settings.autoScan} onChange={e => updateSetting('autoScan', e.target.checked)} />} label={t('admin.autoScan', 'Auto-Scan Documents')} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Expense Approval Workflow */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title={t('admin.expenseWorkflow', 'Expense Approval Workflow')} />
            <CardContent>
              <Stack spacing={2.5}>
                <FormControlLabel control={<Switch checked={!!workflow.requiresApproval} onChange={e => updateWorkflow('requiresApproval', e.target.checked)} />} label={t('admin.requiresApproval', 'Requires Approval')} />
                <TextField label={t('admin.autoApproveThreshold', 'Auto-Approve Threshold')} type="number" fullWidth value={workflow.autoApproveThreshold ?? ''} onChange={e => updateWorkflow('autoApproveThreshold', Number(e.target.value))} />
                <TextField label={t('admin.approverRoles', 'Approver Roles (comma-separated)')} fullWidth value={workflow.approverRoles ?? ''} onChange={e => updateWorkflow('approverRoles', e.target.value)} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" justifyContent="flex-end" mt={3}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
        </Button>
      </Stack>
    </Box>
  );
}
