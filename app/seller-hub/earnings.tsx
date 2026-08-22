// ============================================================
// Seller Hub — Earnings
// Gross earnings, pending, this-month breakdown, history list
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { Wallet, Clock, CheckCircle, ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerContext } from './_layout';
import { fetchSellerEarnings, formatPrice, formatPriceShort, type SellerEarnings } from '@/services/seller';
import { useRouter } from 'expo-router';
import type { OrderWithDetails } from '@/services/orders.types';

type EarningsView = 'month' | 'all';

function EarningsCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <View style={[styles.earningsCard, accent && styles.earningsCardAccent]}>
      <View style={[styles.earningsIcon, accent && styles.earningsIconAccent]}>{icon}</View>
      <Text style={[styles.earningsValue, accent && styles.earningsValueAccent]}>{value}</Text>
      <Text style={[styles.earningsLabel, accent && styles.earningsLabelAccent]}>{label}</Text>
      {sub ? <Text style={styles.earningsSub}>{sub}</Text> : null}
    </View>
  );
}

function OrderHistoryRow({
  order,
  currency,
  onPress,
}: {
  order: OrderWithDetails;
  currency: string;
  onPress: () => void;
}) {
  const firstItem = order.items?.[0];
  const imgUri = firstItem?.listing?.image_url ?? '';
  const price = formatPrice(Number(order.total_amount), currency as any);
  const date = new Date(order.created_at).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  });
  const isCompleted = order.status === 'COMPLETED' || order.status === 'DELIVERED';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.historyRow}>
      <Image source={{ uri: imgUri }} style={styles.historyImg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {firstItem?.listing?.title ?? 'Order #' + order.id.slice(0, 8)}
        </Text>
        <Text style={styles.historyBuyer}>
          {order.buyer?.display_name ?? 'Buyer'} · {date}
        </Text>
        <View style={styles.historyStatus}>
          {isCompleted ? (
            <CheckCircle size={12} color={COLORS.accent} />
          ) : (
            <Clock size={12} color={COLORS.warning} />
          )}
          <Text style={[styles.historyStatusText, { color: isCompleted ? COLORS.accent : COLORS.warning }]}>
            {isCompleted ? 'Completed' : 'In Progress'}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={[styles.historyPrice, !isCompleted && { color: COLORS.textSecondary }]}>
          {price}
        </Text>
        <ChevronRight size={14} color={COLORS.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function SellerEarningsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currency } = useSellerContext();
  const [view, setView] = useState<EarningsView>('month');
  const [earnings, setEarnings] = useState<SellerEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const data = await fetchSellerEarnings(user.id, currency as any);
      setEarnings(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error('[SellerEarnings] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, currency]);

  useEffect(() => { load(); }, [load]);

  if (!earnings) {
    return (
      <View style={styles.loadingWrap}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" />
        ) : (
          <Text style={{ color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>Could not load earnings.</Text>
        )}
      </View>
    );
  }

  const e = earnings!;
  const displayAmount = view === 'month' ? e.thisMonthEarnings : e.grossEarnings;

  // Filter order history for the view
  const historyOrders =
    view === 'month'
      ? e.recentOrders.filter((o) => {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          return new Date(o.created_at) >= startOfMonth && o.status === 'COMPLETED';
        })
      : e.recentOrders.filter((o) => o.status === 'COMPLETED');

  return (
    <Animated.ScrollView
      style={{ opacity: fadeAnim }}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.pageTitle}>Earnings</Text>
        <View style={styles.toggle}>
          {([{ key: 'month', label: 'This Month' }, { key: 'all', label: 'All Time' }] as { key: EarningsView; label: string }[]).map((v) => (
            <TouchableOpacity
              key={v.key}
              onPress={() => setView(v.key)}
              activeOpacity={0.8}
              style={[styles.toggleChip, view === v.key && styles.toggleChipActive]}
            >
              <Text style={[styles.toggleText, view === v.key && styles.toggleTextActive]}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Hero card */}
      <View style={styles.heroCard}>
        <Wallet size={28} color={COLORS.primary} />
        <Text style={styles.heroValue}>{formatPriceShort(displayAmount, currency as any)}</Text>
        <Text style={styles.heroLabel}>{view === 'month' ? 'This Month' : 'All Time'} Earnings</Text>
      </View>

      {/* Secondary cards */}
      <View style={styles.secondaryRow}>
        <EarningsCard
          icon={<Clock size={18} color={COLORS.warning} />}
          label="Pending"
          value={formatPriceShort(e.pendingAmount, currency as any)}
          sub="In progress orders"
        />
        <EarningsCard
          icon={<CheckCircle size={18} color={COLORS.accent} />}
          label="Completed"
          value={formatPriceShort(e.grossEarnings, currency as any)}
          sub="All time"
          accent
        />
      </View>

      {/* History */}
      {historyOrders.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle2}>
            {view === 'month' ? 'This Month' : 'Completed Orders'}
          </Text>
          <View style={styles.historyCard}>
            {historyOrders.map((order) => (
              <OrderHistoryRow
                key={order.id}
                order={order}
                currency={currency}
                onPress={() => router.push(`/orders/${order.id}`)}
              />
            ))}
          </View>
        </View>
      )}

      {historyOrders.length === 0 && (
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyHistoryText}>
            {view === 'month' ? 'No completed orders this month yet' : 'No completed orders yet'}
          </Text>
        </View>
      )}
    </Animated.ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 60,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 2,
  },
  toggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleChipActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroValue: {
    fontSize: 36,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -1,
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  earningsCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  earningsCardAccent: {
    backgroundColor: 'rgba(45,155,111,0.06)',
    borderColor: 'rgba(45,155,111,0.2)',
  },
  earningsIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsIconAccent: {
    backgroundColor: 'rgba(45,155,111,0.12)',
  },
  earningsValue: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  earningsValueAccent: {
    color: COLORS.accent,
  },
  earningsLabel: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
  },
  earningsLabelAccent: {
    color: COLORS.accent,
  },
  earningsSub: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
  },
  historySection: {
    gap: 10,
  },
  historyTitle2: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.text,
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  historyImg: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
  },
  historyTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.text,
  },
  historyBuyer: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStatusText: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
  },
  historyPrice: {
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.primary,
    letterSpacing: -0.2,
  },
  emptyHistory: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
});
