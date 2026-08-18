import React from 'react';
import { Text } from 'react-native';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';

interface CategoryChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? COLORS.primary : COLORS.surface,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: selected ? COLORS.primary : COLORS.border,
        marginRight: 8,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          fontFamily: 'Nunito_600SemiBold',
          color: selected ? '#FFFFFF' : COLORS.textSecondary,
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
