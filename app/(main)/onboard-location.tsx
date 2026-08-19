import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ExpoLocation from 'expo-location';
import { COLORS } from '../../constants/theme';
import { LocationIcon, TreeRingPaw } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

export default function OnboardLocationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditing = params.edit === 'true';
  const { user, updateProfile } = useAuthStore();

  useTrackScreen('OnboardLocation');

  const [street, setStreet] = useState(user?.address || '');
  const [city, setCity] = useState(user?.city || '');
  const [state, setState] = useState(user?.state || '');
  const [zip, setZip] = useState(user?.zip || '');
  const [propertyType, setPropertyType] = useState<'residential' | 'commercial'>(
    user?.property_type || 'residential'
  );
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGPSDetect = async () => {
    setDetecting(true);
    trackEvent('onboard_location_gps');
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please enable location access to auto-detect your address.');
        setDetecting(false);
        return;
      }

      const location = await ExpoLocation.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const [result] = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });

      if (result) {
        setStreet(result.street || result.name || '');
        setCity(result.city || '');
        setState(result.region || '');
        setZip(result.postalCode || '');
      }
    } catch (err) {
      console.error('[OnboardLocation] GPS error:', err);
      Alert.alert('Detection failed', 'Could not detect your location. Please enter it manually.');
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    if (!zip.trim()) {
      Alert.alert('ZIP code required', 'Please enter at least your ZIP code so we can provide accurate diagnoses.');
      return;
    }

    setSaving(true);
    trackEvent('onboard_location_saved', { method: street ? 'full' : 'zip_only', property_type: propertyType });

    const fullAddress = [street, city, state, zip].filter(Boolean).join(', ');

    const success = await updateProfile({
      address: fullAddress,
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      property_type: propertyType,
    });

    setSaving(false);

    if (success) {
      if (isEditing) {
        router.back();
      } else {
        router.replace('/(main)/capture');
      }
    } else {
      Alert.alert('Save failed', 'Could not save your location. Please try again.');
    }
  };

  const handleSkip = () => {
    trackEvent('onboard_location_skipped');
    router.replace('/(main)/capture');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.logoSection}>
          <View style={styles.iconWrap}>
            <LocationIcon color={COLORS.leafAccent} size={36} />
          </View>
          <Text style={styles.title}>
            {isEditing ? 'Update Your Location' : 'Where are you located?'}
          </Text>
          <Text style={styles.subtitle}>
            Your location helps us factor in regional soil, climate, and pest conditions for more accurate diagnoses.
          </Text>
        </View>

        {/* GPS Auto-detect */}
        <TouchableOpacity
          style={styles.gpsButton}
          onPress={handleGPSDetect}
          disabled={detecting}
          activeOpacity={0.7}
        >
          {detecting ? (
            <ActivityIndicator color={COLORS.leafAccent} size="small" />
          ) : (
            <Text style={styles.gpsIcon}>◎</Text>
          )}
          <Text style={styles.gpsText}>
            {detecting ? 'Detecting...' : 'Auto-detect my location'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Manual Entry */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>STREET ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main St"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={street}
            onChangeText={setStreet}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 2 }]}>
            <Text style={styles.label}>CITY</Text>
            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={city}
              onChangeText={setCity}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>STATE</Text>
            <TextInput
              style={styles.input}
              placeholder="NY"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={state}
              onChangeText={setState}
              maxLength={2}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>ZIP CODE *</Text>
          <TextInput
            style={styles.input}
            placeholder="10001"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={zip}
            onChangeText={setZip}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>

        {/* Property Type */}
        <Text style={styles.label}>PROPERTY TYPE</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, propertyType === 'residential' ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => setPropertyType('residential')}
          >
            <Text style={styles.toggleEmoji}>⌂</Text>
            <Text style={[styles.toggleText, propertyType === 'residential' ? styles.toggleTextActive : styles.toggleTextInactive]}>
              Residential
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, propertyType === 'commercial' ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => setPropertyType('commercial')}
          >
            <Text style={styles.toggleEmoji}>▦</Text>
            <Text style={[styles.toggleText, propertyType === 'commercial' ? styles.toggleTextActive : styles.toggleTextInactive]}>
              Commercial
            </Text>
          </TouchableOpacity>
        </View>

        {/* Privacy */}
        <View style={styles.privacyNotice}>
          <Text style={styles.privacyText}>
            🔒 Your address is only used for diagnostic accuracy and to check if Almstead services are available in your area.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button onPress={handleSave} disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Location' : 'Continue'}
        </Button>
        {!isEditing && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canopyDark,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(123,201,80,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,201,80,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 10,
  },
  // GPS button
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(123,201,80,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(123,201,80,0.3)',
    borderRadius: 14,
    marginBottom: 20,
    gap: 10,
  },
  gpsIcon: {
    color: COLORS.leafAccent,
    fontSize: 20,
  },
  gpsText: {
    color: COLORS.leafAccent,
    fontSize: 15,
    fontWeight: '600',
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginHorizontal: 12,
  },
  // Inputs
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  // Toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  toggleActive: {
    borderColor: COLORS.leafAccent,
    backgroundColor: 'rgba(123,201,80,0.12)',
  },
  toggleInactive: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleEmoji: {
    fontSize: 22,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.leafAccent,
  },
  toggleTextInactive: {
    color: 'rgba(255,255,255,0.5)',
  },
  // Privacy
  privacyNotice: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  privacyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  // Footer
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 44,
    paddingTop: 12,
  },
  skipBtn: {
    alignItems: 'center',
    marginTop: 14,
  },
  skipText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
