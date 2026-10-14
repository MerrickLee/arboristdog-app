import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { COLORS } from '../../../constants/theme';
import { BackArrow } from '../../../components/ui/Icons';
import { useAdaptiveLayout } from '../../../hooks/useAdaptiveLayout';
import { useTrackScreen } from '../../../hooks/useTrackScreen';
import { useAppointmentDetail } from '../../../hooks/useAppointmentDetail';
import { useCrewLocationSharing } from '../../../hooks/useCrewLocationSharing';
import { useAuthStore } from '../../../stores/authStore';
import { useAppointmentStore } from '../../../stores/appointmentStore';
import {
  decideChangeRequest, describeError, getOutbox, resolveHold, setAppointmentStatus, setLocationSharing,
} from '../../../services/appointments';
import { AppointmentRole, AppointmentStatus, MessageCategory, Visibility, workStartBlockers } from '../../../utils/jobSafety';
import { formatWindow, trackingView } from '../../../utils/crewTracking';
import { StatusChip, StatusTimeline, PALETTE } from '../../../components/appointments/StatusBits';
import { TrackingCard } from '../../../components/appointments/TrackingCard';
import { SafetyPanel } from '../../../components/appointments/SafetyPanel';
import { TeamActions } from '../../../components/appointments/TeamActions';
import { MessageList, Composer } from '../../../components/appointments/Conversation';

export default function AppointmentScreen() {
  const layout = useAdaptiveLayout();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const teamRole = useAppointmentStore(s => s.teamRole);
  const outboxItems = useAppointmentStore(s => s.outbox);
  const { detail, loading, error, refresh, now } = useAppointmentDetail(id);
  const [busy, setBusy] = useState<AppointmentStatus | 'sharing' | null>(null);
  useTrackScreen('Appointment');

  const appt = detail?.appointment;
  const myAssignment = appt?.appointment_assignments.find(a => a.active && a.user_id === user?.id) ?? null;
  const isOffice = teamRole === 'office';
  const role: AppointmentRole | null = !appt || !user ? null
    : myAssignment ? myAssignment.assignment_role
    : isOffice ? 'office'
    : appt.customer_id === user.id ? 'customer' : null;

  const sharingState = useCrewLocationSharing(id, !!myAssignment?.location_sharing && appt?.status === 'en_route');

  const queued = outboxItems.filter(i => i.appointmentId === id);
  const queuedAckIds = new Set(queued.filter(i => i.kind === 'ack' && !i.failed).map(i => i.id));

  const run = async (key: AppointmentStatus | 'sharing' | null, action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(key);
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      Alert.alert('Not saved', describeError(e));
      await refresh();
      return false;
    } finally {
      setBusy(null);
    }
  };

  const send = (input: { body: string; category: MessageCategory; visibility: Visibility; onBehalfOfCustomer: boolean }) => {
    if (!user || !id) return;
    getOutbox(user.id).enqueue({
      kind: 'message', id: Crypto.randomUUID(), appointmentId: id, createdAt: new Date().toISOString(), attempts: 0, ...input,
    }).then(refresh).catch(() => {});
  };
  const acknowledge = (holdId: string) => {
    if (!user || !id) return;
    getOutbox(user.id).enqueue({ kind: 'ack', id: holdId, appointmentId: id, createdAt: new Date().toISOString(), attempts: 0 })
      .then(refresh).catch(() => {});
  };
  const changeStatus = (to: AppointmentStatus) => {
    if (!id) return;
    const go = () => { run(to, () => setAppointmentStatus(id, to)); };
    if (to === 'cancelled') {
      Alert.alert('Cancel appointment?', 'The customer and assigned team will be notified.', [
        { text: 'Keep', style: 'cancel' }, { text: 'Cancel appointment', style: 'destructive', onPress: go },
      ]);
    } else go();
  };

  const header = (
    <View style={[styles.header, { paddingTop: layout.headerPaddingTop }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(main)/appointments'))}>
        <BackArrow />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{appt?.service ?? 'Appointment'}</Text>
      {appt && <StatusChip status={appt.status} />}
    </View>
  );

  if (!detail || !appt || !user) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          {loading ? <ActivityIndicator size="large" color={COLORS.leafAccent} /> : (
            <>
              <Text style={styles.errorText}>{error || 'This appointment is not available.'}</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={refresh}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  const assignments = appt.appointment_assignments.filter(a => a.active);
  const crewNames = [...new Set(assignments.filter(a => a.assignment_role === 'crew').map(a => a.crew_name || a.display_name))].join(', ');
  const arborists = assignments.filter(a => a.assignment_role === 'arborist').map(a => a.display_name).join(', ');
  const blockers = workStartBlockers({ holds: detail.holds, acks: detail.acks, assignments: appt.appointment_assignments, changeRequests: detail.changeRequests });
  const view = trackingView({
    status: appt.status,
    sharingEnabled: assignments.some(a => a.location_sharing),
    locations: detail.locations,
    property: appt.properties,
    now,
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      {error && <Text style={styles.offline} accessibilityLiveRegion="polite">Can’t reach the server — showing the last update. Messages you send will be queued.</Text>}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summary}>
          {appt.jobs?.title && appt.jobs.title !== appt.service && <Text style={styles.jobTitle}>{appt.jobs.title}</Text>}
          <Text style={styles.window}>{formatWindow(appt.window_start, appt.window_end, appt.time_zone)}</Text>
          <Text style={styles.meta}>{appt.properties?.address}</Text>
          {(crewNames || arborists) ? (
            <Text style={styles.meta}>{[arborists && `Arborist: ${arborists}`, crewNames && `Crew: ${crewNames}`].filter(Boolean).join(' · ')}</Text>
          ) : null}
          {role !== 'customer' && appt.jobs?.scope ? <Text style={styles.scope}>Scope: {appt.jobs.scope}</Text> : null}
          <View style={{ marginTop: 12 }}><StatusTimeline status={appt.status} /></View>
        </View>

        <TrackingCard view={view} property={appt.properties} windowStart={appt.window_start} windowEnd={appt.window_end}
          timeZone={appt.time_zone} crewName={crewNames || undefined} />

        <SafetyPanel
          detail={detail}
          role={role}
          isOffice={isOffice}
          userId={user.id}
          queuedAckIds={queuedAckIds}
          onAcknowledge={acknowledge}
          onResolve={(holdId, note) => run(null, () => resolveHold(holdId, note))}
          onDecide={(requestId, approve, note, ws, we) => run(null, () => decideChangeRequest(requestId, approve, note, ws, we))}
        />

        <TeamActions
          status={appt.status}
          role={role}
          isOffice={isOffice}
          blockers={blockers}
          myLocationSharing={myAssignment ? myAssignment.location_sharing : null}
          sharingState={sharingState}
          busy={busy}
          onStatus={changeStatus}
          onToggleSharing={enabled => { run('sharing', () => setLocationSharing(appt.id, enabled)); }}
        />

        <View>
          <Text style={styles.sectionTitle}>Messages</Text>
          <Text style={styles.sectionSub}>
            {role === 'customer'
              ? 'One place for anything about this visit. The Almstead office, your arborist and crew all see it.'
              : 'Shared with the customer unless marked team only. Use the quick actions for stop instructions.'}
          </Text>
        </View>
        <MessageList
          messages={detail.messages}
          receipts={detail.receipts}
          queued={queued}
          userId={user.id}
          onRetry={msgId => { getOutbox(user.id).retry('message', msgId).then(refresh).catch(() => {}); }}
          onDiscard={msgId => Alert.alert('Discard message?', 'It has not been sent.', [
            { text: 'Keep', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => { getOutbox(user.id).discard('message', msgId); } },
          ])}
        />
        {queued.filter(i => i.kind === 'ack' && i.failed).map(i => (
          <Text key={i.id} style={styles.errorText}>Acknowledgement not accepted: {i.lastError}</Text>
        ))}
      </ScrollView>
      <View style={{ paddingBottom: layout.footerPaddingBottom - 8, backgroundColor: '#15300F' }}>
        <Composer role={role} onSend={send} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canopyDark },
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '700', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  errorText: { color: PALETTE.danger, fontSize: 14, textAlign: 'center' },
  retry: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: COLORS.almsteadGreen },
  retryText: { color: '#fff', fontWeight: '700' },
  offline: { color: COLORS.alertAmber, backgroundColor: PALETTE.amberBg, fontSize: 12, paddingVertical: 8, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  summary: { backgroundColor: PALETTE.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: PALETTE.border, gap: 4 },
  jobTitle: { color: PALETTE.muted, fontSize: 13, fontWeight: '600' },
  window: { color: '#fff', fontSize: 18, fontWeight: '700' },
  meta: { color: PALETTE.muted, fontSize: 13, lineHeight: 19 },
  scope: { color: PALETTE.faint, fontSize: 12, lineHeight: 17, marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sectionSub: { color: PALETTE.faint, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
