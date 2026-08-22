import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Image, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, FileSearch, MapPin, DollarSign, Tag, Clock,
  MessageSquare, CheckCircle, XCircle, Star, BadgeCheck,
  Package, ExternalLink, ArrowRight, AlertTriangle,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import {
  getBuyerRequestDetails,
  acceptBuyerRequestResponse,
  ignoreBuyerRequestResponse,
  cancelBuyerRequest,
} from '@/services/quickmatch';
import type {
  BuyerRequest,
  BuyerRequestResponse,
  BuyerRequestStatus,
} from '@/services/quickmatch.types';
import { supabase } from '@/integrations/supabase/client';

export default function BuyerRequestDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [request, setRequest] = useState<BuyerRequest | null>(null);
  const [responses, setResponses] = useState<BuyerRequestResponse[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const details = await getBuyerRequestDetails(id);
      setRequest(details.request);
      setResponses(details.responses);
    } catch (err: any) {
      console.error('Error loading request details:', err);
      Alert.alert('Error', 'Failed to load request details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcceptOffer = async (response: BuyerRequestResponse) => {
    if (!currentUserId) return;
    Alert.alert(
      'Accept Offer?',
      `Are you sure you want to accept this offer of UGX ${Number(response.price).toLocaleString()} from ${response.seller_name ?? 'the seller'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Offer',
          style: 'default',
          onPress: async () => {
            setActionId(response.id);
            try {
              await acceptBuyerRequestResponse(currentUserId, response.id);
              Alert.alert('Offer Accepted!', 'The request is now marked as FULFILLED. You can continue chatting with the seller.');
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not accept offer.');
            } finally {
              setActionId(null);
            }
          },
        },
      ],
    );
  };

  const handleIgnoreOffer = async (response: BuyerRequestResponse) => {
    if (!currentUserId) return;
    setActionId(response.id);
    try {
      await ignoreBuyerRequestResponse(currentUserId, response.id);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not ignore offer.');
    } finally {
      setActionId(null);
    }
  };

  const handleCancelRequest = async () => {
    if (!request) return;
    Alert.alert(
      'Cancel Request?',
      'Sellers will no longer be able to send offers for this request.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBuyerRequest(request.id);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not cancel request.');
            }
          },
        },
      ],
    );
  };

  const handleStartChat = (response: BuyerRequestResponse) => {
    if (response.conversation_id) {
      router.push({ pathname: '/chat/[id]', params: { id: response.conversation_id } });
    }
  };

  const handleViewProduct = (productId: string) => {
    router.push({ pathname: '/listing/[id]', params: { id: productId } });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <AlertTriangle size={48} color='#EF4444' />
        <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
          Request Not Found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBuyer = currentUserId === request.buyer_id;
  const statusUpper = (request.status ?? 'ACTIVE').toUpperCase() as BuyerRequestStatus;

  const statusBadge = (() => {
    switch (statusUpper) {
      case 'ACTIVE': return { label: 'ACTIVE', bg: '#D1FAE5', text: '#065F46' };
      case 'MATCHED': return { label: 'OFFERS RECEIVED', bg: '#FEF3C7', text: '#92400E' };
      case 'FULFILLED': return { label: 'FULFILLED', bg: '#DBEAFE', text: '#1E40AF' };
      case 'EXPIRED': return { label: 'EXPIRED', bg: '#F3F4F6', text: '#6B7280' };
      case 'CANCELLED': return { label: 'CANCELLED', bg: '#FEE2E2', text: '#991B1B' };
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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Top Header */}
      <View style={{
        paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
            Buyer Request Details
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
            Posted by {request.buyer_name ?? 'Buyer'}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: statusBadge.bg }}>
          <Text style={{ fontSize: 11, fontFamily: 'Nunito_800ExtraBold', color: statusBadge.text }}>
            {statusBadge.label}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Request Header Card */}
        <View style={{
          backgroundColor: COLORS.surface, borderRadius: 18, padding: 18,
          borderWidth: 1, borderColor: COLORS.border, gap: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{
              width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primaryMuted,
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FileSearch size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
                {request.title}
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 }}>
                {request.description || 'No additional details provided.'}
              </Text>
            </View>
          </View>

          {/* Details Metadata */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.primaryMuted }}>
              <DollarSign size={13} color={COLORS.primary} />
              <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: COLORS.primary }}>
                {budgetDisplay}
              </Text>
            </View>

            {request.city && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.surfaceSecondary }}>
                <MapPin size={13} color={COLORS.textSecondary} />
                <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>
                  {request.city} {request.radius ? `(${request.radius}km)` : ''}
                </Text>
              </View>
            )}

            {request.desired_condition && request.desired_condition !== 'any' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.surfaceSecondary }}>
                <Tag size={13} color={COLORS.textSecondary} />
                <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>
                  {request.desired_condition.replace('_', ' ')}
                </Text>
              </View>
            )}
          </View>

          {/* Cancel Button for Buyer */}
          {isBuyer && (statusUpper === 'ACTIVE' || statusUpper === 'MATCHED') && (
            <TouchableOpacity
              onPress={handleCancelRequest}
              style={{
                alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
                borderRadius: 8, backgroundColor: '#FEE2E2', marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: '#991B1B' }}>
                Cancel Request
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Offers / Responses Section */}
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
              Seller Offers ({responses.length})
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
              Direct quotes & linked items
            </Text>
          </View>

          {responses.length === 0 ? (
            <View style={{
              backgroundColor: COLORS.surface, borderRadius: 16, padding: 24,
              alignItems: 'center', justifyContent: 'center', gap: 8,
              borderWidth: 1, borderColor: COLORS.border,
            }}>
              <Clock size={32} color={COLORS.textTertiary} />
              <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                Waiting for seller responses…
              </Text>
              <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary, textAlign: 'center' }}>
                Eligible sellers in {request.city ?? 'your region'} have been notified. Replies will appear here.
              </Text>
            </View>
          ) : (
            responses.map(resp => {
              const isAccepted = resp.status === 'accepted';
              const isIgnored = resp.status === 'ignored';
              const isPending = actionId === resp.id;

              return (
                <View
                  key={resp.id}
                  style={{
                    backgroundColor: COLORS.surface, borderRadius: 18, padding: 16,
                    borderWidth: isAccepted ? 2 : 1,
                    borderColor: isAccepted ? '#10B981' : COLORS.border,
                    opacity: isIgnored ? 0.6 : 1,
                    gap: 12,
                  }}
                >
                  {/* Seller Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {resp.seller_avatar ? (
                        <Image source={{ uri: resp.seller_avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                      ) : (
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: COLORS.primary }}>
                            {(resp.seller_name ?? 'S')[0]}
                          </Text>
                        </View>
                      )}
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                            {resp.seller_name ?? 'Seller'}
                          </Text>
                          {resp.seller_is_verified && (
                            <BadgeCheck size={14} color='#10B981' />
                          )}
                        </View>
                        {resp.seller_rating != null && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Star size={12} color='#F59E0B' fill='#F59E0B' />
                            <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>
                              {Number(resp.seller_rating).toFixed(1)} rating
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Price Badge */}
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: COLORS.primary }}>
                        UGX {Number(resp.price).toLocaleString()}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>
                        {resp.availability ? resp.availability.replace('_', ' ') : 'Available'}
                      </Text>
                    </View>
                  </View>

                  {/* Seller Message */}
                  {resp.message ? (
                    <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.text, lineHeight: 19 }}>
                      "{resp.message}"
                    </Text>
                  ) : null}

                  {/* Linked Product Attachment */}
                  {resp.product && (
                    <TouchableOpacity
                      onPress={() => handleViewProduct(resp.product!.id)}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        padding: 10, borderRadius: 12, backgroundColor: COLORS.surfaceSecondary,
                        borderWidth: 1, borderColor: COLORS.border,
                      }}
                    >
                      {resp.product.image_url ? (
                        <Image source={{ uri: resp.product.image_url }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                      ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={20} color={COLORS.textTertiary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                          {resp.product.title}
                        </Text>
                        <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: COLORS.primary }}>
                          UGX {Number(resp.product.price).toLocaleString()} · View Listing
                        </Text>
                      </View>
                      <ExternalLink size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}

                  {/* Action Buttons for Buyer */}
                  {isBuyer && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      {/* Chat Button */}
                      <TouchableOpacity
                        onPress={() => handleStartChat(resp)}
                        style={{
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                          paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.surfaceSecondary,
                          borderWidth: 1, borderColor: COLORS.border,
                        }}
                      >
                        <MessageSquare size={15} color={COLORS.text} />
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                          Chat
                        </Text>
                      </TouchableOpacity>

                      {/* Accept Offer Button */}
                      {!isAccepted && !isIgnored && (
                        <TouchableOpacity
                          onPress={() => handleAcceptOffer(resp)}
                          disabled={isPending}
                          style={{
                            flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                            paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primary,
                          }}
                        >
                          {isPending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <CheckCircle size={15} color="#FFFFFF" />
                              <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                                Accept Offer
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {/* Ignore Button */}
                      {!isAccepted && !isIgnored && (
                        <TouchableOpacity
                          onPress={() => handleIgnoreOffer(resp)}
                          disabled={isPending}
                          style={{ padding: 10, borderRadius: 12, backgroundColor: COLORS.surfaceSecondary }}
                        >
                          <XCircle size={18} color={COLORS.textTertiary} />
                        </TouchableOpacity>
                      )}

                      {isAccepted && (
                        <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: '#D1FAE5' }}>
                          <CheckCircle size={16} color='#10B981' />
                          <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#065F46' }}>
                            Accepted
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {!isBuyer && (
                    <TouchableOpacity
                      onPress={() => handleStartChat(resp)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primary,
                      }}
                    >
                      <MessageSquare size={15} color='#FFFFFF' />
                      <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                        Open Chat
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
