'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Card, IconButton, MenuItem, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { adminApi } from '@/api';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';
import EmptyState from '@/components/common/EmptyState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ email: '', displayName: '', roles: ['Lawyer'] });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers();
      setUsers(res.data || res);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ email: '', displayName: '', roles: ['Lawyer'] });
    setDrawerOpen(true);
  };

  const openEdit = (u: UserItem) => {
    setEditUser(u);
    setForm({ email: u.email, displayName: u.displayName, roles: u.roles });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editUser) {
        await adminApi.updateUser(editUser.id, { displayName: form.displayName, roles: form.roles });
      } else {
        await adminApi.createUser({ email: form.email, displayName: form.displayName, roles: form.roles });
      }
      setDrawerOpen(false);
      load();
    } finally { setSaving(false); }
  };

  if (loading && users.length === 0) return <LoadingSkeleton variant="table" />;

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" spacing={1} mb={2}>
        <Tooltip title={t('common.refresh', 'Refresh')}>
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('admin.createUser', 'Create User')}
        </Button>
      </Stack>

      {users.length > 0 ? (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.displayName', 'Name')}</TableCell>
                  <TableCell>{t('auth.email', 'Email')}</TableCell>
                  <TableCell>{t('admin.roles', 'Roles')}</TableCell>
                  <TableCell>{t('admin.status', 'Status')}</TableCell>
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
                        {u.roles.map(r => <StatusBadge key={r} status={r} variant="outlined" size="small" />)}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.isActive ? 'Active' : 'Disabled'} size="small" />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('admin.noUsers', 'No users found')} />
      )}

      <DrawerForm
        open={drawerOpen}
        title={editUser ? t('admin.editUser', 'Edit User') : t('admin.createUser', 'Create User')}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSave}
        loading={saving}
      >
        <Stack spacing={2.5}>
          <TextField label={t('auth.email', 'Email')} fullWidth required disabled={!!editUser} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <TextField label={t('admin.displayName', 'Display Name')} fullWidth required value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
          <TextField label={t('admin.roles', 'Roles')} select fullWidth SelectProps={{ multiple: true }} value={form.roles} onChange={e => setForm(f => ({ ...f, roles: e.target.value as unknown as string[] }))}>
            {ROLE_OPTIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
        </Stack>
      </DrawerForm>
    </Box>
  );
}
