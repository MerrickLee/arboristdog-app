import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { COLORS } from '../../constants/theme';
import { TrackingView, LatLng, formatWindow } from '../../utils/crewTracking';
import { TruckIcon } from '../ui/Icons';
import { PALETTE } from './StatusBits';

const FALLBACK_COPY = {
  not_shared: "Live location isn't shared for this trip.",
  no_signal: 'Waiting for the crew’s first location update.',
  stale: 'We’ve lost the crew’s live signal for now — they’re still on the way.',
  no_property_location: 'Live ETA is unavailable for this address.',
};

interface Props {
  view: TrackingView;
  property: MaybeLatLng | null;
  windowStart: string;
  windowEnd: string;
  timeZone: string;
  crewName?: string;
}

export function TrackingCard({ view, property, windowStart, windowEnd, timeZone, crewName }: Props) {
  if (view.mode === 'hidden') return null;
  const window = formatWindow(windowStart, windowEnd, timeZone);

  if (view.mode === 'arrived') {
    return (
      <View style={[styles.card, styles.arrived]} accessibilityLiveRegion="polite">
        <TruckIcon size={22} color={COLORS.leafAccent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{crewName || 'Your crew'} has arrived</Text>
          <Text style={styles.sub}>Live location sharing has ended for this trip.</Text>
        </View>
      </View>
    );
  }

  if (view.mode === 'fallback') {
    return (
      <View style={styles.card} accessibilityLiveRegion="polite">
        <View style={styles.headRow}>
          <TruckIcon size={20} color={COLORS.alertAmber} />
          <Text style={styles.title}>{crewName || 'Your crew'} is on the way</Text>
        </View>
        <Text style={styles.sub}>{FALLBACK_COPY[view.reason]}</Text>
        <View style={styles.windowBox}>
          <Text style={styles.windowLabel}>EXPECTED ARRIVAL</Text>
          <Text style={styles.windowValue}>{window}</Text>
        </View>
        <Text style={styles.note}>We’ll notify you the moment they arrive.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.liveRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.livePillText}>LIVE</Text></View>
          <Text style={styles.eta} accessibilityLabel={`Estimated arrival in about ${view.etaMinutes} minutes`}>~{view.etaMinutes} min</Text>
          <Text style={styles.sub}>{crewName || 'Your crew'} · {view.distanceKm < 1 ? `${Math.round(view.distanceKm * 1000)} m` : `${view.distanceKm.toFixed(1)} km`} away</Text>
          <Text style={styles.note}>Updated {view.secondsAgo < 60 ? 'just now' : `${Math.round(view.secondsAgo / 60)} min ago`} · Window {window.split(' · ')[1]}</Text>
        </View>
        <Radar crew={view.location} property={property} />
      </View>
      <Text style={styles.disclaimer}>ETA is an estimate. Location is shared only during this trip.</Text>
    </View>
  );
}

type MaybeLatLng = { latitude?: number | null; longitude?: number | null };

/** Coarse relative view (crew vs. your home) — deliberately not a street map. */
function Radar({ crew, property }: { crew: LatLng; property: MaybeLatLng | null }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const size = 112;
  const c = size / 2;
  let x = c;
  let y = c - 34;
  if (property?.latitude != null && property?.longitude != null) {
    const dx = (crew.longitude - property.longitude) * Math.cos((property.latitude * Math.PI) / 180);
    const dy = crew.latitude - property.latitude;
    const len = Math.hypot(dx, dy) || 1;
    const r = Math.min(46, 14 + Math.log10(1 + len * 111 * 10) * 16);
    x = c + (dx / len) * r;
    y = c - (dy / len) * r;
  }
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={52} stroke="rgba(255,255,255,0.1)" strokeWidth={1} fill="rgba(123,201,80,0.05)" />
        <Circle cx={c} cy={c} r={32} stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
        <Line x1={c} y1={c} x2={x} y2={y} stroke="rgba(212,160,23,0.5)" strokeWidth={1.5} strokeDasharray="3,3" />
        <Circle cx={c} cy={c} r={6} fill={COLORS.leafAccent} />
        <Circle cx={x} cy={y} r={6} fill={COLORS.alertAmber} />
      </Svg>
      <Animated.View pointerEvents="none" style={[styles.pulse, {
        left: x - 14, top: y - 14,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] }) }],
      }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(212,160,23,0.08)', borderColor: 'rgba(212,160,23,0.35)', borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: PALETTE.okBg, borderColor: 'rgba(123,201,80,0.4)' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sub: { color: PALETTE.muted, fontSize: 13, lineHeight: 19 },
  note: { color: PALETTE.faint, fontSize: 12 },
  windowBox: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12 },
  windowLabel: { color: PALETTE.faint, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  windowValue: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 4 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(212,160,23,0.2)', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.alertAmber },
  livePillText: { color: COLORS.alertAmber, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  eta: { color: '#fff', fontSize: 34, fontWeight: '800', marginVertical: 4 },
  disclaimer: { color: PALETTE.faint, fontSize: 11 },
  pulse: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.alertAmber },
});
