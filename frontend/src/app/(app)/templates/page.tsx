'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add as AddIcon, Visibility as PreviewIcon, Block as DeactivateIcon, Edit as EditIcon,
} from '@mui/icons-material';
import { templateApi } from '@/api';
import type { DocumentTemplate } from '@/types';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';

const CATEGORIES = ['Contract', 'Motion', 'Letter', 'Petition', 'Filing', 'Other'] as const;

export default function TemplatesPage() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole('Lawyer', 'TenantAdmin', 'SystemAdmin');

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('');

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Contract', description: '', template_body: '' });
  const [editTemplate, setEditTemplate] = useState<DocumentTemplate | null>(null);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (category) params.category = category;
      const res = await templateApi.list(params as any);
      setTemplates(res.data);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTemplate(null);
    setForm({ name: '', category: 'Contract', description: '', template_body: '' });
    setDrawerOpen(true);
  };

  const openEdit = (tpl: DocumentTemplate) => {
    setEditTemplate(tpl);
    setForm({
      name: tpl.name || '',
      category: tpl.category || 'Contract',
      description: (tpl as any).description || '',
      template_body: (tpl as any).template_body || '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editTemplate) {
        await templateApi.update(editTemplate.id, {
          name: form.name,
          category: form.category as any,
          description: form.description || undefined,
          template_body: form.template_body,
        } as any);
      } else {
        await templateApi.create({
          name: form.name,
          category: form.category,
          description: form.description || undefined,
          template_body: form.template_body,
        } as any);
      }
      setDrawerOpen(false);
      setEditTemplate(null);
      setForm({ name: '', category: 'Contract', description: '', template_body: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (tpl: DocumentTemplate) => {
    try {
      const rendered = await templateApi.render(tpl.id, {});
      setPreviewHtml((rendered as any)?.rendered ?? '');
      setPreviewTitle(tpl.name);
      setPreviewOpen(true);
    } catch {
      setPreviewHtml('<p>Could not render preview.</p>');
      setPreviewTitle(tpl.name);
      setPreviewOpen(true);
    }
  };

  const handleDeactivate = async (id: string) => {
    await templateApi.deactivate(id);
    load();
  };

  const columns: Column<DocumentTemplate>[] = [
    { field: 'name', headerName: t('templates.name', 'Name'), flex: 2, sortable: true },
    {
      field: 'category',
      headerName: t('templates.category', 'Category'),
      width: 140,
      renderCell: (row) => <StatusBadge status={row.category} variant="outlined" />,
    },
    { field: 'description', headerName: t('common.description', 'Description'), flex: 2 },
    {
      field: 'is_active',
      headerName: t('templates.status', 'Status'),
      width: 120,
      renderCell: (row) => (
        <StatusBadge status={(row as any).is_active !== false ? 'Active' : 'Inactive'} />
      ),
    },
    {
      field: 'created_at',
      headerName: t('common.createdAt', 'Created'),
      width: 150,
      sortable: true,
      renderCell: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      renderCell: (row) => (
        <Stack direction="row" spacing={0.5}>
          {canManage && (row as any).is_active !== false && (
            <Tooltip title={t('templates.edit', 'Edit')}>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('templates.preview', 'Preview')}>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePreview(row); }}>
              <PreviewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canManage && (row as any).is_active !== false && (
            <Tooltip title={t('templates.deactivate', 'Deactivate')}>
              <IconButton size="small" color="warning" onClick={(e) => { e.stopPropagation(); handleDeactivate(row.id); }}>
                <DeactivateIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('templates.title', 'Document Templates')}
        subtitle={t('templates.subtitle', 'Manage reusable document templates')}
        breadcrumbs={[{ label: t('nav.templates', 'Templates') }]}
        actions={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {t('templates.create', 'New Template')}
            </Button>
          ) : undefined
        }
      />

      {/* Category filter */}
      <Stack direction="row" spacing={2} sx={{ mb: 2, maxWidth: 280 }}>
        <TextField
          select fullWidth size="small"
          value={category}
          label={t('templates.category', 'Category')}
          onChange={e => setCategory(e.target.value)}
        >
          <MenuItem value="">{t('common.all', 'All')}</MenuItem>
          {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
      </Stack>

      <DataGrid<DocumentTemplate>
        columns={columns}
        rows={templates}
        loading={loading}
        getRowId={(r) => r.id}
        searchPlaceholder={t('templates.search', 'Search templates…')}
        onRefresh={load}
        emptyMessage={t('templates.empty', 'No templates found')}
        emptyAction={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {t('templates.create', 'New Template')}
            </Button>
          ) : undefined
        }
      />

      {/* ----- Create Template Drawer ----- */}
      <DrawerForm
        open={drawerOpen}
        title={editTemplate ? t('templates.edit', 'Edit Template') : t('templates.create', 'New Template')}
        width={600}
        onClose={() => { setDrawerOpen(false); setEditTemplate(null); }}
        onSubmit={handleSave}
        loading={saving}
        submitLabel={t('common.save', 'Save')}
      >
        <Stack spacing={2.5}>
          <TextField
            label={t('templates.name', 'Name')}
            fullWidth required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label={t('templates.category', 'Category')}
            select fullWidth
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField
            label={t('common.description', 'Description')}
            fullWidth multiline rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <TextField
            label={t('templates.body', 'Template Body')}
            fullWidth required multiline rows={10}
            value={form.template_body}
            onChange={e => setForm(f => ({ ...f, template_body: e.target.value }))}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
            helperText={t('templates.bodyHelp', 'Use Handlebars syntax: {{variableName}}')}
          />
        </Stack>
      </DrawerForm>

      {/* ----- Preview Dialog ----- */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{previewTitle}</DialogTitle>
        <DialogContent dividers>
          <Typography
            component="div"
            sx={{ '& *': { maxWidth: '100%' } }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>{t('common.close', 'Close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
