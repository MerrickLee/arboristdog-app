import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppointmentSync } from '../../hooks/useAppointmentSync';
import { useAppointmentStore } from '../../stores/appointmentStore';
import { markNotificationsRead } from '../../services/appointments';
import { PALETTE } from './StatusBits';

/**
 * Mounted once at the root for signed-in users. Runs appointment sync and shows new
 * notifications as a banner. Urgent banners stay until tapped or dismissed.
 */
export function AppointmentUpdates({ userId }: { userId?: string }) {
  useAppointmentSync(userId);
  const toast = useAppointmentStore(s => s.toast);
  const showToast = useAppointmentStore(s => s.showToast);
  const markRead = useAppointmentStore(s => s.markRead);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast || toast.is_urgent) return;
    const t = setTimeout(() => showToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast, showToast]);

  if (!toast || !userId) return null;
  const openIt = () => {
    markRead([toast.id]);
    markNotificationsRead([toast.id]).catch(() => {});
    showToast(null);
    if (toast.appointment_id) router.push({ pathname: '/(main)/appointment/[id]', params: { id: toast.appointment_id } });
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <TouchableOpacity activeOpacity={0.9} accessibilityRole="alert" accessibilityLiveRegion={toast.is_urgent ? 'assertive' : 'polite'}
        style={[styles.toast, toast.is_urgent && styles.urgent]} onPress={openIt}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{toast.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{toast.body}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={12} onPress={() => showToast(null)}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 1000, elevation: 20 },
  toast: {
    width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: '#24461F', borderWidth: 1, borderColor: 'rgba(123,201,80,0.4)',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  urgent: { backgroundColor: '#5A1F1A', borderColor: PALETTE.danger },
  title: { color: '#fff', fontWeight: '800', fontSize: 14 },
  body: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  close: { color: 'rgba(255,255,255,0.7)', fontSize: 16, paddingHorizontal: 4 },
});
