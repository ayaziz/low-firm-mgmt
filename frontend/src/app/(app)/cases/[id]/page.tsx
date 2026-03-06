'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Autocomplete, Box, Button, Card, CardContent, Chip, Divider, FormControlLabel, Grid,
  IconButton, List, ListItem, ListItemText, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon, Edit as EditIcon,
} from '@mui/icons-material';
import { caseApi, documentApi, auditApi, accountingApi, adminApi, customerApi, courtApi } from '@/api';
import type {
  Case, Task, Session, Filing, Note, Communication, CompletenessResult,
  Document as Doc, AuditEvent, Invoice, MasterDataItem, UserInfo, Customer, Court,
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
import FolderTree from '@/components/common/FolderTree';
import StatusTimeline from '@/components/common/StatusTimeline';

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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  /* ---- sub-entities ---- */
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);
  const [memberships, setMemberships] = useState<Array<{ id: string; userId: string; role: string; displayName: string }>>([]);
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
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [editMembership, setEditMembership] = useState<{ id: string; userId: string; role: string; displayName: string } | null>(null);
  const [editParty, setEditParty] = useState<{ id: string; party_id: string; role_in_case: string; party_name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  /* ---- forms ---- */
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '', assigneeUserId: '', linkedDocumentIds: [] as string[], estimatedHours: '' });
  const [sessionForm, setSessionForm] = useState({ title: '', typeId: '', startDateTime: '', endDateTime: '', location: '', courtId: '', linkedDocumentIds: [] as string[], isBillable: true, outcomeNotes: '' });
  const [filingForm, setFilingForm] = useState({ typeId: '', filedDate: '', notes: '' });
  const [noteForm, setNoteForm] = useState({ content: '', referencedNoteId: '' });
  const [commForm, setCommForm] = useState({ direction: 'Inbound' as 'Inbound' | 'Outbound', typeId: '', dateTime: '', summary: '' });
  const [membershipForm, setMembershipForm] = useState({ userId: '', role: 'CaseMember' });
  const [partyForm, setPartyForm] = useState({ partyId: '', partyRoleType: 'Customer', notes: '' });

  /* ---- confirm transition ---- */
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);

  /* ---- master data ---- */
  const [sessionTypes, setSessionTypes] = useState<MasterDataItem[]>([]);
  const [filingTypes, setFilingTypes] = useState<MasterDataItem[]>([]);
  const [commTypes, setCommTypes] = useState<MasterDataItem[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);

  /* ---- edit state (null = create mode) ---- */
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editFiling, setEditFiling] = useState<Filing | null>(null);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [editComm, setEditComm] = useState<Communication | null>(null);

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
      adminApi.listUsers().catch(() => ({ data: [] })),
      customerApi.list().catch(() => ({ data: [] })),
      courtApi.list({ limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([st, ft, ct, usersRes, custRes, courtRes]) => {
      setSessionTypes((st as MasterDataItem[]).filter((i: MasterDataItem) => i.is_active));
      setFilingTypes((ft as MasterDataItem[]).filter((i: MasterDataItem) => i.is_active));
      setCommTypes((ct as MasterDataItem[]).filter((i: MasterDataItem) => i.is_active));
      const uList = Array.isArray(usersRes) ? usersRes : (usersRes as any).data ?? [];
      setUsers(uList);
      const cList = Array.isArray(custRes) ? custRes : (custRes as any).data ?? [];
      setCustomers(cList);
      const crList = Array.isArray(courtRes) ? courtRes : (courtRes as any).data ?? [];
      setCourts(crList.filter((c: Court) => c.is_active));
    });
  }, []);

  /* ---- handlers ---- */
  const handleTransition = async (newState: string) => {
    if (!cs) return;
    await caseApi.transition(id, newState, cs.row_version);
    setTransitionTarget(null);
    load();
  };

  /* ---- open helpers ---- */
  const openCreateTask = () => { setEditTask(null); setTaskForm({ title: '', description: '', dueDate: '', assigneeUserId: '', linkedDocumentIds: [], estimatedHours: '' }); setTaskOpen(true); };
  const openEditTask = (tk: Task) => {
    setEditTask(tk);
    setTaskForm({ title: tk.title, description: tk.description || '', dueDate: tk.due_date ? tk.due_date.slice(0, 10) : '', assigneeUserId: (tk as any).assignee_user_id || '', linkedDocumentIds: (tk as any).linked_document_ids || [], estimatedHours: (tk as any).estimated_hours ?? '' });
    setTaskOpen(true);
  };
  const openCreateSession = () => { setEditSession(null); setSessionForm({ title: '', typeId: '', startDateTime: '', endDateTime: '', location: '', courtId: '', linkedDocumentIds: [], isBillable: true, outcomeNotes: '' }); setSessionOpen(true); };
  const openEditSession = (s: Session) => {
    setEditSession(s);
    setSessionForm({
      title: (s as any).title || '',
      typeId: (s as any).type_id || (s as any).typeId || '',
      startDateTime: ((s as any).start_date_time || s.session_date || '').slice(0, 16),
      endDateTime: (s as any).end_date_time ? (s as any).end_date_time.slice(0, 16) : '',
      location: s.location || '',
      courtId: (s as any).court_id || '',
      linkedDocumentIds: (s as any).linked_document_ids || [],
      isBillable: (s as any).is_billable !== false,
      outcomeNotes: (s as any).outcome_notes || '',
    });
    setSessionOpen(true);
  };
  const openCreateFiling = () => { setEditFiling(null); setFilingForm({ typeId: '', filedDate: '', notes: '' }); setFilingOpen(true); };
  const openEditFiling = (f: Filing) => {
    setEditFiling(f);
    setFilingForm({ typeId: (f as any).type_id || (f as any).typeId || '', filedDate: f.filed_date ? f.filed_date.slice(0, 10) : '', notes: (f as any).notes || '' });
    setFilingOpen(true);
  };

  const openCreateNote = () => { setEditNote(null); setNoteForm({ content: '', referencedNoteId: '' }); setNoteOpen(true); };
  const openEditNote = (n: Note) => {
    setEditNote(n);
    setNoteForm({ content: (n as any).body || n.content || '', referencedNoteId: (n as any).referenced_note_id || '' });
    setNoteOpen(true);
  };

  const openCreateComm = () => { setEditComm(null); setCommForm({ direction: 'Inbound', typeId: '', dateTime: '', summary: '' }); setCommOpen(true); };
  const openEditComm = (c: Communication) => {
    setEditComm(c);
    setCommForm({
      direction: c.direction || 'Inbound',
      typeId: (c as any).type_id || '',
      dateTime: ((c as any).date_time || c.comm_date || '').slice(0, 16),
      summary: c.summary || '',
    });
    setCommOpen(true);
  };

  const openCreateMembership = () => { setEditMembership(null); setMembershipForm({ userId: '', role: 'CaseMember' }); setMembershipOpen(true); };
  const openEditMembership = (membership: { id: string; userId: string; role: string; displayName: string }) => {
    setEditMembership(membership);
    setMembershipForm({ userId: membership.userId, role: membership.role });
    setMembershipOpen(true);
  };
  const openCreateParty = () => { setEditParty(null); setPartyForm({ partyId: '', partyRoleType: 'Customer', notes: '' }); setPartyOpen(true); };
  const openEditParty = (party: { id: string; party_id: string; role_in_case: string; party_name: string }) => {
    setEditParty(party);
    setPartyForm({ partyId: party.party_id, partyRoleType: party.role_in_case || 'Customer', notes: '' });
    setPartyOpen(true);
  };

  const handleCreateTask = async () => {
    setSaving(true);
    try {
      if (editTask) {
        await caseApi.updateTask(id, editTask.id, {
          title: taskForm.title,
          description: taskForm.description || undefined,
          assigneeUserId: (taskForm as any).assigneeUserId || undefined,
          dueDate: taskForm.dueDate || undefined,
          linkedDocumentIds: taskForm.linkedDocumentIds.length ? taskForm.linkedDocumentIds : undefined,
          estimatedHours: taskForm.estimatedHours ? Number(taskForm.estimatedHours) : undefined,
        } as any);
      } else {
        await caseApi.createTask(id, {
          title: taskForm.title,
          description: taskForm.description || undefined,
          assigneeUserId: (taskForm as any).assigneeUserId || user?.id,
          dueDate: taskForm.dueDate || undefined,
          linkedDocumentIds: taskForm.linkedDocumentIds.length ? taskForm.linkedDocumentIds : undefined,
          estimatedHours: taskForm.estimatedHours ? Number(taskForm.estimatedHours) : undefined,
        } as any);
      }
      setTaskOpen(false);
      setTaskForm({ title: '', description: '', dueDate: '', assigneeUserId: '', linkedDocumentIds: [], estimatedHours: '' });
      setEditTask(null);
      const res = await caseApi.listTasks(id);
      setTasks(Array.isArray(res) ? res : res.data ?? []);
    } finally { setSaving(false); }
  };

  const handleCreateSession = async () => {
    setSaving(true);
    try {
      if (editSession) {
        const originalStart = ((editSession as any).start_date_time || editSession.session_date || '').slice(0, 16);
        if (sessionForm.startDateTime && sessionForm.startDateTime !== originalStart) {
          await caseApi.rescheduleSession(id, editSession.id, {
            newDateTime: new Date(sessionForm.startDateTime).toISOString(),
            reason: 'Rescheduled via session update',
          });
        }
        await caseApi.updateSession(id, editSession.id, {
          title: sessionForm.title || undefined,
          location: sessionForm.location || undefined,
          linkedDocumentIds: sessionForm.linkedDocumentIds.length ? sessionForm.linkedDocumentIds : undefined,
          outcomeNotes: sessionForm.outcomeNotes || undefined,
        });
      } else {
        await caseApi.createSession(id, { 
          title: sessionForm.title,
          typeId: sessionForm.typeId,
          startDateTime: sessionForm.startDateTime ? new Date(sessionForm.startDateTime).toISOString() : undefined,
          endDateTime: sessionForm.endDateTime ? new Date(sessionForm.endDateTime).toISOString() : undefined,
          location: sessionForm.location || undefined,
          courtId: sessionForm.courtId || undefined,
          linkedDocumentIds: sessionForm.linkedDocumentIds.length ? sessionForm.linkedDocumentIds : undefined,
          isBillable: sessionForm.isBillable,
        } as any);
      }
      setSessionOpen(false);
      setSessionForm({ title: '', typeId: '', startDateTime: '', endDateTime: '', location: '', courtId: '', linkedDocumentIds: [], isBillable: true, outcomeNotes: '' });
      setEditSession(null);
      const res = await caseApi.listSessions(id);
      setSessions(Array.isArray(res) ? res : res.data ?? []);
    } finally { setSaving(false); }
  };

  const handleCreateFiling = async () => {
    setSaving(true);
    try {
      if (editFiling) {
        await caseApi.updateFiling(id, editFiling.id, {
          typeId: filingForm.typeId,
          filedDate: filingForm.filedDate || undefined,
          notes: filingForm.notes || undefined,
        } as any);
      } else {
        await caseApi.createFiling(id, {
          typeId: filingForm.typeId,
          filedDate: filingForm.filedDate || undefined,
          notes: filingForm.notes || undefined,
        } as any);
      }
      setFilingOpen(false);
      setFilingForm({ typeId: '', filedDate: '', notes: '' });
      setEditFiling(null);
      const res = await caseApi.listFilings(id);
      setFilings(Array.isArray(res) ? res : res.data ?? []);
    } finally { setSaving(false); }
  };

  const handleCreateNote = async () => {
    setSaving(true);
    try {
      if (editNote) {
        await caseApi.updateNote(id, editNote.id, { body: noteForm.content, referencedNoteId: noteForm.referencedNoteId || undefined });
      } else {
        await caseApi.createNote(id, noteForm.content, noteForm.referencedNoteId || undefined);
      }
      setNoteOpen(false);
      setNoteForm({ content: '', referencedNoteId: '' });
      setEditNote(null);
      const res = await caseApi.listNotes(id);
      setNotes(Array.isArray(res) ? res : res.data ?? []);
    } finally { setSaving(false); }
  };

  const handleCreateComm = async () => {
    // Validate required fields before submission
    if (!commForm.typeId || !commForm.summary?.trim()) return;
    setSaving(true);
    try {
      if (editComm) {
        await caseApi.updateCommunication(id, editComm.id, {
          typeId: commForm.typeId || undefined,
          direction: commForm.direction,
          dateTime: commForm.dateTime ? new Date(commForm.dateTime).toISOString() : undefined,
          summary: commForm.summary || undefined,
        });
      } else {
        await caseApi.createCommunication(id, {
          typeId: commForm.typeId,
          direction: commForm.direction,
          dateTime: commForm.dateTime ? new Date(commForm.dateTime).toISOString() : new Date().toISOString(),
          summary: commForm.summary,  // send as-is (not || undefined)
        } as any);
      }
      setCommOpen(false);
      setCommForm({ direction: 'Inbound', typeId: '', dateTime: '', summary: '' });
      setEditComm(null);
      const res = await caseApi.listCommunications(id);
      setComms(Array.isArray(res) ? res : res.data ?? []);
    } finally { setSaving(false); }
  };

  const handleCreateMembership = async () => {
    setSaving(true);
    try {
      if (editMembership) {
        await caseApi.updateMembership(id, editMembership.id, membershipForm.role);
      } else {
        await caseApi.addMembership(id, membershipForm.userId, membershipForm.role);
      }
      setMembershipOpen(false);
      setEditMembership(null);
      setMembershipForm({ userId: '', role: 'CaseMember' });
      const res = await caseApi.listMemberships(id);
      setMemberships(Array.isArray(res) ? res : (res as any).data ?? []);
    } finally { setSaving(false); }
  };

  const handleCreateParty = async () => {
    setSaving(true);
    try {
      if (editParty) {
        await caseApi.updateParty(id, editParty.id, { partyRoleType: partyForm.partyRoleType, notes: partyForm.notes || undefined });
      } else {
        await caseApi.addParty(id, { partyId: partyForm.partyId, partyRoleType: partyForm.partyRoleType });
      }
      setPartyOpen(false);
      setEditParty(null);
      setPartyForm({ partyId: '', partyRoleType: 'Customer', notes: '' });
      const res = await caseApi.listParties(id);
      setParties(Array.isArray(res) ? res : (res as any).data ?? []);
    } finally { setSaving(false); }
  };

  const handleRemoveMembership = async (membershipUserId: string) => {
    await caseApi.removeMembership(id, membershipUserId);
    const res = await caseApi.listMemberships(id);
    setMemberships(Array.isArray(res) ? res : (res as any).data ?? []);
  };

  const handleRemoveParty = async (partyLinkId: string) => {
    await caseApi.removeParty(id, partyLinkId);
    const res = await caseApi.listParties(id);
    setParties(Array.isArray(res) ? res : (res as any).data ?? []);
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
              <Tab label={t('case.statusHistory', 'History')} />
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
                        {(cs as any).priority && (cs as any).priority !== 'Normal' && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">{t('case.priority', 'Priority')}</Typography>
                            <Box mt={0.25}><StatusBadge status={(cs as any).priority} /></Box>
                          </Box>
                        )}
                        {(cs as any).risk_level && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">{t('case.riskLevel', 'Risk Level')}</Typography>
                            <Box mt={0.25}><StatusBadge status={(cs as any).risk_level} /></Box>
                          </Box>
                        )}
                        {(cs as any).source && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">{t('case.source', 'Source')}</Typography>
                            <Typography variant="body2">{(cs as any).source}</Typography>
                          </Box>
                        )}
                        {(cs as any).estimated_value != null && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">{t('case.estimatedValue', 'Estimated Value')}</Typography>
                            <Typography variant="body2">{Number((cs as any).estimated_value).toLocaleString()}</Typography>
                          </Box>
                        )}
                        {(cs as any).judgment_date && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">{t('case.judgmentDate', 'Judgment Date')}</Typography>
                            <Typography variant="body2">{new Date((cs as any).judgment_date).toLocaleDateString()}</Typography>
                          </Box>
                        )}
                        {(cs as any).judgment_outcome && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">{t('case.judgmentOutcome', 'Judgment Outcome')}</Typography>
                            <Typography variant="body2">{(cs as any).judgment_outcome}</Typography>
                          </Box>
                        )}
                        {(cs as any).appeal_deadline && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">{t('case.appealDeadline', 'Appeal Deadline')}</Typography>
                            <Typography variant="body2" color="error.main">{new Date((cs as any).appeal_deadline).toLocaleDateString()}</Typography>
                          </Box>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <StatusTimeline entityType="Case" entityId={id} />
                </Grid>
              </Grid>
            </TabPanel>

            {/* ── Tasks ─────────────────────────────────────── */}
            <TabPanel value={tab} index={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('case.tasks', 'Tasks')}</Typography>
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={openCreateTask}>{t('common.add', 'Add')}</Button>
              </Stack>
              {tasks.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {tasks.map((tk, i) => (
                      <React.Fragment key={tk.id}>
                        {i > 0 && <Divider />}
                        <ListItem secondaryAction={
                          <IconButton edge="end" size="small" onClick={() => openEditTask(tk)}><EditIcon fontSize="small" /></IconButton>
                        }>
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
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={openCreateSession}>{t('common.add', 'Add')}</Button>
              </Stack>
              {sessions.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {sessions.map((s, i) => (
                      <React.Fragment key={s.id}>
                        {i > 0 && <Divider />}
                        <ListItem secondaryAction={
                          <IconButton edge="end" size="small" onClick={() => openEditSession(s)}><EditIcon fontSize="small" /></IconButton>
                        }>
                          <ListItemText
                            primary={`${(s as any).title || s.session_type || 'Session'} — ${new Date((s as any).start_date_time || s.session_date).toLocaleString()}`}
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
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={openCreateFiling}>{t('common.add', 'Add')}</Button>
              </Stack>
              {filings.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {filings.map((f, i) => (
                      <React.Fragment key={f.id}>
                        {i > 0 && <Divider />}
                        <ListItem secondaryAction={
                          <IconButton edge="end" size="small" onClick={() => openEditFiling(f)}><EditIcon fontSize="small" /></IconButton>
                        }>
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
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={openCreateNote}>{t('common.add', 'Add')}</Button>
              </Stack>
              {notes.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {notes.map((n, i) => (
                      <React.Fragment key={n.id}>
                        {i > 0 && <Divider />}
                        <ListItem secondaryAction={
                          <IconButton edge="end" size="small" onClick={() => openEditNote(n)}><EditIcon fontSize="small" /></IconButton>
                        }>
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
                <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={openCreateComm}>{t('common.add', 'Add')}</Button>
              </Stack>
              {comms.length > 0 ? (
                <Card>
                  <List disablePadding>
                    {comms.map((c, i) => (
                      <React.Fragment key={c.id}>
                        {i > 0 && <Divider />}
                        <ListItem secondaryAction={
                          <IconButton edge="end" size="small" onClick={() => openEditComm(c)}><EditIcon fontSize="small" /></IconButton>
                        }>
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('case.participants', 'Participants')}</Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateMembership}>{t('case.addMember', 'Add Member')}</Button>
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={openCreateParty}>{t('case.addParty', 'Add Party')}</Button>
                </Stack>
              </Stack>
              {memberships.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('case.teamMembers', 'Team Members')}</Typography>
                  <Card sx={{ mb: 2 }}>
                    <List disablePadding>
                      {memberships.map((m, i) => (
                        <React.Fragment key={m.userId}>
                          {i > 0 && <Divider />}
                          <ListItem secondaryAction={
                            <Stack direction="row" spacing={0.5}>
                              <IconButton size="small" onClick={() => openEditMembership(m)}><EditIcon fontSize="small" /></IconButton>
                              <IconButton size="small" color="error" onClick={() => handleRemoveMembership(m.userId)}><AddIcon fontSize="small" sx={{ transform: 'rotate(45deg)' }} /></IconButton>
                            </Stack>
                          }>
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
                          <ListItem secondaryAction={
                            <Stack direction="row" spacing={0.5}>
                              <IconButton size="small" onClick={() => openEditParty(p)}><EditIcon fontSize="small" /></IconButton>
                              <IconButton size="small" color="error" onClick={() => handleRemoveParty(p.id)}><AddIcon fontSize="small" sx={{ transform: 'rotate(45deg)' }} /></IconButton>
                            </Stack>
                          }>
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
              <Grid container spacing={2}>
                {/* Left: Folder Tree */}
                <Grid item xs={12} md={3}>
                  <FolderTree
                    scopeType="case"
                    scopeId={id}
                    selectedFolderId={selectedFolderId ?? undefined}
                    onSelectFolder={(f) => setSelectedFolderId(prev => (prev === f.id ? null : f.id))}
                    showCreateButton
                  />
                </Grid>
                {/* Right: Document List */}
                <Grid item xs={12} md={9}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      {t('case.documents', 'Documents')}
                      {selectedFolderId && <Chip label={t('case.filteredByFolder', 'Folder filter active')} size="small" onDelete={() => setSelectedFolderId(null)} sx={{ ml: 1 }} />}
                    </Typography>
                  </Stack>
                  {(() => {
                    const filteredDocs = selectedFolderId
                      ? documents.filter(d => (d as any).folder_id === selectedFolderId)
                      : documents;
                    return filteredDocs.length > 0 ? (
                      <Card>
                        <List disablePadding>
                          {filteredDocs.map((doc, i) => (
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
                                  secondary={[doc.doc_type, doc.confidentiality, (doc as any).folder_name, new Date(doc.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}
                                />
                                {doc.scan_status && <StatusBadge status={doc.scan_status} variant="outlined" size="small" />}
                              </ListItem>
                            </React.Fragment>
                          ))}
                        </List>
                      </Card>
                    ) : (
                      <EmptyState icon={<DownloadIcon />} title={t('common.noData', 'No data')} message={selectedFolderId ? t('case.noDocumentsInFolder', 'No documents in this folder') : t('case.noDocuments', 'No documents yet')} />
                    );
                  })()}
                </Grid>
              </Grid>
            </TabPanel>

            {/* ── Status History ─────────────────────────────── */}
            <TabPanel value={tab} index={10}>
              <Typography variant="h6" mb={2}>{t('case.statusHistory', 'Status History')}</Typography>
              <StatusTimeline entityType="Case" entityId={id} />
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
        <DrawerForm open={taskOpen} title={editTask ? `${t('common.edit', 'Edit')} ${t('case.task', 'Task')}` : `${t('common.add', 'Add')} ${t('case.task', 'Task')}`} onClose={() => { setTaskOpen(false); setEditTask(null); }} onSubmit={handleCreateTask} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.taskTitle', 'Title')} fullWidth required value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label={t('case.description', 'Description')} fullWidth multiline rows={2} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
            <TextField label={t('case.assignee', 'Assignee')} select fullWidth value={taskForm.assigneeUserId} onChange={e => setTaskForm(f => ({ ...f, assigneeUserId: e.target.value }))}>
              <MenuItem value=""><em>{t('common.none', 'None')}</em></MenuItem>
              {users.map(u => <MenuItem key={u.id} value={u.id}>{u.displayName || u.email}</MenuItem>)}
            </TextField>
            <TextField label={t('case.dueDate', 'Due date')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
            <TextField label={t('case.estimatedHours', 'Estimated hours')} type="number" fullWidth inputProps={{ min: 0, step: 0.5 }} value={taskForm.estimatedHours} onChange={e => setTaskForm(f => ({ ...f, estimatedHours: e.target.value }))} />
            <Autocomplete
              multiple
              options={documents}
              getOptionLabel={(d: Doc) => d.title || d.id}
              value={documents.filter(d => taskForm.linkedDocumentIds.includes(d.id))}
              onChange={(_, vals) => setTaskForm(f => ({ ...f, linkedDocumentIds: vals.map(v => v.id) }))}
              renderInput={(params) => <TextField {...params} label={t('case.linkedDocuments', 'Linked Documents')} />}
            />
          </Stack>
        </DrawerForm>

        {/* Session */}
        <DrawerForm open={sessionOpen} title={editSession ? `${t('common.edit', 'Edit')} ${t('case.session', 'Session')}` : `${t('common.add', 'Add')} ${t('case.session', 'Session')}`} onClose={() => { setSessionOpen(false); setEditSession(null); }} onSubmit={handleCreateSession} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.sessionTitle', 'Title')} fullWidth required value={sessionForm.title} onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label={t('case.sessionType', 'Type')} select fullWidth required value={sessionForm.typeId} onChange={e => setSessionForm(f => ({ ...f, typeId: e.target.value }))}>
              {sessionTypes.map(st => <MenuItem key={st.id} value={st.id}>{st.label_en}</MenuItem>)}
            </TextField>
            <TextField label={t('case.startDateTime', 'Start')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={sessionForm.startDateTime} onChange={e => setSessionForm(f => ({ ...f, startDateTime: e.target.value }))} />
            <TextField label={t('case.endDateTime', 'End')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} value={sessionForm.endDateTime} onChange={e => setSessionForm(f => ({ ...f, endDateTime: e.target.value }))} />
            <TextField label={t('case.location', 'Location')} fullWidth value={sessionForm.location} onChange={e => setSessionForm(f => ({ ...f, location: e.target.value }))} />
            <TextField label={t('case.court', 'Court')} select fullWidth value={sessionForm.courtId} onChange={e => setSessionForm(f => ({ ...f, courtId: e.target.value }))}>
              <MenuItem value="">{t('common.none', '— None —')}</MenuItem>
              {courts.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <Autocomplete
              multiple
              options={documents}
              getOptionLabel={(d: Doc) => d.title || d.id}
              value={documents.filter(d => sessionForm.linkedDocumentIds.includes(d.id))}
              onChange={(_, vals) => setSessionForm(f => ({ ...f, linkedDocumentIds: vals.map(v => v.id) }))}
              renderInput={(params) => <TextField {...params} label={t('case.linkedDocuments', 'Linked Documents')} />}
            />
            <FormControlLabel
              control={<Switch checked={sessionForm.isBillable} onChange={e => setSessionForm(f => ({ ...f, isBillable: e.target.checked }))} />}
              label={t('case.isBillable', 'Billable Session')}
            />
            <TextField label={t('case.actualOutcome', 'Actual Outcome')} fullWidth multiline rows={2} value={sessionForm.outcomeNotes} onChange={e => setSessionForm(f => ({ ...f, outcomeNotes: e.target.value }))} />
          </Stack>
        </DrawerForm>

        {/* Filing */}
        <DrawerForm open={filingOpen} title={editFiling ? `${t('common.edit', 'Edit')} ${t('case.filing', 'Filing')}` : `${t('common.add', 'Add')} ${t('case.filing', 'Filing')}`} onClose={() => { setFilingOpen(false); setEditFiling(null); }} onSubmit={handleCreateFiling} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.filingType', 'Type')} select fullWidth required value={filingForm.typeId} onChange={e => setFilingForm(f => ({ ...f, typeId: e.target.value }))}>
              {filingTypes.map(ft => <MenuItem key={ft.id} value={ft.id}>{ft.label_en}</MenuItem>)}
            </TextField>
            <TextField label={t('case.filingDate', 'Filed date')} type="date" fullWidth InputLabelProps={{ shrink: true }} value={filingForm.filedDate} onChange={e => setFilingForm(f => ({ ...f, filedDate: e.target.value }))} />
            <TextField label={t('case.notes', 'Notes')} fullWidth multiline rows={2} value={filingForm.notes} onChange={e => setFilingForm(f => ({ ...f, notes: e.target.value }))} />
          </Stack>
        </DrawerForm>

        {/* Note */}
        <DrawerForm open={noteOpen} title={editNote ? `${t('common.edit', 'Edit')} ${t('case.note', 'Note')}` : `${t('common.add', 'Add')} ${t('case.note', 'Note')}`} onClose={() => { setNoteOpen(false); setEditNote(null); }} onSubmit={handleCreateNote} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.noteContent', 'Content')} fullWidth multiline rows={4} value={noteForm.content} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))} />
            <TextField label={t('case.referencedNote', 'Referenced Note')} select fullWidth value={noteForm.referencedNoteId} onChange={e => setNoteForm(f => ({ ...f, referencedNoteId: e.target.value }))}>
              <MenuItem value="">{t('common.none', '— None —')}</MenuItem>
              {notes.filter(n => !editNote || n.id !== editNote.id).map(n => <MenuItem key={n.id} value={n.id}>{(n.content || '').substring(0, 60) || n.id}</MenuItem>)}
            </TextField>
          </Stack>
        </DrawerForm>

        {/* Communication */}
        <DrawerForm open={commOpen} title={editComm ? `${t('common.edit', 'Edit')} ${t('case.communication', 'Communication')}` : `${t('common.add', 'Add')} ${t('case.communication', 'Communication')}`} onClose={() => { setCommOpen(false); setEditComm(null); }} onSubmit={handleCreateComm} loading={saving}>
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

        {/* Membership */}
        <DrawerForm open={membershipOpen} title={editMembership ? `${t('common.edit', 'Edit')} ${t('case.teamMember', 'Team Member')}` : `${t('common.add', 'Add')} ${t('case.teamMember', 'Team Member')}`} onClose={() => { setMembershipOpen(false); setEditMembership(null); }} onSubmit={handleCreateMembership} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.user', 'User')} select fullWidth required disabled={!!editMembership} value={membershipForm.userId} onChange={e => setMembershipForm(f => ({ ...f, userId: e.target.value }))}>
              {users.map(u => <MenuItem key={u.id} value={u.id}>{u.displayName || u.email}</MenuItem>)}
            </TextField>
            <TextField label={t('case.role', 'Role')} select fullWidth required value={membershipForm.role} onChange={e => setMembershipForm(f => ({ ...f, role: e.target.value }))}>
              <MenuItem value="CaseOwner">{t('case.caseOwner', 'Case Owner')}</MenuItem>
              <MenuItem value="CaseMember">{t('case.caseMember', 'Case Member')}</MenuItem>
              <MenuItem value="ReadOnly">{t('case.readOnly', 'Read Only')}</MenuItem>
            </TextField>
          </Stack>
        </DrawerForm>

        {/* Case Party */}
        <DrawerForm open={partyOpen} title={editParty ? `${t('common.edit', 'Edit')} ${t('case.caseParty', 'Case Party')}` : `${t('common.add', 'Add')} ${t('case.caseParty', 'Case Party')}`} onClose={() => { setPartyOpen(false); setEditParty(null); }} onSubmit={handleCreateParty} loading={saving}>
          <Stack spacing={2.5}>
            <TextField label={t('case.party', 'Party (Customer)')} select fullWidth required disabled={!!editParty} value={partyForm.partyId} onChange={e => setPartyForm(f => ({ ...f, partyId: e.target.value }))}>
              {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField label={t('case.partyRole', 'Party Role')} select fullWidth required value={partyForm.partyRoleType} onChange={e => setPartyForm(f => ({ ...f, partyRoleType: e.target.value }))}>
              <MenuItem value="Customer">{t('case.customer', 'Customer')}</MenuItem>
              <MenuItem value="Opposing">{t('case.opposing', 'Opposing')}</MenuItem>
              <MenuItem value="ExternalCounsel">{t('case.externalCounsel', 'External Counsel')}</MenuItem>
              <MenuItem value="Other">{t('common.other', 'Other')}</MenuItem>
            </TextField>
            <TextField label={t('case.notes', 'Notes')} fullWidth multiline rows={2} value={partyForm.notes} onChange={e => setPartyForm(f => ({ ...f, notes: e.target.value }))} />
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
