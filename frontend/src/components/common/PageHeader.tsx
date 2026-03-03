'use client';

import React from 'react';
import { Box, Typography, Breadcrumbs, Link as MuiLink, Stack } from '@mui/material';
import { useRouter } from 'next/navigation';
import { NavigateNext as NavNextIcon } from '@mui/icons-material';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  const router = useRouter();

  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavNextIcon fontSize="small" />}
          sx={{ mb: 1 }}
        >
          {breadcrumbs.map((crumb, idx) =>
            crumb.href ? (
              <MuiLink
                key={idx}
                color="inherit"
                underline="hover"
                sx={{ cursor: 'pointer', fontSize: '0.8125rem' }}
                onClick={() => router.push(crumb.href!)}
              >
                {crumb.label}
              </MuiLink>
            ) : (
              <Typography key={idx} color="text.primary" fontSize="0.8125rem">
                {crumb.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
      </Stack>
    </Box>
  );
}
