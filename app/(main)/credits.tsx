import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, TreeRingPaw } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useCreditStore } from '../../stores/creditStore';

export default function CreditsScreen() {
  const router = useRouter();
  const { creditsRemaining, addCredits } = useCreditStore();
  const [purchased, setPurchased] = useState(false);

  const handlePurchase = () => {
    // Mock purchase flow
    addCredits(3);
    setPurchased(true);
  };

  if (purchased) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={styles.successIcon}>
          <Text style={{ fontSize: 24 }}>✓</Text>
        </View>
        <Text style={styles.title}>Credits added!</Text>
        <Text style={styles.subtitle}>3 credits have been added to your account.</Text>
        <Text style={styles.bigCredit}>{creditsRemaining} scans available</Text>
        <View style={{ width: 220 }}>
          <Button variant="secondary" onPress={() => router.back()}>Back to diagnosis</Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>SCANS REMAINING</Text>
          <Text style={styles.balanceNum}>{creditsRemaining}</Text>
          <Text style={styles.balanceSub}>Resets May 1, 2026</Text>
        </View>

        <View style={styles.packCard}>
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
          <View style={styles.packHeader}>
            <View>
              <Text style={styles.packTitle}>3 Credits</Text>
              <Text style={styles.packSub}>3 additional diagnostic scans</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.packPrice}>$1</Text>
              <Text style={styles.packPriceSub}>one-time</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.applePayBtn} onPress={handlePurchase}>
            <Text style={styles.applePayText}>Buy with Apple Pay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.googlePayBtn} onPress={handlePurchase}>
            <Text style={styles.googlePayText}>Google Pay</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.almsteadCta}>
          <View style={styles.ctaIcon}>
            <TreeRingPaw size={24} />
          </View>
          <Text style={styles.ctaTitle}>Already an Almstead customer?</Text>
          <Text style={styles.ctaSub}>
            Verify your account and get unlimited scans for free. We'll check your email or property address against our records.
          </Text>
          <TouchableOpacity style={styles.verifyBtn}>
            <Text style={styles.verifyText}>Verify my account</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  balanceContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  balanceNum: {
    fontSize: 48,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  packCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: COLORS.leafAccent,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    position: 'relative',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: COLORS.leafAccent,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  packHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  packTitle: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  packSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  packPrice: {
    fontSize: 28,
    color: COLORS.leafAccent,
    fontWeight: '700',
  },
  packPriceSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  applePayBtn: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  applePayText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  googlePayBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  googlePayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  almsteadCta: {
    backgroundColor: 'rgba(123,201,80,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(123,201,80,0.2)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(123,201,80,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  ctaTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  ctaSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  verifyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.leafAccent,
  },
  verifyText: {
    color: COLORS.leafAccent,
    fontSize: 13,
    fontWeight: '600',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(123,201,80,0.15)',
    borderWidth: 2,
    borderColor: COLORS.leafAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  bigCredit: {
    fontSize: 32,
    color: COLORS.leafAccent,
    fontWeight: '700',
    marginVertical: 16,
    marginBottom: 32,
  },
});
