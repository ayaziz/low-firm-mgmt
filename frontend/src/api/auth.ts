import { post } from './client';
import type { AuthResponse } from '@/types';

export const authApi = {
  devLogin(email: string, password: string): Promise<AuthResponse> {
    return post<AuthResponse>('/auth/dev/login', { email, password });
  },

  devStepUp(): Promise<{ stepUpToken?: string; access_token?: string }> {
    return post<{ stepUpToken?: string; access_token?: string }>('/auth/dev/step-up');
  },
};
