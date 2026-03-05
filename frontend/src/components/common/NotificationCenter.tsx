'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Badge,
  Box,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Typography,
  Button,
} from '@mui/material';
import {
  Notifications as BellIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { notificationApi } from '@/api';
import type { Notification } from '@/types';

const pathMap: Record<string, string> = {
  case: '/cases',
  task: '/cases',
  session: '/hearings',
  hearing: '/hearings',
  document: '/documents',
  invoice: '/accounting',
  expense: '/accounting',
  wage: '/accounting',
};

export default function NotificationCenter() {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadInitial = useCallback(async () => {
    try {
      const [res, countRes] = await Promise.all([
        notificationApi.list({ limit: 10 }),
        notificationApi.getUnreadCount(),
      ]);
      setNotifications(res.data ?? []);
      setUnreadCount(countRes.count ?? 0);
    } catch {
      // silently fail
    }
  }, []);

  // Set up SSE
  useEffect(() => {
    loadInitial();

    try {
      const es = notificationApi.createStream();
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.id) {
            setNotifications((prev) => [data, ...prev].slice(0, 20));
            setUnreadCount((c) => c + 1);
          }
        } catch {
          // ignore parse errors
        }
      };
      es.onerror = () => {
        // SSE will auto-reconnect
      };
      eventSourceRef.current = es;
    } catch {
      // SSE not available, fall back to polling
    }

    return () => {
      eventSourceRef.current?.close();
    };
  }, [loadInitial]);

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await notificationApi.markAsRead(n.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)),
      );
    }
    const base = pathMap[n.entity_type ?? ''] ?? '/notifications';
    const target = n.entity_id ? `${base}/${n.entity_id}` : base;
    setAnchorEl(null);
    router.push(target);
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="Notifications"
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <BellIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: 360, maxHeight: 480 },
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
          <Typography variant="subtitle1" fontWeight={600}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<DoneAllIcon />} onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </Stack>
        <Divider />

        {notifications.length === 0 ? (
          <Box px={2} py={4} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 360, overflow: 'auto' }}>
            {notifications.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => handleClick(n)}
                sx={{
                  bgcolor: !n.is_read ? 'action.hover' : 'transparent',
                  py: 1,
                  px: 2,
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="body2"
                        fontWeight={!n.is_read ? 700 : 400}
                        noWrap
                        sx={{ flex: 1 }}
                      >
                        {n.title}
                      </Typography>
                      {!n.is_read && <Chip label="New" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />}
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary" component="span">
                      {n.body ?? ''} &middot; {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}

        <Divider />
        <Box px={2} py={1} textAlign="center">
          <Button
            size="small"
            onClick={() => {
              setAnchorEl(null);
              router.push('/notifications');
            }}
          >
            View all
          </Button>
        </Box>
      </Popover>
    </>
  );
}
