'use client';

import React from 'react';
import { Stack, Chip } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface FilterChip {
  key: string;
  label: string;
  value: string;
}

export interface FilterChipsProps {
  filters: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
}

export default function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2, gap: 0.5 }}>
      {filters.map((f) => (
        <Chip
          key={f.key}
          label={`${f.label}: ${f.value}`}
          size="small"
          onDelete={() => onRemove(f.key)}
          deleteIcon={<CloseIcon fontSize="small" />}
          variant="outlined"
          color="primary"
        />
      ))}
      {onClearAll && filters.length > 1 && (
        <Chip
          label="Clear All"
          size="small"
          onClick={onClearAll}
          variant="outlined"
          color="default"
          sx={{ fontWeight: 600 }}
        />
      )}
    </Stack>
  );
}
