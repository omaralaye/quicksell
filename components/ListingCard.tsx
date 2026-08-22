import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, ImageSourcePropType, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Star, Heart } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useAuth } from '@/contexts/AuthContext';
import { ListingWithSeller } from '@/utils/supabase';
import { useAppStore } from '@/store/useAppStore';
import { formatDistance } from '@/services/location';
import type { NearbyListing } from '@/services/location.types';
import { toggleFavoriteListing } from '@/services/favorites';
import { formatPriceCard } from '@/utils/currency';

export type AnyListing = (ListingWithSeller | NearbyListing) & {
  image_url?: string | null;
  seller_rating?: number | null;
  status?: string | null;
};

interface ListingCardProps {
  listing: AnyListing;
  index: number;
  isFavorited?: boolean;
  onFavoriteToggle?: (listingId: string, isFav: boolean) => void;
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  sold:         { label: 'Sold',          color: '#FFFFFF', bg: '#DC2626' },
  reserved:     { label: 'Reserved',      color: '#FFFFFF', bg: '#D97706' },
  out_of_stock: { label: 'Out of Stock',  color: '#FFFFFF', bg: '#6B7280' },
  SOLD:         { label: 'Sold',          color: '#FFFFFF', bg: '#DC2626' },
  ARCHIVED:     { label: 'Archived',      color: '#FFFFFF', bg: '#6B7280' },
};

export function ListingCard({ listing, index, isFavorited = false, onFavoriteToggle }: ListingCardProps) {
  const router  = useRouter();
  const { user: currentUser } = useAuth();
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const [fav, setFav] = useState(isFavorited);

  useEffect(() => { setFav(isFavorited); }, [isFavorited]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, delay: Math.min(index, 6) * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: Math.min(index, 6) * 50, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Data resolution ──────────────────────────────────────────────────────────

  const priceDisplay   = formatPriceCard(Number(listing.price), 'UGX');
  const distanceLabel  = formatDistance((listing as NearbyListing).distance_meters);
  const locationDisplay =
    distanceLabel ??
    (listing as NearbyListing).location_label ??
    (listing as NearbyListing).neighborhood ??
    (listing as any).region ??
    'Nearby';

  const sellerName   = ('seller' in listing ? listing.seller?.display_name : null) ?? (listing as NearbyListing).seller_display_name ?? 'Seller';
  const sellerId     = ('seller' in listing ? listing.seller?.id : null) ?? (listing as any).seller_id ?? '';
  const sellerRating = (listing as any).seller_rating ?? ('seller' in listing ? listing.seller?.rating : null);
  const isOnline     = useAppStore(state => state.onlineUsers[sellerId]);

  const status        = (listing as any).status as string | undefined;
  const statusConfig  = status ? STATUS_CONFIG[status] : null;
  const isUnavailable = !!statusConfig;
  const isAvailable   = !status || status === 'active' || status === 'ACTIVE';

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handlePress = () => router.push(`/listing/${listing.id}`);

  const handleToggleFavorite = async () => {
    if (!currentUser?.id) return;
    const nextFav = !fav;
    setFav(nextFav);
    const result = await toggleFavoriteListing(currentUser.id, listing.id, fav);
    setFav(result);
    onFavoriteToggle?.(listing.id, result);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flex: 1 }}>
      <AnimatedPressable onPress={handlePress} style={{ flex: 1 }}>
        <View style={styles.card}>

          {/* ── Image ─────────────────────────────────────── */}
          <View style={{ position: 'relative' }}>
            <Image
              source={resolveImageSource(listing.image_url ?? undefined)}
              resizeMode="cover"
              style={styles.image}
            />

            {/* Condition badge */}
            {listing.condition && (
              <View style={styles.conditionBadge}>
                <Text style={styles.conditionText}>{listing.condition.replace('_', ' ')}</Text>
              </View>
            )}

            {/* Status overlay (sold / reserved / out-of-stock) */}
            {isUnavailable && statusConfig && (
              <View style={styles.statusOverlay}>
                <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
                  <Text style={styles.statusPillText}>{statusConfig.label.toUpperCase()}</Text>
                </View>
              </View>
            )}

            {/* Heart / Favourite — 44×44 touch target */}
            <TouchableOpacity
              onPress={handleToggleFavorite}
              activeOpacity={0.8}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={styles.heartButton}
            >
              <Heart
                size={15}
                color={fav ? '#EF4444' : '#6B7280'}
                fill={fav ? '#EF4444' : 'transparent'}
              />
            </TouchableOpacity>
          </View>

          {/* ── Info ─────────────────────────────────────── */}
          <View style={styles.info}>

            {/* 1. WHAT — Title (most prominent) */}
            <Text numberOfLines={2} style={styles.title}>{listing.title}</Text>

            {/* 2. HOW MUCH — Price + Rating */}
            <View style={styles.priceRow}>
              <Text style={[styles.price, isUnavailable && styles.priceStruck]}>{priceDisplay}</Text>
              {sellerRating != null && (
                <View style={styles.ratingWrap}>
                  <Star size={10} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.ratingText}>{Number(sellerRating).toFixed(1)}</Text>
                </View>
              )}
            </View>

            {/* 3. WHERE — Location */}
            <View style={styles.locationRow}>
              <MapPin size={11} color={COLORS.textTertiary} />
              <Text numberOfLines={1} style={styles.locationText}>{locationDisplay}</Text>
            </View>

            {/* 4. WHO — Seller + online dot */}
            <View style={styles.sellerRow}>
              <Text numberOfLines={1} style={styles.sellerName}>{sellerName}</Text>
              {isOnline && <View style={styles.onlineDot} />}
            </View>

            {/* 5. AVAILABLE? */}
            {isAvailable && (
              <View style={styles.availBadge}>
                <Text style={styles.availText}>✓ Available</Text>
              </View>
            )}
          </View>

        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: {
    width: '100%' as const,
    aspectRatio: 1,
  },
  conditionBadge: {
    position: 'absolute' as const,
    top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  conditionText: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  statusOverlay: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heartButton: {
    position: 'absolute' as const,
    top: 6, right: 6,
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  info: {
    padding: 12,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.text,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  priceStruck: {
    textDecorationLine: 'line-through' as const,
    color: COLORS.textTertiary,
  },
  ratingWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
  },
  locationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  locationText: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
    flex: 1,
  },
  sellerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  sellerName: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
    flex: 1,
  },
  onlineDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  availBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: 'rgba(45,155,111,0.10)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  availText: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.accent,
    letterSpacing: 0.1,
  },
};
