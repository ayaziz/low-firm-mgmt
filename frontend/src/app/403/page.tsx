'use client';

import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';

export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <Box minHeight="70vh" display="flex" flexDirection="column" justifyContent="center" alignItems="center" gap={2}>
      <Typography variant="h4" fontWeight={700}>403</Typography>
      <Typography variant="h6">Access Denied</Typography>
      <Typography variant="body2" color="text.secondary">You do not have permission to view this page.</Typography>
      <Button variant="contained" onClick={() => router.push('/')}>Go to Dashboard</Button>
    </Box>
  );
}
