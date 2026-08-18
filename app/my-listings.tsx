import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Animated,
  ImageSourcePropType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Pencil } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { MY_LISTINGS } from '@/utils/mockData';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function resolveImageSource(source: string | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

export default function MyListingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    console.log('[MyListings] Back pressed');
    router.back();
  };

  const handleEdit = (id: string, title: string) => {
    console.log('[MyListings] Edit pressed for listing:', id, title);
  };

  const handleListingPress = (id: string) => {
    console.log('[MyListings] Listing pressed:', id);
    router.push(`/listing/${id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 20,
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
              fontSize: 22,
              fontWeight: '800',
              fontFamily: 'Nunito_800ExtraBold',
              color: COLORS.text,
              letterSpacing: -0.3,
            }}
          >
            My Listings
          </Text>
        </View>

        {/* Listings */}
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {MY_LISTINGS.map((listing, index) => {
            const isActive = listing.status === 'active';
            const priceDisplay = `$${listing.price.toLocaleString()}`;

            return (
              <AnimatedListingRow
                key={listing.id}
                index={index}
                onPress={() => handleListingPress(listing.id)}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: COLORS.surface,
                    borderRadius: 14,
                    padding: 14,
                    gap: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <Image
                    source={resolveImageSource(listing.image)}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 10,
                      backgroundColor: COLORS.surfaceSecondary,
                    }}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        fontFamily: 'Nunito_700Bold',
                        color: COLORS.text,
                      }}
                    >
                      {listing.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        fontFamily: 'Nunito_700Bold',
                        color: COLORS.primary,
                      }}
                    >
                      {priceDisplay}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: isActive
                            ? 'rgba(45, 155, 111, 0.12)'
                            : COLORS.surfaceSecondary,
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            fontFamily: 'Nunito_600SemiBold',
                            color: isActive ? COLORS.accent : COLORS.textSecondary,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                          }}
                        >
                          {listing.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <AnimatedPressable
                    onPress={() => handleEdit(listing.id, listing.title)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: COLORS.surfaceSecondary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Pencil size={16} color={COLORS.textSecondary} />
                  </AnimatedPressable>
                </View>
              </AnimatedListingRow>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function AnimatedListingRow({
  index,
  children,
  onPress,
}: {
  index: number;
  children: React.ReactNode;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, index]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable onPress={onPress}>{children}</AnimatedPressable>
    </Animated.View>
  );
}
