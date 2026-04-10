import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ExpoLocation from 'expo-location';
import { COLORS } from '../../constants/theme';
import { BackArrow, LocationIcon } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { ProgressDots } from '../../components/ui/ProgressDots';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

export default function LocationScreen() {
  const router = useRouter();
  const { setLocation } = useDiagnosisStore();

  useTrackScreen('Location');
  const [structuredAddress, setStructuredAddress] = useState<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>({});

  const handleGPSLocation = async () => {
    trackEvent('location_method_used', { method: 'gps' });
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await ExpoLocation.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Reverse geocode to get split fields
      const [addressResult] = await ExpoLocation.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addressResult) {
        const street = addressResult.street || addressResult.name || "";
        const city = addressResult.city || "";
        const state = addressResult.region || "";
        const zip = addressResult.postalCode || "";

        setStructuredAddress({ street, city, state, zip });
        setAddress(`${street}, ${city}, ${state} ${zip}`.trim().replace(/^,/, ''));
        
        setLocation({ 
          address: `${street}, ${city}, ${state} ${zip}`.trim().replace(/^,/, ''),
          street,
          city,
          state,
          zip,
          propertyType,
          coordinates: { lat: latitude, lng: longitude }
        });
      } else {
        setAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const handleNext = () => {
    setLocation({ 
      address, 
      ...structuredAddress,
      propertyType 
    });
    trackEvent('location_submitted', { method: address ? 'manual' : 'gps', property_type: propertyType });
    router.push('/(main)/analyzing');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.stepText}>STEP 3 OF 4</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <LocationIcon color={COLORS.leafAccent} size={40} />
        <Text style={styles.title}>Where is your property?</Text>
        <Text style={styles.subtitle}>Your location helps us factor in regional soil, climate, and pest conditions.</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter your address..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        <TouchableOpacity style={styles.gpsButton} onPress={handleGPSLocation}>
          <Text style={styles.gpsIcon}>◎</Text>
          <Text style={styles.gpsText}>Use my current location</Text>
        </TouchableOpacity>

        <Text style={styles.label}>PROPERTY TYPE</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, propertyType === 'residential' ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => setPropertyType('residential')}
          >
            <Text style={[styles.toggleText, propertyType === 'residential' ? styles.toggleTextActive : styles.toggleTextInactive]}>
              Residential
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, propertyType === 'commercial' ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => setPropertyType('commercial')}
          >
            <Text style={[styles.toggleText, propertyType === 'commercial' ? styles.toggleTextActive : styles.toggleTextInactive]}>
              Commercial
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapPlaceholder}>
          <LocationIcon color={COLORS.leafAccent} size={32} />
        </View>

        <View style={styles.privacyNotice}>
          <Text style={styles.privacyText}>
            Your address is only used for diagnostic accuracy and to check if professional services are available in your area.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <ProgressDots current={2} total={4} />
        <View style={{ marginTop: 16 }}>
          <Button onPress={handleNext}>Analyze My Plant</Button>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  stepText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
    lineHeight: 21,
  },
  inputContainer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  input: {
    color: '#fff',
    fontSize: 15,
    padding: 16,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    marginBottom: 24,
  },
  gpsIcon: {
    color: COLORS.leafAccent,
    fontSize: 18,
    marginRight: 8,
  },
  gpsText: {
    color: COLORS.leafAccent,
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    borderColor: COLORS.leafAccent,
    backgroundColor: 'rgba(123,201,80,0.12)',
  },
  toggleInactive: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.leafAccent,
  },
  toggleTextInactive: {
    color: 'rgba(255,255,255,0.6)',
  },
  mapPlaceholder: {
    height: 160,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  privacyNotice: {
    backgroundColor: 'rgba(212,160,23,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.2)',
    borderRadius: 10,
    padding: 12,
  },
  privacyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    paddingTop: 16,
  },
});
