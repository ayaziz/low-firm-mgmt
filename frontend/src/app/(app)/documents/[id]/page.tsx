'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  FormControlLabel,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CloudDownload as DownloadIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  RestoreFromTrash as RestoreIcon,
  Gavel as LegalHoldIcon,
} from '@mui/icons-material';
import { documentApi } from '@/api';
import type { Document as DocType, DocumentVersion } from '@/types';
import { useAuth } from '@/context/AuthContext';

const SCAN_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  Pending: 'warning',
  Passed: 'success',
  Failed: 'error',
};

export default function DocumentDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const id = params.id as string;

  const [doc, setDoc] = useState<(DocType & { versions: DocumentVersion[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const isAdmin = hasAnyRole('TenantAdmin', 'SystemAdmin');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await documentApi.getById(id);
      setDoc(d);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async () => {
    const { downloadUrl } = await documentApi.download(id);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = doc?.title || 'download';
    a.click();
  };

  const handleCheckout = async () => {
    await documentApi.checkout(id);
    load();
  };

  const handleCheckin = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await documentApi.checkin(id, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
      load();
    };
    input.click();
  };

  const handleBreakLock = async () => {
    await documentApi.breakLock(id);
    load();
  };

  const handleShare = async () => {
    if (!shareEmail) return;
    await documentApi.share(id, { targetUserId: shareEmail, permission: 'view' });
    setShareDialogOpen(false);
    setShareEmail('');
  };

  const handleLegalHoldToggle = async () => {
    if (!doc) return;
    if (doc.legal_hold) {
      await documentApi.removeLegalHold(id);
    } else {
      await documentApi.setLegalHold(id);
    }
    load();
  };

  const handleDelete = async () => {
    await documentApi.softDelete(id);
    load();
  };

  const handleRestore = async () => {
    await documentApi.restore(id);
    load();
  };

  if (loading || !doc) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Typography color="text.secondary">{t('common.loading')}</Typography>
      </Box>
    );
  }

  const isLocked = !!doc.checked_out_by;
  const lockExpired = doc.checkout_expires_at ? new Date(doc.checkout_expires_at) < new Date() : false;

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => router.push('/documents')}>
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={600}>{doc.title}</Typography>
          <Stack direction="row" spacing={1} mt={0.5}>
            <Chip label={doc.scan_status} size="small" color={SCAN_COLORS[doc.scan_status] || 'default'} />
            <Chip label={doc.confidentiality} size="small" variant="outlined" />
            {doc.legal_hold && <Chip label="Legal Hold" size="small" color="error" icon={<LegalHoldIcon />} />}
            {doc.is_deleted && <Chip label="Deleted" size="small" color="error" variant="outlined" />}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<DownloadIcon />} variant="contained" onClick={handleDownload}>
            {t('document.download')}
          </Button>
          <Button startIcon={<ShareIcon />} variant="outlined" onClick={() => setShareDialogOpen(true)}>
            {t('document.share')}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* Metadata */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title={t('document.metadata')} />
            <CardContent>
              <Stack spacing={1.5}>
                <DetailRow label={t('document.name')} value={doc.title} />
                <DetailRow label={t('document.type')} value={doc.mime_type} />
                <DetailRow label={t('document.size')} value={`${(doc.file_size / 1024).toFixed(1)} KB`} />
                <DetailRow label={t('document.scanStatus')} value={doc.scan_status} />
                <DetailRow label={t('document.confidentiality')} value={doc.confidentiality} />
                <DetailRow label={t('common.createdAt')} value={new Date(doc.created_at).toLocaleString()} />
                {doc.case_id && <DetailRow label={t('case.title')} value={doc.case_id} />}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Lock / Checkout */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title={t('document.lockStatus')} />
            <CardContent>
              {isLocked && !lockExpired ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t('document.checkedOut')}
                  {doc.checkout_expires_at && (
                    <Typography variant="caption" display="block">
                      Expires: {new Date(doc.checkout_expires_at).toLocaleString()}
                    </Typography>
                  )}
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t('document.available')}
                </Alert>
              )}
              <Stack direction="row" spacing={1}>
                {!isLocked || lockExpired ? (
                  <Button startIcon={<LockIcon />} variant="outlined" onClick={handleCheckout}>
                    {t('document.checkout')}
                  </Button>
                ) : (
                  <Button startIcon={<UnlockIcon />} variant="outlined" onClick={handleCheckin}>
                    {t('document.checkin')}
                  </Button>
                )}
                {isAdmin && isLocked && !lockExpired && (
                  <Button color="warning" variant="outlined" onClick={handleBreakLock}>
                    {t('document.breakLock')}
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card sx={{ mt: 2 }}>
            <CardHeader title={t('common.actions')} />
            <CardContent>
              <Stack spacing={1}>
                {isAdmin && (
                  <FormControlLabel
                    control={<Switch checked={!!doc.legal_hold} onChange={handleLegalHoldToggle} />}
                    label={t('document.legalHold')}
                  />
                )}
                <Divider />
                {!doc.is_deleted ? (
                  <Button startIcon={<DeleteIcon />} color="error" onClick={handleDelete}>
                    {t('common.delete')}
                  </Button>
                ) : (
                  <Button startIcon={<RestoreIcon />} color="success" onClick={handleRestore}>
                    {t('document.restore')}
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Version History */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title={t('document.versions')} />
            <CardContent>
              {doc.versions && doc.versions.length > 0 ? (
                <List dense>
                  {doc.versions.map((v: DocumentVersion, i: number) => (
                    <ListItem key={v.id || i}>
                      <ListItemText
                        primary={`v${v.version_number} — ${(v.file_size / 1024).toFixed(1)} KB`}
                        secondary={new Date(v.created_at).toLocaleString()}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('common.noData')}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('document.share')}</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <input
              type="email"
              placeholder="Email"
              value={shareEmail}
              onChange={e => setShareEmail(e.target.value)}
              style={{ width: '100%', padding: 8, fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleShare} disabled={!shareEmail}>{t('document.share')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box display="flex" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value}</Typography>
    </Box>
  );
}
