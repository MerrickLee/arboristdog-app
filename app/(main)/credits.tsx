import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, TreeRingPaw } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useCreditStore } from '../../stores/creditStore';
import { useAuthStore } from '../../stores/authStore';
import { getAvailableOfferings, purchasePackage, restorePurchases } from '../../services/purchases';
import { syncPurchasedCredits } from '../../services/credits';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

export default function CreditsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { creditsRemaining, addCredits } = useCreditStore();
  const [purchased, setPurchased] = useState(false);
  const [offering, setOffering] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [verifyingZip, setVerifyingZip] = useState(false);

  useTrackScreen('Credits');

  React.useEffect(() => {
    fetchOfferings();
  }, []);

  const fetchOfferings = async () => {
    const currentOffering = await getAvailableOfferings();
    setOffering(currentOffering);
    setLoading(false);
  };

  const handlePurchase = async (pack: any) => {
    if (!user) return;
    trackEvent('purchase_initiated', { package_id: pack.identifier, price: pack.product.priceString });
    setProcessing(true);
    const response = await purchasePackage(pack);
    
    if (response.success) {
      const amount = pack.packageType === 'MONTHLY' ? 10 : (pack.product.metadata?.credit_count || 3);
      const sync = await syncPurchasedCredits(user.id, amount);
      if (sync.success) {
        addCredits(amount);
        setPurchased(true);
        trackEvent('purchase_completed', { package_id: pack.identifier, credits_added: amount });
      } else {
        Alert.alert("Success, but...", "Payment was successful, but we had trouble syncing your credits. Please try 'Restore Purchases'.");
      }
    } else if (!response.cancelled) {
      trackEvent('purchase_failed', { package_id: pack.identifier, error: response.error });
      Alert.alert("Purchase failed", response.error || "Something went wrong.");
    }
    setProcessing(false);
  };

  const handleRestore = async () => {
    setProcessing(true);
    const response = await restorePurchases();
    if (response.success) {
      Alert.alert("Check Complete", "Your purchases have been verified and synced.");
      // In a real app, you'd re-fetch the latest balance from Supabase here
    }
    setProcessing(false);
  };

  const verifyZipCode = async () => {
    if (zipInput.length < 5) {
      Alert.alert('Invalid Zip', 'Please enter a 5-digit zip code.');
      return;
    }
    setVerifyingZip(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-zipcode', {
        body: { zipcode: zipInput }
      });
      if (error) throw error;
      
      if (data?.inTargetArea) {
        Alert.alert('Success!', 'You are in our service area! We have upgraded you to 5 free scans per month.');
        // Re-fetch profile to update local state (in_target_area)
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
        if (profile) useAuthStore.getState().setUser(profile);
        // Also fetch latest credits
        const { data: creditsData } = await supabase.from('user_credits').select('balance').eq('user_id', user!.id).single();
        if (creditsData) {
          useCreditStore.getState().addCredits(creditsData.balance - useCreditStore.getState().creditsRemaining);
        }
      } else {
        Alert.alert('Not in service area', 'Sorry, that zip code is not currently in our priority service area. You still receive 1 free scan per month!');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to verify zip code.');
    }
    setVerifyingZip(false);
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

        {loading ? (
          <ActivityIndicator color={COLORS.leafAccent} />
        ) : offering && (
          offering.availablePackages.map((pack: any) => (
            <View key={pack.identifier} style={styles.packCard}>
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>POPULAR</Text>
              </View>
              <View style={styles.packHeader}>
                <View>
                  <Text style={styles.packTitle}>{pack.product.title}</Text>
                  <Text style={styles.packSub}>{pack.product.description}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.packPrice}>{pack.product.priceString}</Text>
                </View>
              </View>
              
              <Button 
                disabled={processing}
                onPress={() => handlePurchase(pack)}
              >
                {processing ? "Processing..." : `Buy Now`}
              </Button>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        {!user?.is_almstead_customer && !user?.in_target_area && (
          <View style={styles.zipCodeContainer}>
            <Text style={styles.zipCodeTitle}>Get 5 Free Scans / Month</Text>
            <Text style={styles.zipCodeSub}>Check if you're in our service area to unlock more free monthly scans.</Text>
            <View style={styles.zipCodeInputRow}>
              <TextInput 
                style={styles.zipCodeInput}
                placeholder="Enter Zip Code"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={zipInput}
                onChangeText={setZipInput}
                keyboardType="number-pad"
                maxLength={5}
              />
              <TouchableOpacity style={styles.zipCodeBtn} onPress={verifyZipCode} disabled={verifyingZip}>
                {verifyingZip ? <ActivityIndicator color="#fff" /> : <Text style={styles.zipCodeBtnText}>Check</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {user?.is_almstead_customer ? (
          <View style={[styles.almsteadCta, { backgroundColor: 'rgba(123,201,80,0.15)', borderColor: COLORS.leafAccent }]}>
            <View style={[styles.ctaIcon, { backgroundColor: COLORS.leafAccent }]}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>✓</Text>
            </View>
            <Text style={[styles.ctaTitle, { color: COLORS.leafAccent, fontSize: 16 }]}>Almstead Premium Active</Text>
            <Text style={styles.ctaSub}>
              Your account is linked to your Almstead profile. You have full access and unlimited free scans!
            </Text>
          </View>
        ) : (
          <View style={styles.almsteadCta}>
            <View style={styles.ctaIcon}>
              <TreeRingPaw size={24} />
            </View>
            <Text style={styles.ctaTitle}>Already an Almstead customer?</Text>
            <Text style={styles.ctaSub}>
              Sign up with the email associated with your Almstead account and automatically get unlimited scans for free!
            </Text>
          </View>
        )}
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
  restoreBtn: {
    alignItems: 'center',
    marginVertical: 20,
  },
  restoreText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  zipCodeContainer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  zipCodeTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  zipCodeSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  zipCodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zipCodeInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  zipCodeBtn: {
    backgroundColor: COLORS.leafAccent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  zipCodeBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
});
