import React, { ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdaptiveLayout } from '../../hooks/useAdaptiveLayout';
import { COLORS } from '../../constants/theme';
import { TreeRingPaw, ClockIcon, GearIcon, LocationIcon } from '../ui/Icons';
import { Button } from '../ui/Button';
import { BrandPanel } from './BrandPanel';
import { ScanPanel, ScanPhoto } from './ScanPanel';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { AppointmentsButton } from '../appointments/EntryPoints';

export function AdaptiveExperience({ children }: { children: ReactNode }) {
  const { expanded, experienceWidth, supportWidth } = useAdaptiveLayout();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const router = useRouter();
  const route = segments[segments.length - 1] || 'index';
  // Capture owns its two panes so the live camera stays mounted when resized.
  const showSupport = expanded && route !== 'capture';
  return (
    <View style={[styles.root, { paddingLeft: insets.left, paddingRight: insets.right, paddingTop: expanded ? insets.top : 0, paddingBottom: expanded ? insets.bottom : 0 }]}>
      <View style={[styles.experience, { maxWidth: experienceWidth }]}>
        {expanded && (
          <View style={styles.header}>
            <View style={styles.brand}><TreeRingPaw size={36} /><View style={{ flex: 1 }}><Text style={styles.brandName}>ArboristDog</Text><Text style={styles.brandAttribution}>Powered by Almstead Tree, Shrub &amp; Lawn Care</Text></View></View>
            {segments[0] === '(main)' && <View style={styles.navigation}>
              <AppointmentsButton size={44} iconSize={20} background="rgba(255,255,255,0.1)" />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Scan History" style={styles.navButton} onPress={() => router.push('/(main)/history')}><ClockIcon size={20} /></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Settings" style={styles.navButton} onPress={() => router.push('/(main)/settings')}><GearIcon size={20} /></TouchableOpacity>
            </View>}
          </View>
        )}
        <View style={styles.panes}>
          <View style={[styles.support, { width: showSupport ? supportWidth : 0, display: showSupport ? 'flex' : 'none' }]}>
            <ScrollView contentContainerStyle={styles.supportContent}>
              <SupportContent route={route} />
            </ScrollView>
          </View>
          <View style={styles.main}>{children}</View>
        </View>
      </View>
    </View>
  );
}

function SupportContent({ route }: { route: string }) {
  const router = useRouter();
  const { historyPreview, restoreDiagnosis } = useDiagnosisStore();
  if (['context', 'location', 'analyzing', 'results', 'confirm'].includes(route)) return <ScanPanel />;
  if (route === 'onboard-location') return (
    <View><Text style={styles.label}>LOCAL CONTEXT</Text><LocationIcon size={48} color={COLORS.leafAccent} /><Text style={styles.title}>A diagnosis rooted in your location.</Text><Text style={styles.description}>Your address helps ArboristDog account for regional soil, climate, and pest conditions.</Text><Text style={styles.callout}>Residential &amp; commercial properties</Text><Text style={styles.attribution}>Powered by Almstead{ '\n' }Tree, Shrub &amp; Lawn Care</Text></View>
  );
  if (route === 'history') return historyPreview?.diagnosis_json ? (
    <View><Text style={styles.label}>SELECTED DIAGNOSIS</Text><ScanPhoto uri={historyPreview.image_url} /><Text style={styles.title}>{historyPreview.condition_name}</Text><Text style={styles.callout}>{historyPreview.severity} severity · {historyPreview.confidence}% confidence</Text><Text style={styles.description}>{historyPreview.diagnosis_json.explanation}</Text><Button variant="secondary" style={{ marginTop: 24 }} onPress={() => { restoreDiagnosis(historyPreview); router.push('/(main)/results'); }}>View Full Diagnosis</Button></View>
  ) : <View><BrandPanel /><Text style={[styles.description, { marginTop: 32, textAlign: 'center' }]}>Select a saved scan to review its photo and assessment here.</Text></View>;
  return <View><BrandPanel />{route === 'credits' && <Text style={styles.callout}>Almstead customers get full access and unlimited free scans.</Text>}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canopyDark },
  experience: { width: '100%', flex: 1, alignSelf: 'center' },
  header: { paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', gap: 16 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  brandAttribution: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  navigation: { flexDirection: 'row', gap: 8 },
  navButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  panes: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  support: { backgroundColor: '#234820', borderRightWidth: 2, borderRightColor: '#122E0F' },
  supportContent: { padding: 28, flexGrow: 1, justifyContent: 'center' },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 1.5, marginBottom: 24 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 20, marginBottom: 16 },
  description: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 22 },
  callout: { padding: 14, borderWidth: 1, borderColor: 'rgba(123,201,80,0.3)', backgroundColor: 'rgba(123,201,80,0.1)', borderRadius: 12, color: COLORS.leafAccent, fontSize: 13, lineHeight: 20, marginVertical: 24 },
  attribution: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 32 },
});
