import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Animated,
  useWindowDimensions,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Bell,
  SlidersHorizontal,
  MapPin,
  Check,
  X,
  ArrowUpDown,
  Navigation,
  AlertCircle,
  ChevronDown,
  Sparkles,
  Filter,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { CATEGORIES } from '@/utils/mockData';
import { ListingCard } from '@/components/ListingCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { CategoryChip } from '@/components/CategoryChip';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SearchFilterModal, FilterState } from '@/components/SearchFilterModal';
import { EmptyState } from '@/components/EmptyState';
import { useLocation } from '@/hooks/useLocation';
import { useRankedListings } from '@/hooks/useRankedListings';
import type { WeightProfile } from '@/services/ranking.types';
import {
  RADIUS_PRESET_ORDER,
  RADIUS_PRESET_LABELS,
  RADIUS_PRESET_METERS,
} from '@/services/location.types';
import type { RadiusPreset } from '@/services/location.types';
import { useAppStore } from '@/store/useAppStore';
import { fetchUserFavoriteIds } from '@/services/favorites';

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortOption = 'ranking' | 'nearest' | 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { id: SortOption; label: string; description: string }[] = [
  { id: 'ranking',    label: 'Recommended',         description: 'Proximity, trust and text relevance combined' },
  { id: 'nearest',    label: 'Nearest First',        description: 'Show closest items to your current location' },
  { id: 'newest',     label: 'Newest First',         description: 'Show recently added items first' },
  { id: 'price_asc',  label: 'Price: Low to High',   description: 'Show cheapest items first' },
  { id: 'price_desc', label: 'Price: High to Low',   description: 'Show most expensive items first' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // ── User state
  const currentUser = useAppStore(state => state.user);
  const [userFavoriteIds, setUserFavoriteIds] = useState<Set<string>>(new Set());

  // ── Filter state
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedSort, setSelectedSort]     = useState<SortOption>('ranking');
  const [selectedRadius, setSelectedRadius] = useState<RadiusPreset>('near_me');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [filterState, setFilterState] = useState<FilterState>({
    category: 'All',
    minPrice: '',
    maxPrice: '',
    condition: 'all',
    radius: 'near_me',
    availability: 'all',
    minRating: 0,
  });

  // ── Modal state
  const [sortModalVisible, setSortModalVisible]     = useState(false);
  const [radiusModalVisible, setRadiusModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Location
  const { location, getCurrentLocation, loading: locationLoading } = useLocation();

  // Load user favorites
  useEffect(() => {
    if (currentUser?.id) {
      fetchUserFavoriteIds(currentUser.id).then(ids => {
        setUserFavoriteIds(new Set(ids));
      });
    }
  }, [currentUser?.id]);

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Resolve radius preset → meters / hierarchy filter
  const activeRadius = filterState.radius || selectedRadius;
  const radiusMeters = (() => {
    const m = RADIUS_PRESET_METERS[activeRadius];
    return typeof m === 'number' ? m : 10000;
  })();

  const hierarchyFilters = (() => {
    const ctx = location.context;
    if (!ctx) return {};
    switch (activeRadius) {
      case 'neighborhood': return { filterNeighborhood: ctx.neighborhood };
      case 'city':         return { filterCity:         ctx.city };
      case 'district':     return { filterDistrict:     ctx.district };
      default:             return {};
    }
  })();

  // ── Ranking hook
  const {
    results: rankedResults,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore,
    loadMore,
    refresh,
  } = useRankedListings({
    coordinates:     location.coordinates,
    searchQuery:     debouncedQuery || undefined,
    radiusMeters,
    categoryId:      filterState.category !== 'All' ? filterState.category : undefined,
    minPrice:        filterState.minPrice ? Number(filterState.minPrice) : undefined,
    maxPrice:        filterState.maxPrice ? Number(filterState.maxPrice) : undefined,
    conditionFilter: filterState.condition !== 'all' ? filterState.condition : undefined,
    weightProfile:   'default' as WeightProfile,
    ...hierarchyFilters,
    autoFetch: true,
  });

  // ── Client-side filter & sort
  const listings = (() => {
    let list = [...rankedResults];

    // Availability filter
    if (filterState.availability === 'active') {
      list = list.filter(item => (item as any).status === 'active' || !(item as any).status);
    } else if (filterState.availability === 'reserved') {
      list = list.filter(item => (item as any).status === 'reserved');
    }

    // Min rating filter
    if (filterState.minRating > 0) {
      list = list.filter(item => {
        const rating = (item as any).seller_rating ?? 4.8;
        return rating >= filterState.minRating;
      });
    }

    // Sort
    if (selectedSort === 'nearest') {
      list.sort((a, b) => (a.distance_meters ?? 0) - (b.distance_meters ?? 0));
    } else if (selectedSort === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (selectedSort === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (selectedSort === 'newest') {
      list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    return list;
  })();

  // Fade in header after first load
  useEffect(() => {
    if (!loading) {
      Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [loading, headerOpacity]);

  // Request location on mount
  useEffect(() => {
    getCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardWidth = (width - 16 * 2 - 12) / 2;
  const locationLabel = location.context?.neighborhood ?? location.context?.city ?? 'Nearby';
  const locationStatus = location.status;

  const locationStatusLine = (() => {
    if (locationLoading)                  return 'Getting location…';
    if (locationStatus === 'denied')      return 'Location access denied';
    if (locationStatus === 'unavailable') return 'GPS unavailable';
    if (locationStatus === 'stale')       return `${locationLabel} · Location may be outdated`;
    if (locationStatus === 'manual')      return `${locationLabel} · Manual`;
    if (locationStatus === 'granted')     return locationLabel;
    return 'Select location';
  })();

  const radiusLabel = RADIUS_PRESET_LABELS[activeRadius];
  const listingCountText = `${listings.length} listing${listings.length !== 1 ? 's' : ''}`;
  const currentSortLabel = SORT_OPTIONS.find(s => s.id === selectedSort)?.label ?? 'Sort';
  const sortIsCustom = selectedSort !== 'ranking';
  const radiusIsCustom = activeRadius !== 'near_me';

  const hasActiveFilters =
    filterState.category !== 'All' ||
    filterState.minPrice !== '' ||
    filterState.maxPrice !== '' ||
    filterState.condition !== 'all' ||
    filterState.availability !== 'all' ||
    filterState.minRating > 0;

  const handleRefreshLocation = () => {
    getCurrentLocation().then(() => refresh());
  };

  const handleFavoriteToggle = (listingId: string, isFav: boolean) => {
    setUserFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.add(listingId);
      else next.delete(listingId);
      return next;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              onPress={handleRefreshLocation}
              activeOpacity={0.7}
              style={{ flex: 1, marginRight: 12 }}
            >
              <Text style={{
                fontSize: 28, fontWeight: '800',
                fontFamily: 'Nunito_800ExtraBold',
                color: COLORS.primary, letterSpacing: -0.5,
              }}>
                QuickSell
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                {locationLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <MapPin size={13} color={
                    locationStatus === 'denied' || locationStatus === 'unavailable'
                      ? '#EF4444'
                      : locationStatus === 'stale'
                        ? '#F59E0B'
                        : COLORS.textSecondary
                  } />
                )}
                <Text style={{
                  fontSize: 13, fontFamily: 'Nunito_600SemiBold',
                  color: locationStatus === 'denied' || locationStatus === 'unavailable'
                    ? '#EF4444'
                    : COLORS.textSecondary,
                  flexShrink: 1,
                }} numberOfLines={1}>
                  {locationStatusLine}
                </Text>
              </View>
            </TouchableOpacity>

            <AnimatedPressable
              onPress={() => router.push('/notifications')}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: COLORS.surface,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: COLORS.border,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                position: 'relative',
              }}
            >
              <Bell size={20} color={COLORS.text} />
              <View style={{
                position: 'absolute', top: 10, right: 11,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: COLORS.primary,
                borderWidth: 1.5, borderColor: COLORS.surface,
              }} />
            </AnimatedPressable>
          </View>

          {/* Search bar & Filter Button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <View style={{
              flex: 1,
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: COLORS.surface, borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 12,
              borderWidth: 1, borderColor: COLORS.border,
              gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <Search size={18} color={COLORS.textTertiary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search nearby listings…"
                placeholderTextColor={COLORS.textTertiary}
                style={{ flex: 1, fontSize: 15, fontFamily: 'Nunito_400Regular', color: COLORS.text }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              activeOpacity={0.8}
              style={{
                width: 46, height: 46, borderRadius: 14,
                backgroundColor: hasActiveFilters ? COLORS.primaryMuted : COLORS.surface,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: hasActiveFilters ? COLORS.primary : COLORS.border,
              }}
            >
              <Filter size={18} color={hasActiveFilters ? COLORS.primary : COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Radius selector pill */}
          <TouchableOpacity
            onPress={() => setRadiusModalVisible(true)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              alignSelf: 'flex-start', marginTop: 10,
              backgroundColor: radiusIsCustom ? COLORS.primaryMuted : COLORS.surfaceSecondary,
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
              borderWidth: 1,
              borderColor: radiusIsCustom ? COLORS.primary : COLORS.border,
            }}
          >
            <Navigation size={13} color={radiusIsCustom ? COLORS.primary : COLORS.textSecondary} />
            <Text style={{
              fontSize: 13, fontFamily: 'Nunito_600SemiBold',
              color: radiusIsCustom ? COLORS.primary : COLORS.textSecondary,
            }}>
              {radiusLabel}
            </Text>
            <ChevronDown size={12} color={radiusIsCustom ? COLORS.primary : COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Quick Match banner ───────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/quick-match')}
          activeOpacity={0.85}
          style={{
            marginHorizontal: 16, marginBottom: 12,
            padding: 14, borderRadius: 16,
            backgroundColor: COLORS.primaryMuted,
            borderWidth: 1, borderColor: COLORS.primary,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: COLORS.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} color='#FFFFFF' />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.primary }}>
              Quick Match
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
              Describe what you need — we'll find it
            </Text>
          </View>
          <ChevronDown
            size={16}
            color={COLORS.primary}
            style={{ transform: [{ rotate: '-90deg' }] }}
          />
        </TouchableOpacity>

        {/* ── Location permission banner ─────────────────────────────────── */}
        {(locationStatus === 'denied' || locationStatus === 'unavailable') && (
          <TouchableOpacity
            onPress={handleRefreshLocation}
            activeOpacity={0.8}
            style={{
              marginHorizontal: 16, marginBottom: 8, padding: 12,
              backgroundColor: '#FEF2F2', borderRadius: 12,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              borderWidth: 1, borderColor: '#FECACA',
            }}
          >
            <AlertCircle size={16} color='#EF4444' />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#B91C1C' }}>
                {locationStatus === 'denied' ? 'Location access denied' : 'GPS unavailable'}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#DC2626', marginTop: 1 }}>
                Tap to retry — showing results within default radius
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Category chips ────────────────────────────────────────────── */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
        >
          {CATEGORIES.map(cat => (
            <CategoryChip
              key={cat} label={cat}
              selected={filterState.category === cat}
              onPress={() => setFilterState({ ...filterState, category: cat })}
            />
          ))}
        </ScrollView>

        {/* ── Section header ────────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
        }}>
          <Text style={{ fontSize: 17, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
            {loading ? 'Searching…' : `Near You · ${listingCountText}`}
          </Text>
          <AnimatedPressable
            onPress={() => setSortModalVisible(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: sortIsCustom ? COLORS.primaryMuted : COLORS.surface,
              borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
              borderWidth: 1, borderColor: sortIsCustom ? COLORS.primary : COLORS.border,
            }}
          >
            <ArrowUpDown size={14} color={sortIsCustom ? COLORS.primary : COLORS.textSecondary} />
            <Text style={{
              fontSize: 13, fontFamily: 'Nunito_700Bold',
              color: sortIsCustom ? COLORS.primary : COLORS.textSecondary,
            }}>
              {sortIsCustom ? currentSortLabel : 'Sort'}
            </Text>
          </AnimatedPressable>
        </View>

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16 }}>
          {loading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <View key={i} style={{ width: cardWidth }}><SkeletonCard /></View>
              ))}
            </View>
          ) : listings.length === 0 ? (
            <EmptyState
              icon={<Search size={36} color={COLORS.primary} />}
              title="No listings found"
              subtitle="Try adjusting your radius, price range, condition, or category filters."
              action={{
                label: 'Try Quick Match',
                onPress: () => router.push('/quick-match'),
                icon: <Sparkles size={15} color="#FFFFFF" />,
              }}
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {listings.map((listing, index) => (
                <View key={listing.listing_id || listing.id} style={{ width: cardWidth }}>
                  <ListingCard
                    listing={listing as any}
                    index={index}
                    isFavorited={userFavoriteIds.has(listing.listing_id || listing.id)}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Search Filter Modal ────────────────────────────────────────── */}
      <SearchFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filterState}
        onApplyFilters={newFilters => setFilterState(newFilters)}
        onResetFilters={() => setFilterState({
          category: 'All',
          minPrice: '',
          maxPrice: '',
          condition: 'all',
          radius: 'near_me',
          availability: 'all',
          minRating: 0,
        })}
      />

      {/* ── Radius Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={radiusModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRadiusModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setRadiusModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{
            backgroundColor: COLORS.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingTop: 20, paddingHorizontal: 20, paddingBottom: insets.bottom + 24,
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Navigation size={20} color={COLORS.primary} />
              <Text style={{ fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
                Search Radius
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {RADIUS_PRESET_ORDER.map(preset => {
                const isSelected = activeRadius === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => {
                      setFilterState({ ...filterState, radius: preset });
                      setSelectedRadius(preset);
                      setRadiusModalVisible(false);
                    }}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      padding: 14, borderRadius: 12,
                      backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: isSelected ? COLORS.primary : 'transparent',
                    }}
                  >
                    <Text style={{
                      fontSize: 15,
                      fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                      color: isSelected ? COLORS.primary : COLORS.text,
                    }}>
                      {RADIUS_PRESET_LABELS[preset]}
                    </Text>
                    {isSelected && (
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: COLORS.primary,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Sort Modal ─────────────────────────────────────────────────────── */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{
            backgroundColor: COLORS.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingTop: 20, paddingHorizontal: 20, paddingBottom: insets.bottom + 24,
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ArrowUpDown size={20} color={COLORS.primary} />
                <Text style={{ fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
                  Sort Listings
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSortModalVisible(false)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: COLORS.surfaceSecondary,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 10 }}>
              {SORT_OPTIONS.map(option => {
                const isSelected = selectedSort === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => { setSelectedSort(option.id); setSortModalVisible(false); }}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      padding: 16, borderRadius: 14,
                      backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                      borderWidth: 1, borderColor: isSelected ? COLORS.primary : 'transparent',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{
                        fontSize: 16,
                        fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                        color: isSelected ? COLORS.primary : COLORS.text,
                        marginBottom: 2,
                      }}>
                        {option.label}
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={{
                        width: 26, height: 26, borderRadius: 13,
                        backgroundColor: COLORS.primary,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
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
