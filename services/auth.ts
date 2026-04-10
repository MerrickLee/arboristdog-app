import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Warm up the browser on Android/web ahead of time for faster Google OAuth
WebBrowser.maybeCompleteAuthSession();

// ─── Apple Sign-In ────────────────────────────────────────────────────────────

/**
 * Native Apple Sign-In via expo-apple-authentication.
 * Works in Expo Go on a real device and in development/production builds.
 * Uses Supabase's signInWithIdToken to exchange the Apple credential.
 */
export const signInWithApple = async (): Promise<void> => {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS.');
  }

  // Check if Apple Sign In is available (requires iOS 13+)
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Apple Sign-In is not available on this device.');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple Sign-In failed: no identity token returned.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: credential.authorizationCode ?? undefined,
  });

  if (error) throw error;

  // On success, supabase.auth.onAuthStateChange in _layout.tsx fires automatically.
};

// ─── Google Sign-In ───────────────────────────────────────────────────────────

/**
 * Google Sign-In via Supabase OAuth + expo-web-browser.
 * Works in Expo Go (web redirect flow).
 * On success, supabase.auth.onAuthStateChange fires automatically.
 */
export const signInWithGoogle = async (): Promise<void> => {
  const redirectTo = makeRedirectUri();

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (oauthError) throw oauthError;
  if (!data.url) throw new Error('Google Sign-In failed: no OAuth URL returned.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    // With implicit flow, Supabase returns tokens in the URL hash fragment:
    // exp://127.0.0.1:8081#access_token=...&refresh_token=...
    const url = result.url;
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');

    // Support both hash-fragment (implicit) and query-param (pkce fallback) responses
    const paramString =
      hashIndex !== -1
        ? url.slice(hashIndex + 1)
        : queryIndex !== -1
        ? url.slice(queryIndex + 1)
        : '';

    const params = new URLSearchParams(paramString);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
      // onAuthStateChange in _layout.tsx detects the new session and navigates.
    } else {
      // Fallback: try PKCE-style code exchange (production builds)
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(url);
      if (sessionError) throw sessionError;
    }
  } else if (result.type === 'cancel' || result.type === 'dismiss') {
    return;
  }
};
