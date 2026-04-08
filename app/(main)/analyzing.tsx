import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { TreeRingPaw, CheckIcon } from '../../components/ui/Icons';
import { useDiagnosisStore } from '../../stores/diagnosisStore';

const STEPS = [
  "Analyzing image...",
  "Checking regional conditions...",
  "Cross-referencing pest database...",
  "Generating diagnosis...",
];

export default function AnalyzingScreen() {
  const router = useRouter();
  const { setResult } = useDiagnosisStore();
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
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setCurrentStep(i), i * 1200)
    );
    const done = setTimeout(() => {
      // Mock result setting
      setResult({
        condition_name: "Anthracnose Leaf Blight",
        confidence: 87,
        severity: "moderate",
        explanation: "Anthracnose is a group of fungal diseases causing dark, sunken lesions on leaves, stems, and fruit. Common in the Northeast during cool, wet spring conditions. Your location in the NY/NJ/CT area and recent rainfall patterns are consistent with this diagnosis.",
        actions: [
          { priority: "Now", text: "Remove and dispose of affected leaves to reduce spread", color: "#D4534B" },
          { priority: "Soon", text: "Improve air circulation through targeted pruning", color: COLORS.alertAmber },
          { priority: "Seasonal", text: "Apply preventive fungicide treatment in early spring", color: COLORS.almsteadGreen },
        ]
      });
      router.replace('/(main)/results');
    }, STEPS.length * 1200 + 800);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
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
