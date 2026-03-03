'use client';

import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { statusColors } from '@/theme/theme';

export interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
}

const chipColorMap: Record<string, ChipProps['color']> = {};

// Build from statusColors
Object.entries(statusColors).forEach(([key, value]) => {
  chipColorMap[key] = value === 'default' ? undefined : value;
});

export default function StatusBadge({ status, size = 'small', variant = 'filled' }: StatusBadgeProps) {
  const color = chipColorMap[status] || (statusColors[status] === 'default' ? 'default' : undefined);

  return (
    <Chip
      label={status}
      size={size}
      variant={variant}
      color={color || 'default'}
      sx={{
        fontWeight: 600,
        fontSize: '0.75rem',
        ...(variant === 'filled' && {
          color: '#fff',
        }),
      }}
    />
  );
}
