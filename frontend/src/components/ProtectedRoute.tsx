'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: Role[];
}

export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, hasAnyRole } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) return null;

  if (requiredRoles && requiredRoles.length > 0 && !hasAnyRole(...requiredRoles)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Box sx={{ textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page.</p>
        </Box>
      </Box>
    );
  }

  return <>{children}</>;
}
