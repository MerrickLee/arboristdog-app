import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { ProgressDots } from '../../components/ui/ProgressDots';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

export default function OnboardScreen() {
  const router = useRouter();
  const { user, setHasOnboarded } = useAuthStore();

  useTrackScreen('Onboarding');

  const handleNext = async () => {
    trackEvent('onboarding_completed');
    // Persist to Supabase so it survives app restarts
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ has_onboarded: true })
        .eq('id', user.id);
    }
    setHasOnboarded(true);
    router.replace('/(main)/capture');
  };

  const steps = [
    { num: '1', title: 'Snap a photo', desc: "Take a picture of the tree, shrub, or lawn issue" },
    { num: '2', title: 'Describe the problem', desc: "Tell us what you're seeing and when it started" },
    { num: '3', title: 'Add your location', desc: "So we can factor in local climate and conditions" },
    { num: '4', title: 'Get your diagnosis', desc: "AI-powered analysis with recommended next steps" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header} />
      <View style={styles.content}>
        <Text style={styles.title}>How it works</Text>
        
        {steps.map((step, i) => (
          <View key={i} style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.num}</Text>
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>
      
      <View style={styles.footer}>
        <ProgressDots current={0} total={4} />
        <View style={{ marginTop: 20 }}>
          <Button onPress={handleNext}>Get Started</Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canopyDark,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 32,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    color: COLORS.leafAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
});
