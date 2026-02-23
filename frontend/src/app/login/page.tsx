'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import { useAuth } from '@/context/AuthContext';

const DEV_USERS = [
	{
		label: 'admin@demo.com',
		email: 'admin@demo.com',
		password: 'admin',
		roles: 'SystemAdmin, TenantAdmin',
	},
	{
		label: 'lawyer1@demo.com',
		email: 'lawyer1@demo.com',
		password: 'password',
		roles: 'Lawyer',
	},
	{
		label: 'lawyer2@demo.com',
		email: 'lawyer2@demo.com',
		password: 'password',
		roles: 'Lawyer',
	},
	{
		label: 'accountant@demo.com',
		email: 'accountant@demo.com',
		password: 'password',
		roles: 'Accountant',
	},
	{
		label: 'manager@demo.com',
		email: 'manager@demo.com',
		password: 'password',
		roles: 'TenantAdmin',
	},
]

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.message || t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (u: (typeof DEV_USERS)[0]) => {
    setEmail(u.email);
    setPassword(u.password);
    setError('');
    setLoading(true);
    try {
      await login(u.email, u.password);
      router.push('/');
    } catch (err: any) {
      setError(err?.message || t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{ bgcolor: 'grey.100' }}
    >
      <Card sx={{ width: 420, maxWidth: '90vw' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom textAlign="center">
            {t('app.name')}
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            {t('auth.loginTitle')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label={t('auth.email')}
              type="email"
              fullWidth
              required
              margin="normal"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
            <TextField
              label={t('auth.password')}
              type="password"
              fullWidth
              required
              margin="normal"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? t('common.loading') : t('auth.login')}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Chip label={t('auth.devAccounts')} size="small" />
          </Divider>

          <Stack spacing={1}>
            {DEV_USERS.map(u => (
              <Button
                key={u.email}
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => quickLogin(u)}
                disabled={loading}
                sx={{ justifyContent: 'space-between', textTransform: 'none' }}
              >
                <span>{u.label}</span>
                <Typography variant="caption" color="text.secondary">
                  {u.roles}
                </Typography>
              </Button>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
