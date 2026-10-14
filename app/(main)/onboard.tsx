import { useAdaptiveLayout } from '../../hooks/useAdaptiveLayout';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { ProgressDots } from '../../components/ui/ProgressDots';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';
import { withTimeout } from '../../utils/withTimeout';

export default function OnboardScreen() {
  const layout = useAdaptiveLayout();
  const router = useRouter();
  const { user, setHasOnboarded } = useAuthStore();

  const [saving, setSaving] = useState(false);
  useTrackScreen('Onboarding');

  const handleNext = async () => {
    // Check if the user signed in with Apple's Hide My Email
    const isPrivateRelay = user?.email?.toLowerCase().endsWith('@privaterelay.appleid.com');

    if (isPrivateRelay) {
      Alert.alert(
        "Private Email Detected",
        "You used Apple's 'Hide My Email'. If you are an Almstead customer, you can optionally verify your Almstead account email to link your account and unlock free unlimited scans.\n\nWould you like to enter your real email?",
        [
          {
            text: "Keep Private",
            onPress: () => completeOnboarding(user?.email || '')
          },
          {
            text: "Verify Customer Email",
            onPress: () => promptForRealEmail()
          }
        ]
      );
    } else {
      await completeOnboarding(user?.email || '');
    }
  };

  const promptForRealEmail = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        "Verify Customer Email",
        "Please enter the email associated with your Almstead account to unlock free unlimited scans:",
        [
          {
            text: "Cancel",
            onPress: () => completeOnboarding(user?.email || ''),
            style: "cancel"
          },
          {
            text: "Link Account",
            onPress: async (enteredEmail?: string) => {
              if (!enteredEmail || ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail.trim())) {
                Alert.alert("Invalid Email", "Please enter a valid email address.", [
                  { text: "Try Again", onPress: () => promptForRealEmail() },
                  { text: "Cancel", onPress: () => completeOnboarding(user?.email || '') }
                ]);
                return;
              }
              await completeOnboarding(enteredEmail.trim().toLowerCase());
            }
          }
        ],
        "plain-text"
      );
    } else {
      completeOnboarding(user?.email || '');
    }
  };

  const completeOnboarding = async (finalEmail: string) => {
    if (!user || saving) return;
    setSaving(true);
    const controller = new AbortController();
    try {
      if (finalEmail && finalEmail !== user.email) {
        const { error } = await withTimeout(
          supabase.auth.updateUser({ email: finalEmail }),
          15000,
          'Email verification is taking too long. Please check your connection and try again.',
        );
        if (error) throw error;
        Alert.alert('Verify your email', 'Check your inbox and follow the confirmation links. Your private email stays in use until verification finishes. Customer benefits are granted after verification.');
      }
      const { error } = await withTimeout(
        supabase.from('profiles').update({ has_onboarded: true }).eq('id', user.id).abortSignal(controller.signal),
        15000,
        'Saving is taking too long. Please check your connection and try again.',
        () => controller.abort(),
      );
      if (error) throw error;
      setHasOnboarded(true);
      trackEvent('onboarding_completed');
      router.replace('/(main)/onboard-location');
      if (finalEmail === user.email) {
        // Eligibility is optional here: do not hold navigation for this request.
        supabase.functions.invoke('lookup-customer').then(({ data, error: lookupError }) => {
          const currentUser = useAuthStore.getState().user;
          if (!lookupError && data?.isAlmsteadCustomer && currentUser?.id === user.id) {
            useAuthStore.getState().setUser({ ...currentUser, is_almstead_customer: true });
          }
        }).catch(console.warn);
      }
    } catch (error) {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  const steps = [
    { num: '1', title: 'Snap a photo', desc: "Take a picture of the tree, shrub, or lawn issue" },
    { num: '2', title: 'Describe the problem', desc: "Tell us what you're seeing and when it started" },
    { num: '3', title: 'Add your location', desc: "So we can factor in local climate and conditions" },
    { num: '4', title: 'Get your diagnosis', desc: "AI-powered analysis with recommended next steps" },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: layout.headerPaddingTop }]} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
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
      </ScrollView>
      
      <View style={[styles.footer, { paddingBottom: layout.footerPaddingBottom }]}>
        <ProgressDots current={0} total={4} />
        <View style={{ marginTop: 20 }}>
          <Button onPress={handleNext} disabled={saving}>{saving ? 'Saving...' : 'Get Started'}</Button>
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
    flexGrow: 1,
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
