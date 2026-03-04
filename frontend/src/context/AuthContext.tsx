'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UserInfo, Role } from '@/types';
import { authApi } from '@/api';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  isSteppedUp: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  stepUp: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  hasAnyRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function parseToken(token: string): { exp: number; stepUp?: boolean } | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isSteppedUp: false,
    loading: true,
  });

  // Restore from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('loma_token');
    const userStr = localStorage.getItem('loma_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as UserInfo;
        const parsed = parseToken(token);
        if (parsed && parsed.exp * 1000 > Date.now()) {
          setState({
            user,
            token,
            isAuthenticated: true,
            isSteppedUp: !!parsed.stepUp,
            loading: false,
          });
          return;
        }
      } catch {
        // fall through
      }
    }
    localStorage.removeItem('loma_token');
    localStorage.removeItem('loma_user');
    setState(s => ({ ...s, loading: false }));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Production login via JWT
    const res = await authApi.login(email, password);
    const accessToken = res.accessToken || res.access_token;
    if (!accessToken) {
      throw new Error('Authentication response missing access token');
    }
    localStorage.setItem('loma_token', accessToken);
    localStorage.setItem('loma_user', JSON.stringify(res.user));
    if (res.refreshToken) {
      localStorage.setItem('loma_refresh_token', res.refreshToken);
    }
    setState({
      user: res.user,
      token: accessToken,
      isAuthenticated: true,
      isSteppedUp: false,
      loading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('loma_token');
    localStorage.removeItem('loma_user');
    localStorage.removeItem('loma_refresh_token');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isSteppedUp: false,
      loading: false,
    });
  }, []);

  const stepUp = useCallback(async () => {
    const res = await authApi.devStepUp();
    const stepUpToken = res.stepUpToken || res.access_token;
    if (!stepUpToken) {
      throw new Error('Step-up response missing token');
    }
    localStorage.setItem('loma_token', stepUpToken);
    setState(s => ({
      ...s,
      token: stepUpToken,
      isSteppedUp: true,
    }));
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!state.user) return false;
      return roles.every(r => state.user!.roles.includes(r));
    },
    [state.user],
  );

  const hasAnyRole = useCallback(
    (...roles: Role[]) => {
      if (!state.user) return false;
      return roles.some(r => state.user!.roles.includes(r));
    },
    [state.user],
  );

  return (
    <AuthContext.Provider value={{ ...state, login, logout, stepUp, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
}
