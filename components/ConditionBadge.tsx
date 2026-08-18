import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@/constants/Colors';

interface ConditionBadgeProps {
  condition: string;
  size?: 'sm' | 'md';
}

function getConditionColor(condition: string): { bg: string; text: string } {
  switch (condition) {
    case 'New':
      return { bg: 'rgba(45, 155, 111, 0.15)', text: '#2D9B6F' };
    case 'Like New':
      return { bg: 'rgba(45, 155, 111, 0.12)', text: '#2D9B6F' };
    case 'Excellent':
      return { bg: 'rgba(232, 93, 38, 0.12)', text: COLORS.primary };
    case 'Good':
      return { bg: 'rgba(217, 119, 6, 0.12)', text: COLORS.warning };
    case 'Fair':
      return { bg: 'rgba(168, 162, 158, 0.2)', text: COLORS.textSecondary };
    default:
      return { bg: COLORS.surfaceSecondary, text: COLORS.textSecondary };
  }
}

export function ConditionBadge({ condition, size = 'sm' }: ConditionBadgeProps) {
  const colors = getConditionColor(condition);
  const isSmall = size === 'sm';

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderRadius: 6,
        paddingHorizontal: isSmall ? 6 : 10,
        paddingVertical: isSmall ? 2 : 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: isSmall ? 10 : 12,
          fontWeight: '600',
          color: colors.text,
          fontFamily: 'Nunito_600SemiBold',
          letterSpacing: 0.3,
        }}
      >
        {condition}
      </Text>
    </View>
  );
}
