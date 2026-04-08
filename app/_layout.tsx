import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function RootLayout() {
  const { user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  if (!isMounted) return null;

  return <Slot />;
}
