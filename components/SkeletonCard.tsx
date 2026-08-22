/**
 * Skeleton loading components — synchronized pulse animation.
 * Exports:
 *   SkeletonBlock          — raw building block
 *   SkeletonCard           — grid listing card skeleton
 *   SkeletonConversationRow — inbox row (WhatsApp style)
 *   SkeletonListingDetail  — full listing detail page skeleton
 *   SkeletonProfileHeader  — profile header skeleton
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/Colors';

// ─── Shared animation ─────────────────────────────────────────────────────────

// Single shared value so all blocks pulse in sync when on the same screen.
let _sharedOpacity: Animated.Value | null = null;

function getSharedOpacity(): Animated.Value {
  if (!_sharedOpacity) {
    _sharedOpacity = new Animated.Value(0.4);
    Animated.loop(
      Animated.sequence([
        Animated.timing(_sharedOpacity, { toValue: 0.85, duration: 900, useNativeDriver: true }),
        Animated.timing(_sharedOpacity, { toValue: 0.4,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }
  return _sharedOpacity;
}

// ─── SkeletonBlock ────────────────────────────────────────────────────────────

export function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = getSharedOpacity();
  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: COLORS.surfaceSecondary, opacity },
        style,
      ]}
    />
  );
}

// ─── SkeletonCard (grid listing card) ─────────────────────────────────────────
// Mirrors the new ListingCard layout: image → title → price → location → seller

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width="100%" height={158} borderRadius={0} />
      <View style={styles.cardContent}>
        <SkeletonBlock width="88%" height={13} />
        <SkeletonBlock width="55%" height={13} style={{ marginTop: 2 }} />
        <SkeletonBlock width={110}  height={17} style={{ marginTop: 4 }} />
        <SkeletonBlock width="65%" height={11} style={{ marginTop: 2 }} />
        <SkeletonBlock width="50%" height={11} />
      </View>
    </View>
  );
}

// ─── SkeletonConversationRow (inbox, WhatsApp style) ──────────────────────────

export function SkeletonConversationRow() {
  return (
    <View style={styles.convRow}>
      <SkeletonBlock width={50} height={50} borderRadius={25} />
      <View style={styles.convContent}>
        <View style={styles.convHeader}>
          <SkeletonBlock width={130} height={13} />
          <SkeletonBlock width={32} height={11} />
        </View>
        <SkeletonBlock width="72%" height={12} style={{ marginTop: 7 }} />
      </View>
    </View>
  );
}

// ─── SkeletonListingDetail ────────────────────────────────────────────────────

export function SkeletonListingDetail() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Hero image */}
      <SkeletonBlock width="100%" height={320} borderRadius={0} />

      {/* Content */}
      <View style={styles.detailContent}>
        {/* Badge row */}
        <View style={styles.row}>
          <SkeletonBlock width={80} height={26} borderRadius={8} />
          <SkeletonBlock width={70} height={26} borderRadius={8} />
        </View>

        {/* Title */}
        <SkeletonBlock width="92%" height={21} style={{ marginTop: 16 }} />
        <SkeletonBlock width="60%" height={21} style={{ marginTop: 8 }} />

        {/* Price */}
        <SkeletonBlock width={150} height={30} borderRadius={6} style={{ marginTop: 14 }} />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Seller row */}
        <View style={[styles.row, { alignItems: 'center' }]}>
          <SkeletonBlock width={48} height={48} borderRadius={24} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock width={120} height={14} />
            <SkeletonBlock width={88} height={11} />
            <SkeletonBlock width={70}  height={11} />
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Description */}
        <SkeletonBlock width={130} height={16} style={{ marginBottom: 14 }} />
        <SkeletonBlock width="100%" height={12} style={{ marginBottom: 9 }} />
        <SkeletonBlock width="100%" height={12} style={{ marginBottom: 9 }} />
        <SkeletonBlock width="75%"  height={12} />
      </View>
    </View>
  );
}

// ─── SkeletonProfileHeader ────────────────────────────────────────────────────

export function SkeletonProfileHeader() {
  return (
    <View style={styles.profileHeader}>
      <SkeletonBlock width={88} height={88} borderRadius={44} />
      <View style={{ alignItems: 'center', gap: 10, marginTop: 14 }}>
        <SkeletonBlock width={140} height={18} />
        <SkeletonBlock width={100} height={13} />
      </View>
    </View>
  );
}

// ─── SkeletonSellerDashboard ──────────────────────────────────────────────────

export function SkeletonSellerDashboard() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>
      <View style={{ gap: 8 }}>
        <SkeletonBlock width={100} height={14} />
        <SkeletonBlock width={180} height={34} borderRadius={8} />
      </View>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SkeletonBlock width="48.5%" height={100} borderRadius={16} />
          <SkeletonBlock width="48.5%" height={100} borderRadius={16} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SkeletonBlock width="48.5%" height={100} borderRadius={16} />
          <SkeletonBlock width="48.5%" height={100} borderRadius={16} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={110} borderRadius={16} />
      <SkeletonBlock width="100%" height={140} borderRadius={16} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardContent: {
    padding: 12,
    gap: 7,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  convContent: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 20,
  },
});
