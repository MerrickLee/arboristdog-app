import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboard" />
      <Stack.Screen name="capture" />
      <Stack.Screen name="context" />
      <Stack.Screen name="location" />
      <Stack.Screen name="analyzing" />
      <Stack.Screen name="results" />
      <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
      <Stack.Screen name="confirm" />
    </Stack>
  );
}
