'use client';

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Stack,
  Button,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface DrawerFormProps {
  open: boolean;
  title: string;
  width?: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  children: React.ReactNode;
}

export default function DrawerForm({
  open,
  title,
  width = 420,
  loading = false,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  children,
}: DrawerFormProps) {
  const { t } = useTranslation();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: width } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 3, py: 2 }}
        >
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />

        {/* Body */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {children}
        </Box>

        {/* Footer */}
        {onSubmit && (
          <>
            <Divider />
            <Stack direction="row" spacing={1} sx={{ p: 2 }} justifyContent="flex-end">
              <Button onClick={onClose} disabled={loading}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={onSubmit}
                disabled={loading || submitDisabled}
                startIcon={loading ? <CircularProgress size={16} /> : undefined}
              >
                {submitLabel || t('common.save')}
              </Button>
            </Stack>
          </>
        )}
      </Box>
    </Drawer>
  );
}
