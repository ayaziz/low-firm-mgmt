'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

const IDLE_LIMIT_MS = 15 * 60 * 1000;   // 15 minutes of inactivity
const WARNING_BEFORE_MS = 2 * 60 * 1000; // Show warning 2 min before logout
const CHECK_INTERVAL_MS = 30 * 1000;     // Check every 30 seconds

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];

/**
 * Monitors user activity and auto-logs-out after IDLE_LIMIT_MS of inactivity.
 * Shows a warning dialog WARNING_BEFORE_MS before the logout triggers.
 * Only active when the user is authenticated.
 */
export default function IdleTimeout() {
  const { isAuthenticated, logout } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
  }, []);

  // Attach activity listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    const handler = () => {
      lastActivityRef.current = Date.now();
    };

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handler, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handler);
      }
    };
  }, [isAuthenticated]);

  // Periodic idle check
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= IDLE_LIMIT_MS) {
        logout();
        return;
      }

      if (elapsed >= IDLE_LIMIT_MS - WARNING_BEFORE_MS) {
        setShowWarning(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAuthenticated, logout]);

  if (!isAuthenticated || !showWarning) return null;

  const remainingSec = Math.max(
    0,
    Math.round((IDLE_LIMIT_MS - (Date.now() - lastActivityRef.current)) / 1000),
  );

  return (
    <Dialog open onClose={resetActivity}>
      <DialogTitle>Session Expiring</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Your session will expire in approximately {remainingSec} seconds due to inactivity.
          Click &quot;Stay Logged In&quot; to continue.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={logout} color="error">
          Log Out
        </Button>
        <Button onClick={resetActivity} variant="contained">
          Stay Logged In
        </Button>
      </DialogActions>
    </Dialog>
  );
}
