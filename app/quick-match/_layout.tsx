import { Stack } from 'expo-router';

export default function QuickMatchLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="request"
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
    </Stack>
  );
}
