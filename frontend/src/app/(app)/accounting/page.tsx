'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tab, Tabs } from '@mui/material';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageHeader from '@/components/common/PageHeader';
import InvoicesTab from './InvoicesTab';
import ExpensesTab from './ExpensesTab';
import WagesTab from './WagesTab';

export default function AccountingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <ProtectedRoute requiredRoles={['Accountant', 'TenantAdmin', 'SystemAdmin']}>
    <Box>
      <PageHeader title={t('accounting.title', 'Accounting')} />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('accounting.invoices')} />
        <Tab label={t('accounting.expenses')} />
        <Tab label={t('accounting.wages')} />
      </Tabs>
      {tab === 0 && <InvoicesTab />}
      {tab === 1 && <ExpensesTab />}
      {tab === 2 && <WagesTab />}
    </Box>
    </ProtectedRoute>
  );
}
