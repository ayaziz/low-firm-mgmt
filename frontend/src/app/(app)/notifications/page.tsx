'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import {
  Box, Button, Chip, IconButton, List, ListItemButton, ListItemText, Stack, Typography,
} from '@mui/material';
import {
  Notifications as BellIcon, DoneAll as DoneAllIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { notificationApi } from '@/api';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import StatusBadge from '@/components/common/StatusBadge';

const pathMap: Record<string, string> = {
  case: '/cases',
  task: '/cases',
  session: '/hearings',
  hearing: '/hearings',
  document: '/documents',
  invoice: '/accounting',
  expense: '/accounting',
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (c?: string | null) => {
    setLoading(true);
    try {
      const res = await notificationApi.list({ cursor: c ?? undefined, limit: 20 });
      const list = Array.isArray(res) ? res : res.data ?? [];
      if (c) setNotifications(prev => [...prev, ...list]);
      else setNotifications(list);
      setCursor(res.nextCursor ?? (res as any).next_cursor ?? null);
      setHasMore(!!(res.nextCursor ?? (res as any).next_cursor));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    load();
  };

  const handleClick = async (n: any) => {
    if (!n.is_read) {
      await notificationApi.markAsRead(n.id);
    }
    const base = pathMap[n.entity_type] ?? '/dashboard';
    const target = n.entity_id ? `${base}/${n.entity_id}` : base;
    router.push(target);
  };

  return (
    <Box>
      <PageHeader
        title={t('notifications.title', 'Notifications')}
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<DoneAllIcon />} onClick={handleMarkAllRead}>
              {t('notifications.markAllRead', 'Mark all read')}
            </Button>
            <IconButton onClick={() => load()}><RefreshIcon /></IconButton>
          </Stack>
        }
      />

      {loading && notifications.length === 0 ? <LoadingSkeleton variant="table" /> : notifications.length > 0 ? (
        <>
          <List>
            {notifications.map(n => (
              <ListItemButton
                key={n.id}
                onClick={() => handleClick(n)}
                sx={{ bgcolor: !n.is_read ? 'action.hover' : 'transparent', borderRadius: 1, mb: 0.5 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={!n.is_read ? 700 : 400}>{n.title}</Typography>
                      <StatusBadge status={n.type ?? 'system'} size="small" />
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center" component="span">
                      <Typography variant="caption" color="text.secondary" component="span">{n.body ?? n.message}</Typography>
                      <Typography variant="caption" color="text.disabled" component="span">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                      </Typography>
                    </Stack>
                  }
                />
                {!n.is_read && <Chip label={t('common.new', 'New')} size="small" color="primary" />}
              </ListItemButton>
            ))}
          </List>
          {hasMore && (
            <Stack alignItems="center" mt={2}>
              <Button onClick={() => load(cursor)} disabled={loading}>{t('common.loadMore', 'Load more')}</Button>
            </Stack>
          )}
        </>
      ) : (
        <EmptyState icon={<BellIcon />} title={t('notifications.empty', 'All caught up!')} message={t('notifications.emptyMsg', 'No notifications at this time')} />
      )}
    </Box>
  );
}
