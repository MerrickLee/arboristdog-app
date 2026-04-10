import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { TreeRingPaw, BackArrow } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { signInWithApple, signInWithGoogle } from '../../services/auth';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

// ─── Apple icon (simple  logo) ───────────────────────────────────────────────
const AppleIcon = () => (
  <Text style={{ fontSize: 18, color: '#000', marginRight: 8, lineHeight: 22 }}>
    
  </Text>
);

// ─── Google icon (using Unicode G) ───────────────────────────────────────────
const GoogleIcon = () => (
  <Text style={{ fontSize: 16, color: '#4285F4', fontWeight: '700', marginRight: 8 }}>
    G
  </Text>
);

export default function SignInScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [mode, setMode] = useState<null | 'manual'>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useTrackScreen('SignIn');

  // ── Email / manual sign-up ──────────────────────────────────────────────────
  const handleEmailAuth = async () => {
    if (!email || !name) {
      Alert.alert('Missing info', 'Please fill in your name and email.');
      return;
    }
    trackEvent('sign_in_attempted', { method: 'email' });
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: 'password123',
      options: {
        data: { full_name: name },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign-up error', error.message);
    }
    // On success, onAuthStateChange in _layout.tsx handles navigation.
  };

  // ── Apple Sign-In ───────────────────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    trackEvent('sign_in_attempted', { method: 'apple' });
    setAppleLoading(true);
    try {
      await signInWithApple();
      // Navigation handled by onAuthStateChange
    } catch (err: any) {
      // ERR_CANCELED means the user dismissed the sheet — not an error worth alerting
      if (err?.code !== 'ERR_CANCELED') {
        Alert.alert('Apple Sign-In failed', err?.message ?? 'Unknown error');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // ── Google Sign-In ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    trackEvent('sign_in_attempted', { method: 'google' });
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Navigation handled by onAuthStateChange
    } catch (err: any) {
      Alert.alert('Google Sign-In failed', err?.message ?? 'Unknown error');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Manual sign-up view ─────────────────────────────────────────────────────
  if (mode === 'manual') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setMode(null)}>
            <BackArrow />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Quick sign up so we can save your diagnoses.
          </Text>

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
          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
        <View style={styles.footer}>
          <Button onPress={handleEmailAuth}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Main sign-in view ───────────────────────────────────────────────────────
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
          Create an account to save your diagnoses and get personalized care
          recommendations.
        </Text>

        {/* Apple — iOS only, per Apple guidelines */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            id="btn-sign-in-apple"
            style={[styles.socialButton, { backgroundColor: '#fff' }]}
            onPress={handleAppleSignIn}
            disabled={appleLoading}
            activeOpacity={0.85}
          >
            {appleLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={styles.socialRow}>
                <AppleIcon />
                <Text style={[styles.socialText, { color: '#000' }]}>
                  Continue with Apple
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Google */}
        <TouchableOpacity
          id="btn-sign-in-google"
          style={[
            styles.socialButton,
            { backgroundColor: 'rgba(255,255,255,0.06)' },
          ]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          activeOpacity={0.85}
        >
          {googleLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.socialRow}>
              <GoogleIcon />
              <Text style={[styles.socialText, { color: '#fff' }]}>
                Continue with Google
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity
          id="btn-sign-in-email"
          style={[styles.socialButton, { backgroundColor: 'transparent' }]}
          onPress={() => setMode('manual')}
          activeOpacity={0.7}
        >
          <Text style={[styles.socialText, { color: '#fff' }]}>
            Sign up with email
          </Text>
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
    minHeight: 50,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
