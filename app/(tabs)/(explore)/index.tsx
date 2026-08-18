import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Bell, SlidersHorizontal, MapPin } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { MOCK_LISTINGS, CATEGORIES, Listing } from '@/utils/mockData';
import { ListingCard } from '@/components/ListingCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { CategoryChip } from '@/components/CategoryChip';
import { AnimatedPressable } from '@/components/AnimatedPressable';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setListings(MOCK_LISTINGS);
      setLoading(false);
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 800);
    return () => clearTimeout(timer);
  }, [headerOpacity]);

  const filteredListings = listings.filter((l) => {
    const matchesCategory = selectedCategory === 'All' || l.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cardWidth = (width - 16 * 2 - 12) / 2;

  const handleCategoryPress = (cat: string) => {
    console.log('[Explore] Category selected:', cat);
    setSelectedCategory(cat);
  };

  const handleSearchChange = (text: string) => {
    console.log('[Explore] Search query changed:', text);
    setSearchQuery(text);
  };

  const handleSortPress = () => {
    console.log('[Explore] Sort button pressed');
  };

  const handleBellPress = () => {
    console.log('[Explore] Notification bell pressed');
  };

  const listingCount = filteredListings.length;
  const listingCountText = `${listingCount} listing${listingCount !== 1 ? 's' : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '800',
                  fontFamily: 'Nunito_800ExtraBold',
                  color: COLORS.primary,
                  letterSpacing: -0.5,
                }}
              >
                NearSwap
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <MapPin size={13} color={COLORS.textSecondary} />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                    color: COLORS.textSecondary,
                  }}
                >
                  Brooklyn, NY
                </Text>
              </View>
            </View>
            <AnimatedPressable
              onPress={handleBellPress}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: COLORS.surface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: COLORS.border,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <Bell size={20} color={COLORS.text} />
            </AnimatedPressable>
          </View>

          {/* Search bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginTop: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 10,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <Search size={18} color={COLORS.textTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Search nearby listings…"
              placeholderTextColor={COLORS.textTertiary}
              style={{
                flex: 1,
                fontSize: 15,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.text,
              }}
            />
          </View>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
        >
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              selected={selectedCategory === cat}
              onPress={() => handleCategoryPress(cat)}
            />
          ))}
        </ScrollView>

        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              fontFamily: 'Nunito_700Bold',
              color: COLORS.text,
            }}
          >
            {loading ? 'Near You' : `Near You · ${listingCountText}`}
          </Text>
          <AnimatedPressable
            onPress={handleSortPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: COLORS.surface,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <SlidersHorizontal size={14} color={COLORS.textSecondary} />
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.textSecondary,
              }}
            >
              Sort
            </Text>
          </AnimatedPressable>
        </View>

        {/* Grid */}
        <View style={{ paddingHorizontal: 16 }}>
          {loading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ width: cardWidth }}>
                  <SkeletonCard />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {filteredListings.map((listing, index) => (
                <View key={listing.id} style={{ width: cardWidth }}>
                  <ListingCard listing={listing} index={index} />
                </View>
              ))}
              {filteredListings.length === 0 && (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 60,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      backgroundColor: COLORS.primaryMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Search size={32} color={COLORS.primary} />
                  </View>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '700',
                      fontFamily: 'Nunito_700Bold',
                      color: COLORS.text,
                    }}
                  >
                    No listings found
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Nunito_400Regular',
                      color: COLORS.textSecondary,
                      textAlign: 'center',
                      maxWidth: 260,
                    }}
                  >
                    Try a different category or search term
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
