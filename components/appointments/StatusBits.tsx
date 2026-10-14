import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';
import { AppointmentStatus, STATUS_LABELS } from '../../utils/jobSafety';

export const PALETTE = {
  card: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.1)',
  muted: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.35)',
  danger: '#F06A5F',
  dangerBg: 'rgba(240,106,95,0.14)',
  dangerBorder: 'rgba(240,106,95,0.5)',
  ok: COLORS.leafAccent,
  okBg: 'rgba(123,201,80,0.14)',
  amber: COLORS.alertAmber,
  amberBg: 'rgba(212,160,23,0.16)',
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: '#8EC5FF',
  en_route: COLORS.alertAmber,
  arrived: COLORS.leafAccent,
  in_progress: COLORS.leafAccent,
  completed: 'rgba(255,255,255,0.7)',
  cancelled: PALETTE.danger,
};

export function StatusChip({ status }: { status: AppointmentStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.chip, { backgroundColor: `${color}22`, borderColor: `${color}66` }]} accessibilityLabel={`Status: ${STATUS_LABELS[status]}`}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const STEPS: { status: AppointmentStatus; label: string }[] = [
  { status: 'scheduled', label: 'Scheduled' },
  { status: 'en_route', label: 'On the way' },
  { status: 'arrived', label: 'Arrived' },
  { status: 'in_progress', label: 'Working' },
  { status: 'completed', label: 'Complete' },
];

export function StatusTimeline({ status }: { status: AppointmentStatus }) {
  if (status === 'cancelled') {
    return <View style={styles.cancelled}><Text style={styles.cancelledText}>This appointment was cancelled.</Text></View>;
  }
  const current = STEPS.findIndex(s => s.status === status);
  return (
    <View style={styles.timeline} accessibilityRole="progressbar" accessibilityLabel={`Progress: ${STATUS_LABELS[status]}`}>
      {STEPS.map((step, i) => (
        <View key={step.status} style={styles.step}>
          <View style={styles.trackRow}>
            <View style={[styles.bar, i === 0 && styles.hidden, i <= current && styles.barDone]} />
            <View style={[styles.dot, i <= current && styles.dotDone, i === current && styles.dotCurrent]} />
            <View style={[styles.bar, i === STEPS.length - 1 && styles.hidden, i < current && styles.barDone]} />
          </View>
          <Text style={[styles.stepLabel, i <= current && styles.stepLabelDone]} numberOfLines={1}>{step.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  timeline: { flexDirection: 'row', marginTop: 4 },
  step: { flex: 1, alignItems: 'center' },
  trackRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  bar: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  barDone: { backgroundColor: COLORS.leafAccent },
  hidden: { opacity: 0 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  dotDone: { backgroundColor: COLORS.leafAccent, borderColor: COLORS.leafAccent },
  dotCurrent: { width: 16, height: 16, borderRadius: 8, borderColor: '#fff' },
  stepLabel: { marginTop: 6, fontSize: 11, color: PALETTE.faint, fontWeight: '600' },
  stepLabelDone: { color: '#fff' },
  cancelled: { padding: 12, borderRadius: 12, backgroundColor: PALETTE.dangerBg, borderWidth: 1, borderColor: PALETTE.dangerBorder },
  cancelledText: { color: PALETTE.danger, fontWeight: '700', textAlign: 'center' },
});
