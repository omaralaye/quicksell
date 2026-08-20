import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Animated,
  useWindowDimensions,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Bell, SlidersHorizontal, MapPin, Check, X, ArrowUpDown } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { CATEGORIES } from '@/utils/mockData';
import { fetchListings, ListingWithSeller } from '@/utils/supabase';
import { ListingCard } from '@/components/ListingCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { CategoryChip } from '@/components/CategoryChip';
import { AnimatedPressable } from '@/components/AnimatedPressable';

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'popular';

const SORT_OPTIONS: { id: SortOption; label: string; description: string }[] = [
  { id: 'newest', label: 'Newest First', description: 'Show recently added items first' },
  { id: 'price_asc', label: 'Price: Low to High', description: 'Show cheapest items first' },
  { id: 'price_desc', label: 'Price: High to Low', description: 'Show most expensive items first' },
  { id: 'popular', label: 'Most Popular', description: 'Items with high views and interest' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState<SortOption>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ListingWithSeller[]>([]);
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadListings = async (category: string, search: string, sort: SortOption) => {
    console.log('[Explore] fetchListings', { category, search, sort });
    setLoading(true);
    try {
      let data = await fetchListings(category, search || undefined, sort);
      // Client-side fallback sort to guarantee instant sort ordering
      if (sort === 'price_asc') {
        data = [...data].sort((a, b) => a.price - b.price);
      } else if (sort === 'price_desc') {
        data = [...data].sort((a, b) => b.price - a.price);
      }
      setListings(data);
    } catch (err) {
      console.error('[Explore] fetchListings error:', err);
    } finally {
      setLoading(false);
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  // Initial load
  useEffect(() => {
    loadListings('All', '', 'newest');
  }, []);

  // Re-fetch when category or sort changes (immediate)
  useEffect(() => {
    loadListings(selectedCategory, searchQuery, selectedSort);
  }, [selectedCategory, selectedSort]);

  // Re-fetch when search changes (debounced 300ms)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      loadListings(selectedCategory, searchQuery, selectedSort);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

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
    setSortModalVisible(true);
  };

  const handleSelectSort = (option: SortOption) => {
    console.log('[Explore] Sort selected:', option);
    setSelectedSort(option);
    setSortModalVisible(false);
  };

  const handleBellPress = () => {
    console.log('[Explore] Navigating to notifications screen');
    router.push('/notifications');
  };

  const listingCount = listings.length;
  const listingCountText = `${listingCount} listing${listingCount !== 1 ? 's' : ''}`;

  const currentSortLabel = SORT_OPTIONS.find((s) => s.id === selectedSort)?.label ?? 'Sort';

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
                position: 'relative',
              }}
            >
              <Bell size={20} color={COLORS.text} />
              {/* Unread Badge */}
              <View
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 11,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: COLORS.primary,
                  borderWidth: 1.5,
                  borderColor: COLORS.surface,
                }}
              />
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
              backgroundColor: selectedSort !== 'newest' ? COLORS.primaryMuted : COLORS.surface,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderWidth: 1,
              borderColor: selectedSort !== 'newest' ? COLORS.primary : COLORS.border,
            }}
          >
            <SlidersHorizontal size={14} color={selectedSort !== 'newest' ? COLORS.primary : COLORS.textSecondary} />
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Nunito_700Bold',
                color: selectedSort !== 'newest' ? COLORS.primary : COLORS.textSecondary,
              }}
            >
              {selectedSort === 'newest' ? 'Sort' : currentSortLabel}
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
              {listings.map((listing, index) => (
                <View key={listing.id} style={{ width: cardWidth }}>
                  <ListingCard listing={listing} index={index} />
                </View>
              ))}
              {listings.length === 0 && (
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

      {/* Sort Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 24,
            }}
          >
            {/* Sheet Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: COLORS.border,
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />

            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ArrowUpDown size={20} color={COLORS.primary} />
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: 'Nunito_800ExtraBold',
                    color: COLORS.text,
                  }}
                >
                  Sort Listings
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSortModalVisible(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: COLORS.surfaceSecondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Options list */}
            <View style={{ gap: 10 }}>
              {SORT_OPTIONS.map((option) => {
                const isSelected = selectedSort === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => handleSelectSort(option.id)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      borderRadius: 14,
                      backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: isSelected ? COLORS.primary : 'transparent',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                          color: isSelected ? COLORS.primary : COLORS.text,
                          marginBottom: 2,
                        }}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: 'Nunito_400Regular',
                          color: COLORS.textSecondary,
                        }}
                      >
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: COLORS.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
