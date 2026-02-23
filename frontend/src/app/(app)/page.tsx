'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Skeleton,
} from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { caseApi, accountingApi, notificationApi } from '@/api';
import type { Case, Invoice } from '@/types'

function StatCard({ title, value, color }: { title: string; value: string | number; color?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={700} color={color || 'text.primary'}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState({ activeCases: 0, pendingInvoices: 0, overdueInvoices: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [casesRes, notifRes] = await Promise.all([
          caseApi.list({ limit: 5 }).catch(() => ({ data: [], cursor: null })),
          notificationApi.getUnreadCount().catch(() => ({ count: 0 })),
        ]);

        setRecentCases(casesRes.data);
        setUnreadCount(notifRes.count);

        const activeCases = casesRes.data.filter(
          (c: Case) => c.state === 'Intake' || c.state === 'Active',
        ).length;

        if (hasAnyRole('Accountant', 'TenantAdmin', 'SystemAdmin')) {
          const invoicesRes = await accountingApi
            .listInvoices({ limit: 10 })
            .catch(() => ({ data: [], cursor: null }));
          setRecentInvoices(invoicesRes.data);
          const pending = invoicesRes.data.filter((i: Invoice) => i.status === 'Sent').length;
          const overdue = invoicesRes.data.filter((i: Invoice) => i.status === 'Sent' && new Date(i.due_date) < new Date()).length;
          setStats({ activeCases, pendingInvoices: pending, overdueInvoices: overdue });
        } else {
          setStats({ activeCases, pendingInvoices: 0, overdueInvoices: 0 });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hasAnyRole]);

  if (loading) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>
          {t('dashboard.title')}
        </Typography>
        <Grid container spacing={2}>
          {[1, 2, 3].map(i => (
            <Grid item xs={12} sm={4} key={i}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        {t('dashboard.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {t('dashboard.welcome', { name: user?.displayName || '' })}
      </Typography>

      {/* Stats Row */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <StatCard title={t('dashboard.activeCases')} value={stats.activeCases} color="primary.main" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title={t('dashboard.notifications')} value={unreadCount} color="warning.main" />
        </Grid>
        {hasAnyRole('Accountant', 'TenantAdmin', 'SystemAdmin') && (
          <Grid item xs={12} sm={4}>
            <StatCard
              title={t('dashboard.overdueInvoices')}
              value={stats.overdueInvoices}
              color="error.main"
            />
          </Grid>
        )}
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Cases */}
        {hasAnyRole('Lawyer', 'TenantAdmin', 'SystemAdmin') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('dashboard.recentCases')}
                </Typography>
                {recentCases.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('common.noData')}
                  </Typography>
                ) : (
                  <List dense disablePadding>
                    {recentCases.map(c => (
                      <ListItemButton key={c.id} href={`/cases/${c.id}`}>
                        <ListItemText
                          primary={c.title}
                          secondary={c.system_case_ref}
                        />
                        <Chip label={c.state} size="small" variant="outlined" />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Recent Invoices (Accountant / Admin) */}
        {hasAnyRole('Accountant', 'TenantAdmin', 'SystemAdmin') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('dashboard.recentInvoices')}
                </Typography>
                {recentInvoices.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('common.noData')}
                  </Typography>
                ) : (
                  <List dense disablePadding>
                    {recentInvoices.map(inv => (
                      <ListItemButton key={inv.id} href={`/accounting/invoices/${inv.id}`}>
                        <ListItemText
                          primary={inv.invoice_number}
                          secondary={`${inv.currency} ${inv.total_amount}`}
                        />
                        <Chip
                          label={inv.status}
                          size="small"
                          color={
                            inv.status === 'Paid'
                              ? 'success'
                              : inv.status === 'Voided'
                              ? 'error'
                              : 'default'
                          }
                          variant="outlined"
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
