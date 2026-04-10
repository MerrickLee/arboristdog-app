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
  // Build the redirect URI that Supabase will redirect back to after OAuth.
  // In Expo Go this resolves to the local Metro dev URL; in a build it uses the app scheme.
  const redirectTo = makeRedirectUri();

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true, // We open the browser manually below
    },
  });

  if (oauthError) throw oauthError;
  if (!data.url) throw new Error('Google Sign-In failed: no OAuth URL returned.');

  // Open the Google OAuth page in a browser. Expo handles closing it
  // automatically when the redirect URI is detected.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    // Exchange the auth code / hash fragment for a Supabase session.
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(
      result.url
    );
    if (sessionError) throw sessionError;
    // onAuthStateChange in _layout.tsx will detect the new session and navigate.
  } else if (result.type === 'cancel' || result.type === 'dismiss') {
    // User cancelled — not an error, just do nothing.
    return;
  }
};
