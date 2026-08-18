import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { View } from 'react-native';
import { COLORS } from '@/constants/Colors';

export default function TabLayout() {
  const tabs = [
    {
      name: '(explore)',
      route: '/(tabs)/(explore)' as const,
      icon: 'explore' as const,
      label: 'Explore',
    },
    {
      name: '(sell)',
      route: '/(tabs)/(sell)' as const,
      icon: 'add-circle' as const,
      label: 'Sell',
    },
    {
      name: '(inbox)',
      route: '/(tabs)/(inbox)' as const,
      icon: 'message' as const,
      label: 'Inbox',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen name="(explore)" />
        <Stack.Screen name="(sell)" />
        <Stack.Screen name="(inbox)" />
      </Stack>
      <FloatingTabBar tabs={tabs} containerWidth={280} />
    </View>
  );
}
