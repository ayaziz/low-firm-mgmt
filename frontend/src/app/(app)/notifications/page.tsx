'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle as ReadIcon,
  Circle as UnreadIcon,
  DoneAll as MarkAllIcon,
} from '@mui/icons-material';
import { notificationApi } from '@/api';
import type { Notification } from '@/types';

const typeColors: Record<string, 'info' | 'warning' | 'error' | 'success' | 'default'> = {
  task: 'info',
  session: 'warning',
  approval: 'success',
  system: 'default',
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (c?: string) => {
    setLoading(true);
    try {
      const res = await notificationApi.list({ cursor: c || undefined, limit: 20 });
      setNotifications(prev => (c ? [...prev, ...res.data] : res.data));
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id: string) => {
    await notificationApi.markAsRead(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n)),
    );
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) handleMarkRead(n.id);
    if (n.entity_type && n.entity_id) {
      const pathMap: Record<string, string> = {
        case: '/cases/',
        task: '/cases/',
        session: '/cases/',
        document: '/documents/',
        invoice: '/accounting/invoices/',
        expense: '/accounting',
      };
      const base = pathMap[n.entity_type];
      if (base) router.push(base + n.entity_id);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          {t('notifications.title')}
        </Typography>
        <Button
          startIcon={<MarkAllIcon />}
          onClick={handleMarkAllRead}
          disabled={notifications.every(n => n.is_read)}
        >
          {t('notifications.markAllRead')}
        </Button>
      </Stack>

      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {notifications.length === 0 && !loading && (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              {t('notifications.empty')}
            </Typography>
          )}
          <List disablePadding>
            {notifications.map((n, idx) => (
              <React.Fragment key={n.id}>
                {idx > 0 && <Divider />}
                <ListItem
                  secondaryAction={
                    !n.is_read ? (
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={e => { e.stopPropagation(); handleMarkRead(n.id); }}
                        title={t('notifications.markRead')}
                      >
                        <ReadIcon fontSize="small" color="primary" />
                      </IconButton>
                    ) : null
                  }
                  sx={{
                    cursor: 'pointer',
                    bgcolor: n.is_read ? 'inherit' : 'action.hover',
                  }}
                  onClick={() => handleClick(n)}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 1 }}>
                    {n.is_read ? (
                      <ReadIcon fontSize="small" color="disabled" />
                    ) : (
                      <UnreadIcon fontSize="small" color="primary" />
                    )}
                  </Stack>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="body1"
                          fontWeight={n.is_read ? 400 : 600}
                        >
                          {n.title}
                        </Typography>
                        <Chip
                          label={n.type}
                          size="small"
                          color={typeColors[n.type] || 'default'}
                          variant="outlined"
                        />
                      </Stack>
                    }
                    secondary={
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {n.body}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(n.created_at).toLocaleString()}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {hasMore && (
        <Box textAlign="center" sx={{ mt: 2 }}>
          <Button onClick={() => load(cursor!)} disabled={loading}>
            {t('common.loadMore')}
          </Button>
        </Box>
      )}

      {loading && (
        <Typography color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
          {t('common.loading')}
        </Typography>
      )}
    </Box>
  );
}
