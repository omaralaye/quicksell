// ============================================================
// Seller Hub — Listings Management
// Filter, manage, edit, archive and mark sold
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, MoreHorizontal, Package } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyListings } from '@/services/listings';
import { updateListingStatus } from '@/services/listings';
import { useSellerContext } from './_layout';
import { formatPriceShort } from '@/services/seller';
import type { ListingWithSeller } from '@/services/types';

type FilterTab = 'ALL' | 'ACTIVE' | 'SOLD' | 'ARCHIVED';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'SOLD', label: 'Sold' },
  { key: 'ARCHIVED', label: 'Archived' },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE: { label: 'Active', bg: 'rgba(45,155,111,0.12)', color: COLORS.accent },
  SOLD: { label: 'Sold', bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
  ARCHIVED: { label: 'Archived', bg: COLORS.surfaceSecondary, color: COLORS.textSecondary },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status?.toUpperCase()] ?? STATUS_CONFIG.ARCHIVED;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function ListingRow({
  listing,
  currency,
  onOptions,
  onPress,
}: {
  listing: ListingWithSeller;
  currency: string;
  onOptions: () => void;
  onPress: () => void;
}) {
  const price = formatPriceShort(Number(listing.price), currency as any);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.listingRow}>
      <Image
        source={{ uri: listing.image_url ?? '' }}
        style={styles.listingImg}
      />
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.listingPrice}>{price}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <StatusBadge status={listing.status ?? 'ACTIVE'} />
          <Text style={styles.listingCategory}>{listing.category}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onOptions} activeOpacity={0.7} hitSlop={10} style={styles.moreButton}>
        <MoreHorizontal size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function EmptyState({ filter }: { filter: FilterTab }) {
  const router = useRouter();
  const messages: Record<FilterTab, string> = {
    ALL: 'You have no listings yet',
    ACTIVE: 'No active listings',
    SOLD: 'No sold items yet',
    ARCHIVED: 'No archived listings',
  };
  return (
    <View style={styles.emptyWrap}>
      <Package size={44} color={COLORS.textTertiary} />
      <Text style={styles.emptyTitle}>{messages[filter]}</Text>
      {filter === 'ALL' && (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/(sell)')}
          activeOpacity={0.85}
          style={styles.emptyButton}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.emptyButtonText}>Create a Listing</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function SellerListings() {
  const router = useRouter();
  const { user } = useAuth();
  const { currency } = useSellerContext();
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [listings, setListings] = useState<ListingWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const data = await fetchMyListings(user.id);
      setListings(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error('[SellerListings] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'ALL' ? listings : listings.filter((l) => l.status?.toUpperCase() === filter);

  const handleOptions = (listing: ListingWithSeller) => {
    const isActive = listing.status?.toUpperCase() === 'ACTIVE';
    const isSold = listing.status?.toUpperCase() === 'SOLD';

    const actions: { label: string; action: () => void; destructive?: boolean }[] = [
      {
        label: 'Edit Listing',
        action: () => router.push(`/seller-hub/edit-listing/${listing.id}`),
      },
    ];

    if (isActive) {
      actions.push({
        label: 'Mark as Sold',
        action: () => confirmStatusChange(listing, 'SOLD', 'Mark as Sold?', 'This will remove it from active listings.'),
      });
      actions.push({
        label: 'Archive',
        action: () => confirmStatusChange(listing, 'ARCHIVED', 'Archive Listing?', 'Archived listings are hidden from the marketplace.'),
      });
    }
    if (!isActive) {
      actions.push({
        label: 'Re-activate',
        action: () => confirmStatusChange(listing, 'ACTIVE', 'Re-activate Listing?', 'This will make it visible to buyers again.'),
      });
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: listing.title,
          options: [...actions.map((a) => a.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.findIndex((a) => a.destructive),
        },
        (idx) => {
          if (idx < actions.length) actions[idx].action();
        },
      );
    } else {
      Alert.alert(
        listing.title,
        undefined,
        [
          ...actions.map((a) => ({ text: a.label, onPress: a.action })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
    }
  };

  const confirmStatusChange = (
    listing: ListingWithSeller,
    status: 'ACTIVE' | 'SOLD' | 'ARCHIVED',
    title: string,
    message: string,
  ) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: status === 'ARCHIVED' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await updateListingStatus(listing.id, status);
            setListings((prev) =>
              prev.map((l) => (l.id === listing.id ? { ...l, status } : l)),
            );
          } catch (err) {
            Alert.alert('Error', 'Could not update listing. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterScroll}
        bounces={false}
      >
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setFilter(tab.key)}
            activeOpacity={0.8}
            style={[styles.filterChip, filter === tab.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === tab.key && styles.filterTextActive]}>
              {tab.label}
              {tab.key === 'ALL' ? ` (${listings.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={COLORS.primary}
            />
          }
        >
          {filtered.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            filtered.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                currency={currency}
                onOptions={() => handleOptions(listing)}
                onPress={() => router.push(`/listing/${listing.id}`)}
              />
            ))
          )}
        </Animated.ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/(sell)')}
        activeOpacity={0.9}
        style={styles.fab}
      >
        <Plus size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  filterScroll: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Nunito_700Bold',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
    gap: 8,
  },
  listEmpty: {
    flexGrow: 1,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listingImg: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
  },
  listingInfo: {
    flex: 1,
    gap: 3,
  },
  listingTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.text,
  },
  listingPrice: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.primary,
    letterSpacing: -0.2,
  },
  listingCategory: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.3,
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.textSecondary,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyButtonText: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
