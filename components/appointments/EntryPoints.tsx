import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { CalendarIcon, TruckIcon } from '../ui/Icons';
import { unreadCount, urgentUnreadCount, useAppointmentStore } from '../../stores/appointmentStore';

/** Header button with an unread badge (red when something urgent is unread). */
export function AppointmentsButton({ size = 36, iconSize = 18, background = 'rgba(0,0,0,0.4)' }: { size?: number; iconSize?: number; background?: string }) {
  const router = useRouter();
  const unread = useAppointmentStore(unreadCount);
  const urgent = useAppointmentStore(urgentUnreadCount);
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Appointments${unread ? `, ${unread} new updates` : ''}`}
      style={[styles.btn, { width: size, height: size, backgroundColor: background }]} onPress={() => router.push('/(main)/appointments')}>
      <CalendarIcon size={iconSize} color="#fff" />
      {unread > 0 && (
        <View style={[styles.badge, urgent > 0 && styles.badgeUrgent]}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Shown on the home screen while a crew is on the way or on site. */
export function ActiveTripPill() {
  const router = useRouter();
  const active = useAppointmentStore(s => s.appointments.find(a => a.status === 'en_route' || a.status === 'arrived'));
  if (!active) return null;
  return (
    <TouchableOpacity accessibilityRole="button" style={styles.pill}
      onPress={() => router.push({ pathname: '/(main)/appointment/[id]', params: { id: active.id } })}>
      <TruckIcon size={16} color={COLORS.alertAmber} />
      <Text style={styles.pillText}>{active.status === 'en_route' ? 'Crew on the way · Track' : 'Crew has arrived'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: COLORS.leafAccent, alignItems: 'center', justifyContent: 'center' },
  badgeUrgent: { backgroundColor: '#F06A5F' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.6)' },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
