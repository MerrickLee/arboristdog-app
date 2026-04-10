import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { TreeRingPaw } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { LinearGradient } from 'expo-linear-gradient';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

export default function SplashScreen() {
  const router = useRouter();

  useTrackScreen('Splash');

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <TreeRingPaw size={80} />
        </View>
        <Text style={styles.title}>ArboristDog</Text>
        <Text style={styles.subtext}>POWERED BY</Text>
        <Text style={styles.company}>Almstead</Text>
        <Text style={styles.description}>Tree, Shrub & Lawn Care</Text>
        
        <Button 
          onPress={() => {
            trackEvent('diagnose_cta_tapped');
            router.push('/(auth)/sign-in');
          }}
          style={{ width: 260, marginTop: 40 }}
        >
          Diagnose My Landscape
        </Button>
        <Text style={styles.footer}>3 free scans per month. Almstead customers get unlimited.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canopyDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 1,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  title: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    letterSpacing: 1.5,
  },
  company: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 40,
  },
  footer: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
    textAlign: 'center',
  },
});
