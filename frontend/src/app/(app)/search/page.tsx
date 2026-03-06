'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Card, CardActionArea, CardContent, List, ListItemButton, ListItemIcon, ListItemText,
  Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import {
  Search as SearchIcon, Person as PersonIcon, Gavel as CaseIcon, Description as DocIcon,
} from '@mui/icons-material';
import { searchApi } from '@/api';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

interface SearchResult {
  entityId: string;
  entityType: string;
  title: string;
  subtitle?: string;
  [key: string]: any;
}

const entityIcons: Record<string, React.ReactNode> = {
  customer: <PersonIcon />,
  case: <CaseIcon />,
  document: <DocIcon />,
};

const entityPaths: Record<string, string> = {
  customer: '/customers',
  case: '/cases',
  document: '/documents',
};

export default function SearchPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await searchApi.search({ q, type: filter ?? undefined, limit: 50 });
      setResults(Array.isArray((res as any)?.results) ? (res as any).results : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (initialQ) doSearch(initialQ); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      router.replace(`/search?q=${encodeURIComponent(query)}`);
      doSearch(query);
    }
  };

  const handleFilterChange = (_: React.MouseEvent, val: string | null) => {
    setFilter(val);
    if (query.trim()) {
      setLoading(true);
      searchApi.search({ q: query, type: val ?? undefined, limit: 50 })
        .then(res => setResults(Array.isArray((res as any)?.results) ? (res as any).results : []))
        .finally(() => setLoading(false));
    }
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.entityType ?? r.entity_type ?? 'other';
    (acc[key] = acc[key] ?? []).push(r);
    return acc;
  }, {});

  return (
    <Box>
      <PageHeader title={t('search.title', 'Search')} />

      <Stack spacing={2}>
        <TextField
          fullWidth placeholder={t('search.placeholder', 'Search customers, cases, documents…')}
          value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.disabled' }} /> }}
          autoFocus
        />

        <ToggleButtonGroup value={filter} exclusive onChange={handleFilterChange} size="small">
          <ToggleButton value={null as any}>{t('search.all', 'All')}</ToggleButton>
          <ToggleButton value="customer">{t('search.customers', 'Customers')}</ToggleButton>
          <ToggleButton value="case">{t('search.cases', 'Cases')}</ToggleButton>
          <ToggleButton value="document">{t('search.documents', 'Documents')}</ToggleButton>
        </ToggleButtonGroup>

        {loading ? <LoadingSkeleton variant="table" /> : results.length > 0 ? (
          <Stack spacing={2}>
            {Object.entries(grouped).map(([type, items]) => (
              <Card key={type} variant="outlined">
                <CardContent sx={{ pb: '8px !important' }}>
                  <Typography variant="subtitle2" color="text.secondary" textTransform="capitalize" mb={1}>{type}s ({items.length})</Typography>
                  <List dense disablePadding>
                    {items.map(item => (
                      <ListItemButton key={item.entityId} onClick={() => router.push(`${entityPaths[type] ?? '/dashboard'}/${item.entityId}`)}>
                        <ListItemIcon sx={{ minWidth: 36 }}>{entityIcons[type] ?? <SearchIcon />}</ListItemIcon>
                        <ListItemText primary={item.title ?? item.name} secondary={item.subtitle ?? item.description ?? ''} />
                      </ListItemButton>
                    ))}
                  </List>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : query.trim() && !loading ? (
          <EmptyState icon={<SearchIcon />} title={t('search.noResults', 'No results')} message={t('search.noResultsMsg', 'Try different keywords or filters')} />
        ) : null}
      </Stack>
    </Box>
  );
}
