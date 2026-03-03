'use client';

import React from 'react';
import { Box, Skeleton, Stack } from '@mui/material';

export interface LoadingSkeletonProps {
  variant?: 'table' | 'cards' | 'detail';
  rows?: number;
  columns?: number;
}

export default function LoadingSkeleton({ variant = 'table', rows = 5, columns = 4 }: LoadingSkeletonProps) {
  if (variant === 'cards') {
    return (
      <Stack direction="row" spacing={2} flexWrap="wrap">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={260} height={120} />
        ))}
      </Stack>
    );
  }

  if (variant === 'detail') {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
        <Stack direction="row" spacing={2} mb={3}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" width={200} height={100} />
          ))}
        </Stack>
        <Skeleton variant="rounded" height={300} />
      </Box>
    );
  }

  // table variant
  return (
    <Box>
      <Skeleton variant="rounded" height={48} sx={{ mb: 1 }} />
      {Array.from({ length: rows }).map((_, r) => (
        <Stack key={r} direction="row" spacing={1} mb={0.5}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} variant="text" sx={{ flex: 1, height: 40 }} />
          ))}
        </Stack>
      ))}
    </Box>
  );
}
