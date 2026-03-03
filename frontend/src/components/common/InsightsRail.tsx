'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
} from '@mui/icons-material';

export interface InsightItem {
  label: string;
  value: string | number | React.ReactNode;
  color?: string;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface InsightsRailProps {
  completeness?: number;
  checklist?: ChecklistItem[];
  insights?: InsightItem[];
  children?: React.ReactNode;
}

export default function InsightsRail({ completeness, checklist, insights, children }: InsightsRailProps) {
  return (
    <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
      <Stack spacing={2}>
        {/* Completeness */}
        {completeness !== undefined && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Completeness
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={completeness}
                    sx={{ height: 8, borderRadius: 4 }}
                    color={completeness >= 80 ? 'success' : completeness >= 50 ? 'warning' : 'error'}
                  />
                </Box>
                <Typography variant="body2" fontWeight={700}>
                  {completeness}%
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Checklist */}
        {checklist && checklist.length > 0 && (
          <Card>
            <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Checklist
              </Typography>
              <List dense disablePadding>
                {checklist.map((item, idx) => (
                  <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {item.done ? (
                        <CheckIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      ) : (
                        <UncheckedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        color: item.done ? 'text.secondary' : 'text.primary',
                        sx: item.done ? { textDecoration: 'line-through' } : undefined,
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Insight cards */}
        {insights && insights.length > 0 && (
          <Card>
            <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
              {insights.map((item, idx) => (
                <React.Fragment key={idx}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" py={0.75}>
                    <Typography variant="body2" color="text.secondary">
                      {item.label}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} color={item.color || 'text.primary'}>
                      {item.value}
                    </Typography>
                  </Stack>
                  {idx < insights.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        )}

        {children}
      </Stack>
    </Box>
  );
}
