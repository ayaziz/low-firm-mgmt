'use client';

import React, { useEffect, useState, useCallback, useRef, DragEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { documentApi, caseApi, adminApi } from '@/api';
import type { Document as DocType, Case, MasterDataItem } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import DataGrid, { type Column } from '@/components/common/DataGrid';
import StatusBadge from '@/components/common/StatusBadge';
import DrawerForm from '@/components/common/DrawerForm';

export default function DocumentListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<DocType[]>([]);
  const [docTypes, setDocTypes] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [form, setForm] = useState({ title: '', caseId: '', docTypeId: '', confidentiality: 'Standard' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentApi.list({ limit: 50 });
      setDocs(res.data);
      setCursor(res.nextCursor);
      setTotalCount(res.data.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Handle ?action=new from SpeedDial
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openDrawer();
      router.replace('/documents');
    }
  }, [searchParams]);

  const openDrawer = async () => {
    setDrawerOpen(true);
    const [caseRes, dtRes] = await Promise.all([
      caseApi.list({ limit: 100 }).catch(() => ({ data: [], cursor: null })),
      adminApi.listMasterData('docType').catch(() => []),
    ]);
    setCases(caseRes.data);
    setDocTypes(dtRes);
  };

  const handleCreate = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const result = await documentApi.create({
        title: form.title,
        caseId: form.caseId,
        customerId: '',
        fileName: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        docTypeId: form.docTypeId,
        confidentialityLevel: form.confidentiality,
      });
      if (result.uploadUrl) {
        await fetch(result.uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
        });
      }
      setDrawerOpen(false);
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ title: '', caseId: '', docTypeId: '', confidentiality: 'Standard' });
    setSelectedFile(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      if (!form.title) {
        setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }));
      }
    }
  };

  const columns: Column<DocType>[] = [
    { field: 'title', headerName: t('document.name'), sortable: true },
    { field: 'mime_type', headerName: t('document.type'), sortable: true, width: 140 },
    {
      field: 'file_size',
      headerName: t('document.size'),
      width: 100,
      renderCell: (row) => `${(row.file_size / 1024).toFixed(1)} KB`,
    },
    {
      field: 'scan_status',
      headerName: t('document.scanStatus'),
      width: 120,
      renderCell: (row) => <StatusBadge status={row.scan_status} size="small" />,
    },
    {
      field: 'confidentiality',
      headerName: t('document.confidentiality'),
      width: 140,
      renderCell: (row) => <StatusBadge status={row.confidentiality} size="small" variant="outlined" />,
    },
    {
      field: 'created_at',
      headerName: t('common.createdAt'),
      width: 120,
      sortable: true,
      renderCell: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('document.title')}
        actions={
          <Button variant="contained" startIcon={<UploadIcon />} onClick={openDrawer}>
            {t('document.upload')}
          </Button>
        }
      />

      <DataGrid<DocType>
        columns={columns}
        rows={docs}
        loading={loading}
        getRowId={(r) => r.id}
        onRowClick={(row) => router.push(`/documents/${row.id}`)}
        onRefresh={load}
        emptyMessage={t('common.noData')}
        totalCount={totalCount}
      />

      {/* Upload Drawer */}
      <DrawerForm
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); resetForm(); }}
        title={t('document.upload')}
        onSubmit={handleCreate}
        loading={saving}
        submitLabel={t('document.upload')}
        submitDisabled={!form.title || !selectedFile}
      >
        <Stack spacing={2}>
          {/* Drag & Drop Zone */}
          <Box
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'grey.300',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: dragOver ? (theme) => alpha(theme.palette.primary.main, 0.04) : 'grey.50',
              transition: 'all 0.2s',
              '&:hover': { borderColor: 'primary.light', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02) },
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
                if (file && !form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }));
              }}
            />
            {selectedFile ? (
              <Stack alignItems="center" spacing={0.5}>
                <FileIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography variant="body2" fontWeight={500}>{selectedFile.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </Typography>
              </Stack>
            ) : (
              <Stack alignItems="center" spacing={0.5}>
                <UploadIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {t('document.dragDrop')}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {t('document.selectFile')}
                </Typography>
              </Stack>
            )}
          </Box>

          <TextField
            label={t('document.name')}
            fullWidth
            required
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <TextField
            label={t('case.title')}
            select
            fullWidth
            value={form.caseId}
            onChange={(e) => setForm(f => ({ ...f, caseId: e.target.value }))}
          >
            <MenuItem value="">— {t('common.noData')} —</MenuItem>
            {cases.map(c => (
              <MenuItem key={c.id} value={c.id}>
                {c.title} ({c.system_case_ref})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('doctype.title')}
            select
            fullWidth
            value={form.docTypeId}
            onChange={(e) => setForm(f => ({ ...f, docTypeId: e.target.value }))}
          >
            <MenuItem value="">— {t('common.noData')} —</MenuItem>
            {docTypes.map(d => (
              <MenuItem key={d.id} value={d.id}>
                {d.label_en} ({d.label_ar})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('document.confidentiality')}
            select
            fullWidth
            value={form.confidentiality}
            onChange={(e) => setForm(f => ({ ...f, confidentiality: e.target.value }))}
          >
            <MenuItem value="Standard">Standard</MenuItem>
            <MenuItem value="Confidential">Confidential</MenuItem>
            <MenuItem value="HighlyConfidential">Highly Confidential</MenuItem>
          </TextField>
        </Stack>
      </DrawerForm>
    </Box>
  );
}
