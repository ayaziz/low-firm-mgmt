'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Grid, Stack, Switch, TextField, FormControlLabel, MenuItem,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { adminApi } from '@/api';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

export default function SettingsTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [workflowName, setWorkflowName] = useState('Default');
  const [workflowRoles, setWorkflowRoles] = useState('TenantAdmin');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, w] = await Promise.all([adminApi.getTenantSettings(), adminApi.getExpenseWorkflow()]);
      setSettings(s);
      const steps = Array.isArray((w as any)?.steps) ? (w as any).steps : [];
      setWorkflowName((w as any)?.name || 'Default');
      setWorkflowRoles(steps.map((step: any) => step.approverRole).join(', '));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const roles = workflowRoles
        .split(',')
        .map(role => role.trim())
        .filter(Boolean);

      await Promise.all([
        adminApi.updateTenantSettings(settings),
        adminApi.saveExpenseWorkflow({
          name: workflowName || 'Default',
          steps: roles.map((approverRole, index) => ({ stepOrder: index + 1, approverRole })),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSkeleton variant="detail" />;
  if (!settings) return null;

  const updateSetting = (key: string, value: any) => setSettings((s: any) => ({ ...s, [key]: value }));

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
                <TextField label={t('admin.currency', 'Currency')} fullWidth value={settings.currency ?? ''} onChange={e => updateSetting('currency', e.target.value)} />
                <TextField label={t('admin.timezone', 'Timezone')} fullWidth value={settings.timezone ?? ''} onChange={e => updateSetting('timezone', e.target.value)} />
                <TextField label={t('admin.locale', 'Locale')} fullWidth value={settings.locale ?? ''} onChange={e => updateSetting('locale', e.target.value)} />
                <TextField
                  label={t('admin.planTier', 'Plan Tier')}
                  select
                  fullWidth
                  value={settings.planTier ?? 'Standard'}
                  onChange={e => updateSetting('planTier', e.target.value)}
                >
                  <MenuItem value="Standard">Standard</MenuItem>
                  <MenuItem value="Enterprise">Enterprise</MenuItem>
                </TextField>
                <FormControlLabel control={<Switch checked={!!settings.lawyerCanDraft} onChange={e => updateSetting('lawyerCanDraft', e.target.checked)} />} label={t('admin.lawyerCanDraft', 'Lawyer can draft')} />
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
                <TextField label={t('admin.workflowName', 'Workflow Name')} fullWidth value={workflowName} onChange={e => setWorkflowName(e.target.value)} />
                <TextField
                  label={t('admin.approvalSteps', 'Approval Roles (comma-separated, in order)')}
                  fullWidth
                  value={workflowRoles}
                  onChange={e => setWorkflowRoles(e.target.value)}
                />
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
