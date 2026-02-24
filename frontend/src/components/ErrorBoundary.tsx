'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  correlationId: string | null;
}

/**
 * Global error boundary that catches unhandled React render errors,
 * sends them to the backend telemetry endpoint (with correlation ID),
 * and shows a user-friendly fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, correlationId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Generate a client-side correlation ID
    const correlationId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    this.setState({ correlationId });

    // Fire-and-forget: report to backend telemetry
    this.reportError(error, info, correlationId);
  }

  private async reportError(
    error: Error,
    info: ErrorInfo,
    correlationId: string,
  ): Promise<void> {
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('loma_token')
        : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/v1/telemetry/ui-error', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      });
    } catch {
      // Swallow — don't let telemetry failure cause another crash
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, correlationId: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            bgcolor: 'background.default',
            p: 3,
          }}
        >
          <Paper
            elevation={3}
            sx={{ p: 4, maxWidth: 520, textAlign: 'center' }}
          >
            <ErrorOutlineIcon
              color="error"
              sx={{ fontSize: 64, mb: 2 }}
            />
            <Typography variant="h5" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              An unexpected error occurred. The error has been reported automatically.
            </Typography>
            {this.state.correlationId && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ display: 'block', mb: 2, fontFamily: 'monospace' }}
              >
                Reference: {this.state.correlationId}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="contained" onClick={this.handleReload}>
                Reload Page
              </Button>
              <Button variant="outlined" onClick={this.handleReset}>
                Try Again
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
