import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { TreeRingPaw, CheckIcon } from '../../components/ui/Icons';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { useAuthStore } from '../../stores/authStore';
import { useCreditStore } from '../../stores/creditStore';
import { performAnalysis } from '../../services/analysis';
import { Alert } from 'react-native';

const STEPS = [
  "Analyzing image...",
  "Checking regional conditions...",
  "Cross-referencing pest database...",
  "Generating diagnosis...",
];

export default function AnalyzingScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { deductCredit } = useCreditStore();
  const { 
    capturedImage, 
    selectedTags, 
    description, 
    location,
    setResult,
    setRemoteImageUrl
  } = useDiagnosisStore();
  const [currentStep, setCurrentStep] = useState(0);
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 1500);

    const startAnalysis = async () => {
      if (!user || !capturedImage) return;

      const response = await performAnalysis(user.id, capturedImage, {
        symptoms: selectedTags,
        description: description,
        location: location
      });

      if (response.success && response.result) {
        setResult(response.result);
        if (response.imageUrl) {
          setRemoteImageUrl(response.imageUrl);
        }
        deductCredit(); // Update local store
        router.replace('/(main)/results');
      } else {
        Alert.alert(
          'Analysis Failed',
          response.error || 'Something went wrong while analyzing your plant.',
          [{ text: 'Try Again', onPress: () => router.back() }]
        );
      }
    };

    startAnalysis();

    return () => clearInterval(stepInterval);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
        <TreeRingPaw size={64} />
      </Animated.View>
      
      <Text style={styles.title}>Analyzing...</Text>
      
      <View style={styles.stepsContainer}>
        {STEPS.map((s, i) => (
          <View key={i} style={[styles.stepItem, { opacity: i <= currentStep ? 1 : 0.3 }]}>
            {i < currentStep ? (
              <CheckIcon />
            ) : i === currentStep ? (
              <View style={styles.spinner} />
            ) : (
              <View style={styles.emptyCircle} />
            )}
            <Text style={[styles.stepText, { color: i <= currentStep ? '#fff' : 'rgba(255,255,255,0.4)' }]}>
              {s}
            </Text>
          </View>
        ))}
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
    paddingHorizontal: 40,
  },
  pulseCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: COLORS.leafAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 24,
  },
  stepsContainer: {
    width: '100%',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  stepText: {
    fontSize: 14,
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.leafAccent,
    borderTopColor: 'transparent',
    // In a real app we'd animate the rotation too
  },
  emptyCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
