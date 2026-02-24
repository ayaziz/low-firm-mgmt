'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Download as DownloadIcon } from '@mui/icons-material';
import { customerApi, documentApi, auditApi } from '@/api';
import type { Customer, Contact, Address, Document as Doc, AuditEvent } from '@/types';

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box py={2}>{children}</Box> : null;
}

export default function CustomerDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer] = useState<(Customer & { contacts: Contact[]; addresses: Address[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Contact dialog
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', contact_role: '', phone: '', email: '' });

  // Address dialog
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressForm, setAddressForm] = useState({ address_type: '', line1: '', line2: '', city: '', country: '' });

  // New tab data
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [checklist, setChecklist] = useState<Array<{ id: string; label: string; is_met: boolean }>>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [financialSummary, setFinancialSummary] = useState<{ totalInvoiced: number; totalPaid: number; outstanding: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, docs, complianceRes, auditRes, finRes] = await Promise.all([
        customerApi.getById(id),
        documentApi.list({ customerId: id, limit: 100 }).catch(() => ({ data: [] })),
        customerApi.getChecklist(id).catch(() => ({ items: [] })),
        auditApi.getByEntity('Customer', id).catch(() => ({ data: [] })),
        customerApi.getFinancialSummary(id).catch(() => null),
      ]);
      setCustomer(c);
      setEditForm({ full_name: c.full_name, notes: c.notes || '' });
      setDocuments(docs.data);
      setChecklist(complianceRes.items);
      setAuditEvents(auditRes.data);
      setFinancialSummary(finRes);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await customerApi.update(id, { ...editForm, row_version: customer.row_version });
      await load();
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async () => {
    setSaving(true);
    try {
      await customerApi.addContact(id, contactForm);
      setContactOpen(false);
      setContactForm({ name: '', contact_role: '', phone: '', email: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    await customerApi.deleteContact(id, contactId);
    load();
  };

  const handleAddAddress = async () => {
    setSaving(true);
    try {
      await customerApi.addAddress(id, addressForm);
      setAddressOpen(false);
      setAddressForm({ address_type: '', line1: '', line2: '', city: '', country: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    await customerApi.deleteAddress(id, addressId);
    load();
  };

  if (loading || !customer) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            {customer.full_name}
          </Typography>
          <Stack direction="row" spacing={1} mt={0.5}>
            <Chip label={customer.customer_type} size="small" />
            <Typography variant="body2" color="text.secondary" fontFamily="monospace">
              {customer.national_id}
            </Typography>
          </Stack>
        </Box>
        <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
          {t('common.edit')}
        </Button>
      </Stack>

      <Divider />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1 }} variant="scrollable" scrollButtons="auto">
        <Tab label={t('customer.overview')} />
        <Tab label={t('customer.contacts')} />
        <Tab label={t('customer.addresses')} />
        <Tab label={`${t('customer.documents')} (${documents.length})`} />
        <Tab label={t('customer.compliance')} />
        <Tab label={t('customer.financialSummary')} />
        <Tab label={t('customer.audit')} />
      </Tabs>

      {/* Overview Tab */}
      <TabPanel value={tab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('customer.details')}
                </Typography>
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('customer.status')}</Typography>
                    <Typography>{customer.status}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('customer.notes')}</Typography>
                    <Typography>{customer.notes || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('common.createdAt')}</Typography>
                    <Typography>{new Date(customer.created_at).toLocaleDateString()}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Contacts Tab */}
      <TabPanel value={tab} index={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{t('customer.contacts')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setContactOpen(true)} size="small">
            {t('common.add')}
          </Button>
        </Stack>
        {customer.contacts && customer.contacts.length > 0 ? (
          <Card>
            <List disablePadding>
              {customer.contacts.map((c: Contact, i: number) => (
                <React.Fragment key={c.id}>
                  {i > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <IconButton edge="end" onClick={() => handleDeleteContact(c.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={c.name}
                      secondary={`${c.contact_role || ''} • ${c.phone || ''} • ${c.email || ''}`}
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('common.noData')}
          </Typography>
        )}
      </TabPanel>

      {/* Addresses Tab */}
      <TabPanel value={tab} index={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{t('customer.addresses')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddressOpen(true)} size="small">
            {t('common.add')}
          </Button>
        </Stack>
        {customer.addresses && customer.addresses.length > 0 ? (
          <Grid container spacing={2}>
            {customer.addresses.map((a: Address) => (
              <Grid item xs={12} sm={6} key={a.id}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2">{a.address_type}</Typography>
                      <IconButton size="small" onClick={() => handleDeleteAddress(a.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Typography variant="body2">{a.line1}</Typography>
                    {a.line2 && <Typography variant="body2">{a.line2}</Typography>}
                    <Typography variant="body2">{a.city}, {a.country}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('common.noData')}
          </Typography>
        )}
      </TabPanel>

      {/* Documents Tab */}
      <TabPanel value={tab} index={3}>
        <Typography variant="h6" mb={2}>{t('customer.documents')}</Typography>
        {documents.length > 0 ? (
          <Card>
            <List disablePadding>
              {documents.map((doc, i) => (
                <React.Fragment key={doc.id}>
                  {i > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <IconButton edge="end" onClick={async () => {
                        const res = await documentApi.download(doc.id);
                        window.open(res.downloadUrl, '_blank');
                      }}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={doc.title}
                      secondary={`${doc.doc_type || ''} • ${doc.confidentiality || ''} • ${new Date(doc.created_at).toLocaleDateString()}`}
                    />
                    <Chip label={doc.scan_status} size="small" variant="outlined" sx={{ mr: 1 }} />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : (
          <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>
        )}
      </TabPanel>

      {/* Compliance Checklist Tab */}
      <TabPanel value={tab} index={4}>
        <Typography variant="h6" mb={2}>{t('customer.compliance')}</Typography>
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
                          await customerApi.toggleChecklistItem(id, item.id, e.target.checked);
                          setChecklist(prev => prev.map(ci => ci.id === item.id ? { ...ci, is_met: e.target.checked } : ci));
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
          <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>
        )}
      </TabPanel>

      {/* Financial Summary Tab */}
      <TabPanel value={tab} index={5}>
        <Typography variant="h6" mb={2}>{t('customer.financialSummary')}</Typography>
        {financialSummary ? (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">{t('accounting.totalInvoiced') || 'Total Invoiced'}</Typography>
                  <Typography variant="h5" fontWeight={700}>{financialSummary.totalInvoiced.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">{t('accounting.totalPaid') || 'Total Paid'}</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">{financialSummary.totalPaid.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">{t('customer.outstanding')}</Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">{financialSummary.outstanding.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>
        )}
      </TabPanel>

      {/* Audit Tab */}
      <TabPanel value={tab} index={6}>
        <Typography variant="h6" mb={2}>{t('customer.audit')}</Typography>
        {auditEvents.length > 0 ? (
          <Card>
            <List disablePadding>
              {auditEvents.map((ev, i) => (
                <React.Fragment key={ev.id}>
                  {i > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={ev.action}
                      secondary={`${ev.actor_name || ev.actor_id} • ${new Date(ev.created_at).toLocaleString()}`}
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : (
          <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>
        )}
      </TabPanel>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.edit')} {t('customer.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={t('customer.name')} fullWidth value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            <TextField label={t('customer.notes')} fullWidth multiline rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleUpdate} disabled={saving}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onClose={() => setContactOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.add')} {t('customer.contacts')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={t('customer.name')} fullWidth value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} />
            <TextField label={t('customer.contactRole')} fullWidth value={contactForm.contact_role} onChange={e => setContactForm(f => ({ ...f, contact_role: e.target.value }))} />
            <TextField label={t('customer.phone')} fullWidth value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} />
            <TextField label={t('customer.email')} fullWidth value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddContact} disabled={saving || !contactForm.name}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Address Dialog */}
      <Dialog open={addressOpen} onClose={() => setAddressOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.add')} {t('customer.addresses')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={t('customer.addressLabel')} fullWidth value={addressForm.address_type} onChange={e => setAddressForm(f => ({ ...f, address_type: e.target.value }))} />
            <TextField label={t('customer.addressLine1')} fullWidth value={addressForm.line1} onChange={e => setAddressForm(f => ({ ...f, line1: e.target.value }))} />
            <TextField label={t('customer.addressLine2')} fullWidth value={addressForm.line2} onChange={e => setAddressForm(f => ({ ...f, line2: e.target.value }))} />
            <TextField label={t('customer.city')} fullWidth value={addressForm.city} onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))} />
            <TextField label={t('customer.country')} fullWidth value={addressForm.country} onChange={e => setAddressForm(f => ({ ...f, country: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddressOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddAddress} disabled={saving || !addressForm.address_type || !addressForm.line1}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
