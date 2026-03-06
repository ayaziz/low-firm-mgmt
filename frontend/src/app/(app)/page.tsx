'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Stack,
  Divider,
} from '@mui/material';
import {
  Gavel as CaseIcon,
  Notifications as NotifIcon,
  AttachMoney as MoneyIcon,
  Timer as TimeIcon,
  People as PeopleIcon,
  Event as CalendarIcon,
  TrendingUp,
  Description as DocIcon,
  Warning as WarningIcon,
  Assignment as TaskIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { caseApi, accountingApi, notificationApi, calendarApi, reportApi, timeEntryApi } from '@/api';
import type { Case, Invoice, CalendarEvent, ReportResult } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import KPICard from '@/components/common/KPICard';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';

const PIE_COLORS = ['#1B3A5C', '#4A7C59', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [casesByState, setCasesByState] = useState<Array<{ name: string; value: number }>>([]);
  const [stats, setStats] = useState({
    activeCases: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalReceivable: 0,
    totalHoursWeek: 0,
    pendingWages: 0,
    overdueTasks: 0,
    upcomingSessions: 0,
  });

  const isLawyer = hasAnyRole('Lawyer');
  const isAccountant = hasAnyRole('Accountant');
  const isAdmin = hasAnyRole('TenantAdmin', 'SystemAdmin');

  const formatCurrency = useCallback(
    (amount: number) => new Intl.NumberFormat(i18n.language || undefined, { style: 'currency', currency: 'USD' }).format(amount || 0),
    [i18n.language],
  );

  useEffect(() => {
    async function load() {
      try {
        const promises: Promise<unknown>[] = [
          caseApi.list({ limit: 5 }).catch(() => ({ data: [], cursor: null })),
          notificationApi.getUnreadCount().catch(() => ({ count: 0 })),
          calendarApi.getMyEvents({ limit: 5 }).catch(() => ({ data: [], cursor: null })),
        ];

        // Fetch report data for case pie chart
        promises.push(
          reportApi.generate('cases-by-state').catch(() => ({ columns: [], rows: [] })),
        );

        // Fetch KPI dashboard
        promises.push(
          reportApi.kpiDashboard().catch(() => null),
        );

        if (hasAnyRole('Accountant', 'TenantAdmin', 'SystemAdmin')) {
          promises.push(
            accountingApi.listInvoices({ limit: 10 }).catch(() => ({ data: [], cursor: null })),
          );
        }

        if (hasAnyRole('Lawyer', 'TenantAdmin', 'SystemAdmin')) {
          promises.push(
            timeEntryApi.summary().catch(() => ({ total_hours: 0, billable_hours: 0, total_amount: 0 })),
          );
        }

        const results = await Promise.all(promises);

        const casesRes = results[0] as { data: Case[] };
        const notifRes = results[1] as { count: number };
        const eventsRes = results[2] as { data: CalendarEvent[] };
        const reportRes = results[3] as ReportResult;
        const kpiRes = results[4] as any;

        setRecentCases(casesRes.data);
        setUnreadCount(notifRes.count);
        setUpcomingEvents(eventsRes.data || []);

        // Parse pie chart data
        if (reportRes.data && reportRes.data.length > 0) {
          const pieData = reportRes.data.map((r: Record<string, unknown>) => ({
            name: String(r.state || r.name || ''),
            value: Number(r.count || r.value || 0),
          }));
          setCasesByState(pieData);
        }

        const activeCases = casesRes.data.filter(
          (c: Case) => c.state === 'Intake' || c.state === 'Active',
        ).length;

        let pendingInvoices = 0;
        let overdueInvoices = 0;
        let totalReceivable = 0;

        if (hasAnyRole('Accountant', 'TenantAdmin', 'SystemAdmin')) {
          const invoicesRes = results[5] as { data: Invoice[] };
          setRecentInvoices(invoicesRes.data);
          pendingInvoices = invoicesRes.data.filter((i: Invoice) => i.status === 'Sent').length;
          overdueInvoices = invoicesRes.data.filter(
            (i: Invoice) => i.status === 'Sent' && new Date(i.due_date) < new Date(),
          ).length;
          totalReceivable = invoicesRes.data
            .filter((i: Invoice) => i.status === 'Sent' || i.status === 'PartiallyPaid')
            .reduce((s: number, i: Invoice) => s + (i.total_amount - (i.paid_amount || 0)), 0);
        }

        let totalHoursWeek = 0;
        const timeSummaryIdx = hasAnyRole('Accountant', 'TenantAdmin', 'SystemAdmin') ? 6 : 5;
        if (hasAnyRole('Lawyer', 'TenantAdmin', 'SystemAdmin') && results[timeSummaryIdx]) {
          const summary = results[timeSummaryIdx] as { total_hours?: number };
          totalHoursWeek = summary.total_hours || 0;
        }

        // Extract KPI data
        let pendingWages = 0;
        let overdueTasks = 0;
        let upcomingSessions = 0;
        if (kpiRes) {
          pendingWages = kpiRes.wages?.pendingApproval ?? kpiRes.wages?.pending_approval ?? 0;
          overdueTasks = kpiRes.tasks?.overdueCount ?? kpiRes.tasks?.overdue_count ?? 0;
          upcomingSessions = kpiRes.sessions?.upcomingCount ?? kpiRes.sessions?.upcoming_count ?? 0;
        }

        setStats({ activeCases, pendingInvoices, overdueInvoices, totalReceivable, totalHoursWeek, pendingWages, overdueTasks, upcomingSessions });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hasAnyRole]);

  if (loading) {
    return (
      <Box>
        <PageHeader title={t('dashboard.title')} />
        <LoadingSkeleton variant="cards" columns={4} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={`${t('dashboard.welcome')}, ${user?.displayName || ''}`}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      />

      {/* KPI Row */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <KPICard
            title={t('dashboard.activeCases')}
            value={stats.activeCases}
            icon={<CaseIcon />}
            color="#1B3A5C"
            onClick={() => router.push('/cases')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KPICard
            title={t('dashboard.notifications')}
            value={unreadCount}
            icon={<NotifIcon />}
            color="#F59E0B"
            onClick={() => router.push('/notifications')}
          />
        </Grid>
        {(isAccountant || isAdmin) && (
          <Grid item xs={6} sm={3}>
            <KPICard
              title={t('dashboard.overdueInvoices')}
              value={stats.overdueInvoices}
              icon={<WarningIcon />}
              color="#EF4444"
              trend={stats.overdueInvoices > 0 ? 'up' : 'flat'}
              trendLabel={stats.overdueInvoices > 0 ? t('dashboard.overdueCount', '{{count}} overdue', { count: stats.overdueInvoices }) : t('common.none', 'None')}
              onClick={() => router.push('/accounting')}
            />
          </Grid>
        )}
        {(isLawyer || isAdmin) && (
          <Grid item xs={6} sm={3}>
            <KPICard
              title={t('dashboard.hoursThisWeek')}
              value={`${stats.totalHoursWeek}h`}
              icon={<TimeIcon />}
              color="#4A7C59"
              onClick={() => router.push('/time-entries')}
            />
          </Grid>
        )}
        {(isAccountant || isAdmin) && (
          <Grid item xs={6} sm={3}>
            <KPICard
              title={t('dashboard.totalReceivable')}
              value={formatCurrency(stats.totalReceivable)}
              icon={<MoneyIcon />}
              color="#8B5CF6"
              onClick={() => router.push('/accounting')}
            />
          </Grid>
        )}
        {(isAccountant || isAdmin) && stats.pendingWages > 0 && (
          <Grid item xs={6} sm={3}>
            <KPICard
              title={t('dashboard.pendingWages', 'Pending Wages')}
              value={stats.pendingWages}
              icon={<MoneyIcon />}
              color="#06B6D4"
              onClick={() => router.push('/accounting')}
            />
          </Grid>
        )}
        {stats.overdueTasks > 0 && (
          <Grid item xs={6} sm={3}>
            <KPICard
              title={t('dashboard.overdueTasks', 'Overdue Tasks')}
              value={stats.overdueTasks}
              icon={<TaskIcon />}
              color="#EF4444"
              trend="up"
              trendLabel={t('dashboard.overdueCount', '{{count}} overdue', { count: stats.overdueTasks })}
              onClick={() => router.push('/tasks')}
            />
          </Grid>
        )}
        {stats.upcomingSessions > 0 && (
          <Grid item xs={6} sm={3}>
            <KPICard
              title={t('dashboard.upcomingSessions', 'Upcoming Sessions')}
              value={stats.upcomingSessions}
              icon={<CalendarIcon />}
              color="#06B6D4"
              onClick={() => router.push('/calendar')}
            />
          </Grid>
        )}
      </Grid>

      <Grid container spacing={3}>
        {/* Cases by State - Pie chart */}
        {casesByState.length > 0 && (
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {t('reports.casesByState')}
                </Typography>
                <Box sx={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={casesByState}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {casesByState.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Recent Cases */}
        {(isLawyer || isAdmin) && (
          <Grid item xs={12} md={casesByState.length > 0 ? 4 : 6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('dashboard.recentCases')}
                  </Typography>
                  <Button size="small" onClick={() => router.push('/cases')}>
                    {t('common.all')}
                  </Button>
                </Stack>
                {recentCases.length === 0 ? (
                  <EmptyState message={t('common.noData')} />
                ) : (
                  <List dense disablePadding>
                    {recentCases.map(c => (
                      <ListItemButton key={c.id} onClick={() => router.push(`/cases/${c.id}`)} sx={{ borderRadius: 1, mb: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CaseIcon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={c.title}
                          secondary={c.system_case_ref}
                          primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }}
                          secondaryTypographyProps={{ fontSize: '0.75rem' }}
                        />
                        <StatusBadge status={c.state} />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Upcoming Events */}
        <Grid item xs={12} md={casesByState.length > 0 ? 4 : 6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {t('dashboard.upcomingSessions')}
                </Typography>
                <Button size="small" onClick={() => router.push('/calendar')}>
                  {t('common.all')}
                </Button>
              </Stack>
              {upcomingEvents.length === 0 ? (
                <EmptyState message={t('common.noData')} />
              ) : (
                <List dense disablePadding>
                  {upcomingEvents.map(ev => (
                    <ListItemButton key={ev.id} sx={{ borderRadius: 1, mb: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CalendarIcon fontSize="small" color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary={ev.title}
                        secondary={ev.start_at ? new Date(ev.start_at).toLocaleString() : ''}
                        primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: '0.75rem' }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Invoices (Accountant / Admin) */}
        {(isAccountant || isAdmin) && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('dashboard.recentInvoices')}
                  </Typography>
                  <Button size="small" onClick={() => router.push('/accounting')}>
                    {t('common.all')}
                  </Button>
                </Stack>
                {recentInvoices.length === 0 ? (
                  <EmptyState message={t('common.noData')} />
                ) : (
                  <List dense disablePadding>
                    {recentInvoices.map(inv => (
                      <ListItemButton key={inv.id} onClick={() => router.push(`/accounting/invoices/${inv.id}`)} sx={{ borderRadius: 1, mb: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <MoneyIcon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={inv.invoice_number}
                          secondary={`${inv.currency} ${Number(inv.total_amount).toLocaleString()}`}
                          primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }}
                          secondaryTypographyProps={{ fontSize: '0.75rem' }}
                        />
                        <StatusBadge status={inv.status} />
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
