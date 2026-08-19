import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, TreeRingPaw, LocationIcon, TreeIcon, ClockIcon } from '../../components/ui/Icons';
import { useAuthStore } from '../../stores/authStore';
import { useCreditStore } from '../../stores/creditStore';
import { supabase } from '../../services/supabase';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { creditsRemaining } = useCreditStore();

  useTrackScreen('Settings');

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            trackEvent('sign_out');
            await supabase.auth.signOut();
            setUser(null);
          },
        },
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>
              {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          {user?.is_almstead_customer && (
            <View style={styles.almsteadBadge}>
              <TreeRingPaw size={14} />
              <Text style={styles.almsteadBadgeText}>Almstead Customer</Text>
            </View>
          )}
          {user?.in_target_area && !user?.is_almstead_customer && (
            <View style={[styles.almsteadBadge, { borderColor: 'rgba(123,201,80,0.4)' }]}>
              <Text style={styles.almsteadBadgeText}>In Service Area</Text>
            </View>
          )}
        </View>

        {/* Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SCAN CREDITS</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(main)/credits')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(123,201,80,0.15)' }]}>
                <TreeIcon size={18} color={COLORS.leafAccent} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Scan Balance</Text>
                <Text style={styles.menuSub}>{creditsRemaining} scans remaining</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <View style={{ height: 8 }} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push({ pathname: '/(main)/onboard-location', params: { edit: 'true' } })}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(212,160,23,0.15)' }]}>
                <LocationIcon color={COLORS.alertAmber} size={18} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Location</Text>
                <Text style={styles.menuSub} numberOfLines={1}>
                  {user?.zip ? `${user.city || ''} ${user.state || ''} ${user.zip}`.trim() : 'Not set'}
                </Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(main)/history')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(212,160,23,0.15)' }]}>
                <ClockIcon size={18} color={COLORS.alertAmber} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Scan History</Text>
                <Text style={styles.menuSub}>View past diagnoses</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEGAL</Text>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>☰</Text>
              </View>
              <Text style={styles.menuTitle}>Privacy Policy</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>☷</Text>
              </View>
              <Text style={styles.menuTitle}>Terms of Service</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>ArboristDog v{appVersion}</Text>
        <Text style={styles.powered}>Powered by Almstead Tree, Shrub & Lawn Care</Text>
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
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  // Profile card
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(123,201,80,0.2)',
    borderWidth: 2,
    borderColor: COLORS.leafAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 26,
    color: COLORS.leafAccent,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  almsteadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.leafAccent,
    backgroundColor: 'rgba(123,201,80,0.12)',
  },
  almsteadBadgeText: {
    fontSize: 12,
    color: COLORS.leafAccent,
    fontWeight: '600',
  },
  // Sections
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  menuSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 2,
  },
  // Sign out
  signOutBtn: {
    backgroundColor: 'rgba(229,57,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.25)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  signOutText: {
    color: '#E53935',
    fontSize: 15,
    fontWeight: '600',
  },
  // Footer
  version: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginBottom: 4,
  },
  powered: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
  },
});
