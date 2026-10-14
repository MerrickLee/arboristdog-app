import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppointmentStore } from '../stores/appointmentStore';
import {
  fetchAppointments, fetchNotifications, fetchTeamRole, getOutbox, releaseOutbox, subscribeToNotifications,
} from '../services/appointments';

/**
 * App-wide sync for the signed-in user: team role, appointment list, notifications and the
 * offline outbox. Notifications are stored server-side, so anything missed while offline or
 * while realtime was disconnected is picked up on resubscribe and on returning to the app.
 */
export function useAppointmentSync(userId: string | undefined) {
  useEffect(() => {
    const store = useAppointmentStore.getState;
    if (!userId) {
      store().reset();
      releaseOutbox();
      return;
    }
    let cancelled = false;
    const outbox = getOutbox(userId);
    const unsubscribeOutbox = outbox.subscribe(items => store().setOutbox(items));
    outbox.list().then(items => { if (!cancelled) store().setOutbox(items); }).catch(() => {});

    const refresh = async () => {
      try {
        const [role, notifications, appointments] = await Promise.all([fetchTeamRole(userId), fetchNotifications(), fetchAppointments()]);
        if (cancelled) return;
        store().setTeamRole(role);
        store().setNotifications(notifications);
        store().setAppointments(appointments);
      } catch (error) {
        console.warn('[Appointments] refresh failed', error);
      }
      outbox.flush().catch(() => {});
    };
    refresh();

    const unsubscribeRealtime = subscribeToNotifications(userId, notification => {
      store().addNotification(notification);
      store().showToast(notification);
      fetchAppointments().then(a => { if (!cancelled) store().setAppointments(a); }).catch(() => {});
    }, refresh);
    const appState = AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
    const retry = setInterval(() => {
      if (store().outbox.some(i => !i.failed)) outbox.flush().catch(() => {});
    }, 20000);

    return () => {
      cancelled = true;
      unsubscribeOutbox();
      unsubscribeRealtime();
      appState.remove();
      clearInterval(retry);
    };
  }, [userId]);
}
