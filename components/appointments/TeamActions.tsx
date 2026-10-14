import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';
import { AppointmentRole, AppointmentStatus, Blocker, describeBlocker, statusActions } from '../../utils/jobSafety';
import type { SharingState } from '../../hooks/useCrewLocationSharing';
import { PALETTE } from './StatusBits';

interface Props {
  status: AppointmentStatus;
  role: AppointmentRole | null;
  isOffice: boolean;
  blockers: Blocker[];
  myLocationSharing: boolean | null; // null when the user is not assigned
  sharingState: SharingState;
  busy: AppointmentStatus | 'sharing' | null;
  onStatus: (to: AppointmentStatus) => void;
  onToggleSharing: (enabled: boolean) => void;
}

export function TeamActions({ status, role, isOffice, blockers, myLocationSharing, sharingState, busy, onStatus, onToggleSharing }: Props) {
  const actions = statusActions(role, status, isOffice);
  const showSharing = myLocationSharing !== null && (status === 'scheduled' || status === 'en_route');
  if (!actions.length && !showSharing) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>JOB CONTROLS</Text>

      {showSharing && (
        <View style={styles.shareRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.shareTitle}>Share my location for this trip</Text>
            <Text style={styles.shareSub}>
              {sharingState === 'denied' ? 'Location permission is off — the customer sees the arrival window instead.'
                : sharingState === 'sharing' ? 'Sharing while en route. Stops automatically on arrival.'
                : 'Only while en route to this job. Never off-duty or for other jobs.'}
            </Text>
          </View>
          {busy === 'sharing' ? <ActivityIndicator color={COLORS.leafAccent} /> : (
            <Switch value={!!myLocationSharing} onValueChange={onToggleSharing} accessibilityLabel="Share my location for this trip" />
          )}
        </View>
      )}

      {actions.map(a => {
        const isStart = a.to === 'in_progress';
        const blocked = isStart && blockers.length > 0;
        const destructive = a.to === 'cancelled';
        return (
          <View key={a.to}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked || !!busy }}
              accessibilityHint={blocked ? 'Blocked until every instruction is resolved and acknowledged' : undefined}
              disabled={blocked || !!busy}
              style={[styles.action, destructive && styles.actionDanger, blocked && styles.actionBlocked]}
              onPress={() => onStatus(a.to)}
            >
              {busy === a.to ? <ActivityIndicator color="#fff" /> : (
                <Text style={[styles.actionText, destructive && { color: PALETTE.danger }]}>{blocked ? `⛔ ${a.label} — blocked` : a.label}</Text>
              )}
            </TouchableOpacity>
            {blocked && (
              <View style={styles.blockers}>
                {blockers.map((b, i) => <Text key={i} style={styles.blocker}>• {describeBlocker(b)}</Text>)}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: PALETTE.card, borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: PALETTE.border },
  label: { color: PALETTE.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  shareTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  shareSub: { color: PALETTE.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  action: { backgroundColor: COLORS.almsteadGreen, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  actionDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: PALETTE.dangerBorder },
  actionBlocked: { backgroundColor: PALETTE.dangerBg, borderWidth: 1, borderColor: PALETTE.dangerBorder },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  blockers: { marginTop: 8, gap: 4 },
  blocker: { color: PALETTE.danger, fontSize: 13, lineHeight: 18 },
});
