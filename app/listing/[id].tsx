import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Animated,
  ImageSourcePropType,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Star, ChevronRight, Tag, MessageCircle, DollarSign } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/constants/Colors';
import { MOCK_LISTINGS, getRelativeTime } from '@/utils/mockData';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ConditionBadge } from '@/components/ConditionBadge';
import { StarRating } from '@/components/StarRating';

function resolveImageSource(source: string | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;

  const listing = MOCK_LISTINGS.find((l) => l.id === id);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
      Animated.timing(contentTranslateY, { toValue: 0, duration: 400, delay: 100, useNativeDriver: true }),
    ]).start();
  }, [contentOpacity, contentTranslateY]);

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>Listing not found</Text>
      </View>
    );
  }

  const postedDate = getRelativeTime(listing.createdAt);
  const priceDisplay = `$${listing.price.toLocaleString()}`;

  const handleBack = () => {
    console.log('[ListingDetail] Back pressed');
    router.back();
  };

  const handleViewProfile = () => {
    console.log('[ListingDetail] View seller profile:', listing.sellerId);
    router.push(`/seller/${listing.sellerId}`);
  };

  const handleMessage = () => {
    console.log('[ListingDetail] Message Seller pressed for listing:', listing.id);
    router.push(`/chat/c1`);
  };

  const handleOffer = () => {
    console.log('[ListingDetail] Make Offer pressed for listing:', listing.id, 'price:', listing.price);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={{ position: 'relative' }}>
          <Image
            source={resolveImageSource(listing.image)}
            resizeMode="cover"
            style={{ width: '100%', height: 300 }}
          />
          {/* Floating back button */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + 12,
              left: 16,
            }}
          >
            <AnimatedPressable onPress={handleBack}>
              <BlurView
                intensity={60}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.3)',
                }}
              >
                <ArrowLeft size={20} color={COLORS.text} />
              </BlurView>
            </AnimatedPressable>
          </View>
        </View>

        {/* Content */}
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
            padding: 20,
            gap: 0,
          }}
        >
          {/* Badges row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ConditionBadge condition={listing.condition} size="md" />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: COLORS.primaryMuted,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Tag size={12} color={COLORS.primary} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  fontFamily: 'Nunito_600SemiBold',
                  color: COLORS.primary,
                }}
              >
                {listing.category}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 24,
              fontWeight: '800',
              fontFamily: 'Nunito_800ExtraBold',
              color: COLORS.text,
              letterSpacing: -0.3,
              marginBottom: 8,
            }}
          >
            {listing.title}
          </Text>

          {/* Price */}
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              fontFamily: 'Nunito_800ExtraBold',
              color: COLORS.primary,
              letterSpacing: -0.5,
              marginBottom: 20,
            }}
          >
            {priceDisplay}
          </Text>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: COLORS.divider, marginBottom: 20 }} />

          {/* Seller row */}
          <AnimatedPressable onPress={handleViewProfile}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: COLORS.surface,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                marginBottom: 20,
              }}
            >
              <Image
                source={resolveImageSource(listing.sellerAvatar)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: COLORS.surfaceSecondary,
                }}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: 'Nunito_700Bold',
                    color: COLORS.text,
                  }}
                >
                  {listing.sellerName}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Nunito_400Regular',
                    color: COLORS.textSecondary,
                  }}
                >
                  {listing.sellerRegion}
                </Text>
                <StarRating rating={listing.sellerRating} size={13} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                    color: COLORS.primary,
                  }}
                >
                  View profile
                </Text>
                <ChevronRight size={14} color={COLORS.primary} />
              </View>
            </View>
          </AnimatedPressable>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: COLORS.divider, marginBottom: 20 }} />

          {/* Description */}
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              fontFamily: 'Nunito_700Bold',
              color: COLORS.text,
              marginBottom: 10,
            }}
          >
            About this item
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Nunito_400Regular',
              color: COLORS.textSecondary,
              lineHeight: 22,
              marginBottom: 16,
            }}
          >
            {listing.description}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Nunito_400Regular',
              color: COLORS.textTertiary,
            }}
          >
            Posted {postedDate}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <AnimatedPressable
          onPress={handleMessage}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 14,
            paddingVertical: 14,
            borderWidth: 1.5,
            borderColor: COLORS.primary,
            backgroundColor: 'transparent',
          }}
        >
          <MessageCircle size={18} color={COLORS.primary} />
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              fontFamily: 'Nunito_700Bold',
              color: COLORS.primary,
            }}
          >
            Message Seller
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={handleOffer}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 14,
            paddingVertical: 14,
            backgroundColor: COLORS.primary,
          }}
        >
          <DollarSign size={18} color="#FFFFFF" />
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              fontFamily: 'Nunito_700Bold',
              color: '#FFFFFF',
            }}
          >
            Make Offer
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}
