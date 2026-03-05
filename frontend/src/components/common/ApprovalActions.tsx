'use client';

import React, { useState } from 'react';
import {
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
} from '@mui/material';
import {
  Send as SubmitIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  AttachMoney as PaidIcon,
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';

export interface ApprovalActionsProps {
  entityType: 'wage' | 'invoice';
  status: string;
  onSubmit?: (comment?: string) => Promise<void>;
  onApprove?: (comment?: string) => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
  onMarkPaid?: (comment?: string) => Promise<void>;
  disabled?: boolean;
}

type DialogMode = 'submit' | 'approve' | 'reject' | 'markPaid' | null;

export default function ApprovalActions({
  entityType,
  status,
  onSubmit,
  onApprove,
  onReject,
  onMarkPaid,
  disabled = false,
}: ApprovalActionsProps) {
  const { hasAnyRole } = useAuth();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = hasAnyRole('TenantAdmin', 'SystemAdmin');
  const isAccountant = hasAnyRole('Accountant');

  const canSubmit = entityType === 'wage'
    ? status === 'Draft' && (isAccountant || isAdmin)
    : status === 'Finalized' && (isAccountant || isAdmin);

  const canApprove = entityType === 'wage'
    ? status === 'Submitted' && isAdmin
    : status === 'Review' && isAdmin;

  const canReject = canApprove;

  const canMarkPaid = entityType === 'wage'
    ? status === 'Approved' && (isAccountant || isAdmin)
    : false;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      switch (dialogMode) {
        case 'submit':
          await onSubmit?.(comment || undefined);
          break;
        case 'approve':
          await onApprove?.(comment || undefined);
          break;
        case 'reject':
          await onReject?.(comment);
          break;
        case 'markPaid':
          await onMarkPaid?.(comment || undefined);
          break;
      }
      setDialogMode(null);
      setComment('');
    } finally {
      setLoading(false);
    }
  };

  const dialogTitles: Record<string, string> = {
    submit: 'Submit for Approval',
    approve: 'Approve',
    reject: 'Reject',
    markPaid: 'Mark as Paid',
  };

  return (
    <>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {canSubmit && onSubmit && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<SubmitIcon />}
            disabled={disabled}
            onClick={() => setDialogMode('submit')}
          >
            Submit
          </Button>
        )}
        {canApprove && onApprove && (
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<ApproveIcon />}
            disabled={disabled}
            onClick={() => setDialogMode('approve')}
          >
            Approve
          </Button>
        )}
        {canReject && onReject && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<RejectIcon />}
            disabled={disabled}
            onClick={() => setDialogMode('reject')}
          >
            Reject
          </Button>
        )}
        {canMarkPaid && onMarkPaid && (
          <Button
            variant="contained"
            color="info"
            size="small"
            startIcon={<PaidIcon />}
            disabled={disabled}
            onClick={() => setDialogMode('markPaid')}
          >
            Mark Paid
          </Button>
        )}
      </Stack>

      <Dialog open={!!dialogMode} onClose={() => !loading && setDialogMode(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogMode ? dialogTitles[dialogMode] : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {dialogMode === 'reject'
              ? 'Please provide a reason for rejection.'
              : 'Optionally add a comment.'}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label={dialogMode === 'reject' ? 'Reason (required)' : 'Comment (optional)'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required={dialogMode === 'reject'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogMode(null)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={loading || (dialogMode === 'reject' && !comment.trim())}
            color={dialogMode === 'reject' ? 'error' : 'primary'}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
