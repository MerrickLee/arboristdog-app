import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useCreditStore } from '../stores/creditStore';
import { initAnalytics, trackEvent, identifyUser } from '../services/analytics';
import { initPurchases } from '../services/purchases';
import { supabase } from '../services/supabase';

export default function RootLayout() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();
  const { setCredits } = useCreditStore();
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Initialize external services
    initAnalytics();
    initPurchases();

    // Track that the app was opened
    trackEvent('app_start');

    // Check for active session
    checkUser();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      fetchProfile(session.user.id);
    } else {
      setUser(null);
    }
  };

  const fetchProfile = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      setUser(data);
      // Identify the user in Heap so all events are attributed to them
      identifyUser(userId);
      // Also fetch credits
      fetchCredits(userId);
    } else {
      console.error("Error fetching profile:", error);
      setUser(null);
    }
  };

  const fetchCredits = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (data && !error) {
      setCredits(data.balance);
    }
  };

  useEffect(() => {
    if (!isMounted) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace('/(auth)');
    } else if (user && inAuthGroup) {
      // Redirect away from the sign-in page.
      if (!user.has_onboarded) {
        router.replace('/(main)/onboard');
      } else {
        router.replace('/(main)/capture');
      }
    }
  }, [user, segments, isMounted]);

  if (!isMounted || isLoading) return null;

  return <Slot />;
}
