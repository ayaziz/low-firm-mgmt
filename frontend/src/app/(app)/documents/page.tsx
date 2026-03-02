'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { documentApi, caseApi, adminApi } from '@/api';
import type { Document as DocType, Case, MasterDataItem } from '@/types'

const SCAN_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  Pending: 'warning',
  Passed: 'success',
  Failed: 'error',
};

export default function DocumentListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [docs, setDocs] = useState<DocType[]>([]);
  const [docTypes, setDocTypes] = useState<MasterDataItem[]>([])
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [form, setForm] = useState({ title: '', caseId: '', docTypeId: '', confidentiality: 'Standard' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const res = await documentApi.list({ cursor: cur || undefined, limit: 20 });
      if (cur) {
        setDocs(prev => [...prev, ...res.data]);
      } else {
        setDocs(res.data);
      }
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreateDialog = async () => {
    setDialogOpen(true);
    const res = await caseApi.list({ limit: 100 }).catch(() => ({ data: [], cursor: null }));
    setCases(res.data);
    const docTypeRes = await adminApi.listMasterData('docType')
    setDocTypes(docTypeRes);
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
      // Upload file to presigned URL
      if (result.uploadUrl) {
        await fetch(result.uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
        });
      }
      setDialogOpen(false);
      setForm({ title: '', caseId: '', docTypeId: '', confidentiality: 'Standard' });
      setSelectedFile(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
		<Box>
			<Stack
				direction="row"
				justifyContent="space-between"
				alignItems="center"
				mb={2}
			>
				<Typography variant="h5" fontWeight={600}>
					{t('document.title')}
				</Typography>
				<Stack direction="row" spacing={1}>
					<Tooltip title={t('common.refresh')}>
						<IconButton onClick={() => load()}>
							<RefreshIcon />
						</IconButton>
					</Tooltip>
					<Button
						variant="contained"
						startIcon={<UploadIcon />}
						onClick={openCreateDialog}
					>
						{t('document.upload')}
					</Button>
				</Stack>
			</Stack>

			<Card>
				<TableContainer>
					<Table>
						<TableHead>
							<TableRow>
								<TableCell>{t('document.name')}</TableCell>
								<TableCell>{t('document.type')}</TableCell>
								<TableCell>{t('document.size')}</TableCell>
								<TableCell>{t('document.scanStatus')}</TableCell>
								<TableCell>{t('document.confidentiality')}</TableCell>
								<TableCell>{t('common.createdAt')}</TableCell>
								<TableCell width={60} />
							</TableRow>
						</TableHead>
						<TableBody>
							{docs.map((d) => (
								<TableRow
									key={d.id}
									hover
									sx={{ cursor: 'pointer' }}
									onClick={() => router.push(`/documents/${d.id}`)}
								>
									<TableCell>{d.title}</TableCell>
									<TableCell>{d.mime_type}</TableCell>
									<TableCell>{(d.file_size / 1024).toFixed(1)} KB</TableCell>
									<TableCell>
										<Chip
											label={d.scan_status}
											size="small"
											color={SCAN_COLORS[d.scan_status] || 'default'}
										/>
									</TableCell>
									<TableCell>
										<Chip
											label={d.confidentiality}
											size="small"
											variant="outlined"
										/>
									</TableCell>
									<TableCell>
										{new Date(d.created_at).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<IconButton size="small">
											<ViewIcon fontSize="small" />
										</IconButton>
									</TableCell>
								</TableRow>
							))}
							{docs.length === 0 && !loading && (
								<TableRow>
									<TableCell colSpan={7} align="center">
										<Typography variant="body2" color="text.secondary" py={4}>
											{t('common.noData')}
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
							{t('common.loadMore')}
						</Button>
					</Box>
				)}
			</Card>

			{/* Upload Dialog */}
			<Dialog
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>{t('document.upload')}</DialogTitle>
				<DialogContent>
					<Stack spacing={2} mt={1}>
						<TextField
							label={t('document.name')}
							fullWidth
							required
							value={form.title}
							onChange={(e) =>
								setForm((f) => ({ ...f, title: e.target.value }))
							}
						/>
						<TextField
							label={t('case.title')}
							select
							fullWidth
							value={form.caseId}
							onChange={(e) =>
								setForm((f) => ({ ...f, caseId: e.target.value }))
							}
						>
							<MenuItem value="">— {t('common.noData')} —</MenuItem>
							{cases.map((c) => (
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
							onChange={(e) =>
								setForm((f) => ({ ...f, docTypeId: e.target.value }))
							}
						>
							<MenuItem value="">— {t('common.noData')} —</MenuItem>
							{docTypes.map((d) => (
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
							onChange={(e) =>
								setForm((f) => ({ ...f, confidentiality: e.target.value }))
							}
						>
							<MenuItem value="Standard">Standard</MenuItem>
							<MenuItem value="Confidential">Confidential</MenuItem>
							<MenuItem value="HighlyConfidential">
								Highly Confidential
							</MenuItem>
						</TextField>
						<Box>
							<input
								ref={fileInputRef}
								type="file"
								hidden
								onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
							/>
							<Button
								variant="outlined"
								startIcon={<UploadIcon />}
								onClick={() => fileInputRef.current?.click()}
							>
								{selectedFile ? selectedFile.name : t('document.selectFile')}
							</Button>
							{selectedFile && (
								<Typography
									variant="caption"
									display="block"
									mt={0.5}
									color="text.secondary"
								>
									{(selectedFile.size / 1024).toFixed(1)} KB
								</Typography>
							)}
						</Box>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setDialogOpen(false)}>
						{t('common.cancel')}
					</Button>
					<Button
						variant="contained"
						onClick={handleCreate}
						disabled={saving || !form.title || !selectedFile}
					>
						{t('document.upload')}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	)
}
