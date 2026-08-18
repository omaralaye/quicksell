import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { COLORS } from '@/constants/Colors';

function SkeletonBlock({ width, height, borderRadius = 8 }: { width: number | string; height: number; borderRadius?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: width as number,
        height,
        borderRadius,
        backgroundColor: COLORS.surfaceSecondary,
        opacity,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      }}
    >
      <SkeletonBlock width="100%" height={160} borderRadius={0} />
      <View style={{ padding: 12, gap: 8 }}>
        <SkeletonBlock width={60} height={10} />
        <SkeletonBlock width="80%" height={14} />
        <SkeletonBlock width="60%" height={12} />
        <SkeletonBlock width={40} height={12} />
      </View>
    </View>
  );
}
