'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  People as PeopleIcon,
  Gavel as GavelIcon,
  Description as DocIcon,
} from '@mui/icons-material';
import { searchApi } from '@/api';
import type { SearchResult } from '@/types';

const entityIcons: Record<string, React.ReactNode> = {
  customer: <PeopleIcon fontSize="small" />,
  case: <GavelIcon fontSize="small" />,
  document: <DocIcon fontSize="small" />,
};

const entityPaths: Record<string, string> = {
  customer: '/customers/',
  case: '/cases/',
  document: '/documents/',
};

export default function SearchPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await searchApi.search({ q, type: filter || undefined, limit: 50 });
      setResults(res.data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { doSearch(initialQ); }, [initialQ, doSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      router.replace(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.entityType] ||= []).push(r);
    return acc;
  }, {});

  const filteredGroups = filter ? { [filter]: grouped[filter] || [] } : grouped;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {t('search.title')}
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, v) => setFilter(v)}
          size="small"
        >
          <ToggleButton value="customer">{t('search.customers')}</ToggleButton>
          <ToggleButton value="case">{t('search.cases')}</ToggleButton>
          <ToggleButton value="document">{t('search.documents')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {loading && <Typography color="text.secondary">{t('common.loading')}</Typography>}

      {!loading && results.length === 0 && initialQ && (
        <Typography color="text.secondary">{t('search.noResults')}</Typography>
      )}

      {Object.entries(filteredGroups).map(([type, items]) => (
        <Card key={type} sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              {entityIcons[type]}
              <Typography variant="subtitle1" fontWeight={600} textTransform="capitalize">
                {type}s
              </Typography>
              <Chip label={items.length} size="small" />
            </Stack>
            <Divider />
            <List dense disablePadding>
              {items.map(item => (
                <ListItemButton
                  key={item.entityId}
                  onClick={() => router.push(`${entityPaths[type] || '/'}${item.entityId}`)}
                >
                  <ListItemText
                    primary={item.title}
                    secondary={item.subtitle}
                  />
                  <Chip
                    label={item.matchField}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
