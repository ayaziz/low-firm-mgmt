'use client';

import React from 'react';
import { Card, CardContent, Box, Typography, Stack } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';

export interface KPICardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  onClick?: () => void;
}

export default function KPICard({ title, value, icon, color, trend, trendLabel, onClick }: KPICardProps) {
  const trendColor = trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : TrendingFlat;

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': onClick
          ? { boxShadow: 4, transform: 'translateY(-2px)' }
          : undefined,
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom noWrap>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700} color={color || 'text.primary'}>
              {value}
            </Typography>
            {trend && trendLabel && (
              <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
                <Typography variant="caption" color={trendColor}>
                  {trendLabel}
                </Typography>
              </Stack>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: color ? `${color}15` : 'action.hover',
                color: color || 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
