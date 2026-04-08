import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { TreeRingPaw, BackArrow } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';

export default function SignInScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [mode, setMode] = useState<null | 'manual' | 'phone_step'>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleAuth = (method: string) => {
    // Mocking auth response
    setUser({
      id: 'mock-user-id',
      name: name || 'Mock User',
      email: email || 'mock@example.com',
      phone: phone || '',
      auth_method: method,
      is_almstead_customer: false,
      has_onboarded: false,
    });
    router.replace('/(main)/onboard');
  };

  if (mode === 'manual') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setMode(null)}>
            <BackArrow />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Quick sign up so we can save your diagnoses.</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              style={styles.input}
              placeholder="(555) 555-5555"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <Text style={styles.termsText}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
        </ScrollView>
        <View style={styles.footer}>
          <Button onPress={() => handleAuth('email')}>Create Account</Button>
        </View>
      </KeyboardAvoidingView>
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
        <View style={styles.logoContainer}>
          <TreeRingPaw size={60} />
        </View>
        <Text style={styles.titleCenter}>Sign in</Text>
        <Text style={styles.subtitleCenter}>
          Create an account to save your diagnoses and get personalized care recommendations.
        </Text>

        <TouchableOpacity style={[styles.socialButton, { backgroundColor: '#fff' }]} onPress={() => setMode('phone_step')}>
          <Text style={[styles.socialText, { color: '#000' }]}>Continue with Apple</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.socialButton, { backgroundColor: 'rgba(255,255,255,0.06)' }]} onPress={() => setMode('phone_step')}>
          <Text style={[styles.socialText, { color: '#fff' }]}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity style={[styles.socialButton, { backgroundColor: 'transparent' }]} onPress={() => setMode('manual')}>
          <Text style={[styles.socialText, { color: '#fff' }]}>Sign up with email</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.footer}>
        <Text style={styles.termsTextCenter}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
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
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  titleCenter: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitleCenter: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 21,
  },
  title: {
    fontSize: 26,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
    lineHeight: 21,
  },
  socialButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  socialText: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  orText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginHorizontal: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 15,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  termsText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
  },
  termsTextCenter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
});
