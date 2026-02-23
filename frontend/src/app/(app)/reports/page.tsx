'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { reportApi } from '@/api';
import { useAuth } from '@/context/AuthContext';
import type { ReportResult } from '@/types';

const CHART_COLORS = ['#1B3A5C', '#2E7D32', '#ED6C02', '#D32F2F', '#1565C0', '#6A1B9A', '#00897B', '#EF6C00', '#546E7A'];

interface ReportDef {
  slug: string;
  label: string;
  chart: 'bar' | 'pie' | 'line' | 'table';
  roles?: string[];
}

const REPORTS: ReportDef[] = [
  { slug: 'cases-by-state', label: 'Cases by State', chart: 'bar' },
  { slug: 'cases-by-type', label: 'Cases by Type', chart: 'pie' },
  { slug: 'cases-by-owner', label: 'Cases by Owner', chart: 'bar' },
  { slug: 'overdue-tasks', label: 'Overdue Tasks', chart: 'table' },
  { slug: 'upcoming-sessions', label: 'Upcoming Sessions', chart: 'table' },
  { slug: 'completeness-gaps', label: 'Completeness Gaps', chart: 'table' },
  { slug: 'receivables', label: 'Receivables', chart: 'table', roles: ['Accountant', 'TenantAdmin', 'SystemAdmin'] },
  { slug: 'cashflow', label: 'Cash Flow', chart: 'line', roles: ['Accountant', 'TenantAdmin', 'SystemAdmin'] },
  { slug: 'expenses-by-category', label: 'Expenses by Category', chart: 'pie', roles: ['Accountant', 'TenantAdmin', 'SystemAdmin'] },
];

export default function ReportsPage() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const [selected, setSelected] = useState('cases-by-state');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const visibleReports = REPORTS.filter(r => !r.roles || hasAnyRole(...(r.roles as any)));
  const currentDef = visibleReports.find(r => r.slug === selected) || visibleReports[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportApi.generate(selected, filters);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [selected, filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    reportApi.exportCsv(selected, filters);
  };

  const renderChart = () => {
    if (!result || !result.data || result.data.length === 0) {
      return (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {t('reports.noData')}
        </Typography>
      );
    }

    const data = result.data;

    switch (currentDef.chart) {
      case 'bar': {
        const valueKey = Object.keys(data[0]).find(k => k !== 'key') || 'count';
        return (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
              <XAxis dataKey="key" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey={valueKey} fill={CHART_COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case 'pie': {
        const nameKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'string') || 'key';
        const valueKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'number') || 'count';
        return (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie data={data} dataKey={valueKey as string} nameKey={nameKey as string} cx="50%" cy="50%" outerRadius={120} label>
                {data.map((_e, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case 'line': {
        const numKeys = Object.keys(data[0]).filter(k => typeof data[0][k] === 'number');
        return (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              {numKeys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      }

      case 'table': {
        const cols = Object.keys(data[0]);
        return (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {cols.map(c => (
                    <TableCell key={c} sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {c.replace(/_/g, ' ')}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={i}>
                    {cols.map(c => (
                      <TableCell key={c}>{String(row[c] ?? '')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        );
      }
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {t('reports.title')}
      </Typography>

      <Grid container spacing={3}>
        {/* Left: report selector & filters */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title={t('reports.selectReport')} />
            <CardContent>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>{t('reports.reportType')}</InputLabel>
                <Select
                  value={selected}
                  label={t('reports.reportType')}
                  onChange={e => { setSelected(e.target.value); setFilters({}); }}
                >
                  {visibleReports.map(r => (
                    <MenuItem key={r.slug} value={r.slug}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Context-sensitive filters */}
              {(selected === 'overdue-tasks') && (
                <TextField
                  fullWidth size="small" label="Priority"
                  value={filters.priority || ''}
                  onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
                  sx={{ mb: 1 }}
                />
              )}
              {(selected === 'upcoming-sessions') && (
                <TextField
                  fullWidth size="small" label="Days ahead" type="number"
                  value={filters.days || '7'}
                  onChange={e => setFilters(f => ({ ...f, days: e.target.value }))}
                  sx={{ mb: 1 }}
                />
              )}
              {(selected === 'completeness-gaps') && (
                <>
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Entity Type</InputLabel>
                    <Select
                      value={filters.entityType || 'customer'}
                      label="Entity Type"
                      onChange={e => setFilters(f => ({ ...f, entityType: e.target.value }))}
                    >
                      <MenuItem value="customer">Customer</MenuItem>
                      <MenuItem value="case">Case</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth size="small" label="Threshold (%)" type="number"
                    value={filters.thresholdPct || '80'}
                    onChange={e => setFilters(f => ({ ...f, thresholdPct: e.target.value }))}
                    sx={{ mb: 1 }}
                  />
                </>
              )}
              {(selected === 'cashflow') && (
                <Stack spacing={1}>
                  <TextField
                    fullWidth size="small" label="Start Month" placeholder="2024-01"
                    value={filters.startMonth || ''}
                    onChange={e => setFilters(f => ({ ...f, startMonth: e.target.value }))}
                  />
                  <TextField
                    fullWidth size="small" label="End Month" placeholder="2024-12"
                    value={filters.endMonth || ''}
                    onChange={e => setFilters(f => ({ ...f, endMonth: e.target.value }))}
                  />
                </Stack>
              )}

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={load}
                  disabled={loading}
                  fullWidth
                >
                  {t('reports.generate')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExport}
                  fullWidth
                >
                  CSV
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: chart / table */}
        <Grid item xs={12} md={9}>
          <Card>
            <CardHeader
              title={currentDef.label}
              subheader={
                result?.metadata
                  ? `Generated at ${new Date(result.metadata.generatedAt).toLocaleString()}`
                  : undefined
              }
            />
            <CardContent>
              {loading ? (
                <Typography color="text.secondary">{t('common.loading')}</Typography>
              ) : (
                renderChart()
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
