import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  AppointmentDetail, describeError, fetchAppointmentDetail, markAppointmentRead, subscribeToAppointment,
} from '../services/appointments';

/** Live data for one appointment: realtime, plus refetch on foreground and a polling backstop. */
export function useAppointmentDetail(id: string | undefined) {
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const lastMarked = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const next = await fetchAppointmentDetail(id);
      setDetail(next);
      setError(null);
      setNow(new Date());
      const latest = next.messages[next.messages.length - 1]?.id ?? 'none';
      if (latest !== lastMarked.current) {
        lastMarked.current = latest;
        markAppointmentRead(id, true).catch(() => {});
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    };
    const unsubscribe = subscribeToAppointment(id, debounced);
    const appState = AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
    const poll = setInterval(refresh, 30000);
    return () => {
      unsubscribe();
      appState.remove();
      clearInterval(poll);
      if (timer) clearTimeout(timer);
    };
  }, [id, refresh]);

  // While en route, refresh often so ETA and stale-signal fallback stay current.
  const enRoute = detail?.appointment.status === 'en_route';
  useEffect(() => {
    if (!enRoute) return;
    const fast = setInterval(refresh, 15000);
    return () => clearInterval(fast);
  }, [enRoute, refresh]);

  return { detail, loading, error, refresh, now };
}
