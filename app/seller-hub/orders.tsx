// ============================================================
// Seller Hub — Orders Management
// Filter by status, transition orders inline
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingBag, ChevronRight, Clock, User } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserOrders, transitionOrderStatus } from '@/services/orders';
import { useSellerContext } from './_layout';
import { formatPriceShort } from '@/services/seller';
import type { OrderWithDetails, OrderStatus } from '@/services/orders.types';

// ─── Filter definitions ───────────────────────────────────────────────────────

type OrderFilterKey = 'ALL' | 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

const FILTER_TABS: { key: OrderFilterKey; label: string; statuses: OrderStatus[] }[] = [
  { key: 'ALL', label: 'All', statuses: [] },
  { key: 'NEW', label: 'New', statuses: ['PENDING', 'PAYMENT_PENDING', 'PAID'] },
  { key: 'ACCEPTED', label: 'Accepted', statuses: ['ACCEPTED'] },
  { key: 'PREPARING', label: 'Preparing', statuses: ['PREPARING'] },
  { key: 'READY', label: 'Ready', statuses: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] },
  { key: 'COMPLETED', label: 'Completed', statuses: ['COMPLETED', 'DELIVERED'] },
  { key: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'DISPUTED'] },
];

// ─── Status display config ────────────────────────────────────────────────────

const STATUS_DISPLAY: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'New Order', bg: 'rgba(217,119,6,0.12)', color: COLORS.warning },
  PAYMENT_PENDING: { label: 'Awaiting Payment', bg: 'rgba(217,119,6,0.12)', color: COLORS.warning },
  PAID: { label: 'Paid', bg: 'rgba(45,155,111,0.12)', color: COLORS.accent },
  ACCEPTED: { label: 'Accepted', bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
  PREPARING: { label: 'Preparing', bg: 'rgba(232,93,38,0.12)', color: COLORS.primary },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', bg: 'rgba(45,155,111,0.12)', color: COLORS.accent },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: 'rgba(45,155,111,0.12)', color: COLORS.accent },
  DELIVERED: { label: 'Delivered', bg: 'rgba(45,155,111,0.12)', color: COLORS.accent },
  COMPLETED: { label: 'Completed', bg: 'rgba(45,155,111,0.12)', color: COLORS.accent },
  CANCELLED: { label: 'Cancelled', bg: 'rgba(220,38,38,0.10)', color: COLORS.danger },
  REFUND_PENDING: { label: 'Refund Pending', bg: 'rgba(220,38,38,0.10)', color: COLORS.danger },
  REFUNDED: { label: 'Refunded', bg: COLORS.surfaceSecondary, color: COLORS.textSecondary },
  DISPUTED: { label: 'Disputed', bg: 'rgba(220,38,38,0.10)', color: COLORS.danger },
};

// ─── Next action mapping ──────────────────────────────────────────────────────

type NextAction = {
  label: string;
  status: OrderStatus;
  style: 'primary' | 'danger';
};

function getNextActions(status: OrderStatus): NextAction[] {
  switch (status) {
    case 'PENDING':
    case 'PAID':
      return [
        { label: 'Accept Order', status: 'ACCEPTED', style: 'primary' },
        { label: 'Decline', status: 'CANCELLED', style: 'danger' },
      ];
    case 'ACCEPTED':
      return [{ label: 'Start Preparing', status: 'PREPARING', style: 'primary' }];
    case 'PREPARING':
      return [{ label: 'Mark Ready', status: 'READY_FOR_PICKUP', style: 'primary' }];
    case 'READY_FOR_PICKUP':
      return [{ label: 'Mark Completed', status: 'COMPLETED', style: 'primary' }];
    default:
      return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  currency,
  onPress,
  onAction,
}: {
  order: OrderWithDetails;
  currency: string;
  onPress: () => void;
  onAction: (status: OrderStatus) => void;
}) {
  const statusCfg = STATUS_DISPLAY[order.status] ?? { label: order.status, bg: COLORS.surfaceSecondary, color: COLORS.textSecondary };
  const nextActions = getNextActions(order.status);
  const firstItem = order.items?.[0];
  const imgUri = firstItem?.listing?.image_url ?? '';
  const price = formatPriceShort(Number(order.total_amount), currency as any);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.orderCard}>
      <View style={styles.orderCardHeader}>
        {/* Item thumbnail */}
        <Image source={{ uri: imgUri }} style={styles.orderImg} />

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.orderItemTitle} numberOfLines={1}>
            {firstItem?.listing?.title ?? 'Order #' + order.id.slice(0, 8)}
          </Text>
          <Text style={styles.orderPrice}>{price}</Text>
          <View style={styles.orderMeta}>
            <View style={[styles.orderStatusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.orderStatusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.orderRight}>
          <Text style={styles.orderTime}><Clock size={11} color={COLORS.textTertiary} /> {timeAgo(order.created_at)}</Text>
          <ChevronRight size={16} color={COLORS.textTertiary} style={{ marginTop: 8 }} />
        </View>
      </View>

      {/* Buyer info */}
      <View style={styles.orderBuyer}>
        <User size={12} color={COLORS.textSecondary} />
        <Text style={styles.orderBuyerText}>
          {order.buyer?.display_name ?? 'Buyer'}
        </Text>
      </View>

      {/* Action buttons */}
      {nextActions.length > 0 && (
        <View style={styles.actionButtons}>
          {nextActions.map((act) => (
            <TouchableOpacity
              key={act.status}
              onPress={() => onAction(act.status)}
              activeOpacity={0.85}
              style={[
                styles.actionBtn,
                act.style === 'primary' ? styles.actionBtnPrimary : styles.actionBtnDanger,
              ]}
            >
              <Text
                style={[
                  styles.actionBtnText,
                  act.style === 'danger' && styles.actionBtnTextDanger,
                ]}
              >
                {act.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SellerOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const { currency } = useSellerContext();
  const [filter, setFilter] = useState<OrderFilterKey>('ALL');
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const data = await fetchUserOrders(user.id, 'seller');
      setOrders(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error('[SellerOrders] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filteredTab = FILTER_TABS.find((t) => t.key === filter)!;
  const filtered =
    filter === 'ALL' ? orders : orders.filter((o) => filteredTab.statuses.includes(o.status));

  const handleAction = async (order: OrderWithDetails, newStatus: OrderStatus) => {
    if (!user) return;
    const actionLabels: Partial<Record<OrderStatus, string>> = {
      ACCEPTED: 'Accept this order?',
      CANCELLED: 'Decline this order?',
      PREPARING: 'Mark as preparing?',
      READY_FOR_PICKUP: 'Mark as ready for pickup?',
      COMPLETED: 'Mark as completed?',
    };
    Alert.alert(
      actionLabels[newStatus] ?? 'Update order?',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: newStatus === 'CANCELLED' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await transitionOrderStatus(order.id, newStatus, user.id);
              setOrders((prev) =>
                prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o)),
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not update order status.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterScroll}
        bounces={false}
      >
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === 'ALL'
              ? orders.length
              : orders.filter((o) => tab.statuses.includes(o.status)).length;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              activeOpacity={0.8}
              style={[styles.filterChip, filter === tab.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === tab.key && styles.filterTextActive]}>
                {tab.label} {count > 0 ? `(${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listEmpty,
          ]}
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
            <View style={styles.emptyWrap}>
              <ShoppingBag size={44} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>No orders here</Text>
              <Text style={styles.emptySub}>Orders from buyers will appear here</Text>
            </View>
          ) : (
            filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                currency={currency}
                onPress={() => router.push(`/orders/${order.id}`)}
                onAction={(status) => handleAction(order, status)}
              />
            ))
          )}
        </Animated.ScrollView>
      )}
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
    paddingBottom: 60,
    gap: 10,
  },
  listEmpty: {
    flexGrow: 1,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  orderImg: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
  },
  orderItemTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.text,
  },
  orderPrice: {
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.primary,
    letterSpacing: -0.2,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderStatusText: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.2,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderTime: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
  },
  orderBuyer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  orderBuyerText: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionBtnDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: '#FFFFFF',
  },
  actionBtnTextDanger: {
    color: COLORS.danger,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});
