import React from 'react';
import { View, Text } from 'react-native';
import { Star } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';

interface StarRatingProps {
  rating: number;
  size?: number;
  showNumber?: boolean;
}

export function StarRating({ rating, size = 14, showNumber = true }: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  const ratingDisplay = rating.toFixed(1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} size={size} color="#F59E0B" fill="#F59E0B" />
      ))}
      {hasHalf && (
        <Star key="half" size={size} color="#F59E0B" fill="transparent" />
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} size={size} color="#D1D5DB" fill="transparent" />
      ))}
      {showNumber && (
        <Text
          style={{
            fontSize: size,
            fontWeight: '600',
            fontFamily: 'Nunito_600SemiBold',
            color: COLORS.textSecondary,
            marginLeft: 2,
          }}
        >
          {ratingDisplay}
        </Text>
      )}
    </View>
  );
}
