import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { AlertIcon, CheckIcon } from '../ui/Icons';
import { AppointmentDetail } from '../../services/appointments';
import {
  AppointmentRole, CATEGORY_LABELS, ChangeRequest, Hold, canAcknowledge, canDecideChange, canResolveHold, pendingAcknowledgements,
} from '../../utils/jobSafety';
import { PALETTE } from './StatusBits';

interface Props {
  detail: AppointmentDetail;
  role: AppointmentRole | null;
  isOffice: boolean;
  userId: string;
  queuedAckIds: Set<string>;
  onAcknowledge: (holdId: string) => void;
  onResolve: (holdId: string, note: string) => Promise<boolean>;
  onDecide: (requestId: string, approve: boolean, note: string, windowStart?: string, windowEnd?: string) => Promise<boolean>;
}

const time = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function SafetyPanel(props: Props) {
  const { detail } = props;
  const assignments = detail.appointment.appointment_assignments;
  const ackState = pendingAcknowledgements({ holds: detail.holds, acks: detail.acks, assignments });
  const standaloneRequests = detail.changeRequests.filter(c => !c.hold_id && c.status === 'pending');
  if (!detail.holds.length && !standaloneRequests.length) return null;

  // Open or not-fully-acknowledged first.
  const ordered = [...ackState].sort((a, b) => Number(b.hold.status === 'open' || b.pending.length > 0) - Number(a.hold.status === 'open' || a.pending.length > 0));

  return (
    <View style={styles.wrap} accessibilityLiveRegion="assertive">
      {ordered.map(({ hold, acknowledged, pending }) => (
        <HoldCard key={hold.id} {...props} hold={hold} acknowledged={acknowledged} pending={pending}
          request={detail.changeRequests.find(c => c.hold_id === hold.id)} />
      ))}
      {standaloneRequests.map(request => <RequestCard key={request.id} {...props} request={request} />)}
    </View>
  );
}

function HoldCard(props: Props & {
  hold: Hold;
  acknowledged: AppointmentDetail['appointment']['appointment_assignments'];
  pending: AppointmentDetail['appointment']['appointment_assignments'];
  request?: ChangeRequest;
}) {
  const { hold, acknowledged, pending, request, role, isOffice, userId, queuedAckIds, onAcknowledge, detail } = props;
  const open = hold.status === 'open';
  const needsMyAck = canAcknowledge(role) && pending.some(a => a.user_id === userId);
  const queued = queuedAckIds.has(hold.id);
  const total = acknowledged.length + pending.length;
  const ackTime = (uid: string) => detail.acks.find(k => k.hold_id === hold.id && k.user_id === uid)?.acknowledged_at;

  return (
    <View style={[styles.card, open || pending.length ? styles.cardOpen : styles.cardDone]}>
      <View style={styles.headRow}>
        {open || pending.length ? <AlertIcon size={18} /> : <CheckIcon />}
        <Text style={[styles.kind, !(open || pending.length) && { color: PALETTE.ok }]}>
          {open ? 'STOP — ' : ''}{CATEGORY_LABELS[hold.kind].toUpperCase()}
        </Text>
        <Text style={styles.when}>{time(hold.opened_at)}</Text>
      </View>
      <Text style={styles.summary}>“{hold.summary}”</Text>

      {role === 'customer' ? (
        <Text style={styles.customerNote}>
          {open ? 'Sent to your crew and the office. No work will start until the office confirms with you.' : `Resolved: ${hold.resolution_note}`}
          {total > 0 ? `\nAcknowledged by ${acknowledged.length} of ${total} team members.` : ''}
        </Text>
      ) : (
        <>
          <Text style={styles.sectionLabel}>CREW ACKNOWLEDGEMENT {pending.length ? `· ${pending.length} PENDING` : '· COMPLETE'}</Text>
          {[...acknowledged, ...pending].map(a => {
            const at = ackTime(a.user_id);
            return (
              <View key={a.user_id} style={styles.ackRow}>
                <Text style={[styles.ackMark, { color: at ? PALETTE.ok : PALETTE.amber }]}>{at ? '✓' : '…'}</Text>
                <Text style={styles.ackName}>{a.display_name}{a.user_id === userId ? ' (you)' : ''}</Text>
                <Text style={styles.ackRole}>{a.assignment_role}</Text>
                <Text style={[styles.ackTime, !at && { color: PALETTE.amber }]}>{at ? time(at) : 'Waiting'}</Text>
              </View>
            );
          })}
          {total === 0 && <Text style={styles.customerNote}>No arborist or crew assigned yet — whoever is assigned must acknowledge.</Text>}

          {needsMyAck && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Acknowledge this instruction"
              disabled={queued}
              style={[styles.ackButton, queued && { opacity: 0.6 }]}
              onPress={() => onAcknowledge(hold.id)}
            >
              <Text style={styles.ackButtonText}>{queued ? 'Acknowledgement queued — sending when online' : 'I have read this — acknowledge'}</Text>
            </TouchableOpacity>
          )}

          {!open && <Text style={styles.resolved}>Resolved: {hold.resolution_note}</Text>}
          {open && request?.status === 'pending' && canDecideChange(role, isOffice, request.kind) && <DecisionForm {...props} request={request} />}
          {open && !request && canResolveHold(role, isOffice) && <ResolveForm {...props} />}
          {open && !canResolveHold(role, isOffice) && (
            <Text style={styles.customerNote}>Waiting for the office to confirm with the customer. Do not start this work.</Text>
          )}
        </>
      )}
    </View>
  );
}

function RequestCard(props: Props & { request: ChangeRequest }) {
  const { request, role, isOffice } = props;
  return (
    <View style={[styles.card, styles.cardPending]}>
      <View style={styles.headRow}>
        <Text style={[styles.kind, { color: PALETTE.amber }]}>{CATEGORY_LABELS.reschedule.toUpperCase()}</Text>
        <Text style={styles.when}>{time(request.created_at)}</Text>
      </View>
      <Text style={styles.summary}>“{request.details}”</Text>
      <Text style={styles.customerNote}>
        {role === 'customer' ? 'The office will confirm a new time. Your appointment stays as scheduled until then.' : 'Awaiting an office decision. The schedule has not changed.'}
      </Text>
      {canDecideChange(role, isOffice, request.kind) && <DecisionForm {...props} request={request} />}
    </View>
  );
}

function ResolveForm({ hold, onResolve }: Props & { hold: Hold }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.form}>
      <TextInput style={styles.input} placeholder="How was this confirmed with the customer?" placeholderTextColor={PALETTE.faint}
        value={note} onChangeText={setNote} multiline accessibilityLabel="Resolution note" />
      <TouchableOpacity accessibilityRole="button" disabled={!note.trim() || busy} style={[styles.primary, (!note.trim() || busy) && styles.disabled]}
        onPress={async () => { setBusy(true); try { if (await onResolve(hold.id, note.trim())) setNote(''); } finally { setBusy(false); } }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Mark resolved</Text>}
      </TouchableOpacity>
    </View>
  );
}

function DecisionForm({ request, onDecide }: Props & { request: ChangeRequest }) {
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const isReschedule = request.kind === 'reschedule';
  const toIso = (d: string, t: string) => {
    const parsed = new Date(`${d}T${t}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };
  const windowStart = isReschedule ? toIso(date, start) : null;
  const windowEnd = isReschedule ? toIso(date, end) : null;
  const windowValid = !isReschedule || (!!windowStart && !!windowEnd && windowEnd > windowStart);

  const decide = async (approve: boolean) => {
    setBusy(true);
    try { await onDecide(request.id, approve, note.trim(), windowStart ?? undefined, windowEnd ?? undefined); } finally { setBusy(false); }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.sectionLabel}>DECISION (SHARED WITH THE CUSTOMER)</Text>
      {isReschedule && (
        <View style={styles.windowRow}>
          <TextInput style={[styles.input, { flex: 1.4 }]} placeholder="YYYY-MM-DD" placeholderTextColor={PALETTE.faint} value={date} onChangeText={setDate} accessibilityLabel="New date" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="09:00" placeholderTextColor={PALETTE.faint} value={start} onChangeText={setStart} accessibilityLabel="Window start" />
          <TextInput style={styles.input} placeholder="11:00" placeholderTextColor={PALETTE.faint} value={end} onChangeText={setEnd} accessibilityLabel="Window end" />
        </View>
      )}
      <TextInput style={styles.input} placeholder={request.kind === 'scope_change' ? 'e.g. Oak by the driveway removed from scope' : 'Note to customer'}
        placeholderTextColor={PALETTE.faint} value={note} onChangeText={setNote} multiline accessibilityLabel="Decision note" />
      <View style={styles.windowRow}>
        <TouchableOpacity accessibilityRole="button" disabled={!note.trim() || busy} style={[styles.secondary, (!note.trim() || busy) && styles.disabled]} onPress={() => decide(false)}>
          <Text style={styles.secondaryText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={!note.trim() || !windowValid || busy} style={[styles.primary, { flex: 1 }, (!note.trim() || !windowValid || busy) && styles.disabled]} onPress={() => decide(true)}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Approve {request.kind === 'reschedule' ? 'new time' : request.kind === 'cancellation' ? 'cancellation' : 'scope change'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 8 },
  cardOpen: { backgroundColor: PALETTE.dangerBg, borderColor: PALETTE.dangerBorder },
  cardDone: { backgroundColor: PALETTE.card, borderColor: PALETTE.border },
  cardPending: { backgroundColor: PALETTE.amberBg, borderColor: 'rgba(212,160,23,0.45)' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kind: { color: PALETTE.danger, fontWeight: '800', fontSize: 12, letterSpacing: 1, flex: 1 },
  when: { color: PALETTE.faint, fontSize: 11 },
  summary: { color: '#fff', fontSize: 16, fontWeight: '600', lineHeight: 22 },
  customerNote: { color: PALETTE.muted, fontSize: 13, lineHeight: 19 },
  sectionLabel: { color: PALETTE.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ackMark: { width: 16, fontWeight: '800', fontSize: 15 },
  ackName: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  ackRole: { color: PALETTE.faint, fontSize: 12, textTransform: 'capitalize' },
  ackTime: { color: PALETTE.muted, fontSize: 12, minWidth: 92, textAlign: 'right' },
  ackButton: { marginTop: 6, backgroundColor: PALETTE.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ackButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resolved: { color: PALETTE.ok, fontSize: 13, fontWeight: '600' },
  form: { gap: 8, marginTop: 6 },
  windowRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, color: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: PALETTE.border },
  primary: { backgroundColor: '#3E7D34', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: PALETTE.border, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
