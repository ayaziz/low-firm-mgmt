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
  Grid,
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
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PictureAsPdf as PdfIcon,
  Send as SendIcon,
  CheckCircle as FinalizeIcon,
  Payment as PaymentIcon,
  Block as VoidIcon,
} from '@mui/icons-material';
import { accountingApi } from '@/api';
import type { Invoice } from '@/types';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Draft: 'default',
  Finalized: 'info',
  Sent: 'warning',
  Paid: 'success',
  Overdue: 'error',
  Void: 'default',
};

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'BankTransfer', reference: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const inv = await accountingApi.getInvoice(id);
      setInvoice(inv);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleFinalize = async () => {
    if (!invoice) return;
    await accountingApi.finalizeInvoice(id);
    load();
  };

  const handleSend = async () => {
    if (!invoice) return;
    await accountingApi.sendInvoice(id);
    load();
  };

  const handleVoid = async () => {
    if (!invoice) return;
    const reason = window.prompt('Reason for voiding') || 'Voided';
    await accountingApi.voidInvoice(id, reason || 'Voided');
    load();
  };

  const handleDownloadPdf = async () => {
    await accountingApi.downloadInvoicePdf(id);
  };

  const handleRecordPayment = async () => {
    setSaving(true);
    try {
      await accountingApi.createPayment({
        invoiceId: id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        paymentDate: new Date().toISOString().split('T')[0],
        reference: paymentForm.reference || undefined,
      });
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: 0, method: 'BankTransfer', reference: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !invoice) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Typography color="text.secondary">{t('common.loading')}</Typography>
      </Box>
    );
  }

  const total = invoice.lineItems?.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0)
    ?? Number(invoice.total_amount) ?? 0;
  const paidAmount = Number(invoice.paid_amount) || 0;
  const balance = total - paidAmount;

  return (
		<Box>
			{/* Header */}
			<Stack direction="row" alignItems="center" spacing={2} mb={3}>
				<IconButton onClick={() => router.push('/accounting')}>
					<BackIcon />
				</IconButton>
				<Box flex={1}>
					<Typography variant="h5" fontWeight={600}>
						{t('accounting.invoiceNumber')}: {invoice.invoice_number}
					</Typography>
					<Chip
						label={invoice.status}
						size="small"
						color={STATUS_COLORS[invoice.status] || 'default'}
						sx={{ mt: 0.5 }}
					/>
				</Box>
				<Stack direction="row" spacing={1} flexWrap="wrap">
					{invoice.status === 'Draft' && (
						<Button
							startIcon={<FinalizeIcon />}
							variant="contained"
							color="info"
							onClick={handleFinalize}
						>
							Finalize
						</Button>
					)}
					{invoice.status === 'Finalized' && (
						<Button
							startIcon={<SendIcon />}
							variant="contained"
							onClick={handleSend}
						>
							Send
						</Button>
					)}
					{['Sent', 'Overdue'].includes(invoice.status) && balance > 0 && (
						<Button
							startIcon={<PaymentIcon />}
							variant="contained"
							color="success"
							onClick={() => {
								setPaymentForm((f) => ({ ...f, amount: balance }))
								setPaymentDialogOpen(true)
							}}
						>
							{t('accounting.recordPayment')}
						</Button>
					)}
					{['Draft', 'Finalized', 'Sent'].includes(invoice.status) && (
						<Button
							startIcon={<VoidIcon />}
							variant="outlined"
							color="error"
							onClick={handleVoid}
						>
							Void
						</Button>
					)}
					<Button
						startIcon={<PdfIcon />}
						variant="outlined"
						onClick={handleDownloadPdf}
					>
						PDF
					</Button>
				</Stack>
			</Stack>

			<Grid container spacing={3}>
				{/* Summary */}
				<Grid item xs={12} md={4}>
					<Card>
						<CardHeader title="Summary" />
						<CardContent>
							<Stack spacing={1.5}>
					<DetailRow label="Total" value={`$${Number(total).toFixed(2)}`} />
							<DetailRow label="Paid" value={`$${Number(paidAmount).toFixed(2)}`} />
							<DetailRow label="Balance" value={`$${Number(balance).toFixed(2)}`} />
								{invoice.due_date && (
									<DetailRow
										label={t('accounting.dueDate')}
										value={new Date(invoice.due_date).toLocaleDateString()}
									/>
								)}
								<DetailRow
									label={t('common.createdAt')}
									value={new Date(invoice.created_at).toLocaleString()}
								/>
							</Stack>
							{balance < 0 && (
								<Alert severity="error" sx={{ mt: 2 }}>
									Overpayment detected!
								</Alert>
							)}
						</CardContent>
					</Card>
				</Grid>

				{/* Line Items */}
				<Grid item xs={12} md={8}>
					<Card>
						<CardHeader title={t('accounting.lineItems')} />
						<TableContainer>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>{t('accounting.description')}</TableCell>
										<TableCell align="right">
											{t('accounting.quantity')}
										</TableCell>
										<TableCell align="right">
											{t('accounting.unitPrice')}
										</TableCell>
										<TableCell align="right">Total</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{invoice.lineItems?.map((li, i) => (
										<TableRow key={li.id || i}>
											<TableCell>{li.description}</TableCell>
											<TableCell align="right">{li.quantity}</TableCell>
											<TableCell align="right">
											${Number(li.unit_price ?? 0).toFixed(2)}
										</TableCell>
										<TableCell align="right">
											$
											{((Number(li.quantity) || 0) * (Number(li.unit_price) || 0)).toFixed(
													2,
												)}
											</TableCell>
										</TableRow>
									))}
									<TableRow>
										<TableCell colSpan={3} align="right">
											<strong>Total</strong>
										</TableCell>
										<TableCell align="right">
										<strong>${Number(total).toFixed(2)}</strong>
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</TableContainer>
					</Card>
				</Grid>

				{/* Payments */}
				<Grid item xs={12}>
					<Card>
						<CardHeader title={t('accounting.payments')} />
						{invoice.payments && invoice.payments.length > 0 ? (
							<TableContainer>
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>{t('accounting.amount')}</TableCell>
											<TableCell>{t('accounting.paymentMethod')}</TableCell>
											<TableCell>Reference</TableCell>
											<TableCell>{t('common.createdAt')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{invoice.payments.map((p, i) => (
											<TableRow key={p.id || i}>
												<TableCell>${Number(p.amount).toFixed(2)}</TableCell>
												<TableCell>{p.payment_method}</TableCell>
												<TableCell>{p.reference || '—'}</TableCell>
												<TableCell>
													{new Date(p.created_at).toLocaleString()}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
						) : (
							<CardContent>
								<Typography variant="body2" color="text.secondary">
									{t('common.noData')}
								</Typography>
							</CardContent>
						)}
					</Card>
				</Grid>
			</Grid>

			{/* Record Payment Dialog */}
			<Dialog
				open={paymentDialogOpen}
				onClose={() => setPaymentDialogOpen(false)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>{t('accounting.recordPayment')}</DialogTitle>
				<DialogContent>
					<Stack spacing={2} mt={1}>
						<TextField
							label={t('accounting.amount')}
							type="number"
							fullWidth
							required
							value={paymentForm.amount}
							onChange={(e) =>
								setPaymentForm((f) => ({
									...f,
									amount: Number(e.target.value),
								}))
							}
							helperText={`Balance: $${Number(balance).toFixed(2)}`}
						/>
						<TextField
							label={t('accounting.paymentMethod')}
							select
							fullWidth
							value={paymentForm.method}
							onChange={(e) =>
								setPaymentForm((f) => ({ ...f, method: e.target.value }))
							}
						>
							<MenuItem value="BankTransfer">Bank Transfer</MenuItem>
							<MenuItem value="Cash">Cash</MenuItem>
							<MenuItem value="Check">Check</MenuItem>
							<MenuItem value="CreditCard">Credit Card</MenuItem>
						</TextField>
						<TextField
							label="Reference"
							fullWidth
							value={paymentForm.reference}
							onChange={(e) =>
								setPaymentForm((f) => ({ ...f, reference: e.target.value }))
							}
						/>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setPaymentDialogOpen(false)}>
						{t('common.cancel')}
					</Button>
					<Button
						variant="contained"
						onClick={handleRecordPayment}
						disabled={saving || paymentForm.amount <= 0}
					>
						{t('accounting.recordPayment')}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	)
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box display="flex" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value}</Typography>
    </Box>
  );
}
