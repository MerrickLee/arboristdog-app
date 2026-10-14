import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { updateCrewLocation } from '../services/appointments';

export type SharingState = 'idle' | 'sharing' | 'denied' | 'error';

/**
 * Reports this crew member's position only while `active` (job en route + opted in for this
 * job). Foreground only — no background tracking — and it stops as soon as the server
 * declines an update (trip ended, unassigned, or sharing turned off elsewhere).
 */
export function useCrewLocationSharing(appointmentId: string | undefined, active: boolean): SharingState {
  const [state, setState] = useState<SharingState>('idle');

  useEffect(() => {
    if (!appointmentId || !active) {
      setState('idle');
      return;
    }
    let subscription: Location.LocationSubscription | null = null;
    let stopped = false;
    const stop = () => {
      subscription?.remove();
      subscription = null;
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (stopped) return;
      if (status !== 'granted') {
        setState('denied');
        return;
      }
      setState('sharing');
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 20000, distanceInterval: 50 },
        async ({ coords }) => {
          try {
            const accepted = await updateCrewLocation(appointmentId, coords.latitude, coords.longitude, coords.accuracy);
            if (!accepted) {
              stop();
              setState('idle');
            }
          } catch {
            // Poor connectivity: the next fix retries. The customer sees the stale-signal fallback meanwhile.
          }
        },
      );
      if (stopped) stop();
    })().catch(() => setState('error'));

    return () => {
      stopped = true;
      stop();
    };
  }, [appointmentId, active]);

  return state;
}
