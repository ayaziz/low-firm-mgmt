'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import ProtectedRoute from '@/components/ProtectedRoute';
import UsersTab from './UsersTab';
import MasterDataTab from './MasterDataTab';
import CaseTypesTab from './CaseTypesTab';
import SettingsTab from './SettingsTab';

export default function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <ProtectedRoute requiredRoles={['TenantAdmin', 'SystemAdmin']}>
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        {t('admin.title')}
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('admin.users')} />
        <Tab label={t('admin.masterData')} />
        <Tab label={t('admin.caseTypes')} />
        <Tab label={t('admin.settings')} />
      </Tabs>
      {tab === 0 && <UsersTab />}
      {tab === 1 && <MasterDataTab />}
      {tab === 2 && <CaseTypesTab />}
      {tab === 3 && <SettingsTab />}
    </Box>
    </ProtectedRoute>
  );
}
