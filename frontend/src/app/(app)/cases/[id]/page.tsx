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
import { caseApi, documentApi, auditApi, accountingApi } from '@/api';
import type { Case, Task, Session, Filing, Note, Communication, CompletenessResult, Document as Doc, AuditEvent, Invoice } from '@/types';

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box py={2}>{children}</Box> : null;
}

const STATE_COLORS: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  Draft: 'default', Open: 'info', InProgress: 'primary', OnHold: 'warning', Closed: 'success', Archived: 'default',
};

const TRANSITIONS: Record<string, string[]> = {
  Draft: ['Open'],
  Open: ['InProgress', 'OnHold', 'Closed'],
  InProgress: ['OnHold', 'Closed'],
  OnHold: ['InProgress'],
  Closed: ['Archived'],
};

export default function CaseDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params.id as string;

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
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '' });
  const [sessionForm, setSessionForm] = useState({ session_date: '', session_type: '', location: '', notes: '' });
  const [filingForm, setFilingForm] = useState({ title: '', filing_type: '', filed_date: '' });
  const [noteForm, setNoteForm] = useState({ content: '' });
  const [commForm, setCommForm] = useState({ direction: 'Inbound' as 'Inbound' | 'Outbound', comm_type: 'Email', summary: '' });

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
      setTasks(taskRes.data);
      setSessions(sessRes.data);
      setFilings(filRes.data);
      setNotes(noteRes.data);
      setComms(commRes.data);
      setMemberships(Array.isArray(memberRes) ? memberRes : []);
      setParties(Array.isArray(partyRes) ? partyRes : []);
      setDocuments(docRes.data);
      setInvoices(invRes.data);
      setAuditEvents(auditRes.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (newState: string) => {
    if (!cs) return;
    await caseApi.transition(id, newState, cs.row_version);
    load();
  };

  const handleCreateTask = async () => {
    setSaving(true);
    try {
      await caseApi.createTask(id, taskForm);
      setTaskOpen(false);
      setTaskForm({ title: '', description: '', due_date: '' });
      const res = await caseApi.listTasks(id);
      setTasks(res.data);
    } finally { setSaving(false); }
  };

  const handleCreateSession = async () => {
    setSaving(true);
    try {
      await caseApi.createSession(id, sessionForm);
      setSessionOpen(false);
      setSessionForm({ session_date: '', session_type: '', location: '', notes: '' });
      const res = await caseApi.listSessions(id);
      setSessions(res.data);
    } finally { setSaving(false); }
  };

  const handleCreateFiling = async () => {
    setSaving(true);
    try {
      await caseApi.createFiling(id, filingForm);
      setFilingOpen(false);
      setFilingForm({ title: '', filing_type: '', filed_date: '' });
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
      await caseApi.createCommunication(id, commForm);
      setCommOpen(false);
      setCommForm({ direction: 'Inbound' as 'Inbound' | 'Outbound', comm_type: 'Email', summary: '' });
      const res = await caseApi.listCommunications(id);
      setComms(res.data);
    } finally { setSaving(false); }
  };

  if (loading || !cs) {
    return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  }

  const nextStates = TRANSITIONS[cs.state] || [];

  return (
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
            <TextField label={t('case.dueDate')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} />
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
            <TextField label={t('case.sessionDate')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={sessionForm.session_date} onChange={e => setSessionForm(f => ({ ...f, session_date: e.target.value }))} />
            <TextField label={t('case.sessionType')} fullWidth required value={sessionForm.session_type} onChange={e => setSessionForm(f => ({ ...f, session_type: e.target.value }))} />
            <TextField label={t('case.location')} fullWidth value={sessionForm.location} onChange={e => setSessionForm(f => ({ ...f, location: e.target.value }))} />
            <TextField label={t('case.notes')} fullWidth multiline rows={2} value={sessionForm.notes} onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateSession} disabled={saving || !sessionForm.session_date || !sessionForm.session_type}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Filing Dialog */}
      <Dialog open={filingOpen} onClose={() => setFilingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('common.add')} {t('case.filings')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={t('case.title')} fullWidth required value={filingForm.title} onChange={e => setFilingForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label={t('case.filingType')} fullWidth value={filingForm.filing_type} onChange={e => setFilingForm(f => ({ ...f, filing_type: e.target.value }))} />
            <TextField label={t('case.filingDate')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={filingForm.filed_date} onChange={e => setFilingForm(f => ({ ...f, filed_date: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilingOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateFiling} disabled={saving || !filingForm.filing_type}>{t('common.save')}</Button>
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
            <TextField label={t('case.direction')} select fullWidth value={commForm.direction} onChange={e => setCommForm(f => ({ ...f, direction: e.target.value as 'Inbound' | 'Outbound' }))}>
              <MenuItem value="Inbound">{t('case.inbound')}</MenuItem>
              <MenuItem value="Outbound">{t('case.outbound')}</MenuItem>
            </TextField>
            <TextField label={t('case.commType')} select fullWidth value={commForm.comm_type} onChange={e => setCommForm(f => ({ ...f, comm_type: e.target.value }))}>
              <MenuItem value="Email">Email</MenuItem>
              <MenuItem value="Phone">Phone</MenuItem>
              <MenuItem value="Meeting">Meeting</MenuItem>
              <MenuItem value="Letter">Letter</MenuItem>
            </TextField>
            <TextField label={t('case.summary')} fullWidth multiline rows={3} value={commForm.summary} onChange={e => setCommForm(f => ({ ...f, summary: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateComm} disabled={saving || !commForm.summary}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
