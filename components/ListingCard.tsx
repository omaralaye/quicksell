import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ListingWithSeller } from '@/utils/supabase';

interface ListingCardProps {
  listing: ListingWithSeller;
  index: number;
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export function ListingCard({ listing, index }: ListingCardProps) {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, index]);

  const priceDisplay = `$${Number(listing.price).toLocaleString()}`;
  const distanceDisplay = `~${(0.3 + index * 0.25).toFixed(1)} mi`;
  const sellerName = listing.seller?.display_name ?? '';

  const handlePress = () => {
    console.log('[ListingCard] Pressed listing:', listing.id, listing.title);
    router.push(`/listing/${listing.id}`);
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flex: 1 }}>
      <AnimatedPressable onPress={handlePress} style={{ flex: 1 }}>
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
          {/* Image */}
          <View style={{ position: 'relative' }}>
            <Image
              source={resolveImageSource(listing.image_url ?? undefined)}
              resizeMode="cover"
              style={{ width: '100%', aspectRatio: 1 }}
            />
            {/* Condition badge overlay */}
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  fontFamily: 'Nunito_600SemiBold',
                  color: '#FFFFFF',
                  letterSpacing: 0.2,
                }}
              >
                {listing.condition}
              </Text>
            </View>
            {listing.status === 'sold' && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    backgroundColor: '#DC2626',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: 'Nunito_700Bold',
                      color: '#FFFFFF',
                      letterSpacing: 0.5,
                    }}
                  >
                    SOLD
                  </Text>
                </View>
              </View>
            )}
            {listing.status === 'out_of_stock' && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    backgroundColor: '#D97706',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: 'Nunito_700Bold',
                      color: '#FFFFFF',
                      letterSpacing: 0.5,
                    }}
                  >
                    OUT OF STOCK
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Content */}
          <View style={{ padding: 10, gap: 3 }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                fontFamily: 'Nunito_700Bold',
                color: COLORS.primary,
              }}
            >
              {priceDisplay}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.text,
              }}
            >
              {listing.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.textSecondary,
              }}
            >
              {sellerName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <MapPin size={11} color={COLORS.textTertiary} />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.textTertiary,
                }}
              >
                {distanceDisplay}
              </Text>
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
