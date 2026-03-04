/** @format */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
	Box,
	Button,
	IconButton,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	MenuItem,
	Paper,
} from '@mui/material'
import {
	Add as AddIcon,
	Refresh as RefreshIcon,
	Check as ApproveIcon,
	Close as RejectIcon,
	Edit as EditIcon,
} from '@mui/icons-material'
import { accountingApi, caseApi, adminApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import DrawerForm from '@/components/common/DrawerForm'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import ConfirmDialog from '@/components/common/ConfirmDialog'

export default function ExpensesTab() {
	const { t } = useTranslation()
	const { hasAnyRole } = useAuth()
	const canApprove = hasAnyRole('TenantAdmin', 'Accountant')

	const [expenses, setExpenses] = useState<any[]>([])
	const [cursor, setCursor] = useState<string | null>(null)
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [cases, setCases] = useState<any[]>([])
	const [categories, setCategories] = useState<any[]>([])

	const [drawerOpen, setDrawerOpen] = useState(false)
	const [saving, setSaving] = useState(false)
	const [form, setForm] = useState({
		caseId: '',
		categoryId: '',
		description: '',
		amount: '',
		customerId: '',
		date: '',
	})
	const [editExpense, setEditExpense] = useState<any | null>(null)
	const [rejectTarget, setRejectTarget] = useState<any>(null)

	const load = useCallback(async (c?: string | null) => {
		setLoading(true)
		try {
			const res = await accountingApi.listExpenses({
				cursor: c ?? undefined,
				limit: 20,
			})
			const list = Array.isArray(res) ? res : (res.data ?? [])
			if (c) setExpenses((prev) => [...prev, ...list])
			else setExpenses(list)
			setCursor(res.nextCursor ?? (res as any).next_cursor ?? null)
			setHasMore(!!(res.nextCursor ?? (res as any).next_cursor))
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		load()
	}, [load])
	useEffect(() => {
		caseApi
			.list({ limit: 100 })
			.then((r) => setCases(Array.isArray(r) ? r : (r.data ?? [])))
		adminApi
			.listMasterData('expenseCategory')
			.then((r) => setCategories(Array.isArray(r) ? r : (r ?? [])))
	}, [])

	const handleSave = async () => {
		setSaving(true)
		try {
			if (editExpense) {
				await accountingApi.updateExpense(editExpense.id, {
					caseId: form.caseId || undefined,
					expenseDate: form.date || undefined,
					customerId: form.customerId || undefined,
					categoryId: form.categoryId || undefined,
					description: form.description || undefined,
					amount: form.amount ? Number(form.amount) : undefined,
				} as any)
			} else {
				await accountingApi.createExpense({
					caseId: form.caseId,
					expenseDate: form.date,
					customerId: form.customerId,
					categoryId: form.categoryId,
					description: form.description,
					amount: Number(form.amount),
				})
			}
			setDrawerOpen(false)
			setEditExpense(null)
			setForm({
				caseId: '',
				categoryId: '',
				description: '',
				customerId: '',
				amount: '',
				date: '',
			})
			load()
		} finally {
			setSaving(false)
		}
	}

	const openCreate = () => {
		setEditExpense(null)
		setForm({ caseId: '', categoryId: '', description: '', amount: '', customerId: '', date: '' })
		setDrawerOpen(true)
	}

	const openEdit = (exp: any) => {
		setEditExpense(exp)
		setForm({
			caseId: exp.case_id || exp.caseId || '',
			categoryId: exp.category_id || exp.categoryId || '',
			description: exp.description || '',
			amount: String(exp.amount ?? ''),
			customerId: exp.customer_id || exp.customerId || '',
			date: exp.expense_date ? exp.expense_date.slice(0, 10) : '',
		})
		setDrawerOpen(true)
	}

	const handleApprove = async (id: string) => {
		await accountingApi.approveExpense(id)
		load()
	}

	const handleReject = async () => {
		if (!rejectTarget) return
		const reason = window.prompt(
			t('accounting.rejectReason', 'Rejection reason:'),
		)
		if (reason === null) {
			setRejectTarget(null)
			return
		}
		await accountingApi.rejectExpense(rejectTarget.id, reason)
		setRejectTarget(null)
		load()
	}

	return (
		<Box>
			<Stack direction="row" spacing={2} mb={2} justifyContent="flex-end">
				<IconButton onClick={() => load()}>
					<RefreshIcon />
				</IconButton>
				<Button
					variant="contained"
					startIcon={<AddIcon />}
					onClick={openCreate}
				>
					{t('common.create', 'Create')}
				</Button>
			</Stack>

			{loading && expenses.length === 0 ? (
				<LoadingSkeleton variant="table" />
			) : expenses.length > 0 ? (
				<>
					<TableContainer component={Paper}>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>
										{t('accounting.description', 'Description')}
									</TableCell>
									<TableCell>{t('accounting.case', 'Case')}</TableCell>
									<TableCell>{t('accounting.amount', 'Amount')}</TableCell>
									<TableCell>{t('common.status', 'Status')}</TableCell>
									<TableCell>{t('common.date', 'Date')}</TableCell>
									<TableCell>{t('common.actions', 'Actions')}</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{expenses.map((exp) => (
									<TableRow key={exp.id} hover>
										<TableCell>{exp.description}</TableCell>
										<TableCell>{exp.case_title ?? exp.caseId}</TableCell>
										<TableCell>{Number(exp.amount ?? 0).toFixed(2)}</TableCell>
										<TableCell>
											<StatusBadge status={exp.status ?? 'Submitted'} />
										</TableCell>
										<TableCell>
											{exp.created_at
												? new Date(exp.created_at).toLocaleDateString()
												: '—'}
										</TableCell>
										<TableCell>
											<Stack direction="row" spacing={0.5}>
												{(exp.status === 'Pending' || exp.status === 'Submitted') && (
													<IconButton size="small" onClick={() => openEdit(exp)}>
														<EditIcon fontSize="small" />
													</IconButton>
												)}
												{canApprove && exp.status === 'Submitted' && (
													<>
														<IconButton
															size="small"
															color="success"
															onClick={() => handleApprove(exp.id)}
														>
															<ApproveIcon fontSize="small" />
														</IconButton>
														<IconButton
															size="small"
															color="error"
															onClick={() => setRejectTarget(exp)}
														>
															<RejectIcon fontSize="small" />
														</IconButton>
													</>
												)}
											</Stack>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
					{hasMore && (
						<Stack alignItems="center" mt={2}>
							<Button onClick={() => load(cursor)} disabled={loading}>
								{t('common.loadMore', 'Load more')}
							</Button>
						</Stack>
					)}
				</>
			) : (
				<EmptyState
					icon={<AddIcon />}
					title={t('accounting.noExpenses', 'No expenses')}
					message={t(
						'accounting.noExpensesMsg',
						'Submit your first expense report',
					)}
				/>
			)}

			<ConfirmDialog
				open={!!rejectTarget}
				title={t('accounting.rejectExpense', 'Reject Expense')}
				message={t(
					'accounting.rejectConfirm',
					'Are you sure you want to reject this expense?',
				)}
				variant="danger"
				loading={false}
				onConfirm={handleReject}
				onCancel={() => setRejectTarget(null)}
			/>

			<DrawerForm
				open={drawerOpen}
				title={editExpense ? t('accounting.editExpense', 'Edit Expense') : t('accounting.createExpense', 'Create Expense')}
				onClose={() => { setDrawerOpen(false); setEditExpense(null); }}
				onSubmit={handleSave}
				loading={saving}
			>
				<Stack spacing={2.5}>
					<TextField
						select
						label={t('accounting.case', 'Case')}
						fullWidth
						value={form.caseId}
						onChange={(e) => {
							const caseId = e.target.value
							const selected = cases.find((c) => c.id === caseId)

							setForm((f) => ({
								...f,
								caseId,
								customerId: (selected?.customer_id ??'') as string,
							}))
						}}
					>
						{cases.map((c) => (
							<MenuItem key={c.id} value={c.id}>
								{c.title ?? c.case_number}
							</MenuItem>
						))}
					</TextField>
					<TextField
						label={t('accounting.category')}
						select
						fullWidth
						value={form.categoryId}
						onChange={(e) =>
							setForm((f) => ({ ...f, categoryId: e.target.value }))
						}
					>
						<MenuItem value="">— {t('common.noData')} —</MenuItem>
						{categories.map((d) => (
							<MenuItem key={d.id} value={d.id}>
								{d.label_en} ({d.label_ar})
							</MenuItem>
						))}
					</TextField>

					<TextField
						label={t('accounting.expenseDate', 'Expense Date')}
						type="date"
						fullWidth
						InputLabelProps={{ shrink: true }}
						value={form.date}
						onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
					/>

					<TextField
						label={t('accounting.amount', 'Amount')}
						type="number"
						fullWidth
						value={form.amount}
						onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
					/>
					<TextField
						label={t('accounting.description', 'Description')}
						fullWidth
						multiline
						rows={3}
						value={form.description}
						onChange={(e) =>
							setForm((f) => ({ ...f, description: e.target.value }))
						}
					/>
				</Stack>
			</DrawerForm>
		</Box>
	)
}
