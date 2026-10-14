import { useAdaptiveLayout } from '../../hooks/useAdaptiveLayout';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Linking, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, TreeRingPaw } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useCreditStore } from '../../stores/creditStore';
import { useAuthStore } from '../../stores/authStore';
import { getAvailableOfferings, purchasePackage, restorePurchases, getPurchaseStatus, hasActiveSubscription } from '../../services/purchases';
import { syncPurchasedCredits } from '../../services/credits';
import { supabase } from '../../services/supabase';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

export default function CreditsScreen() {
  const layout = useAdaptiveLayout();
  const router = useRouter();
  const { user } = useAuthStore();
  const { creditsRemaining, setCreditsRemaining } = useCreditStore();
  const [purchased, setPurchased] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [verifyingZip, setVerifyingZip] = useState(false);

  // Calculate dynamic reset date (1st of next month)
  const getResetDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  useTrackScreen('Credits');

  React.useEffect(() => {
    fetchOfferings();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') fetchOfferings();
    });
    return () => listener.remove();
  }, [user?.id]);

  const fetchOfferings = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      setOffering(await getAvailableOfferings(user.id));
      setSubscriptionActive(hasActiveSubscription(await getPurchaseStatus(user.id)));
      await refreshBalance();
    } catch {
      setOffering(null);
    } finally { setLoading(false); }
  };

  const refreshBalance = async () => {
    const result = await syncPurchasedCredits();
    setCreditsRemaining(result.balance);
    setCreditsAdded(result.creditsAdded);
    setSubscriptionActive(result.subscriptionActive);
    return result;
  };

  const handlePurchase = async (pack: PurchasesPackage) => {
    if (!user || processing) return;
    setProcessing(true);
    try {
      trackEvent('purchase_initiated', { package_id: pack.identifier });
      const response = await purchasePackage(pack, user.id);
      if (response.success) {
        await refreshBalance();
        setPurchased(true);
        trackEvent('purchase_completed', { package_id: pack.identifier });
      } else if (!response.cancelled) {
        Alert.alert('Purchase not completed', response.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Balance update pending', error instanceof Error ? error.message : 'Please try Restore Purchases shortly.');
    } finally { setProcessing(false); }
  };

  const handleRestore = async () => {
    if (!user || processing) return;
    setProcessing(true);
    try {
      await restorePurchases(user.id);
      const result = await refreshBalance();
      Alert.alert('Purchases checked', `${result.subscriptionActive ? 'Your subscription is active. ' : 'No active subscription found. '}Your balance is ${result.balance} scans. Previously credited purchases are never added twice. Consumable scans remain linked to this Arborist Dog account.`);
    } catch (error) {
      Alert.alert('Unable to restore', error instanceof Error ? error.message : 'Please try again.');
    } finally { setProcessing(false); }
  };

  const openLink = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert('Unable to open link', 'Please try again later.'); }
  };

  const verifyZipCode = async () => {
    if (!user || !/^\d{5}$/.test(zipInput)) {
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
      <ScrollView style={styles.container} contentContainerStyle={[{ flexGrow: 1, paddingTop: layout.headerPaddingTop, paddingBottom: layout.footerPaddingBottom }, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={styles.successIcon}>
          <Text style={{ fontSize: 24 }}>✓</Text>
        </View>
        <Text style={styles.title}>Purchase confirmed</Text>
        <Text style={styles.subtitle}>{creditsAdded} scans have been added to your account.</Text>
        <Text style={styles.bigCredit}>{creditsRemaining} scans available</Text>
        <View style={{ width: 220 }}>
          <Button variant="secondary" onPress={() => router.back()}>Back to diagnosis</Button>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: layout.headerPaddingTop }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: layout.footerPaddingBottom }]}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>SCANS REMAINING</Text>
          <Text style={styles.balanceNum}>{creditsRemaining}</Text>
          <Text style={styles.balanceSub}>Free monthly scans renew {getResetDate()}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.leafAccent} />
        ) : offering && offering.availablePackages?.length > 0 ? (
          offering.availablePackages.map((pack: PurchasesPackage) => (
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
                  <Text style={styles.packPriceSub}>{pack.product.subscriptionPeriod ? ({ P1M: 'Per month', P1Y: 'Per year', P1W: 'Per week' }[pack.product.subscriptionPeriod] || `Period: ${pack.product.subscriptionPeriod}`) : 'One-time purchase'}</Text>
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
        ) : !loading && (
          <View style={styles.emptyOfferingsCard}>
            <Text style={styles.emptyOfferingsTitle}>No packages available yet</Text>
            <Text style={styles.emptyOfferingsSub}>
              Purchases are temporarily unavailable. Please try again shortly. In the meantime, you can earn free scans by verifying your zip code below or by being an Almstead customer.
            </Text>
          </View>
        )}

        {subscriptionActive && <Text style={styles.ctaSub}>Monthly subscription active</Text>}
        <Text style={styles.ctaSub}>Subscriptions renew automatically unless canceled at least 24 hours before the period ends. Payment is charged to your Apple Account. Manage or cancel in App Store subscriptions. Purchased scan packs do not expire.</Text>
        <TouchableOpacity style={styles.restoreBtn} onPress={fetchOfferings} disabled={processing}><Text style={styles.restoreText}>Refresh packages</Text></TouchableOpacity>
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={processing || loading}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.restoreBtn} onPress={() => openLink('https://apps.apple.com/account/subscriptions')}><Text style={styles.restoreText}>Manage Subscriptions</Text></TouchableOpacity>
        <TouchableOpacity style={styles.restoreBtn} onPress={() => openLink('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}><Text style={styles.restoreText}>Terms of Use (EULA)</Text></TouchableOpacity>
        {process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL && <TouchableOpacity style={styles.restoreBtn} onPress={() => openLink(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL!)}><Text style={styles.restoreText}>Privacy Policy</Text></TouchableOpacity>}
        {!user?.is_almstead_customer && !user?.in_target_area && (
          <View style={styles.zipCodeContainer}>
            <Text style={styles.zipCodeTitle}>Get 5 Free Scans / Month</Text>
            <Text style={styles.zipCodeSub}>Check if you’re in our service area to unlock more free monthly scans.</Text>
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
      </ScrollView>
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
    paddingBottom: 48,
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
    flexWrap: 'wrap',
    gap: 12,
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
  emptyOfferingsCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  emptyOfferingsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyOfferingsSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
