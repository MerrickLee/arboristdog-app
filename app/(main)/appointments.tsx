import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, CalendarIcon } from '../../components/ui/Icons';
import { useAdaptiveLayout } from '../../hooks/useAdaptiveLayout';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { useAppointmentStore } from '../../stores/appointmentStore';
import { fetchAppointments, fetchNotifications, markNotificationsRead } from '../../services/appointments';
import { formatWindow } from '../../utils/crewTracking';
import { StatusChip, PALETTE } from '../../components/appointments/StatusBits';

export default function AppointmentsScreen() {
  const layout = useAdaptiveLayout();
  const router = useRouter();
  const { appointments, notifications, teamRole, setAppointments, setNotifications, markRead } = useAppointmentStore();
  const [refreshing, setRefreshing] = useState(false);
  useTrackScreen('Appointments');

  const load = useCallback(async () => {
    try {
      const [a, n] = await Promise.all([fetchAppointments(), fetchNotifications()]);
      setAppointments(a);
      setNotifications(n);
    } catch (e) {
      console.warn('[Appointments] load failed', e);
    } finally {
      setRefreshing(false);
    }
  }, [setAppointments, setNotifications]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (id: string) => router.push({ pathname: '/(main)/appointment/[id]', params: { id } });
  const unread = notifications.filter(n => !n.read_at);
  const upcoming = appointments.filter(a => !['completed', 'cancelled'].includes(a.status));
  const past = appointments.filter(a => ['completed', 'cancelled'].includes(a.status));

  const renderCard = (a: typeof appointments[number]) => {
    const openHolds = a.appointment_holds.filter(h => h.status === 'open').length;
    const unreadForAppt = unread.filter(n => n.appointment_id === a.id).length;
    return (
      <TouchableOpacity key={a.id} style={[styles.card, openHolds > 0 && styles.cardAlert]} activeOpacity={0.75}
        accessibilityRole="button" accessibilityLabel={`${a.service}, ${formatWindow(a.window_start, a.window_end, a.time_zone)}`} onPress={() => open(a.id)}>
        <View style={styles.cardTop}>
          <Text style={styles.service} numberOfLines={1}>{a.service}</Text>
          {unreadForAppt > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadForAppt}</Text></View>}
        </View>
        <Text style={styles.window}>{formatWindow(a.window_start, a.window_end, a.time_zone)}</Text>
        <Text style={styles.address} numberOfLines={1}>{a.properties?.address}</Text>
        <View style={styles.cardBottom}>
          <StatusChip status={a.status} />
          {openHolds > 0 && <Text style={styles.holdText}>⛔ {openHolds} open instruction{openHolds > 1 ? 's' : ''}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: layout.headerPaddingTop }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{teamRole ? 'Jobs' : 'Appointments'}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: layout.footerPaddingBottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.leafAccent} />}>
        {unread.length > 0 && (
          <View style={styles.updates}>
            <View style={styles.updatesHead}>
              <Text style={styles.sectionLabel}>NEW UPDATES</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => { const ids = unread.map(n => n.id); markRead(ids); markNotificationsRead(ids).catch(() => {}); }}>
                <Text style={styles.link}>Mark all read</Text>
              </TouchableOpacity>
            </View>
            {unread.slice(0, 5).map(n => (
              <TouchableOpacity key={n.id} style={[styles.update, n.is_urgent && styles.updateUrgent]} accessibilityRole="button"
                onPress={() => { markRead([n.id]); markNotificationsRead([n.id]).catch(() => {}); if (n.appointment_id) open(n.appointment_id); }}>
                <Text style={[styles.updateTitle, n.is_urgent && { color: PALETTE.danger }]}>{n.title}</Text>
                <Text style={styles.updateBody} numberOfLines={2}>{n.body}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>UPCOMING</Text>
        {upcoming.length ? upcoming.map(renderCard) : (
          <View style={styles.empty}>
            <CalendarIcon size={40} color="rgba(123,201,80,0.4)" />
            <Text style={styles.emptyTitle}>No upcoming appointments</Text>
            <Text style={styles.emptySub}>When Almstead books a visit, it will appear here with live updates and a place to message your crew.</Text>
          </View>
        )}
        {past.length > 0 && <Text style={[styles.sectionLabel, { marginTop: 12 }]}>RECENT</Text>}
        {past.map(renderCard)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canopyDark },
  header: { paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, color: '#fff', fontWeight: '700', flex: 1 },
  content: { paddingHorizontal: 24, gap: 12 },
  sectionLabel: { color: PALETTE.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  link: { color: COLORS.leafAccent, fontSize: 12, fontWeight: '700' },
  updates: { gap: 8, marginBottom: 8 },
  updatesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  update: { backgroundColor: PALETTE.card, borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: COLORS.leafAccent },
  updateUrgent: { borderLeftColor: PALETTE.danger, backgroundColor: PALETTE.dangerBg },
  updateTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  updateBody: { color: PALETTE.muted, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: PALETTE.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: PALETTE.border, gap: 4 },
  cardAlert: { borderColor: PALETTE.dangerBorder },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  service: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: PALETTE.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  window: { color: '#fff', fontSize: 14, fontWeight: '500' },
  address: { color: PALETTE.muted, fontSize: 13 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  holdText: { color: PALETTE.danger, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16, gap: 10 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  emptySub: { color: PALETTE.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
