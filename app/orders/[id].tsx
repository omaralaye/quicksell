import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  initiatePayment,
  simulatePaymentCallback,
  fetchOrderPayment,
  subscribeToPaymentStatus,
  type PaymentRecord,
} from '@/services/payments';
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ShoppingBag,
  Store,
  UserCheck,
  AlertTriangle,
  MessageCircle,
  CreditCard,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Lock,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOrderDetails, transitionOrderStatus } from '@/services/orders';
import type { OrderWithDetails, OrderStatus, OrderStatusHistoryRow } from '@/services/orders.types';
import { submitTransactionReview } from '@/services/reputation';
import { getOrCreateConversation } from '@/services/chat';
import { supabase } from '@/integrations/supabase/client';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Star } from 'lucide-react-native';

function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return 'UGX 0';
  return `UGX ${amount.toLocaleString()}`;
}

function getStatusBadgeStyle(status: OrderStatus) {
  switch (status) {
    case 'PENDING':
    case 'PAYMENT_PENDING':
      return { bg: '#FEF3C7', text: '#D97706', label: status.replace('_', ' ') };
    case 'ACCEPTED':
    case 'PAID':
    case 'PREPARING':
      return { bg: '#DBEAFE', text: '#2563EB', label: status.replace('_', ' ') };
    case 'READY_FOR_PICKUP':
    case 'OUT_FOR_DELIVERY':
      return { bg: '#E0E7FF', text: '#4F46E5', label: status.replace(/_/g, ' ') };
    case 'DELIVERED':
    case 'COMPLETED':
      return { bg: '#D1FAE5', text: '#059669', label: status };
    case 'CANCELLED':
    case 'REFUNDED':
      return { bg: '#FEE2E2', text: '#DC2626', label: status };
    case 'DISPUTED':
    case 'REFUND_PENDING':
      return { bg: '#FCE7F3', text: '#DB2777', label: status.replace('_', ' ') };
    default:
      return { bg: COLORS.surfaceSecondary, text: COLORS.textSecondary, label: status };
  }
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Cancellation / Reason Modal
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [targetStatus, setTargetStatus] = useState<OrderStatus | null>(null);
  const [reasonText, setReasonText] = useState('');

  // Payment Modal & Realtime State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [activePayment, setActivePayment] = useState<PaymentRecord | null>(null);
  const [paymentInitiating, setPaymentInitiating] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);

  // Review Modal State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleStartPaymentFlow = async () => {
    if (!id || paymentInitiating) return;
    setPaymentInitiating(true);
    try {
      const res = await initiatePayment({ orderId: id, provider: 'stripe' });
      const current = await fetchOrderPayment(id);
      if (current) setActivePayment(current);
      setPaymentModalVisible(true);
    } catch (err: any) {
      console.error('[OrderDetail] initiatePayment error:', err);
      Alert.alert('Payment Error', err?.message ?? 'Could not initialize payment session.');
    } finally {
      setPaymentInitiating(false);
    }
  };

  const handleSimulateWebhook = async (status: 'SUCCESSFUL' | 'FAILED') => {
    if (!activePayment || processingCallback) return;
    setProcessingCallback(true);
    try {
      await simulatePaymentCallback({
        idempotencyKey: activePayment.idempotency_key,
        providerReference: activePayment.provider_reference ?? undefined,
        status,
      });
      const updated = await fetchOrderPayment(id!);
      if (updated) setActivePayment(updated);
      loadOrderData();
      if (status === 'SUCCESSFUL') {
        Alert.alert('Payment Successful!', 'Server callback confirmed payment. Order status set to PAID.');
      } else {
        Alert.alert('Payment Failed', 'Server callback marked payment as failed. Reservation released.');
      }
    } catch (err: any) {
      console.error('[OrderDetail] simulateWebhook error:', err);
      Alert.alert('Callback Error', err?.message ?? 'Failed to execute payment callback');
    } finally {
      setProcessingCallback(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!id || submittingReview) return;
    setSubmittingReview(true);
    try {
      await submitTransactionReview(id, ratingValue, reviewComment);
      Alert.alert('Review Submitted', 'Thank you! Your rating has been recorded and reputation metrics updated.');
      setReviewModalVisible(false);
      setReviewComment('');
      loadOrderData();
    } catch (err: any) {
      console.error('[OrderDetail] submit review error:', err);
      Alert.alert('Review Failed', err?.message ?? 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const loadOrderData = () => {
    if (!id || !user) return;
    fetchOrderDetails(id, user.id)
      .then((data) => setOrder(data))
      .catch((err) => {
        console.error('[OrderDetail] load error:', err);
        Alert.alert('Error', 'Could not load order details.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id || !user) return;
    loadOrderData();

    // Subscribe to Realtime updates on order and status history
    const channel = supabase
      .channel(`order_detail_${id}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => loadOrderData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${id}` },
        () => loadOrderData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const handleTransition = async (newStatus: OrderStatus, reason?: string) => {
    if (!id || !user || actionLoading) return;
    setActionLoading(true);
    try {
      await transitionOrderStatus(id, newStatus, user.id, reason);
      Alert.alert('Status Updated', `Order is now ${newStatus.replace(/_/g, ' ')}.`);
      loadOrderData();
    } catch (err: any) {
      console.error('[OrderDetail] transition error:', err);
      Alert.alert('Transition Failed', err?.message ?? 'Could not update order status.');
    } finally {
      setActionLoading(false);
      setReasonModalVisible(false);
      setReasonText('');
      setTargetStatus(null);
    }
  };

  const openReasonModal = (status: OrderStatus) => {
    setTargetStatus(status);
    setReasonModalVisible(true);
  };

  const handleContactOtherParty = async () => {
    if (!user || !order) return;
    const isBuyer = user.id === order.buyer_id;
    const otherUserId = isBuyer ? order.seller_id : order.buyer_id;
    const firstListingId = order.items?.[0]?.listing_id;

    try {
      const convId = await getOrCreateConversation(
        isBuyer ? user.id : otherUserId,
        isBuyer ? otherUserId : user.id,
        firstListingId,
        order.id
      );
      router.push(`/chat/${convId}`);
    } catch (err: any) {
      console.error('[OrderDetail] chat error:', err);
      Alert.alert('Error', 'Could not open chat.');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <XCircle size={48} color={COLORS.danger} />
        <Text style={{ fontSize: 18, fontFamily: 'Nunito_700Bold', color: COLORS.text, marginTop: 12 }}>
          Order Not Found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 15, color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBuyer = user?.id === order.buyer_id;
  const isSeller = user?.id === order.seller_id;
  const badgeStyle = getStatusBadgeStyle(order.status);
  const firstItem = order.items?.[0];
  const listingTitle = firstItem?.listing?.title ?? 'Product Item';
  const listingImage = firstItem?.listing?.image_url ?? (firstItem?.listing?.images?.[0] ?? undefined);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Top Header Bar */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AnimatedPressable
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={COLORS.text} />
        </AnimatedPressable>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '800',
              fontFamily: 'Nunito_800ExtraBold',
              color: COLORS.text,
            }}
          >
            {isBuyer ? 'Your Order' : 'Order to Fulfill'}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Nunito_400Regular',
              color: COLORS.textSecondary,
            }}
          >
            Order #{order.id.substring(0, 8)}
          </Text>
        </View>

        {/* Status Pill */}
        <View
          style={{
            backgroundColor: badgeStyle.bg,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Nunito_800ExtraBold',
              color: badgeStyle.text,
              textTransform: 'uppercase',
            }}
          >
            {badgeStyle.label}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product & Order Overview Card */}
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Image
              source={{ uri: listingImage }}
              style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary }}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Nunito_700Bold', color: COLORS.text }} numberOfLines={2}>
                {listingTitle}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                Quantity: {firstItem?.quantity ?? 1}
              </Text>
              <Text style={{ fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: COLORS.primary }}>
                Total: {formatCurrency(order.total_amount)}
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: COLORS.divider }} />

          {/* Participant Information */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isBuyer ? (
                <>
                  <Store size={16} color={COLORS.textSecondary} />
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: COLORS.text }}>
                    Seller: {order.seller?.display_name ?? 'QuickSell Seller'}
                  </Text>
                </>
              ) : (
                <>
                  <UserCheck size={16} color={COLORS.textSecondary} />
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: COLORS.text }}>
                    Buyer: {order.buyer?.display_name ?? 'Buyer'}
                  </Text>
                </>
              )}
            </View>

            <TouchableOpacity
              onPress={handleContactOtherParty}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: COLORS.surfaceSecondary,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 14,
              }}
            >
              <MessageCircle size={14} color={COLORS.primary} />
              <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: COLORS.primary }}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Status History Audit Trail */}
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color={COLORS.primary} />
            <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
              Status Audit History
            </Text>
          </View>

          {(!order.history || order.history.length === 0) ? (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.textTertiary }}>
              No history transitions recorded yet.
            </Text>
          ) : (
            <View style={{ gap: 12, marginTop: 4 }}>
              {order.history.map((h, i) => (
                <View key={h.id || i} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: i === order.history!.length - 1 ? COLORS.primary : COLORS.border,
                        marginTop: 4,
                      }}
                    />
                    {i < order.history!.length - 1 && (
                      <View style={{ width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 2 }} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                      {h.new_status.replace(/_/g, ' ')}
                    </Text>
                    {h.previous_status && (
                      <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                        From: {h.previous_status.replace(/_/g, ' ')}
                      </Text>
                    )}
                    {h.reason && (
                      <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textTertiary }}>
                        Reason: {h.reason}
                      </Text>
                    )}
                    <Text style={{ fontSize: 10, fontFamily: 'Nunito_400Regular', color: COLORS.textTertiary, marginTop: 2 }}>
                      {new Date(h.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.surface,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          gap: 10,
        }}
      >
        {actionLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            {/* SELLER ACTION CONTROLS */}
            {isSeller && (
              <View style={{ gap: 8 }}>
                {order.status === 'PENDING' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => openReasonModal('CANCELLED')}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: COLORS.surfaceSecondary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleTransition('ACCEPTED')}
                      style={{
                        flex: 2,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: COLORS.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>Accept Order</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {order.status === 'ACCEPTED' && (
                  <TouchableOpacity
                    onPress={() => handleTransition('PAYMENT_PENDING')}
                    style={{
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: COLORS.primary,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                      Request Payment from Buyer
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === 'PAID' && (
                  <TouchableOpacity
                    onPress={() => handleTransition('PREPARING')}
                    style={{
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: COLORS.primary,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                      Start Preparing Order
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === 'PREPARING' && (
                  <TouchableOpacity
                    onPress={() => handleTransition('READY_FOR_PICKUP')}
                    style={{
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: COLORS.primary,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                      Mark Ready for Pickup
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === 'READY_FOR_PICKUP' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => handleTransition('OUT_FOR_DELIVERY')}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: COLORS.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                        Hand to Courier
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleTransition('DELIVERED')}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: COLORS.accent,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                        Mark Delivered
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {order.status === 'OUT_FOR_DELIVERY' && (
                  <TouchableOpacity
                    onPress={() => handleTransition('DELIVERED')}
                    style={{
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: COLORS.accent,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                      Mark Delivered
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* BUYER ACTION CONTROLS */}
            {isBuyer && (
              <View style={{ gap: 8 }}>
                {(order.status === 'PENDING' || order.status === 'ACCEPTED' || order.status === 'PAYMENT_PENDING') && (
                  <TouchableOpacity
                    onPress={handleStartPaymentFlow}
                    disabled={paymentInitiating}
                    style={{
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: COLORS.primary,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {paymentInitiating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Lock size={16} color="#FFFFFF" />
                        <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                          Pay Securely ({formatCurrency(order.total_amount)})
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {order.status === 'DELIVERED' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => openReasonModal('DISPUTED')}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: COLORS.surfaceSecondary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>
                        Report Issue
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleTransition('COMPLETED')}
                      style={{
                        flex: 2,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: COLORS.accent,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                        Confirm Receipt
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {['PENDING', 'ACCEPTED', 'PAYMENT_PENDING'].includes(order.status) && (
                  <TouchableOpacity
                    onPress={() => openReasonModal('CANCELLED')}
                    style={{
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>
                      Cancel Order
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* COMPLETED ORDER REVIEW BUTTON FOR BOTH BUYER & SELLER */}
            {order.status === 'COMPLETED' && (
              <TouchableOpacity
                onPress={() => setReviewModalVisible(true)}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: COLORS.warning,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Star size={18} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF' }}>
                  Rate Transaction
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} transparent animationType="fade" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, gap: 16 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text, textAlign: 'center' }}>
              Rate Your Experience
            </Text>
            
            <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary, textAlign: 'center' }}>
              {isBuyer ? 'Rate your seller for this completed purchase.' : 'Rate your buyer for this completed transaction.'}
            </Text>

            {/* 5-Star Selector */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingValue(star)} style={{ padding: 4 }}>
                  <Star
                    size={32}
                    color={star <= ratingValue ? COLORS.warning : COLORS.border}
                    fill={star <= ratingValue ? COLORS.warning : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Write an optional review comment..."
              placeholderTextColor={COLORS.textTertiary}
              style={{
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.text,
                minHeight: 80,
              }}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} style={{ padding: 10 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitReview}
                disabled={submittingReview}
                style={{ backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>Submit Rating</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reason Modal for Cancellation or Disputes */}
      <Modal visible={reasonModalVisible} transparent animationType="fade" onRequestClose={() => setReasonModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, gap: 14 }}>
            <Text style={{ fontSize: 17, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
              Provide Reason for {targetStatus?.replace(/_/g, ' ')}
            </Text>
            <TextInput
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="Enter reason..."
              placeholderTextColor={COLORS.textTertiary}
              style={{
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.text,
                minHeight: 80,
              }}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setReasonModalVisible(false)} style={{ padding: 10 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => targetStatus && handleTransition(targetStatus, reasonText)}
                style={{ backgroundColor: COLORS.danger, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Secure Payment Gateway Modal (Zero-Trust) */}
      <Modal visible={paymentModalVisible} transparent animationType="slide" onRequestClose={() => setPaymentModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              gap: 16,
              maxHeight: '85%',
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CreditCard size={20} color={COLORS.primary} />
                <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
                  Secure Payment Gateway
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={{ padding: 4 }}>
                <XCircle size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Zero-Trust Security Banner */}
            <View
              style={{
                backgroundColor: '#F0F9FF',
                borderColor: '#BAE6FD',
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <Lock size={18} color="#0284C7" />
              <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: '#0369A1', lineHeight: 16 }}>
                Protected by QuickSell Zero-Trust Gateway. Payment status is verified strictly by server-side webhooks.
              </Text>
            </View>

            {/* Order Payment Summary */}
            <View
              style={{
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 14,
                padding: 16,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>Order Total</Text>
                <Text style={{ fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: COLORS.primary }}>
                  {formatCurrency(order?.total_amount)}
                </Text>
              </View>

              {activePayment && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textTertiary }}>
                      Idempotency Key
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>
                      {activePayment.idempotency_key.substring(0, 22)}...
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textTertiary }}>
                      Provider Ref
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>
                      {activePayment.provider_reference}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textTertiary }}>
                      Payment Status
                    </Text>
                    <View
                      style={{
                        backgroundColor: activePayment.status === 'SUCCESSFUL' ? '#D1FAE5' : activePayment.status === 'FAILED' ? '#FEE2E2' : '#FEF3C7',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'Nunito_800ExtraBold',
                          color: activePayment.status === 'SUCCESSFUL' ? '#059669' : activePayment.status === 'FAILED' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {activePayment.status}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Server Callback Simulation Controls (Zero-Trust Verification) */}
            <View style={{ gap: 10, marginTop: 6 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Nunito_700Bold', color: COLORS.textSecondary }}>
                Server Payment Gateway Actions:
              </Text>

              <TouchableOpacity
                onPress={() => handleSimulateWebhook('SUCCESSFUL')}
                disabled={processingCallback || activePayment?.status === 'SUCCESSFUL'}
                style={{
                  backgroundColor: COLORS.accent,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: activePayment?.status === 'SUCCESSFUL' ? 0.6 : 1,
                }}
              >
                {processingCallback ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#FFFFFF" />
                    <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF' }}>
                      {activePayment?.status === 'SUCCESSFUL' ? 'Payment Verified Success' : 'Simulate Provider Webhook Success'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSimulateWebhook('FAILED')}
                disabled={processingCallback || activePayment?.status === 'SUCCESSFUL'}
                style={{
                  backgroundColor: COLORS.surfaceSecondary,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: COLORS.danger,
                }}
              >
                <XCircle size={16} color={COLORS.danger} />
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>
                  Simulate Provider Webhook Failure
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.textSecondary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
