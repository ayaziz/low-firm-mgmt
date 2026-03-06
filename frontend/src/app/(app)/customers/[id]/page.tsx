'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Card, CardContent, Checkbox, Chip, Divider, Grid,
  IconButton, List, ListItem, ListItemIcon, ListItemText, MenuItem, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Download as DownloadIcon,
} from '@mui/icons-material';
import { customerApi, documentApi, auditApi, adminApi } from '@/api';
import type {
	Customer,
	Contact,
	Address,
	Document as Doc,
	AuditEvent,
	CustomerStatus,
} from '@/types'
import type { CustomerCommunication } from '@/api/customers';
import PageHeader from '@/components/common/PageHeader';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';
import KPICard from '@/components/common/KPICard';
import InsightsRail from '@/components/common/InsightsRail';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import FolderTree from '@/components/common/FolderTree';
import StatusTimeline from '@/components/common/StatusTimeline';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box py={2}>{children}</Box> : null;
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function CustomerDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params.id as string;

  /* ---- core state ---- */
  const [customer, setCustomer] = useState<(Customer & { contacts: Contact[]; addresses: Address[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const[isIndividual, setIsIndividual] = useState(false);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [communications, setCommunications] = useState<CustomerCommunication[]>([]);
  const [commTypes, setCommTypes] = useState<Array<{ id: string; label_en: string; is_active: boolean }>>([]);
  const [commForm, setCommForm] = useState({
    direction: 'Inbound' as 'Inbound' | 'Outbound',
    typeId: '',
    dateTime: '',
    summary: '',
    nextSteps: '',
    participants: '',
  });

  /* ---- drawer state ---- */
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', notes: '', status: 'Active' as CustomerStatus, national_id: '', passport_number: '', registration_id: '', tax_id: '', customer_type: 'Individual' as 'Individual' | 'Organization' });

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', role_id: '', phone: '', email: '' });
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const [addressOpen, setAddressOpen] = useState(false);
  const [addressForm, setAddressForm] = useState({
    address_type: '',
    is_primary: false,
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  });
  const [editAddress, setEditAddress] = useState<Address | null>(null);

  /* ---- tab data ---- */
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [checklist, setChecklist] = useState<Array<{ id: string; label: string; is_met: boolean }>>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [financialSummary, setFinancialSummary] = useState<{
    last_payment_date: string | null; overdue: number; paid: number; outstanding: number;
  } | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  /* ---- load ---- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, docs, complianceRes, auditRes, finRes, commRes, commTypesRes] = await Promise.all([
        customerApi.getById(id),
        documentApi.list({ customerId: id, limit: 100 }).catch(() => ({ data: [] })),
        customerApi.getChecklist(id).catch(() => ({ items: [] })),
        auditApi.getByEntity('Customer', id).catch(() => ({ data: [] })),
        customerApi.getFinancialSummary(id).catch(() => null),
        customerApi.listCommunications(id).catch(() => []),
        adminApi.listMasterData('communicationType').catch(() => []),
      ]);

      setCustomer(c);
      setIsIndividual(c.customer_type === 'Individual');
      setEditForm({ name: c.name, notes: c.notes || '', status: c.status, national_id: c.national_id || '', passport_number: c.passport_number || '', registration_id: c.registration_id || '', tax_id: c.tax_id || '', customer_type: c.customer_type });
      setDocuments(Array.isArray(docs) ? docs : docs.data ?? []);
      setChecklist(Array.isArray(complianceRes) ? complianceRes : complianceRes.items ?? []);
      setAuditEvents(Array.isArray(auditRes) ? auditRes : auditRes.data ?? []);
      setFinancialSummary(finRes);
      setCommunications(Array.isArray(commRes) ? commRes : []);
      setCommTypes((commTypesRes as Array<{ id: string; label_en: string; is_active: boolean }>).filter((item) => item.is_active));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /* ---- handlers ---- */
  const handleUpdate = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await customerApi.update(id, {
				...editForm,
				rowVersion: customer.rowVersion,
			})
      await load();
      setEditOpen(false);
    } finally { setSaving(false); }
  };

  const openCreateContact = () => { setEditContact(null); setContactForm({ name: '', role_id: '', phone: '', email: '' }); setContactOpen(true); };
  const openEditContact = (c: Contact) => {
    setEditContact(c);
    setContactForm({ name: c.name, role_id: (c as any).role_id || '', phone: c.phone || '', email: c.email || '' });
    setContactOpen(true);
  };

  const handleAddContact = async () => {
    if (!contactForm.name?.trim()) return;
    setSaving(true);
    // Strip empty optional fields so backend validators (IsEmail, IsString) don't reject them
    const payload: Record<string, string> = { name: contactForm.name };
    if (contactForm.role_id) payload.role_id = contactForm.role_id;
    if (contactForm.phone?.trim()) payload.phone = contactForm.phone.trim();
    if (contactForm.email?.trim()) payload.email = contactForm.email.trim();
    try {
      if (editContact) {
        await customerApi.updateContact(id, editContact.id, payload);
      } else {
        await customerApi.addContact(id, payload);
      }
      setContactOpen(false);
      setContactForm({ name: '', role_id: '', phone: '', email: '' });
      setEditContact(null);
      load();
    } finally { setSaving(false); }
  };

  const handleDeleteContact = async (cid: string) => {
    await customerApi.deleteContact(id, cid);
    load();
  };

  const openCreateAddress = () => {
    setEditAddress(null);
    setAddressForm({ address_type: '', is_primary: false, line1: '', line2: '', city: '', state: '', postal_code: '', country: '' });
    setAddressOpen(true);
  };
  const openEditAddress = (a: Address) => {
    setEditAddress(a);
    setAddressForm({
      address_type: a.address_type || '',
      is_primary: !!(a as any).is_primary,
      line1: a.line1 || '',
      line2: a.line2 || '',
      city: a.city || '',
      state: (a as any).state || (a as any).state_province || '',
      postal_code: (a as any).postal_code || '',
      country: a.country || '',
    });
    setAddressOpen(true);
  };

  const handleAddAddress = async () => {
    setSaving(true);
    try {
      if (editAddress) {
        await customerApi.updateAddress(id, editAddress.id, addressForm);
      } else {
        await customerApi.addAddress(id, addressForm);
      }
      setAddressOpen(false);
      setAddressForm({ address_type: '', is_primary: false, line1: '', line2: '', city: '', state: '', postal_code: '', country: '' });
      setEditAddress(null);
      load();
    } finally { setSaving(false); }
  };

  const handleDeleteAddress = async (aid: string) => {
    await customerApi.deleteAddress(id, aid);
    load();
  };

  const handleCreateCommunication = async () => {
    if (!commForm.typeId || !commForm.summary.trim()) return;
    setSaving(true);
    try {
      await customerApi.createCommunication(id, {
        typeId: commForm.typeId,
        dateTime: commForm.dateTime ? new Date(commForm.dateTime).toISOString() : new Date().toISOString(),
        direction: commForm.direction,
        summary: commForm.summary.trim(),
        nextSteps: commForm.nextSteps.trim() || undefined,
        participants: commForm.participants.trim() || undefined,
      });
      setCommOpen(false);
      setCommForm({ direction: 'Inbound', typeId: '', dateTime: '', summary: '', nextSteps: '', participants: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  /* ---- loading skeleton ---- */
  if (loading || !customer) return <LoadingSkeleton variant="detail" />;

  /* ---- derived ---- */
  const completenessPercent = checklist.length > 0
    ? Math.round((checklist.filter(c => c.is_met).length / checklist.length) * 100)
    : undefined;

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
		<Box>
			{/* Header */}
			<PageHeader
				title={customer.name}
				subtitle={
					<Stack direction="row" spacing={1} alignItems="center">
						<StatusBadge status={customer.customer_type} variant="outlined" />
						<StatusBadge status={customer.status} />
						{customer.national_id && (
							<Typography
								variant="body2"
								color="text.secondary"
								fontFamily="monospace"
							>
								{customer.national_id}
							</Typography>
						)}
					</Stack>
				}
				breadcrumbs={[
					{ label: t('nav.customers', 'Customers'), href: '/customers' },
					{ label: customer.name },
				]}
				actions={
					<Button
						variant="outlined"
						startIcon={<EditIcon />}
						onClick={() => setEditOpen(true)}
					>
						{t('common.edit', 'Edit')}
					</Button>
				}
			/>

			<Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
				{/* ---- Main content ---- */}
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Tabs
						value={tab}
						onChange={(_, v) => setTab(v)}
						variant="scrollable"
						scrollButtons="auto"
					>
						<Tab label={t('customer.overview', 'Overview')} />
						<Tab
							label={`${t('customer.contacts', 'Contacts')} (${customer.contacts?.length || 0})`}
						/>
						<Tab
							label={`${t('customer.addresses', 'Addresses')} (${customer.addresses?.length || 0})`}
						/>
						<Tab
							label={`${t('customer.documents', 'Documents')} (${documents.length})`}
						/>
						<Tab
							label={`${t('customer.communications', 'Communications')} (${communications.length})`}
						/>
						<Tab label={t('customer.compliance', 'Compliance')} />
						<Tab label={t('customer.financialSummary', 'Financial')} />
						<Tab label={t('customer.audit', 'Audit')} />
					</Tabs>

					{/* ── Overview ───────────────────────────────────── */}
					<TabPanel value={tab} index={0}>
						<Grid container spacing={3}>
							<Grid item xs={12} md={6}>
								<Card>
									<CardContent>
										<Typography
											variant="subtitle2"
											color="text.secondary"
											gutterBottom
										>
											{t('customer.details', 'Details')}
										</Typography>
										<Stack spacing={1.5}>
											<Box>
												<Typography variant="caption" color="text.secondary">
													{t('customer.status', 'Status')}
												</Typography>
												<Box mt={0.25}>
													<StatusBadge status={customer.status} />
												</Box>
											</Box>
											<Box>
												<Typography variant="caption" color="text.secondary">
													{t('customer.notes', 'Notes')}
												</Typography>
												<Typography variant="body2">
													{customer.notes || '—'}
												</Typography>
											</Box>
											<Box>
												<Typography variant="caption" color="text.secondary">
													{t('common.createdAt', 'Created')}
												</Typography>
												<Typography variant="body2">
													{new Date(customer.created_at).toLocaleDateString()}
												</Typography>
											</Box>
											{(customer as any).kyc_status && (
												<Box>
													<Typography variant="caption" color="text.secondary">
														{t('customer.kycStatus', 'KYC Status')}
													</Typography>
													<Box mt={0.25}>
														<StatusBadge
															status={(customer as any).kyc_status}
														/>
													</Box>
												</Box>
											)}
											{(customer as any).risk_profile && (
												<Box>
													<Typography variant="caption" color="text.secondary">
														{t('customer.riskProfile', 'Risk Profile')}
													</Typography>
													<Box mt={0.25}>
														<StatusBadge
															status={(customer as any).risk_profile}
														/>
													</Box>
												</Box>
											)}
											{(customer as any).credit_rating && (
												<Box>
													<Typography variant="caption" color="text.secondary">
														{t('customer.creditRating', 'Credit Rating')}
													</Typography>
													<Typography variant="body2">
														{(customer as any).credit_rating}
													</Typography>
												</Box>
											)}
											{(customer as any).preferred_language && (
												<Box>
													<Typography variant="caption" color="text.secondary">
														{t(
															'customer.preferredLanguage',
															'Preferred Language',
														)}
													</Typography>
													<Typography variant="body2">
														{(customer as any).preferred_language}
													</Typography>
												</Box>
											)}
											{(customer as any).preferred_comm_channel && (
												<Box>
													<Typography variant="caption" color="text.secondary">
														{t(
															'customer.preferredCommChannel',
															'Preferred Channel',
														)}
													</Typography>
													<Typography variant="body2">
														{(customer as any).preferred_comm_channel}
													</Typography>
												</Box>
											)}
											{(customer as any).industry_sector && (
												<Box>
													<Typography variant="caption" color="text.secondary">
														{t('customer.industrySector', 'Industry')}
													</Typography>
													<Typography variant="body2">
														{(customer as any).industry_sector}
													</Typography>
												</Box>
											)}
										</Stack>
									</CardContent>
								</Card>
							</Grid>
							<Grid item xs={12} md={6}>
								<StatusTimeline entityType="customer" entityId={id} />
							</Grid>
						</Grid>
					</TabPanel>

					{/* ── Contacts ───────────────────────────────────── */}
					<TabPanel value={tab} index={1}>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
							mb={2}
						>
							<Typography variant="h6">
								{t('customer.contacts', 'Contacts')}
							</Typography>
							<Button
								variant="contained"
								startIcon={<AddIcon />}
								size="small"
								onClick={openCreateContact}
							>
								{t('common.add', 'Add')}
							</Button>
						</Stack>
						{customer.contacts?.length > 0 ? (
							<Card>
								<List disablePadding>
									{customer.contacts.map((c: Contact, i: number) => (
										<React.Fragment key={c.id}>
											{i > 0 && <Divider />}
											<ListItem
												secondaryAction={
													<Stack direction="row" spacing={0.5}>
														<IconButton
															size="small"
															onClick={() => openEditContact(c)}
														>
															<EditIcon fontSize="small" />
														</IconButton>
														<IconButton
															size="small"
															onClick={() => handleDeleteContact(c.id)}
														>
															<DeleteIcon fontSize="small" />
														</IconButton>
													</Stack>
												}
											>
												<ListItemText
													primary={c.name}
													secondary={[
														(c as any).contact_role || c.role_id,
														c.phone,
														c.email,
													]
														.filter(Boolean)
														.join(' · ')}
												/>
											</ListItem>
										</React.Fragment>
									))}
								</List>
							</Card>
						) : (
							<EmptyState
								icon={<AddIcon />}
								title={t('common.noData', 'No data')}
								message={t('customer.noContacts', 'No contacts yet')}
							/>
						)}
					</TabPanel>

					{/* ── Addresses ──────────────────────────────────── */}
					<TabPanel value={tab} index={2}>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
							mb={2}
						>
							<Typography variant="h6">
								{t('customer.addresses', 'Addresses')}
							</Typography>
							<Button
								variant="contained"
								startIcon={<AddIcon />}
								size="small"
								onClick={openCreateAddress}
							>
								{t('common.add', 'Add')}
							</Button>
						</Stack>
						{customer.addresses?.length > 0 ? (
							<Grid container spacing={2}>
								{customer.addresses.map((a: Address) => (
									<Grid item xs={12} sm={6} key={a.id}>
										<Card>
											<CardContent>
												<Stack
													direction="row"
													justifyContent="space-between"
													alignItems="center"
												>
													<StatusBadge
														status={a.address_type}
														variant="outlined"
													/>
													<Stack direction="row" spacing={0.5}>
														<IconButton
															size="small"
															onClick={() => openEditAddress(a)}
														>
															<EditIcon fontSize="small" />
														</IconButton>
														<IconButton
															size="small"
															onClick={() => handleDeleteAddress(a.id)}
														>
															<DeleteIcon fontSize="small" />
														</IconButton>
													</Stack>
												</Stack>
												<Typography variant="body2" mt={1}>
													{a.line1}
												</Typography>
												{a.line2 && (
													<Typography variant="body2">{a.line2}</Typography>
												)}
												<Typography variant="body2">
													{a.city}, {a.country}
												</Typography>
											</CardContent>
										</Card>
									</Grid>
								))}
							</Grid>
						) : (
							<EmptyState
								icon={<AddIcon />}
								title={t('common.noData', 'No data')}
								message={t('customer.noAddresses', 'No addresses yet')}
							/>
						)}
					</TabPanel>

					{/* ── Documents ──────────────────────────────────── */}
					<TabPanel value={tab} index={3}>
						<Grid container spacing={2}>
							<Grid item xs={12} md={3}>
								<FolderTree
									scopeType="customer"
									scopeId={id}
									selectedFolderId={selectedFolderId ?? undefined}
									onSelectFolder={(f) =>
										setSelectedFolderId((prev) => (prev === f.id ? null : f.id))
									}
									showCreateButton
								/>
							</Grid>
							<Grid item xs={12} md={9}>
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="center"
									mb={2}
								>
									<Typography variant="h6">
										{t('customer.documents', 'Documents')}
										{selectedFolderId && (
											<Chip
												label={t(
													'customer.filteredByFolder',
													'Folder filter active',
												)}
												size="small"
												onDelete={() => setSelectedFolderId(null)}
												sx={{ ml: 1 }}
											/>
										)}
									</Typography>
								</Stack>
								{(() => {
									const filteredDocs = selectedFolderId
										? documents.filter(
												(d) => (d as any).folder_id === selectedFolderId,
											)
										: documents
									return filteredDocs.length > 0 ? (
										<Card>
											<List disablePadding>
												{filteredDocs.map((doc, i) => (
													<React.Fragment key={doc.id}>
														{i > 0 && <Divider />}
														<ListItem
															secondaryAction={
																<IconButton
																	edge="end"
																	onClick={async () => {
																		const res = await documentApi.download(
																			doc.id,
																		)
																		window.open(res.downloadUrl, '_blank')
																	}}
																>
																	<DownloadIcon fontSize="small" />
																</IconButton>
															}
														>
															<ListItemText
																primary={doc.title}
																secondary={[
																	doc.doc_type,
																	doc.confidentiality,
																	(doc as any).folder_name,
																	new Date(doc.created_at).toLocaleDateString(),
																]
																	.filter(Boolean)
																	.join(' · ')}
															/>
															{doc.scan_status && (
																<StatusBadge
																	status={doc.scan_status}
																	variant="outlined"
																	size="small"
																/>
															)}
														</ListItem>
													</React.Fragment>
												))}
											</List>
										</Card>
									) : (
										<EmptyState
											icon={<DownloadIcon />}
											title={t('common.noData', 'No data')}
											message={
												selectedFolderId
													? t(
															'customer.noDocumentsInFolder',
															'No documents in this folder',
														)
													: t('customer.noDocuments', 'No documents yet')
											}
										/>
									)
								})()}
							</Grid>
						</Grid>
					</TabPanel>

					{/* ── Compliance ─────────────────────────────────── */}
					<TabPanel value={tab} index={4}>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
							mb={2}
						>
							<Typography variant="h6">
								{t('customer.communications', 'Communications')}
							</Typography>
							<Button
								variant="contained"
								startIcon={<AddIcon />}
								size="small"
								onClick={() => setCommOpen(true)}
							>
								{t('common.add', 'Add')}
							</Button>
						</Stack>
						{communications.length > 0 ? (
							<Card>
								<List disablePadding>
									{communications.map((comm, i) => (
										<React.Fragment key={comm.id}>
											{i > 0 && <Divider />}
											<ListItem>
												<ListItemText
													primary={comm.summary}
													secondary={[
														comm.direction,
														comm.date_time
															? new Date(comm.date_time).toLocaleString()
															: '',
														comm.participants,
													]
														.filter(Boolean)
														.join(' · ')}
												/>
											</ListItem>
										</React.Fragment>
									))}
								</List>
							</Card>
						) : (
							<EmptyState
								icon={<AddIcon />}
								title={t('common.noData', 'No data')}
								message={t(
									'customer.noCommunications',
									'No communications yet',
								)}
							/>
						)}
					</TabPanel>

					{/* ── Compliance ─────────────────────────────────── */}
					<TabPanel value={tab} index={5}>
						<Typography variant="h6" mb={2}>
							{t('customer.compliance', 'Compliance')}
						</Typography>
						{checklist.length > 0 ? (
							<Card>
								<List disablePadding>
									{checklist.map((item, i) => (
										<React.Fragment key={item.id}>
											{i > 0 && <Divider />}
											<ListItem>
												<ListItemIcon>
													<Checkbox
														edge="start"
														checked={item.is_met}
														onChange={async (e) => {
															await customerApi.toggleChecklistItem(
																id,
																item.id,
																e.target.checked,
															)
															setChecklist((prev) =>
																prev.map((ci) =>
																	ci.id === item.id
																		? { ...ci, is_met: e.target.checked }
																		: ci,
																),
															)
														}}
													/>
												</ListItemIcon>
												<ListItemText primary={item.label} />
											</ListItem>
										</React.Fragment>
									))}
								</List>
							</Card>
						) : (
							<EmptyState
								icon={<AddIcon />}
								title={t('common.noData', 'No data')}
								message={t('customer.noChecklist', 'No checklist items')}
							/>
						)}
					</TabPanel>

					{/* ── Financial Summary ──────────────────────────── */}
					<TabPanel value={tab} index={6}>
						<Typography variant="h6" mb={2}>
							{t('customer.financialSummary', 'Financial Summary')}
						</Typography>
						{financialSummary ? (
							<Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
								<KPICard
									title={t('accounting.overdue', 'Overdue')}
									value={`$${financialSummary.overdue?.toLocaleString() || '0'}`}
									color="error.main"
								/>
								<KPICard
									title={t('accounting.totalPaid', 'Total Paid')}
									value={`$${financialSummary.paid?.toLocaleString() || '0'}`}
									color="success.main"
								/>
								<KPICard
									title={t('customer.outstanding', 'Outstanding')}
									value={`$${financialSummary.outstanding?.toLocaleString() || '0'}`}
									color="warning.main"
								/>
							</Stack>
						) : (
							<EmptyState
								icon={<AddIcon />}
								title={t('common.noData', 'No data')}
								message={t('customer.noFinancial', 'No financial data')}
							/>
						)}
					</TabPanel>

					{/* ── Audit ──────────────────────────────────────── */}
					<TabPanel value={tab} index={7}>
						<Typography variant="h6" mb={2}>
							{t('customer.audit', 'Audit')}
						</Typography>
						{auditEvents.length > 0 ? (
							<Card>
								<List disablePadding>
									{auditEvents.map((ev, i) => (
										<React.Fragment key={ev.id}>
											{i > 0 && <Divider />}
											<ListItem>
												<ListItemText
													primary={ev.action}
													secondary={`${ev.actor_name || ev.actor_id} · ${new Date(ev.created_at).toLocaleString()}`}
												/>
											</ListItem>
										</React.Fragment>
									))}
								</List>
							</Card>
						) : (
							<EmptyState
								icon={<AddIcon />}
								title={t('common.noData', 'No data')}
								message={t('customer.noAudit', 'No audit events')}
							/>
						)}
					</TabPanel>
				</Box>

				{/* ---- Insights sidebar ---- */}
				<InsightsRail
					completeness={completenessPercent}
					checklist={checklist.map((c) => ({ label: c.label, done: c.is_met }))}
					insights={
						financialSummary
							? [
									{
										label: t('accounting.overdue', 'Overdue'),
										value: `$${financialSummary.overdue?.toLocaleString() || '0'}`,
										color: 'error.main',
									},
									{
										label: t('accounting.totalPaid', 'Paid'),
										value: `$${financialSummary.paid?.toLocaleString() || '0'}`,
										color: 'success.main',
									},
									{
										label: t('customer.outstanding', 'Outstanding'),
										value: `$${financialSummary.outstanding?.toLocaleString() || '0'}`,
										color: 'warning.main',
									},
								]
							: undefined
					}
				/>
			</Stack>

			{/* ============================================================ */}
			{/*  Drawers                                                     */}
			{/* ============================================================ */}

			{/* Edit Customer */}
			<DrawerForm
				open={editOpen}
				title={`${t('common.edit', 'Edit')} ${t('customer.title', 'Customer')}`}
				onClose={() => setEditOpen(false)}
				onSubmit={handleUpdate}
				loading={saving}
			>
				<Stack spacing={2.5}>
					<TextField
						label={t('customer.name', 'Name')}
						fullWidth
						value={editForm.name}
						onChange={(e) =>
							setEditForm((f) => ({ ...f, name: e.target.value }))
						}
					/>
					<TextField
						label={t('customer.status', 'Status')}
						select
						fullWidth
						value={editForm.status}
						onChange={(e) =>
							setEditForm((f) => ({
								...f,
								status: e.target.value as CustomerStatus,
							}))
						}
					>
						<MenuItem value="Active">{t('common.active', 'Active')}</MenuItem>
						<MenuItem value="Inactive">
							{t('common.inactive', 'Inactive')}
						</MenuItem>
						<MenuItem value="Prospect">
							{t('customer.prospect', 'Prospect')}
						</MenuItem>
					</TextField>
					<TextField
						label={t('customer.nationalId')}
						fullWidth
						required={isIndividual && !editForm.passport_number.trim()}
						value={editForm.national_id}
						onChange={(e) =>
							setEditForm((f) => ({ ...f, national_id: e.target.value }))
						}
						disabled={!isIndividual}
						helperText={
							isIndividual
								? t(
										'customer.identityHint',
										'Provide national ID or passport number',
									)
								: ''
						}
					/>
					<TextField
						label={t('customer.notes', 'Notes')}
						fullWidth
						multiline
						rows={3}
						value={editForm.notes}
						onChange={(e) =>
							setEditForm((f) => ({ ...f, notes: e.target.value }))
						}
					/>
				</Stack>
			</DrawerForm>

			{/* Add/Edit Contact */}
			<DrawerForm
				open={contactOpen}
				title={
					editContact
						? `${t('common.edit', 'Edit')} ${t('customer.contact', 'Contact')}`
						: `${t('common.add', 'Add')} ${t('customer.contact', 'Contact')}`
				}
				onClose={() => {
					setContactOpen(false)
					setEditContact(null)
				}}
				onSubmit={handleAddContact}
				loading={saving}
			>
				<Stack spacing={2.5}>
					<TextField
						label={t('customer.contactName', 'Name')}
						fullWidth
						required
						value={contactForm.name}
						onChange={(e) =>
							setContactForm((f) => ({ ...f, name: e.target.value }))
						}
					/>
					<TextField
						label={t('customer.contactRole', 'Role')}
						select
						fullWidth
						value={contactForm.role_id}
						onChange={(e) =>
							setContactForm((f) => ({ ...f, role_id: e.target.value }))
						}
					>
						<MenuItem value="">
							<em>{t('common.none', 'None')}</em>
						</MenuItem>
						<MenuItem value="Owner">Owner</MenuItem>
						<MenuItem value="Manager">Manager</MenuItem>
						<MenuItem value="Legal Representative">
							Legal Representative
						</MenuItem>
						<MenuItem value="Accountant">Accountant</MenuItem>
						<MenuItem value="Primary Contact">Primary Contact</MenuItem>
						<MenuItem value="Other">Other</MenuItem>
					</TextField>
					<TextField
						label={t('customer.phone', 'Phone')}
						fullWidth
						value={contactForm.phone}
						onChange={(e) =>
							setContactForm((f) => ({ ...f, phone: e.target.value }))
						}
					/>
					<TextField
						label={t('customer.email', 'Email')}
						fullWidth
						value={contactForm.email}
						onChange={(e) =>
							setContactForm((f) => ({ ...f, email: e.target.value }))
						}
					/>
				</Stack>
			</DrawerForm>

			{/* Add/Edit Address */}
			<DrawerForm
				open={addressOpen}
				title={
					editAddress
						? `${t('common.edit', 'Edit')} ${t('customer.address', 'Address')}`
						: `${t('common.add', 'Add')} ${t('customer.address', 'Address')}`
				}
				onClose={() => {
					setAddressOpen(false)
					setEditAddress(null)
				}}
				onSubmit={handleAddAddress}
				loading={saving}
			>
				<Stack spacing={2.5}>
					<TextField
						label={t('customer.addressType', 'Type')}
						select
						fullWidth
						required
						value={addressForm.address_type}
						onChange={(e) =>
							setAddressForm((f) => ({ ...f, address_type: e.target.value }))
						}
					>
						<MenuItem value="Home">Home</MenuItem>
						<MenuItem value="Work">Work</MenuItem>
						<MenuItem value="Mailing">Mailing</MenuItem>
						<MenuItem value="Other">Other</MenuItem>
					</TextField>
					<TextField
						label={t('customer.addressLine1', 'Line 1')}
						fullWidth
						required
						value={addressForm.line1}
						onChange={(e) =>
							setAddressForm((f) => ({ ...f, line1: e.target.value }))
						}
					/>
					<TextField
						label={t('customer.addressLine2', 'Line 2')}
						fullWidth
						value={addressForm.line2}
						onChange={(e) =>
							setAddressForm((f) => ({ ...f, line2: e.target.value }))
						}
					/>
					<TextField
						label={t('customer.city', 'City')}
						fullWidth
						value={addressForm.city}
						onChange={(e) =>
							setAddressForm((f) => ({ ...f, city: e.target.value }))
						}
					/>
					<TextField
						label={t('customer.state', 'State')}
						fullWidth
						value={addressForm.state}
						onChange={(e) =>
							setAddressForm((f) => ({ ...f, state: e.target.value }))
						}
					/>
					<TextField
						label={t('customer.postalCode', 'Postal Code')}
						fullWidth
						value={addressForm.postal_code}
						onChange={(e) =>
							setAddressForm((f) => ({ ...f, postal_code: e.target.value }))
						}
					/>
					<TextField
						label={t('customer.country', 'Country')}
						fullWidth
						value={addressForm.country}
						onChange={(e) =>
							setAddressForm((f) => ({ ...f, country: e.target.value }))
						}
					/>
					<Stack direction="row" alignItems="center" spacing={1}>
						<Checkbox
							checked={addressForm.is_primary}
							onChange={(e) =>
								setAddressForm((f) => ({ ...f, is_primary: e.target.checked }))
							}
						/>
						<Typography variant="body2">
							{t('customer.isPrimary', 'Primary address')}
						</Typography>
					</Stack>
				</Stack>
			</DrawerForm>

			{/* Add Communication */}
			<DrawerForm
				open={commOpen}
				title={`${t('common.add', 'Add')} ${t('customer.communication', 'Communication')}`}
				onClose={() => setCommOpen(false)}
				onSubmit={handleCreateCommunication}
				loading={saving}
			>
				<Stack spacing={2.5}>
					<TextField
						label={t('case.direction', 'Direction')}
						select
						fullWidth
						required
						value={commForm.direction}
						onChange={(e) =>
							setCommForm((prev) => ({
								...prev,
								direction: e.target.value as 'Inbound' | 'Outbound',
							}))
						}
					>
						<MenuItem value="Inbound">{t('case.inbound', 'Inbound')}</MenuItem>
						<MenuItem value="Outbound">
							{t('case.outbound', 'Outbound')}
						</MenuItem>
					</TextField>
					<TextField
						label={t('case.commType', 'Type')}
						select
						fullWidth
						required
						value={commForm.typeId}
						onChange={(e) =>
							setCommForm((prev) => ({ ...prev, typeId: e.target.value }))
						}
					>
						{commTypes.map((type) => (
							<MenuItem key={type.id} value={type.id}>
								{type.label_en}
							</MenuItem>
						))}
					</TextField>
					<TextField
						label={t('case.dateTime', 'Date & time')}
						type="datetime-local"
						fullWidth
						required
						InputLabelProps={{ shrink: true }}
						value={commForm.dateTime}
						onChange={(e) =>
							setCommForm((prev) => ({ ...prev, dateTime: e.target.value }))
						}
					/>
					<TextField
						label={t('case.summary', 'Summary')}
						fullWidth
						multiline
						rows={3}
						required
						value={commForm.summary}
						onChange={(e) =>
							setCommForm((prev) => ({ ...prev, summary: e.target.value }))
						}
					/>
					<TextField
						label={t('case.nextSteps', 'Next Steps')}
						fullWidth
						value={commForm.nextSteps}
						onChange={(e) =>
							setCommForm((prev) => ({ ...prev, nextSteps: e.target.value }))
						}
					/>
					<TextField
						label={t('case.participants', 'Participants')}
						fullWidth
						value={commForm.participants}
						onChange={(e) =>
							setCommForm((prev) => ({ ...prev, participants: e.target.value }))
						}
					/>
				</Stack>
			</DrawerForm>
		</Box>
	)
}
