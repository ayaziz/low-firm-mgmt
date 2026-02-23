'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';

const baseTheme: ThemeOptions = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h1: { fontSize: '1.75rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    h4: { fontSize: '1.125rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem' },
  },
  palette: {
    primary: {
      main: '#1B3A5C',      // Professional navy
      light: '#2E5A8A',
      dark: '#0F2440',
    },
    secondary: {
      main: '#4A7C59',      // Muted green for accents
      light: '#6B9E7A',
      dark: '#2F5C3E',
    },
    success: {
      main: '#2E7D32',       // Paid, Scan Passed, Approved
    },
    warning: {
      main: '#ED6C02',       // Due soon, Pending, On Hold, Scanning
    },
    error: {
      main: '#D32F2F',       // Scan Failed, Overdue, Rejected, Voided
    },
    info: {
      main: '#0288D1',       // Draft, Planned, Pending
    },
    background: {
      default: '#F5F6F8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A2E',
      secondary: '#5A5A7A',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            backgroundColor: '#F5F6F8',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
};

export function createAppTheme(direction: 'ltr' | 'rtl') {
  return createTheme({
    ...baseTheme,
    direction,
  });
}

/** Status color mapping for semantic tokens */
export const statusColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  // Invoice status
  Draft: 'info',
  Finalized: 'info',
  Sent: 'info',
  Paid: 'success',
  PartiallyPaid: 'warning',
  Voided: 'error',
  // Case state
  Intake: 'info',
  Open: 'info',
  Active: 'success',
  Pending: 'warning',
  Closed: 'default',
  Archived: 'default',
  // Scan status
  Scanning: 'warning',
  Passed: 'success',
  Failed: 'error',
  // Expense status
  Submitted: 'info',
  Approved: 'success',
  Rejected: 'error',
  // Task
  Overdue: 'error',
  DueSoon: 'warning',
  // On Hold
  OnHold: 'warning',
};
