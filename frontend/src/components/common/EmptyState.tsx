'use client';

import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { SearchOff as EmptyIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
      }}
    >
      <Stack alignItems="center" spacing={1.5}>
        <Box sx={{ color: 'text.disabled', fontSize: 56 }}>
          {icon || <EmptyIcon sx={{ fontSize: 56 }} />}
        </Box>
        <Typography variant="h6" color="text.secondary" fontWeight={600}>
          {title || t('common.noData')}
        </Typography>
        {message && (
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth={360}>
            {message}
          </Typography>
        )}
        {action && <Box mt={2}>{action}</Box>}
      </Stack>
    </Box>
  );
}
