// ============================================================
// BuyerRequestCard — Comprehensive Buyer Request & Offer Response
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  FileSearch, MapPin, DollarSign, Tag, Clock, Star,
  MessageSquarePlus, CheckCircle, X, Link, Package, AlertCircle,
  BadgeCheck, ChevronRight,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import {
  respondToBuyerRequestWithOffer,
  fetchSellerActiveListings,
} from '@/services/quickmatch';
import { AVAILABILITY_OPTIONS } from '@/services/quickmatch.types';
import type { BuyerRequest, AvailabilityOption } from '@/services/quickmatch.types';
import { supabase } from '@/integrations/supabase/client';

function MetaChip({
  icon, label, color,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
      backgroundColor: COLORS.surfaceSecondary,
    }}>
      {icon}
      <Text style={{
        fontSize: 12, fontFamily: 'Nunito_600SemiBold',
        color: color ?? COLORS.textSecondary,
      }}>
        {label}
      </Text>
    </View>
  );
}

interface Props {
  request: BuyerRequest;
  /** When true, show the "Make an Offer / I HAVE THIS" button (seller view). */
  sellerView?: boolean;
  /** Callback when pressed to navigate to detail view. */
  onPressDetail?: () => void;
}

export function BuyerRequestCard({ request, sellerView = false, onPressDetail }: Props) {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);

  // Form fields for seller response
  const [message, setMessage] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [availability, setAvailability] = useState<AvailabilityOption>('in_stock');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Seller listings for product linking
  const [sellerListings, setSellerListings] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);

  // Load seller listings when modal opens
  useEffect(() => {
    if (modalVisible) {
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setLoadingListings(true);
          try {
            const listings = await fetchSellerActiveListings(user.id);
            setSellerListings(listings);
          } catch (err) {
            console.error('Error fetching seller listings:', err);
          } finally {
            setLoadingListings(false);
          }
        }
      })();
    }
  }, [modalVisible]);

  const handleOpenOfferModal = () => {
    // Default price to request max price if set
    const defaultPrice = request.budget_max ?? request.max_price ?? '';
    setPriceInput(defaultPrice ? String(defaultPrice) : '');
    setModalVisible(true);
  };

  const handleSendOffer = async () => {
    if (!message.trim()) {
      Alert.alert('Message required', 'Please include a brief message to the buyer.');
      return;
    }

    const numericPrice = parseFloat(priceInput.replace(/,/g, ''));
    if (isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid offer price in UGX.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to make an offer.');
      return;
    }

    setResponding(true);
    try {
      const result = await respondToBuyerRequestWithOffer({
        sellerId: user.id,
        requestId: request.id,
        message: message.trim(),
        price: numericPrice,
        productId: selectedProductId ?? undefined,
        availability,
      });

      setModalVisible(false);
      setResponded(true);

      // Navigate to chat
      router.push({ pathname: '/chat/[id]', params: { id: result.conversation_id } });
    } catch (err: any) {
      Alert.alert('Offer Error', err?.message ?? 'Could not submit offer.');
    } finally {
      setResponding(false);
    }
  };

  // Status badge styling
  const statusConfig = (() => {
    const s = request.status?.toUpperCase() ?? 'ACTIVE';
    switch (s) {
      case 'ACTIVE': return { label: 'ACTIVE', bg: '#D1FAE5', text: '#065F46' };
      case 'MATCHED': return { label: 'OFFERS RECEIVED', bg: '#FEF3C7', text: '#92400E' };
      case 'FULFILLED': return { label: 'FULFILLED', bg: '#DBEAFE', text: '#1E40AF' };
      case 'EXPIRED': return { label: 'EXPIRED', bg: '#F3F4F6', text: '#6B7280' };
      case 'CANCELLED': return { label: 'CANCELLED', bg: '#FEE2E2', text: '#991B1B' };
      default: return { label: s, bg: '#F3F4F6', text: '#374151' };
    }
  })();

  const budgetDisplay = (() => {
    const max = request.budget_max ?? request.max_price ?? request.budget;
    const min = request.budget_min ?? request.min_price;
    if (min && max) return `UGX ${Number(min).toLocaleString()} - ${Number(max).toLocaleString()}`;
    if (max) return `UGX ${Number(max).toLocaleString()} max`;
    if (min) return `From UGX ${Number(min).toLocaleString()}`;
    return 'Flexible budget';
  })();

  const locationDisplay = request.city ?? request.location_label ?? request.district ?? 'Nearby';

  return (
    <>
      <TouchableOpacity
        onPress={onPressDetail}
        activeOpacity={onPressDetail ? 0.85 : 1}
        style={{
          backgroundColor: COLORS.surface, borderRadius: 18,
          padding: 16, borderWidth: 1, borderColor: COLORS.border,
          gap: 12,
        }}
      >
        {/* Header with Title & Status */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: COLORS.primaryMuted,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <FileSearch size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <Text style={{
                flex: 1, fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.text,
              }} numberOfLines={2}>
                {request.title}
              </Text>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                backgroundColor: statusConfig.bg,
              }}>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito_800ExtraBold', color: statusConfig.text }}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>

            {request.description ? (
              <Text style={{
                fontSize: 13, fontFamily: 'Nunito_400Regular',
                color: COLORS.textSecondary, marginTop: 4, lineHeight: 18,
              }} numberOfLines={2}>
                {request.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Metadata chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <MetaChip
            icon={<DollarSign size={11} color={COLORS.primary} />}
            label={budgetDisplay}
            color={COLORS.primary}
          />
          {locationDisplay ? (
            <MetaChip
              icon={<MapPin size={11} color={COLORS.textSecondary} />}
              label={locationDisplay}
            />
          ) : null}
          {request.desired_condition && request.desired_condition !== 'any' ? (
            <MetaChip
              icon={<Tag size={11} color={COLORS.textSecondary} />}
              label={request.desired_condition.replace('_', ' ')}
            />
          ) : null}
          {request.response_count > 0 ? (
            <MetaChip
              icon={<Star size={11} color='#F59E0B' />}
              label={`${request.response_count} offer${request.response_count !== 1 ? 's' : ''}`}
              color='#D97706'
            />
          ) : null}
        </View>

        {/* Seller Response CTA */}
        {sellerView && !responded && (request.status === 'ACTIVE' || request.status === 'MATCHED') && (
          <TouchableOpacity
            onPress={handleOpenOfferModal}
            activeOpacity={0.85}
            style={{
              backgroundColor: COLORS.primary, borderRadius: 12,
              paddingVertical: 12, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 8,
              marginTop: 4,
            }}
          >
            <MessageSquarePlus size={16} color='#FFFFFF' />
            <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
              I HAVE THIS — Make an Offer
            </Text>
          </TouchableOpacity>
        )}

        {responded && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#D1FAE5', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
          }}>
            <CheckCircle size={16} color='#10B981' />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#065F46' }}>
              Offer sent! Check your inbox to manage conversation.
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Seller Offer Modal ───────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={{
            backgroundColor: COLORS.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, gap: 16, maxHeight: '85%',
          }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
                  Respond to Buyer Request
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                  "{request.title}"
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={10}>
                <X size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              {/* 1. Price Quote */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                  Your Offer Price (UGX) *
                </Text>
                <TextInput
                  value={priceInput}
                  onChangeText={setPriceInput}
                  placeholder="e.g. 2,800,000"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: COLORS.surfaceSecondary, borderRadius: 12,
                    borderWidth: 1, borderColor: COLORS.border,
                    paddingHorizontal: 14, paddingVertical: 12,
                    fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.primary,
                  }}
                />
              </View>

              {/* 2. Availability */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                  Availability *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row' }}>
                  {AVAILABILITY_OPTIONS.map(opt => {
                    const active = opt.value === availability;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setAvailability(opt.value)}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
                          backgroundColor: active ? COLORS.primary : COLORS.surfaceSecondary,
                          borderWidth: 1, borderColor: active ? COLORS.primary : COLORS.border,
                        }}
                      >
                        <Text style={{
                          fontSize: 12, fontFamily: active ? 'Nunito_700Bold' : 'Nunito_400Regular',
                          color: active ? '#FFFFFF' : COLORS.text,
                        }}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 3. Link Existing Product */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                    Link Existing Listing
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                    Avoid duplicate listings
                  </Text>
                </View>

                {loadingListings ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />
                ) : sellerListings.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, flexDirection: 'row' }}>
                    {/* None option */}
                    <TouchableOpacity
                      onPress={() => setSelectedProductId(null)}
                      style={{
                        width: 120, height: 74, borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: selectedProductId === null ? COLORS.primary : COLORS.border,
                        backgroundColor: selectedProductId === null ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                        alignItems: 'center', justifyContent: 'center', padding: 8,
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontFamily: 'Nunito_700Bold',
                        color: selectedProductId === null ? COLORS.primary : COLORS.textSecondary,
                        textAlign: 'center',
                      }}>
                        No product link
                      </Text>
                    </TouchableOpacity>

                    {sellerListings.map(prod => {
                      const selected = selectedProductId === prod.id;
                      return (
                        <TouchableOpacity
                          key={prod.id}
                          onPress={() => {
                            setSelectedProductId(prod.id);
                            if (!priceInput) setPriceInput(String(prod.price));
                          }}
                          style={{
                            width: 150, borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: selected ? COLORS.primary : COLORS.border,
                            backgroundColor: selected ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                            padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
                          }}
                        >
                          {prod.image_url ? (
                            <Image source={{ uri: prod.image_url }} style={{ width: 36, height: 36, borderRadius: 8 }} />
                          ) : (
                            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}>
                              <Package size={18} color={COLORS.textTertiary} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                              {prod.title}
                            </Text>
                            <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: COLORS.primary }}>
                              UGX {Number(prod.price).toLocaleString()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={{
                    padding: 12, borderRadius: 12, backgroundColor: COLORS.surfaceSecondary,
                    borderWidth: 1, borderColor: COLORS.border,
                  }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                      No active listings found. You can still send a price quote without linking a listing.
                    </Text>
                  </View>
                )}
              </View>

              {/* 4. Intro Message */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                  Message to Buyer *
                </Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Hi! I have what you're looking for in great condition. Can deliver today in Kampala."
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  style={{
                    backgroundColor: COLORS.surfaceSecondary, borderRadius: 12,
                    borderWidth: 1, borderColor: COLORS.border,
                    padding: 12, fontSize: 14, fontFamily: 'Nunito_400Regular',
                    color: COLORS.text, minHeight: 80, textAlignVertical: 'top',
                  }}
                />
              </View>

              {/* Submit Offer Button */}
              <TouchableOpacity
                onPress={handleSendOffer}
                disabled={responding}
                activeOpacity={0.85}
                style={{
                  backgroundColor: COLORS.primary, borderRadius: 14,
                  paddingVertical: 14, alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                  marginTop: 8,
                }}
              >
                {responding ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                  {responding ? 'Sending Offer…' : 'Submit Offer & Start Chat'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
