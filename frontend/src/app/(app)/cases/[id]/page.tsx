'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
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
  ListItemText,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Download as DownloadIcon } from '@mui/icons-material';
import { caseApi, documentApi, auditApi, accountingApi, adminApi } from '@/api';
import type { Case, Task, Session, Filing, Note, Communication, CompletenessResult, Document as Doc, AuditEvent, Invoice, MasterDataItem } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CAPABILITIES } from '@/auth/capabilities';
import { useAuth } from '@/context/AuthContext';

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box py={2}>{children}</Box> : null;
}

const STATE_COLORS: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  Intake: 'default', Open: 'info', Active: 'primary', Pending: 'warning', Closed: 'success', Archived: 'default',
};

const TRANSITIONS: Record<string, string[]> = {
  Intake: ['Open'],
  Open: ['Active'],
  Active: ['Pending', 'Closed'],
  Pending: ['Active', 'Closed'],
  Closed: ['Archived'],
};

export default function CaseDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

  const [cs, setCs] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [completeness, setCompleteness] = useState<CompletenessResult | null>(null);

  // Sub-entities
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);
  const [memberships, setMemberships] = useState<Array<{ userId: string; role: string; displayName: string }>>([]);
  const [parties, setParties] = useState<Array<{ id: string; party_id: string; role_in_case: string; party_name: string }>>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // Dialogs
  const [taskOpen, setTaskOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [filingOpen, setFilingOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '' });
  const [sessionForm, setSessionForm] = useState({ title: '', typeId: '', startDateTime: '', endDateTime: '', location: '' });
  const [filingForm, setFilingForm] = useState({ typeId: '', filedDate: '', notes: '' });
  const [noteForm, setNoteForm] = useState({ content: '' });
  const [commForm, setCommForm] = useState({ direction: 'Inbound' as 'Inbound' | 'Outbound', typeId: '', dateTime: '', summary: '' });

  // Master data for dropdowns
  const [sessionTypes, setSessionTypes] = useState<MasterDataItem[]>([]);
  const [filingTypes, setFilingTypes] = useState<MasterDataItem[]>([]);
  const [commTypes, setCommTypes] = useState<MasterDataItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caseData, comp, taskRes, sessRes, filRes, noteRes, commRes, memberRes, partyRes, docRes, invRes, auditRes] = await Promise.all([
        caseApi.getById(id),
        caseApi.getCompleteness(id).catch(() => null),
        caseApi.listTasks(id).catch(() => ({ data: [] })),
        caseApi.listSessions(id).catch(() => ({ data: [] })),
        caseApi.listFilings(id).catch(() => ({ data: [] })),
        caseApi.listNotes(id).catch(() => ({ data: [] })),
        caseApi.listCommunications(id).catch(() => ({ data: [] })),
        caseApi.listMemberships(id).catch(() => []),
        caseApi.listParties(id).catch(() => []),
        documentApi.list({ caseId: id, limit: 100 }).catch(() => ({ data: [] })),
        accountingApi.listInvoices({ caseId: id }).catch(() => ({ data: [] })),
        auditApi.getByEntity('Case', id).catch(() => ({ data: [] })),
      ]);
      setCs(caseData);
      setCompleteness(comp);
      // Sub-entity list endpoints return raw arrays, not { data: [] }
      setTasks(Array.isArray(taskRes) ? taskRes : taskRes.data ?? []);
      setSessions(Array.isArray(sessRes) ? sessRes : sessRes.data ?? []);
      setFilings(Array.isArray(filRes) ? filRes : filRes.data ?? []);
      setNotes(Array.isArray(noteRes) ? noteRes : noteRes.data ?? []);
      setComms(Array.isArray(commRes) ? commRes : commRes.data ?? []);
      setMemberships(Array.isArray(memberRes) ? memberRes : []);
      setParties(Array.isArray(partyRes) ? partyRes : []);
      setDocuments(Array.isArray(docRes) ? docRes : docRes.data ?? []);
      setInvoices(Array.isArray(invRes) ? invRes : invRes.data ?? []);
      setAuditEvents(Array.isArray(auditRes) ? auditRes : auditRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Load master data for dropdowns
  useEffect(() => {
    Promise.all([
      adminApi.listMasterData('sessionType').catch(() => []),
      adminApi.listMasterData('filingType').catch(() => []),
      adminApi.listMasterData('communicationType').catch(() => []),
    ]).then(([st, ft, ct]) => {
      setSessionTypes(st.filter(i => i.is_active));
      setFilingTypes(ft.filter(i => i.is_active));
      setCommTypes(ct.filter(i => i.is_active));
    });
  }, []);

  const handleTransition = async (newState: string) => {
    if (!cs) return;
    await caseApi.transition(id, newState, cs.row_version);
    load();
  };

  const handleCreateTask = async () => {
    setSaving(true);
    try {
      await caseApi.createTask(id, {
        title: taskForm.title,
        description: taskForm.description || undefined,
        assigneeUserId: user?.id,
        dueDate: taskForm.dueDate || undefined,
      } as any);
      setTaskOpen(false);
      setTaskForm({ title: '', description: '', dueDate: '' });
      const res = await caseApi.listTasks(id);
      setTasks(res.data);
    } finally { setSaving(false); }
  };

  const handleCreateSession = async () => {
    setSaving(true);
    try {
      await caseApi.createSession(id, {
        title: sessionForm.title,
        typeId: sessionForm.typeId,
        startDateTime: sessionForm.startDateTime ? new Date(sessionForm.startDateTime).toISOString() : undefined,
        endDateTime: sessionForm.endDateTime ? new Date(sessionForm.endDateTime).toISOString() : undefined,
        location: sessionForm.location || undefined,
      } as any);
      setSessionOpen(false);
      setSessionForm({ title: '', typeId: '', startDateTime: '', endDateTime: '', location: '' });
      const res = await caseApi.listSessions(id);
      setSessions(res.data);
    } finally { setSaving(false); }
  };

  const handleCreateFiling = async () => {
    setSaving(true);
    try {
      await caseApi.createFiling(id, {
        typeId: filingForm.typeId,
        filedDate: filingForm.filedDate || undefined,
        notes: filingForm.notes || undefined,
      } as any);
      setFilingOpen(false);
      setFilingForm({ typeId: '', filedDate: '', notes: '' });
      const res = await caseApi.listFilings(id);
      setFilings(res.data);
    } finally { setSaving(false); }
  };

  const handleCreateNote = async () => {
    setSaving(true);
    try {
      await caseApi.createNote(id, noteForm.content);
      setNoteOpen(false);
      setNoteForm({ content: '' });
      const res = await caseApi.listNotes(id);
      setNotes(res.data);
    } finally { setSaving(false); }
  };

  const handleCreateComm = async () => {
    setSaving(true);
    try {
      await caseApi.createCommunication(id, {
        typeId: commForm.typeId,
        direction: commForm.direction,
        dateTime: commForm.dateTime ? new Date(commForm.dateTime).toISOString() : new Date().toISOString(),
        summary: commForm.summary || undefined,
      } as any);
      setCommOpen(false);
      setCommForm({ direction: 'Inbound' as 'Inbound' | 'Outbound', typeId: '', dateTime: '', summary: '' });
      const res = await caseApi.listCommunications(id);
      setComms(res.data);
    } finally { setSaving(false); }
  };

  if (loading || !cs) {
    return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  }

  const nextStates = TRANSITIONS[cs.state] || [];

  return (
    <ProtectedRoute requiredRoles={CAPABILITIES.canAccessCaseDetails}>
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={600}>{cs.title}</Typography>
          <Stack direction="row" spacing={1} mt={0.5} alignItems="center">
            <Typography variant="body2" fontFamily="monospace" color="text.secondary">{cs.system_case_ref}</Typography>
            <Chip label={cs.state} size="small" color={STATE_COLORS[cs.state] || 'default'} />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          {nextStates.map(s => (
            <Button key={s} variant="outlined" size="small" onClick={() => handleTransition(s)}>
              → {s}
            </Button>
          ))}
        </Stack>
      </Stack>

      {/* Completeness Bar */}
      {completeness && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="body2" fontWeight={600}>{t('case.completeness')}</Typography>
              <Box sx={{ flexGrow: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={completeness.score}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
              <Typography variant="body2" fontWeight={700}>{completeness.score}%</Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Divider />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1 }} variant="scrollable" scrollButtons="auto">
        <Tab label={t('case.overview')} />
        <Tab label={`${t('case.tasks')} (${tasks.length})`} />
        <Tab label={`${t('case.sessions')} (${sessions.length})`} />
        <Tab label={`${t('case.filings')} (${filings.length})`} />
        <Tab label={`${t('case.notes')} (${notes.length})`} />
        <Tab label={`${t('case.communications')} (${comms.length})`} />
        <Tab label={`${t('case.participants')} (${memberships.length + parties.length})`} />
        <Tab label={`${t('case.documents')} (${documents.length})`} />
        <Tab label={t('case.financialSummary')} />
        <Tab label={t('case.audit')} />
      </Tabs>

      {/* Overview */}
      <TabPanel value={tab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('case.details')}</Typography>
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('case.description')}</Typography>
                    <Typography>{cs.description || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('common.createdAt')}</Typography>
                    <Typography>{new Date(cs.created_at).toLocaleDateString()}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tasks */}
      <TabPanel value={tab} index={1}>
        <Stack direction="row" justifyContent="space-between" mb={2}>
          <Typography variant="h6">{t('case.tasks')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setTaskOpen(true)}>{t('common.add')}</Button>
        </Stack>
        {tasks.length > 0 ? (
          <Card>
            <List disablePadding>
              {tasks.map((tk, i) => (
                <React.Fragment key={tk.id}>
                  {i > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={tk.title}
                      secondary={`${tk.status} ${tk.due_date ? `• Due: ${new Date(tk.due_date).toLocaleDateString()}` : ''}`}
                    />
                    <Chip label={tk.status} size="small" variant="outlined" />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>}
      </TabPanel>

      {/* Sessions */}
      <TabPanel value={tab} index={2}>
        <Stack direction="row" justifyContent="space-between" mb={2}>
          <Typography variant="h6">{t('case.sessions')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setSessionOpen(true)}>{t('common.add')}</Button>
        </Stack>
        {sessions.length > 0 ? (
          <Card>
            <List disablePadding>
              {sessions.map((s, i) => (
                <React.Fragment key={s.id}>
                  {i > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={`${s.session_type} — ${new Date(s.session_date).toLocaleString()} — ${s.location || t('common.noData')}`}
                      secondary={s.notes}
                    />
                    <Chip label={s.status} size="small" variant="outlined" />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>}
      </TabPanel>

      {/* Filings */}
      <TabPanel value={tab} index={3}>
        <Stack direction="row" justifyContent="space-between" mb={2}>
          <Typography variant="h6">{t('case.filings')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setFilingOpen(true)}>{t('common.add')}</Button>
        </Stack>
        {filings.length > 0 ? (
          <Card>
            <List disablePadding>
              {filings.map((f, i) => (
                <React.Fragment key={f.id}>
                  {i > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={f.title || f.filing_type}
                      secondary={`${f.filing_type || ''} • ${f.filed_date ? new Date(f.filed_date).toLocaleDateString() : ''}`}
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>}
      </TabPanel>

      {/* Notes */}
      <TabPanel value={tab} index={4}>
        <Stack direction="row" justifyContent="space-between" mb={2}>
          <Typography variant="h6">{t('case.notes')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setNoteOpen(true)}>{t('common.add')}</Button>
        </Stack>
        {notes.length > 0 ? (
          <Card>
            <List disablePadding>
              {notes.map((n, i) => (
                <React.Fragment key={n.id}>
                  {i > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={n.content}
                      secondary={new Date(n.created_at).toLocaleString()}
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>}
      </TabPanel>

      {/* Communications */}
      <TabPanel value={tab} index={5}>
        <Stack direction="row" justifyContent="space-between" mb={2}>
          <Typography variant="h6">{t('case.communications')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setCommOpen(true)}>{t('common.add')}</Button>
        </Stack>
        {comms.length > 0 ? (
          <Card>
            <List disablePadding>
              {comms.map((c, i) => (
                <React.Fragment key={c.id}>
                  {i > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={c.summary}
                      secondary={`${c.direction} • ${c.comm_type} • ${new Date(c.created_at).toLocaleString()}`}
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>}
      </TabPanel>

      {/* Participants Tab */}
      <TabPanel value={tab} index={6}>
        <Typography variant="h6" mb={2}>{t('case.participants')}</Typography>
        {memberships.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>Team Members</Typography>
            <Card sx={{ mb: 2 }}>
              <List disablePadding>
                {memberships.map((m, i) => (
                  <React.Fragment key={m.userId}>
                    {i > 0 && <Divider />}
                    <ListItem>
                      <ListItemText primary={m.displayName} secondary={m.role} />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </Card>
          </>
        )}
        {parties.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>Case Parties</Typography>
            <Card>
              <List disablePadding>
                {parties.map((p, i) => (
                  <React.Fragment key={p.id}>
                    {i > 0 && <Divider />}
                    <ListItem>
                      <ListItemText primary={p.party_name} secondary={p.role_in_case} />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </Card>
          </>
        )}
        {memberships.length === 0 && parties.length === 0 && (
          <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>
        )}
      </TabPanel>

      {/* Documents Tab */}
      <TabPanel value={tab} index={7}>
        <Typography variant="h6" mb={2}>{t('case.documents')}</Typography>
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

      {/* Financial Summary Tab */}
      <TabPanel value={tab} index={8}>
        <Typography variant="h6" mb={2}>{t('case.financialSummary')}</Typography>
        {invoices.length > 0 ? (
          <Card>
            <List disablePadding>
              {invoices.map((inv, i) => (
                <React.Fragment key={inv.id}>
                  {i > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={`${inv.invoice_number || inv.id} — ${inv.status}`}
                      secondary={`Due: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'} • Total: ${(inv.total_amount ?? 0).toLocaleString()}`}
                    />
                    <Chip label={inv.status} size="small" color={inv.status === 'Paid' ? 'success' : inv.status === 'Voided' ? 'error' : 'default'} />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : (
          <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>
        )}
      </TabPanel>

      {/* Audit Tab */}
      <TabPanel value={tab} index={9}>
        <Typography variant="h6" mb={2}>{t('case.audit')}</Typography>
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

      {/* Task Dialog */}
      <Dialog open={taskOpen} onClose={() => setTaskOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.add')} {t('case.tasks')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={t('case.taskTitle')} fullWidth required value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label={t('case.description')} fullWidth multiline rows={2} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
            <TextField label={t('case.dueDate')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateTask} disabled={saving || !taskForm.title}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Session Dialog */}
      <Dialog open={sessionOpen} onClose={() => setSessionOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.add')} {t('case.sessions')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={t('case.sessionTitle')} fullWidth required value={sessionForm.title} onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label={t('case.sessionType')} select fullWidth required value={sessionForm.typeId} onChange={e => setSessionForm(f => ({ ...f, typeId: e.target.value }))}>
              {sessionTypes.map(st => (<MenuItem key={st.id} value={st.id}>{st.label_en}</MenuItem>))}
            </TextField>
            <TextField label={t('case.startDateTime')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={sessionForm.startDateTime} onChange={e => setSessionForm(f => ({ ...f, startDateTime: e.target.value }))} />
            <TextField label={t('case.endDateTime')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={sessionForm.endDateTime} onChange={e => setSessionForm(f => ({ ...f, endDateTime: e.target.value }))} />
            <TextField label={t('case.location')} fullWidth value={sessionForm.location} onChange={e => setSessionForm(f => ({ ...f, location: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateSession} disabled={saving || !sessionForm.title || !sessionForm.typeId || !sessionForm.startDateTime || !sessionForm.endDateTime}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Filing Dialog */}
      <Dialog open={filingOpen} onClose={() => setFilingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.add')} {t('case.filings')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={t('case.filingType')} select fullWidth required value={filingForm.typeId} onChange={e => setFilingForm(f => ({ ...f, typeId: e.target.value }))}>
              {filingTypes.map(ft => (<MenuItem key={ft.id} value={ft.id}>{ft.label_en}</MenuItem>))}
            </TextField>
            <TextField label={t('case.filingDate')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={filingForm.filedDate} onChange={e => setFilingForm(f => ({ ...f, filedDate: e.target.value }))} />
            <TextField label={t('case.notes')} fullWidth multiline rows={2} value={filingForm.notes} onChange={e => setFilingForm(f => ({ ...f, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilingOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateFiling} disabled={saving || !filingForm.typeId}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteOpen} onClose={() => setNoteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.add')} {t('case.notes')}</DialogTitle>
        <DialogContent>
          <TextField label={t('case.noteContent')} fullWidth multiline rows={4} value={noteForm.content} onChange={e => setNoteForm({ content: e.target.value })} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateNote} disabled={saving || !noteForm.content}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Communication Dialog */}
      <Dialog open={commOpen} onClose={() => setCommOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.add')} {t('case.communications')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={t('case.direction')} select fullWidth required value={commForm.direction} onChange={e => setCommForm(f => ({ ...f, direction: e.target.value as 'Inbound' | 'Outbound' }))}>
              <MenuItem value="Inbound">{t('case.inbound')}</MenuItem>
              <MenuItem value="Outbound">{t('case.outbound')}</MenuItem>
            </TextField>
            <TextField label={t('case.commType')} select fullWidth required value={commForm.typeId} onChange={e => setCommForm(f => ({ ...f, typeId: e.target.value }))}>
              {commTypes.map(ct => (<MenuItem key={ct.id} value={ct.id}>{ct.label_en}</MenuItem>))}
            </TextField>
            <TextField label={t('case.dateTime')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={commForm.dateTime} onChange={e => setCommForm(f => ({ ...f, dateTime: e.target.value }))} />
            <TextField label={t('case.summary')} fullWidth multiline rows={3} value={commForm.summary} onChange={e => setCommForm(f => ({ ...f, summary: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateComm} disabled={saving || !commForm.typeId || !commForm.dateTime}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </ProtectedRoute>
  );
}
