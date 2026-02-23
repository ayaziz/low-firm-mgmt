'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { adminApi } from '@/api';

interface UserItem {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  isActive?: boolean;
  created_at?: string;
}

const ROLE_OPTIONS = ['Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin'];

export default function UsersTab() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ email: '', displayName: '', password: '', roles: ['Lawyer'] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers();
      setUsers(res.data || res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ email: '', displayName: '', password: '', roles: ['Lawyer'] });
    setDialogOpen(true);
  };

  const openEdit = (u: UserItem) => {
    setEditUser(u);
    setForm({ email: u.email, displayName: u.displayName, password: '', roles: u.roles });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editUser) {
      await adminApi.updateUser(editUser.id, {
        displayName: form.displayName,
        roles: form.roles,
      });
    } else {
      await adminApi.createUser({
        email: form.email,
        displayName: form.displayName,
        roles: form.roles,
      });
    }
    setDialogOpen(false);
    load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" spacing={1} mb={2}>
        <Tooltip title={t('common.refresh')}>
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('admin.createUser')}
        </Button>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.displayName')}</TableCell>
                <TableCell>{t('auth.email')}</TableCell>
                <TableCell>{t('admin.roles')}</TableCell>
                <TableCell>{t('admin.status')}</TableCell>
                <TableCell width={60} />
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.displayName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {u.roles.map(r => <Chip key={r} label={r} size="small" />)}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={u.isActive ? 'Active' : 'Disabled'}
                      size="small"
                      color={u.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => openEdit(u)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" py={4}>
                      {t('common.noData')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editUser ? t('admin.editUser') : t('admin.createUser')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('auth.email')}
              fullWidth
              required
              disabled={!!editUser}
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
            <TextField
              label={t('admin.displayName')}
              fullWidth
              required
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            />
            <TextField
              label={t('auth.password')}
              type="password"
              fullWidth
              required={!editUser}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              helperText={editUser ? 'Leave blank to keep current password' : ''}
            />
            <TextField
              label={t('admin.roles')}
              select
              fullWidth
              SelectProps={{ multiple: true }}
              value={form.roles}
              onChange={e => setForm(f => ({ ...f, roles: e.target.value as unknown as string[] }))}
            >
              {ROLE_OPTIONS.map(r => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.email || !form.displayName || (!editUser && !form.password)}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
