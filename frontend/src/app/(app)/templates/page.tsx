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
  Refresh as RefreshIcon,
  Article as TemplateIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { templateApi } from '@/api';
import type { DocumentTemplate, DocumentTemplateCategory } from '@/types';
import { useAuth } from '@/context/AuthContext';

const CATEGORIES: DocumentTemplateCategory[] = ['Contract', 'Motion', 'Letter', 'Filing', 'Report', 'Other'];

export default function TemplatesPage() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: 'Letter' as DocumentTemplateCategory,
    description: '',
    template_body: '',
  });
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        cursor: cur || undefined,
        limit: 20,
      };
      if (categoryFilter) params.category = categoryFilter;
      const res = await templateApi.list(params);
      if (cur) {
        setTemplates(prev => [...prev, ...res.data]);
      } else {
        setTemplates(res.data);
      }
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await templateApi.create({
        name: form.name,
        category: form.category,
        description: form.description || undefined,
        template_body: form.template_body,
      });
      setDialogOpen(false);
      setForm({ name: '', category: 'Letter', description: '', template_body: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (templateId: string) => {
    setPreviewTemplateId(templateId);
    try {
      const res = await templateApi.render(templateId, {});
      setPreviewHtml(res.rendered);
      setPreviewOpen(true);
    } catch {
      setPreviewHtml('Error rendering template. Some variables may be required.');
      setPreviewOpen(true);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await templateApi.deactivate(id);
      load();
    } catch {
      // error handled
    }
  };

  const canManage = hasAnyRole('Lawyer', 'TenantAdmin', 'SystemAdmin');

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={600}>
          <TemplateIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('nav.templates', 'Document Templates')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label={t('template.category', 'Category')}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <Tooltip title={t('common.refresh', 'Refresh')}>
            <IconButton onClick={() => load()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              {t('template.add', 'New Template')}
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('template.name', 'Name')}</TableCell>
                <TableCell>{t('template.category', 'Category')}</TableCell>
                <TableCell>{t('template.description', 'Description')}</TableCell>
                <TableCell>{t('template.status', 'Status')}</TableCell>
                <TableCell>{t('common.createdAt', 'Created')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map(tpl => (
                <TableRow key={tpl.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{tpl.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={tpl.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{tpl.description || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={tpl.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={tpl.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{new Date(tpl.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Preview">
                        <IconButton size="small" onClick={() => handlePreview(tpl.id)}>
                          <PreviewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canManage && tpl.is_active && (
                        <Button size="small" color="error" onClick={() => handleDeactivate(tpl.id)}>
                          Deactivate
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={4}>
                      {t('common.noData', 'No data found')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {hasMore && (
          <Box textAlign="center" py={2}>
            <Button onClick={() => load(cursor)} disabled={loading}>
              {t('common.loadMore', 'Load More')}
            </Button>
          </Box>
        )}
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('template.add', 'New Template')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Template Name" fullWidth required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <TextField label="Category" select fullWidth value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as DocumentTemplateCategory }))}>
              {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField label="Description" fullWidth value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <TextField
              label="Template Body (Handlebars)"
              fullWidth
              multiline
              rows={10}
              required
              value={form.template_body}
              onChange={e => setForm(f => ({ ...f, template_body: e.target.value }))}
              helperText="Use {{variableName}} for dynamic content"
              sx={{ fontFamily: 'monospace' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.name || !form.template_body}>{t('common.save', 'Save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Template Preview</DialogTitle>
        <DialogContent>
          <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'serif', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 200 }}>
            {previewHtml}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
