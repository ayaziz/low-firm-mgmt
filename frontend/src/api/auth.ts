import { post } from './client';
import type { AuthResponse } from '@/types';

export const authApi = {
  /** Production login (email + password) */
  login(email: string, password: string): Promise<AuthResponse> {
    return post<AuthResponse>('/auth/login', { email, password });
  },

  /** Refresh access token using a refresh token */
  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken });
  },

  /** Dev-only login (email only, no password check) */
  devLogin(email: string, password: string): Promise<AuthResponse> {
    return post<AuthResponse>('/auth/dev/login', { email, password });
  },

  devStepUp(): Promise<{ stepUpToken?: string; access_token?: string }> {
    return post<{ stepUpToken?: string; access_token?: string }>('/auth/dev/step-up');
  },
};
