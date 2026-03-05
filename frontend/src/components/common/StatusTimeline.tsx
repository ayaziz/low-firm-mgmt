'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  ArrowForward as ArrowIcon,
  Circle as DotIcon,
} from '@mui/icons-material';
import { statusHistoryApi } from '@/api';
import type { StatusHistoryEntry } from '@/types';

export interface StatusTimelineProps {
  entityType: string;
  entityId: string;
  /** Pre-loaded entries (skip API call if provided) */
  entries?: StatusHistoryEntry[];
}

export default function StatusTimeline({ entityType, entityId, entries: propEntries }: StatusTimelineProps) {
  const [entries, setEntries] = useState<StatusHistoryEntry[]>(propEntries ?? []);
  const [loading, setLoading] = useState(!propEntries);

  useEffect(() => {
    if (propEntries) {
      setEntries(propEntries);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await statusHistoryApi.getTimeline(entityType, entityId, { limit: 50 });
        if (!cancelled) setEntries(res.data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId, propEntries]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
        No status changes recorded.
      </Typography>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Status Timeline
      </Typography>
      <Stack spacing={1.5}>
        {entries.map((entry, idx) => (
          <Stack
            key={entry.id}
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            sx={{
              position: 'relative',
              pl: 3,
              '&::before': idx < entries.length - 1
                ? {
                    content: '""',
                    position: 'absolute',
                    left: 10,
                    top: 24,
                    bottom: -12,
                    width: 2,
                    bgcolor: 'divider',
                  }
                : undefined,
            }}
          >
            <DotIcon
              sx={{
                fontSize: 12,
                position: 'absolute',
                left: 5,
                top: 6,
                color: idx === 0 ? 'primary.main' : 'text.disabled',
              }}
            />
            <Box flex={1}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {entry.from_status && (
                  <>
                    <Chip label={entry.from_status} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                    <ArrowIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </>
                )}
                <Chip label={entry.to_status} size="small" color="primary" sx={{ fontSize: '0.7rem' }} />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {entry.actor_name || 'System'}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {new Date(entry.created_at).toLocaleString()}
                </Typography>
              </Stack>
              {entry.comment && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>
                  &quot;{entry.comment}&quot;
                </Typography>
              )}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
