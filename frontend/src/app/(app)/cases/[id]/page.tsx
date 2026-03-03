'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Card, CardContent, Chip, Divider, Grid,
  IconButton, List, ListItem, ListItemText, MenuItem, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon,
} from '@mui/icons-material';
import { caseApi, documentApi, auditApi, accountingApi, adminApi } from '@/api';
import type {
  Case, Task, Session, Filing, Note, Communication, CompletenessResult,
  Document as Doc, AuditEvent, Invoice, MasterDataItem,
} from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CAPABILITIES } from '@/auth/capabilities';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import DrawerForm from '@/components/common/DrawerForm';
import StatusBadge from '@/components/common/StatusBadge';
import InsightsRail from '@/components/common/InsightsRail';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function CaseDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

  /* ---- core state ---- */
  const [cs, setCs] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [completeness, setCompleteness] = useState<CompletenessResult | null>(null);

  /* ---- sub-entities ---- */
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

  /* ---- drawers ---- */
  const [taskOpen, setTaskOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [filingOpen, setFilingOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ---- forms ---- */
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '' });
  const [sessionForm, setSessionForm] = useState({ title: '', typeId: '', startDateTime: '', endDateTime: '', location: '' });
  const [filingForm, setFilingForm] = useState({ typeId: '', filedDate: '', notes: '' });
  const [noteForm, setNoteForm] = useState({ content: '' });
  const [commForm, setCommForm] = useState({ direction: 'Inbound' as 'Inbound' | 'Outbound', typeId: '', dateTime: '', summary: '' });

  /* ---- confirm transition ---- */
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);

  /* ---- master data ---- */
  const [sessionTypes, setSessionTypes] = useState<MasterDataItem[]>([]);
  const [filingTypes, setFilingTypes] = useState<MasterDataItem[]>([]);
  const [commTypes, setCommTypes] = useState<MasterDataItem[]>([]);

  /* ---- load ---- */
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

  /* master data for dropdowns */
  useEffect(() => {
    Promise.all([
      adminApi.listMasterData('sessionType').catch(() => []),
      adminApi.listMasterData('filingType').catch(() => []),
      adminApi.listMasterData('communicationType').catch(() => []),
    ]).then(([st, ft, ct]) => {
      setSessionTypes((st as MasterDataItem[]).filter((i: MasterDataItem) => i.is_active));
      setFilingTypes((ft as MasterDataItem[]).filter((i: MasterDataItem) => i.is_active));
      setCommTypes((ct as MasterDataItem[]).filter((i: MasterDataItem) => i.is_active));
    });
  }, []);

  /* ---- handlers ---- */
  const handleTransition = async (newState: string) => {
    if (!cs) return;
    await caseApi.transition(id, newState, cs.row_version);
    setTransitionTarget(null);
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
      setTasks(Array.isArray(res) ? res : res.data ?? []);
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
      setSessions(Array.isArray(res) ? res : res.data ?? []);
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
      setFilings(Array.isArray(res) ? res : res.data ?? []);
    } finally { setSaving(false); }
  };

  const handleCreateNote = async () => {
    setSaving(true);
    try {
      await caseApi.createNote(id, noteForm.content);
      setNoteOpen(false);
      setNoteForm({ content: '' });
      const res = await caseApi.listNotes(id);
      setNotes(Array.isArray(res) ? res : res.data ?? []);
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
      setCommForm({ direction: 'Inbound', typeId: '', dateTime: '', summary: '' });
      const res = await caseApi.listCommunications(id);
      setComms(Array.isArray(res) ? res : res.data ?? []);
    } finally { setSaving(false); }
  };

  /* ---- loading ---- */
  if (loading || !cs) return <LoadingSkeleton variant="detail" />;

  const nextStates = TRANSITIONS[cs.state] || [];

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <ProtectedRoute requiredRoles={CAPABILITIES.canAccessCaseDetails}>
      <Box>
        {/* Header */}
        <PageHeader
          title={cs.title}
          subtitle={
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" fontFamily="monospace" color="text.secondary">{cs.system_case_ref}</Typography>
              <StatusBadge status={cs.state} />
            </Stack>
          }
          breadcrumbs={[
            { label: t('nav.cases', 'Cases'), href: '/cases' },
            { label: cs.title },
          ]}
          actions={
            <Stack direction="row" spacing={1}>
              {nextStates.map(s => (
                <Button key={s} variant="outlined" size="small" onClick={() => setTransitionTarget(s)}>
                  &rarr; {s}
                </Button>
              ))}
            </Stack>
          }
        />

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          {/* ---- Main content ---- */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
              <Tab label={t('case.overview', 'Overview')} />
              <Tab label={`${t('case.tasks', 'Tasks')} (${tasks.length})`} />
              <Tab label={`${t('case.sessions', 'Sessions')} (${sessions.length})`} />
              <Tab label={`${t('case.filings', 'Filings')} (${filings.length})`} />
              <Tab label={`${t('case.notes', 'Notes')} (${notes.length})`} />
              <Tab label={`${t('case.communications', 'Communications')} (${comms.length})`} />
              <Tab label={`${t('case.participants', 'Participants')} (${memberships.length + parties.length})`} />
              <Tab label={`${t('case.documents', 'Documents')} (${documents.length})`} />
              <Tab label={t('case.financialSummary', 'Financial')} />
              <Tab label={t('case.audit', 'Audit')} />
            </Tabs>

            {/* ── Overview ──────────────────────────────────── */}
            <TabPanel value={tab} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('case.details', 'Details')}</Typography>
                      <Stack spacing={1.5}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('case.description', 'Description')}</Typography>
                          <Typography variant="body2">{cs.description || '—'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('common.createdAt', 'Created')}</Typography>
                          <Typography variant="body2">{new Date(cs.created_at).toLocaleDateString()}</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            {/* ── Tasks ─────────────────────────────────────── */}
            <TabPanel value={tab} index={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('case.tasks', 'Tasks')}</Typography>
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setTaskOpen(true)}>{t('common.add', 'Add')}</Button>
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
                            secondary={tk.due_date ? `Due: ${new Date(tk.due_date).toLocaleDateString()}` : undefined}
                          />
                          <StatusBadge status={tk.status} size="small" />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Card>
              ) : <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('case.noTasks', 'No tasks yet')} />}
            </TabPanel>

            {/* ── Sessions ──────────────────────────────────── */}
            <TabPanel value={tab} index={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('case.sessions', 'Sessions')}</Typography>
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setSessionOpen(true)}>{t('common.add', 'Add')}</Button>
              </Stack>
              {sessions.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {sessions.map((s, i) => (
                      <React.Fragment key={s.id}>
                        {i > 0 && <Divider />}
                        <ListItem>
                          <ListItemText
                            primary={`${s.session_type} — ${new Date(s.session_date).toLocaleString()}`}
                            secondary={s.location || s.notes}
                          />
                          <StatusBadge status={s.status} size="small" />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Card>
              ) : <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('case.noSessions', 'No sessions yet')} />}
            </TabPanel>

            {/* ── Filings ───────────────────────────────────── */}
            <TabPanel value={tab} index={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('case.filings', 'Filings')}</Typography>
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setFilingOpen(true)}>{t('common.add', 'Add')}</Button>
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
                            secondary={[f.filing_type, f.filed_date ? new Date(f.filed_date).toLocaleDateString() : null].filter(Boolean).join(' · ')}
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Card>
              ) : <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('case.noFilings', 'No filings yet')} />}
            </TabPanel>

            {/* ── Notes ─────────────────────────────────────── */}
            <TabPanel value={tab} index={4}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('case.notes', 'Notes')}</Typography>
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setNoteOpen(true)}>{t('common.add', 'Add')}</Button>
              </Stack>
              {notes.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {notes.map((n, i) => (
                      <React.Fragment key={n.id}>
                        {i > 0 && <Divider />}
                        <ListItem>
                          <ListItemText primary={n.content} secondary={new Date(n.created_at).toLocaleString()} />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Card>
              ) : <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('case.noNotes', 'No notes yet')} />}
            </TabPanel>

            {/* ── Communications ─────────────────────────────── */}
            <TabPanel value={tab} index={5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('case.communications', 'Communications')}</Typography>
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setCommOpen(true)}>{t('common.add', 'Add')}</Button>
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
                            secondary={[c.direction, c.comm_type, new Date(c.created_at).toLocaleString()].filter(Boolean).join(' · ')}
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Card>
              ) : <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('case.noComms', 'No communications yet')} />}
            </TabPanel>

            {/* ── Participants ───────────────────────────────── */}
            <TabPanel value={tab} index={6}>
              <Typography variant="h6" mb={2}>{t('case.participants', 'Participants')}</Typography>
              {memberships.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('case.teamMembers', 'Team Members')}</Typography>
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
                  <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('case.caseParties', 'Case Parties')}</Typography>
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
                <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('case.noParticipants', 'No participants yet')} />
              )}
            </TabPanel>

            {/* ── Documents ─────────────────────────────────── */}
            <TabPanel value={tab} index={7}>
              <Typography variant="h6" mb={2}>{t('case.documents', 'Documents')}</Typography>
              {documents.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {documents.map((doc, i) => (
                      <React.Fragment key={doc.id}>
                        {i > 0 && <Divider />}
                        <ListItem
                          secondaryAction={
                            <IconButton edge="end" onClick={async () => { const res = await documentApi.download(doc.id); window.open(res.downloadUrl, '_blank'); }}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={doc.title}
                            secondary={[doc.doc_type, doc.confidentiality, new Date(doc.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}
                          />
                          {doc.scan_status && <StatusBadge status={doc.scan_status} variant="outlined" size="small" />}
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Card>
              ) : <EmptyState icon={<DownloadIcon />} title={t('common.noData', 'No data')} message={t('case.noDocuments', 'No documents yet')} />}
            </TabPanel>

            {/* ── Financial Summary ─────────────────────────── */}
            <TabPanel value={tab} index={8}>
              <Typography variant="h6" mb={2}>{t('case.financialSummary', 'Financial Summary')}</Typography>
              {invoices.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {invoices.map((inv, i) => (
                      <React.Fragment key={inv.id}>
                        {i > 0 && <Divider />}
                        <ListItem>
                          <ListItemText
                            primary={`${inv.invoice_number || inv.id} — ${inv.status}`}
                            secondary={`Due: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'} · Total: ${(inv.total_amount ?? 0).toLocaleString()}`}
                          />
                          <StatusBadge status={inv.status} size="small" />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Card>
              ) : <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('case.noInvoices', 'No invoices yet')} />}
            </TabPanel>

            {/* ── Audit ─────────────────────────────────────── */}
            <TabPanel value={tab} index={9}>
              <Typography variant="h6" mb={2}>{t('case.audit', 'Audit')}</Typography>
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
              ) : <EmptyState icon={<AddIcon />} title={t('common.noData', 'No data')} message={t('case.noAudit', 'No audit events')} />}
            </TabPanel>
          </Box>

          {/* ---- Insights sidebar ---- */}
          <InsightsRail
            completeness={completeness?.score}
            checklist={(completeness as any)?.items?.map((item: any) => ({ label: item.label, done: item.met })) || []}
          />
        </Stack>

        {/* ============================================================ */}
        {/*  Drawers                                                     */}
        {/* ============================================================ */}

        {/* Task */}
        <DrawerForm open={taskOpen} title={`${t('common.add', 'Add')} ${t('case.task', 'Task')}`} onClose={() => setTaskOpen(false)} onSubmit={handleCreateTask} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.taskTitle', 'Title')} fullWidth required value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label={t('case.description', 'Description')} fullWidth multiline rows={2} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
            <TextField label={t('case.dueDate', 'Due date')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
          </Stack>
        </DrawerForm>

        {/* Session */}
        <DrawerForm open={sessionOpen} title={`${t('common.add', 'Add')} ${t('case.session', 'Session')}`} onClose={() => setSessionOpen(false)} onSubmit={handleCreateSession} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.sessionTitle', 'Title')} fullWidth required value={sessionForm.title} onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label={t('case.sessionType', 'Type')} select fullWidth required value={sessionForm.typeId} onChange={e => setSessionForm(f => ({ ...f, typeId: e.target.value }))}>
              {sessionTypes.map(st => <MenuItem key={st.id} value={st.id}>{st.label_en}</MenuItem>)}
            </TextField>
            <TextField label={t('case.startDateTime', 'Start')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={sessionForm.startDateTime} onChange={e => setSessionForm(f => ({ ...f, startDateTime: e.target.value }))} />
            <TextField label={t('case.endDateTime', 'End')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={sessionForm.endDateTime} onChange={e => setSessionForm(f => ({ ...f, endDateTime: e.target.value }))} />
            <TextField label={t('case.location', 'Location')} fullWidth value={sessionForm.location} onChange={e => setSessionForm(f => ({ ...f, location: e.target.value }))} />
          </Stack>
        </DrawerForm>

        {/* Filing */}
        <DrawerForm open={filingOpen} title={`${t('common.add', 'Add')} ${t('case.filing', 'Filing')}`} onClose={() => setFilingOpen(false)} onSubmit={handleCreateFiling} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.filingType', 'Type')} select fullWidth required value={filingForm.typeId} onChange={e => setFilingForm(f => ({ ...f, typeId: e.target.value }))}>
              {filingTypes.map(ft => <MenuItem key={ft.id} value={ft.id}>{ft.label_en}</MenuItem>)}
            </TextField>
            <TextField label={t('case.filingDate', 'Filed date')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={filingForm.filedDate} onChange={e => setFilingForm(f => ({ ...f, filedDate: e.target.value }))} />
            <TextField label={t('case.notes', 'Notes')} fullWidth multiline rows={2} value={filingForm.notes} onChange={e => setFilingForm(f => ({ ...f, notes: e.target.value }))} />
          </Stack>
        </DrawerForm>

        {/* Note */}
        <DrawerForm open={noteOpen} title={`${t('common.add', 'Add')} ${t('case.note', 'Note')}`} onClose={() => setNoteOpen(false)} onSubmit={handleCreateNote} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.noteContent', 'Content')} fullWidth multiline rows={4} value={noteForm.content} onChange={e => setNoteForm({ content: e.target.value })} />
          </Stack>
        </DrawerForm>

        {/* Communication */}
        <DrawerForm open={commOpen} title={`${t('common.add', 'Add')} ${t('case.communication', 'Communication')}`} onClose={() => setCommOpen(false)} onSubmit={handleCreateComm} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.direction', 'Direction')} select fullWidth required value={commForm.direction} onChange={e => setCommForm(f => ({ ...f, direction: e.target.value as 'Inbound' | 'Outbound' }))}>
              <MenuItem value="Inbound">{t('case.inbound', 'Inbound')}</MenuItem>
              <MenuItem value="Outbound">{t('case.outbound', 'Outbound')}</MenuItem>
            </TextField>
            <TextField label={t('case.commType', 'Type')} select fullWidth required value={commForm.typeId} onChange={e => setCommForm(f => ({ ...f, typeId: e.target.value }))}>
              {commTypes.map(ct => <MenuItem key={ct.id} value={ct.id}>{ct.label_en}</MenuItem>)}
            </TextField>
            <TextField label={t('case.dateTime', 'Date & time')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={commForm.dateTime} onChange={e => setCommForm(f => ({ ...f, dateTime: e.target.value }))} />
            <TextField label={t('case.summary', 'Summary')} fullWidth multiline rows={3} value={commForm.summary} onChange={e => setCommForm(f => ({ ...f, summary: e.target.value }))} />
          </Stack>
        </DrawerForm>

        {/* Transition Confirm */}
        <ConfirmDialog
          open={!!transitionTarget}
          title={t('case.transitionTitle', 'Change case state')}
          message={t('case.transitionMessage', `Move this case to "${transitionTarget}"?`)}
          confirmLabel={transitionTarget || ''}
          variant="warning"
          loading={false}
          onConfirm={() => transitionTarget && handleTransition(transitionTarget)}
          onCancel={() => setTransitionTarget(null)}
        />
      </Box>
    </ProtectedRoute>
  );
}
