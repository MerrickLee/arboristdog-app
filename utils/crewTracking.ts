// Pure ETA / tracking decisions for the customer view. No device or network access here.

export interface LatLng { latitude: number; longitude: number }
export interface CrewLocation extends LatLng { user_id: string; recorded_at: string; accuracy_m?: number | null }

/** A fix older than this is treated as lost signal rather than shown as "live". */
export const LOCATION_STALE_MS = 3 * 60 * 1000;

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rough drive time: straight-line distance × road factor at a suburban average speed. */
export function estimateEtaMinutes(from: LatLng, to: LatLng, averageSpeedKmh = 35, roadFactor = 1.35): number {
  return Math.max(1, Math.round(((distanceKm(from, to) * roadFactor) / averageSpeedKmh) * 60));
}

export type TrackingView =
  | { mode: 'hidden' }
  | { mode: 'arrived' }
  | { mode: 'live'; etaMinutes: number; distanceKm: number; location: CrewLocation; secondsAgo: number }
  | { mode: 'fallback'; reason: 'not_shared' | 'no_signal' | 'stale' | 'no_property_location'; secondsAgo?: number };

export function trackingView(input: {
  status: string;
  sharingEnabled: boolean;
  locations: CrewLocation[];
  property: { latitude?: number | null; longitude?: number | null } | null;
  now?: Date;
}): TrackingView {
  const now = (input.now ?? new Date()).getTime();
  if (input.status === 'arrived') return { mode: 'arrived' };
  if (input.status !== 'en_route') return { mode: 'hidden' };
  if (!input.sharingEnabled) return { mode: 'fallback', reason: 'not_shared' };
  const latest = [...input.locations].sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))[0];
  if (!latest) return { mode: 'fallback', reason: 'no_signal' };
  const secondsAgo = Math.max(0, Math.round((now - Date.parse(latest.recorded_at)) / 1000));
  if (secondsAgo * 1000 > LOCATION_STALE_MS) return { mode: 'fallback', reason: 'stale', secondsAgo };
  const p = input.property;
  if (p?.latitude == null || p?.longitude == null) return { mode: 'fallback', reason: 'no_property_location', secondsAgo };
  const target = { latitude: p.latitude, longitude: p.longitude };
  return { mode: 'live', etaMinutes: estimateEtaMinutes(latest, target), distanceKm: distanceKm(latest, target), location: latest, secondsAgo };
}

export function formatWindow(startIso: string, endIso: string, timeZone?: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts = timeZone ? { timeZone } : {};
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...opts });
  const t = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...opts });
  return `${day} · ${t(start)} – ${t(end)}`;
}
