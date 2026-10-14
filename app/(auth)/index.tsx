import { useAdaptiveLayout } from '../../hooks/useAdaptiveLayout';
import React from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BrandPanel } from '../../components/layout/BrandPanel';
import { Button } from '../../components/ui/Button';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

export default function SplashScreen() {
  const layout = useAdaptiveLayout();
  const router = useRouter();

  useTrackScreen('Splash');

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: layout.headerPaddingTop + 24, paddingBottom: layout.footerPaddingBottom + 24 }]}>
        {!layout.expanded ? <BrandPanel /> : <>
          <Text style={styles.expandedTitle}>Diagnose your landscape</Text>
          <Text style={styles.expandedDescription}>Take a photo of a tree, shrub, or lawn issue and get AI-powered insights with recommended next steps.</Text>
        </>}
        
        <Button 
          onPress={() => {
            trackEvent('diagnose_cta_tapped');
            router.push('/(auth)/sign-in');
          }}
          style={{ width: '100%', maxWidth: 360, marginTop: 40 }}
        >
          Diagnose My Landscape
        </Button>
        <Text style={[styles.footer, { paddingBottom: layout.footerPaddingBottom }]}>1 free scan per month. Verify your service area for 5. Almstead customers get unlimited.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canopyDark,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 1,
  },
  expandedTitle: { color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  expandedDescription: { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 400 },
  footer: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
    textAlign: 'center',
  },
});
