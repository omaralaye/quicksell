import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Animated,
  ImageSourcePropType,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronRight,
  Tag,
  MessageCircle,
  DollarSign,
  X,
  CheckCircle2,
  Send,
  Trash2,
  Check,
  PackageX,
  RefreshCw,
  MoreVertical,
  ShieldCheck,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/constants/Colors';
import { getRelativeTime } from '@/utils/mockData';
import { fetchListing, ListingWithSeller, updateListingStatus, deleteListing, initiateOrderWithReservation } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateConversation, sendMessage } from '@/services/chat';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ConditionBadge } from '@/components/ConditionBadge';
import { StarRating } from '@/components/StarRating';
import { SkeletonListingDetail } from '@/components/SkeletonCard';
import { ErrorState } from '@/components/ErrorState';
import { formatPrice, formatPriceCard } from '@/utils/currency';

function resolveImageSource(source: string | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;

  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  const [loading, setLoading] = useState(true);

  // Make Offer Modal states
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerSubmitted, setOfferSubmitted] = useState(false);

  // Options Menu Sheet state
  const [sellerMenuVisible, setSellerMenuVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    console.log('[ListingDetail] Fetching listing:', id);
    fetchListing(id)
      .then((data) => {
        setListing(data);
        if (data?.price) {
          const suggested = Math.round(Number(data.price) * 0.9);
          setOfferAmount(suggested.toString());
        }
        Animated.parallel([
          Animated.timing(contentOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
          Animated.timing(contentTranslateY, { toValue: 0, duration: 400, delay: 100, useNativeDriver: true }),
        ]).start();
      })
      .catch((err) => {
        console.error('[ListingDetail] fetchListing error:', err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleBack = () => {
    console.log('[ListingDetail] Back pressed');
    router.back();
  };

  const handleViewProfile = () => {
    const sellerId = listing?.seller?.id;
    console.log('[ListingDetail] View seller profile:', sellerId);
    if (sellerId) router.push(`/seller/${sellerId}`);
  };

  const handleMessage = async () => {
    console.log('[ListingDetail] Message Seller pressed for listing:', listing?.id);
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to message the seller.');
      return;
    }
    const sellerId = listing?.seller_id ?? listing?.seller?.id;
    if (!listing || !sellerId) {
      Alert.alert('Error', 'Seller information is missing.');
      return;
    }
    if (user.id === sellerId) {
      Alert.alert('Notice', 'This is your own listing.');
      return;
    }
    try {
      const convId = await getOrCreateConversation(user.id, sellerId, listing.id);
      router.push(`/chat/${convId}`);
    } catch (err: any) {
      console.error('[ListingDetail] handleMessage error:', err);
      Alert.alert('Error', err?.message ?? 'Could not open chat with seller.');
    }
  };

  const handleOpenOfferModal = () => {
    console.log('[ListingDetail] Opening Make Offer modal');
    setOfferSubmitted(false);
    setOfferModalVisible(true);
  };

  const handleQuickDiscount = (percentage: number) => {
    if (!listing?.price) return;
    const discounted = Math.round(Number(listing.price) * (1 - percentage / 100));
    setOfferAmount(discounted.toString());
  };

  const handleBuyNow = async () => {
    if (!listing) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to buy this item.');
      return;
    }
    try {
      const reservation = await initiateOrderWithReservation({
        buyerId: user.id,
        listingId: listing.id,
        requestedQty: 1,
        reservationMinutes: 15,
      });
      Alert.alert(
        'Item Reserved!',
        `You have 15 minutes to complete payment before your reservation expires.\nTotal: $${reservation.total_amount.toLocaleString()}`,
        [
          { text: 'View Order', onPress: () => router.push(`/orders/${reservation.order_id}`) },
          { text: 'OK', style: 'cancel' }
        ]
      );
      // Reload listing details
      const updated = await fetchListing(listing.id);
      setListing(updated);
    } catch (err: any) {
      Alert.alert('Reservation Error', err?.message ?? 'Could not reserve item.');
    }
  };

  const handleSubmitOffer = async () => {
    const amountNum = parseFloat(offerAmount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Offer', 'Please enter a valid offer amount.');
      return;
    }

    console.log('[ListingDetail] Offer submitted:', { amount: amountNum, note: offerNote });
    setOfferSubmitted(true);

    const sellerId = listing?.seller_id ?? listing?.seller?.id;
    let convId: string | null = null;
    if (user && listing && sellerId && user.id !== sellerId) {
      try {
        const activeConvId = await getOrCreateConversation(user.id, sellerId, listing.id);
        convId = activeConvId;
      const offerText = `🏷️ OFFER SENT: UGX ${amountNum.toLocaleString()}${offerNote ? `\nNote: ${offerNote}` : ''}`;
        await sendMessage(activeConvId, user.id, offerText);
      } catch (err) {
        console.error('[ListingDetail] Error creating conversation for offer:', err);
      }
    }

    setTimeout(() => {
      setOfferModalVisible(false);
      Alert.alert(
        'Offer Sent!',
        `Your offer of UGX ${amountNum.toLocaleString()} has been sent to ${listing?.seller?.display_name ?? 'the seller'}.`,
        [
          {
            text: 'View Chat',
            onPress: () => {
              if (convId) router.push(`/chat/${convId}`);
            },
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }, 800);
  };

  // Seller Action Handlers
  const handleToggleSold = async () => {
    if (!listing) return;
    setSellerMenuVisible(false);
    const newStatus = listing.status === 'SOLD' ? 'ACTIVE' : 'SOLD';
    console.log('[ListingDetail] Updating status to:', newStatus);
    try {
      await updateListingStatus(listing.id, newStatus);
      setListing((prev) => (prev ? { ...prev, status: newStatus } : prev));
      Alert.alert(
        newStatus === 'SOLD' ? 'Marked as Sold!' : 'Listing Reactivated',
        newStatus === 'SOLD'
          ? 'This listing is now marked as Sold and will be updated everywhere for buyers.'
          : 'Your listing is active again and visible to buyers.'
      );
    } catch (err) {
      console.error('[ListingDetail] updateListingStatus error:', err);
    }
  };

  const handleToggleOutOfStock = async () => {
    if (!listing) return;
    setSellerMenuVisible(false);
    const newStatus = listing.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    console.log('[ListingDetail] Updating status to:', newStatus);
    try {
      await updateListingStatus(listing.id, newStatus);
      setListing((prev) => (prev ? { ...prev, status: newStatus } : prev));
      Alert.alert(
        newStatus === 'ARCHIVED' ? 'Marked Out of Stock' : 'Listing Reactivated',
        newStatus === 'ARCHIVED'
          ? 'This item is now marked as Out of Stock.'
          : 'Your listing is active again and visible to buyers.'
      );
    } catch (err) {
      console.error('[ListingDetail] updateListingStatus error:', err);
    }
  };

  const handleDeleteListing = () => {
    if (!listing) return;
    setSellerMenuVisible(false);
    Alert.alert(
      'Delete Listing?',
      `Are you sure you want to permanently delete "${listing.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('[ListingDetail] Deleting listing:', listing.id);
            await deleteListing(listing.id);
            Alert.alert('Listing Deleted', 'Your item listing has been deleted.');
            router.back();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <SkeletonListingDetail />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ position: 'absolute', top: insets.top + 12, left: 16, zIndex: 10 }}>
          <TouchableOpacity
            onPress={handleBack}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <ErrorState
          title="Listing not found"
          message="This listing may have been removed by the seller."
          onRetry={handleBack}
        />
      </View>
    );
  }

  // Check if current user is seller (or default demo user)
  const isSeller =
    user?.id === listing.seller_id ||
    user?.id === listing.seller?.id ||
    listing.seller_id === 'user-me' ||
    !listing.seller_id; // Default demo seller capability for easy testing

  const isSold = listing.status === 'SOLD';
  const isOutOfStock = listing.status === 'ARCHIVED';
  const isAvailable = !isSold && !isOutOfStock;

  const postedDate = getRelativeTime(listing.created_at ?? '');
  const priceDisplay = formatPriceCard(Number(listing.price), 'UGX');
  const sellerName = listing.seller?.display_name ?? 'Seller';
  const sellerRegion = listing.seller?.region ?? '';
  const sellerRating = listing.seller?.rating ?? 0;
  const sellerAvatar = listing.seller?.avatar_url ?? undefined;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image with status overlays */}
        <View style={{ position: 'relative' }}>
          <Image
            source={resolveImageSource(listing.image_url ?? undefined)}
            resizeMode="cover"
            style={{ width: '100%', height: 320 }}
          />

          {/* Sold / Out of Stock Image Banner Overlay */}
          {isSold && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(239, 68, 68, 0.45)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  backgroundColor: '#DC2626',
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontFamily: 'Nunito_800ExtraBold',
                    color: '#FFFFFF',
                    letterSpacing: 2,
                  }}
                >
                  ITEM SOLD
                </Text>
              </View>
            </View>
          )}

          {isOutOfStock && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(217, 119, 6, 0.45)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  backgroundColor: '#D97706',
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: 'Nunito_800ExtraBold',
                    color: '#FFFFFF',
                    letterSpacing: 1.5,
                  }}
                >
                  OUT OF STOCK
                </Text>
              </View>
            </View>
          )}

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

          {/* Seller Menu Button (top right) */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + 12,
              right: 16,
            }}
          >
            <AnimatedPressable onPress={() => setSellerMenuVisible(true)}>
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
                <MoreVertical size={20} color={COLORS.text} />
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
          {/* Status Alert Banner for Buyers */}
          {isSold && (
            <View
              style={{
                backgroundColor: '#FEE2E2',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderWidth: 1,
                borderColor: '#FCA5A5',
              }}
            >
              <CheckCircle2 size={20} color="#DC2626" />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontFamily: 'Nunito_700Bold',
                  color: '#991B1B',
                }}
              >
                This item has been marked as SOLD by the seller.
              </Text>
            </View>
          )}

          {isOutOfStock && (
            <View
              style={{
                backgroundColor: '#FEF3C7',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderWidth: 1,
                borderColor: '#FCD34D',
              }}
            >
              <PackageX size={20} color="#D97706" />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontFamily: 'Nunito_700Bold',
                  color: '#92400E',
                }}
              >
                This item is currently OUT OF STOCK.
              </Text>
            </View>
          )}

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
              color: isSold ? COLORS.textTertiary : COLORS.primary,
              letterSpacing: -0.5,
              marginBottom: 20,
              textDecorationLine: isSold ? 'line-through' : 'none',
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
                source={resolveImageSource(sellerAvatar)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: COLORS.surfaceSecondary,
                }}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                    {sellerName}
                  </Text>
                  {isSeller && (
                    <View style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Nunito_700Bold', color: COLORS.primary }}>YOU</Text>
                    </View>
                  )}
                </View>
                {sellerRegion ? (
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                    📍 {sellerRegion}
                  </Text>
                ) : null}
                <StarRating rating={sellerRating} size={13} />
                {/* Trust signals */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {(listing.seller as any)?.total_sales != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <ShieldCheck size={12} color={COLORS.accent} />
                      <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: COLORS.accent }}>
                        {(listing.seller as any).total_sales} sales
                      </Text>
                    </View>
                  )}
                  {(listing.seller as any)?.created_at && (
                    <Text style={{ fontSize: 11, fontFamily: 'Nunito_400Regular', color: COLORS.textTertiary }}>
                      · Member since {new Date((listing.seller as any).created_at).getFullYear()}
                    </Text>
                  )}
                </View>
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

      {/* Bottom Actions Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
        }}
      >
        {isAvailable ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Message Seller Button */}
            <AnimatedPressable
              onPress={handleMessage}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderRadius: 14,
                height: 50,
                borderWidth: 1.5,
                borderColor: COLORS.border,
                backgroundColor: COLORS.surfaceSecondary,
                paddingHorizontal: 6,
              }}
            >
              <MessageCircle size={16} color={COLORS.text} />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                }}
              >
                Chat
              </Text>
            </AnimatedPressable>

            {/* Make Offer Button */}
            <AnimatedPressable
              onPress={handleOpenOfferModal}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderRadius: 14,
                height: 50,
                borderWidth: 1.5,
                borderColor: COLORS.primary,
                backgroundColor: COLORS.primaryMuted,
                paddingHorizontal: 6,
              }}
            >
              <DollarSign size={16} color={COLORS.primary} />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.primary,
                }}
              >
                Offer
              </Text>
            </AnimatedPressable>

            {/* Buy Now (Reserve) Button */}
            <AnimatedPressable
              onPress={handleBuyNow}
              style={{
                flex: 1.3,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderRadius: 14,
                height: 50,
                backgroundColor: COLORS.primary,
                paddingHorizontal: 8,
              }}
            >
              <ShieldCheck size={17} color="#FFFFFF" />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  fontFamily: 'Nunito_700Bold',
                  color: '#FFFFFF',
                }}
              >
                Buy Now
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          /* Disabled State Bar for Buyers when Sold/Out of Stock */
          <View
            style={{
              height: 50,
              borderRadius: 14,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Nunito_800ExtraBold',
                color: isSold ? '#DC2626' : '#D97706',
              }}
            >
              {isSold ? 'ITEM SOLD' : 'OUT OF STOCK'}
            </Text>
          </View>
        )}
      </View>

      {/* Seller Control Sheet Modal */}
      <Modal
        visible={sellerMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSellerMenuVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setSellerMenuVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 20,
            }}
          >
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

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
                Listing Options
              </Text>
              <TouchableOpacity
                onPress={() => setSellerMenuVisible(false)}
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

            <View style={{ gap: 10 }}>
              {/* Mark as Sold Toggle */}
              <TouchableOpacity
                onPress={handleToggleSold}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: isSold ? '#DEF7EC' : COLORS.surfaceSecondary,
                }}
              >
                {isSold ? <RefreshCw size={20} color="#03543F" /> : <CheckCircle2 size={20} color="#059669" />}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Nunito_700Bold',
                      color: isSold ? '#03543F' : COLORS.text,
                    }}
                  >
                    {isSold ? 'Reactivate Listing' : 'Mark as Sold'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                    {isSold
                      ? 'Make this listing active and available to buyers again'
                      : 'Mark item as sold and disable buyer offer buttons'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Mark Out of Stock Toggle */}
              <TouchableOpacity
                onPress={handleToggleOutOfStock}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: isOutOfStock ? '#FEF3C7' : COLORS.surfaceSecondary,
                }}
              >
                <PackageX size={20} color={isOutOfStock ? '#92400E' : '#D97706'} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Nunito_700Bold',
                      color: isOutOfStock ? '#92400E' : COLORS.text,
                    }}
                  >
                    {isOutOfStock ? 'Mark as In Stock' : 'Mark Out of Stock'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                    {isOutOfStock ? 'Set status back to active' : 'Temporarily disable orders for this item'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Delete Listing Button */}
              <TouchableOpacity
                onPress={handleDeleteListing}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: '#FEE2E2',
                }}
              >
                <Trash2 size={20} color={COLORS.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>
                    Delete Listing
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                    Permanently delete this item listing
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Make Offer Modal */}
      <Modal
        visible={offerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setOfferModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 20,
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
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <DollarSign size={22} color={COLORS.primary} />
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: 'Nunito_800ExtraBold',
                    color: COLORS.text,
                  }}
                >
                  Make an Offer
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOfferModalVisible(false)}
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

            {/* Listing Summary Card */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 12,
                padding: 12,
                gap: 12,
                marginBottom: 20,
              }}
            >
              <Image
                source={resolveImageSource(listing.image_url ?? undefined)}
                style={{ width: 44, height: 44, borderRadius: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 14,
                    fontFamily: 'Nunito_700Bold',
                    color: COLORS.text,
                    marginBottom: 2,
                  }}
                >
                  {listing.title}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                    color: COLORS.textSecondary,
                  }}
                >
                  Asking Price:{' '}
                  <Text style={{ color: COLORS.primary, fontFamily: 'Nunito_800ExtraBold' }}>
                    {priceDisplay}
                  </Text>
                </Text>
              </View>
            </View>

            {/* Offer Amount Input */}
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Nunito_700Bold',
                color: COLORS.text,
                marginBottom: 8,
              }}
            >
              Your Offer Amount ($USD)
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: COLORS.primary,
                paddingHorizontal: 16,
                height: 54,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontFamily: 'Nunito_800ExtraBold',
                  color: COLORS.primary,
                  marginRight: 6,
                }}
              >
                $
              </Text>
              <TextInput
                value={offerAmount}
                onChangeText={setOfferAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.textTertiary}
                style={{
                  flex: 1,
                  fontSize: 22,
                  fontFamily: 'Nunito_800ExtraBold',
                  color: COLORS.text,
                }}
              />
            </View>

            {/* Quick Percentage Chips */}
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.textSecondary,
                marginBottom: 8,
              }}
            >
              Quick suggestions:
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {[5, 10, 15, 20].map((pct) => {
                const discounted = Math.round(Number(listing.price) * (1 - pct / 100));
                const isSelected = offerAmount === discounted.toString();
                return (
                  <TouchableOpacity
                    key={pct}
                    onPress={() => handleQuickDiscount(pct)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: isSelected ? COLORS.primary : COLORS.surfaceSecondary,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: isSelected ? COLORS.primary : COLORS.border,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: 'Nunito_700Bold',
                        color: isSelected ? '#FFFFFF' : COLORS.text,
                      }}
                    >
                      ${discounted}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: 'Nunito_600SemiBold',
                        color: isSelected ? 'rgba(255,255,255,0.85)' : COLORS.textSecondary,
                      }}
                    >
                      -{pct}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional Note */}
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Nunito_700Bold',
                color: COLORS.text,
                marginBottom: 8,
              }}
            >
              Note to Seller (Optional)
            </Text>

            <TextInput
              value={offerNote}
              onChangeText={setOfferNote}
              placeholder="e.g. Can pick up today evening!"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={2}
              style={{
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.text,
                minHeight: 60,
                textAlignVertical: 'top',
                marginBottom: 20,
              }}
            />

            {/* Submit Offer Button */}
            <TouchableOpacity
              onPress={handleSubmitOffer}
              disabled={offerSubmitted}
              activeOpacity={0.85}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: offerSubmitted ? 0.7 : 1,
              }}
            >
              {offerSubmitted ? (
                <>
                  <CheckCircle2 size={20} color="#FFFFFF" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Nunito_700Bold',
                      color: '#FFFFFF',
                    }}
                  >
                    Sending Offer...
                  </Text>
                </>
              ) : (
                <>
                  <Send size={18} color="#FFFFFF" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Nunito_700Bold',
                      color: '#FFFFFF',
                    }}
                  >
                    Send Offer to {sellerName}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
