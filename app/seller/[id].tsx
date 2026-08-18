import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Animated,
  ImageSourcePropType,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, ShoppingBag, TrendingUp, MessageCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { MOCK_LISTINGS } from '@/utils/mockData';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ListingCard } from '@/components/ListingCard';
import { StarRating } from '@/components/StarRating';

function resolveImageSource(source: string | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

export default function SellerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(16)).current;

  const sellerListings = MOCK_LISTINGS.filter((l) => l.sellerId === id);
  const seller = sellerListings[0] ?? MOCK_LISTINGS[0];

  const activeListings = sellerListings.filter((l) => l.status === 'active');
  const soldListings = sellerListings.filter((l) => l.status === 'sold');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
      Animated.timing(headerTranslateY, { toValue: 0, duration: 400, delay: 100, useNativeDriver: true }),
    ]).start();
  }, [headerOpacity, headerTranslateY]);

  const cardWidth = (width - 16 * 2 - 12) / 2;

  const handleBack = () => {
    console.log('[SellerProfile] Back pressed');
    router.back();
  };

  const handleMessage = () => {
    console.log('[SellerProfile] Message seller pressed:', id);
    router.push('/chat/c1');
  };

  const sellerName = seller.sellerName;
  const sellerRegion = seller.sellerRegion;
  const sellerRating = seller.sellerRating;
  const sellerAvatar = seller.sellerAvatar;
  const activeCount = activeListings.length;
  const soldCount = soldListings.length;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header bar */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AnimatedPressable
            onPress={handleBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.surface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <ArrowLeft size={20} color={COLORS.text} />
          </AnimatedPressable>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              fontFamily: 'Nunito_700Bold',
              color: COLORS.text,
            }}
          >
            Seller Profile
          </Text>
        </View>

        {/* Profile card */}
        <Animated.View
          style={{
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
            marginHorizontal: 16,
            marginBottom: 24,
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              padding: 20,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
              gap: 12,
            }}
          >
            <Image
              source={resolveImageSource(sellerAvatar)}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: COLORS.surfaceSecondary,
              }}
            />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  fontFamily: 'Nunito_800ExtraBold',
                  color: COLORS.text,
                  letterSpacing: -0.3,
                }}
              >
                {sellerName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MapPin size={13} color={COLORS.textSecondary} />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Nunito_400Regular',
                    color: COLORS.textSecondary,
                  }}
                >
                  {sellerRegion}
                </Text>
              </View>
              <StarRating rating={sellerRating} size={15} />
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.textTertiary,
                  marginTop: 2,
                }}
              >
                Member since Jan 2024
              </Text>
            </View>

            {/* Stats row */}
            <View
              style={{
                flexDirection: 'row',
                width: '100%',
                borderTopWidth: 1,
                borderTopColor: COLORS.divider,
                paddingTop: 16,
                gap: 0,
              }}
            >
              {[
                { icon: <ShoppingBag size={18} color={COLORS.primary} />, value: String(activeCount), label: 'Listings' },
                { icon: <TrendingUp size={18} color={COLORS.accent} />, value: String(soldCount), label: 'Sales' },
                { icon: <MessageCircle size={18} color={COLORS.warning} />, value: '98%', label: 'Response' },
              ].map((stat, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 4,
                    borderRightWidth: i < 2 ? 1 : 0,
                    borderRightColor: COLORS.divider,
                  }}
                >
                  {stat.icon}
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '800',
                      fontFamily: 'Nunito_800ExtraBold',
                      color: COLORS.text,
                    }}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Nunito_400Regular',
                      color: COLORS.textSecondary,
                    }}
                  >
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Message button */}
            <AnimatedPressable
              onPress={handleMessage}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: COLORS.primary,
                borderRadius: 12,
                paddingVertical: 13,
              }}
            >
              <MessageCircle size={18} color="#FFFFFF" />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  fontFamily: 'Nunito_700Bold',
                  color: '#FFFFFF',
                }}
              >
                Message {sellerName}
              </Text>
            </AnimatedPressable>
          </View>
        </Animated.View>

        {/* Active listings */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              fontFamily: 'Nunito_700Bold',
              color: COLORS.text,
              marginBottom: 14,
            }}
          >
            Active Listings
          </Text>
          {activeListings.length === 0 ? (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: 40,
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.textSecondary,
                }}
              >
                No active listings
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {activeListings.map((listing, index) => (
                <View key={listing.id} style={{ width: cardWidth }}>
                  <ListingCard listing={listing} index={index} />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
