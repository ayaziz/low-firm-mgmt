'use client';

import React from 'react';
import { ThemeProvider as AppThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { SnackbarProvider } from 'notistack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '@/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <ErrorBoundary>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          autoHideDuration={4000}
        >
          <AuthProvider>{children}</AuthProvider>
        </SnackbarProvider>
      </ErrorBoundary>
    </AppThemeProvider>
  );
}
