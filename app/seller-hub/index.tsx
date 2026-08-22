// ============================================================
// Seller Hub — Dashboard
// Shows actionable summary: stats, needs attention, quick actions
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Package,
  ShoppingBag,
  MessageSquare,
  FileSearch,
  TrendingUp,
  Plus,
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  Clock,
  Wallet,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerContext } from './_layout';
import {
  fetchSellerDashboardStats,
  formatPriceShort,
  type SellerDashboardStats,
} from '@/services/seller';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatCardProps = {
  icon: React.ReactNode;
  iconBg: string;
  value: string | number;
  label: string;
  badge?: number;
  onPress?: () => void;
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({ icon, iconBg, value, label, badge, onPress }: StatCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.statCard, { transform: [{ scale }] }]}>
        <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {!!badge && (
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.quickAction}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '18' }]}>{icon}</View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onPress && (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          <Text style={styles.sectionAction}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

import { SkeletonSellerDashboard } from '@/components/SkeletonCard';

export default function SellerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { currency } = useSellerContext();

  const [stats, setStats] = useState<SellerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const data = await fetchSellerDashboardStats(user.id, currency);
        setStats(data);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      } catch (err) {
        console.error('[SellerDashboard] load error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, currency],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (loading && !stats) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <SkeletonSellerDashboard />
      </View>
    );
  }

  const s = stats!;
  const needsAttentionItems = [
    s.pendingOrders > 0 && {
      key: 'orders',
      icon: <Clock size={16} color={COLORS.warning} />,
      text: `${s.pendingOrders} order${s.pendingOrders !== 1 ? 's' : ''} awaiting action`,
      onPress: () => router.push('/seller-hub/orders'),
    },
    s.unreadMessages > 0 && {
      key: 'messages',
      icon: <MessageSquare size={16} color={COLORS.primary} />,
      text: `${s.unreadMessages} unread message${s.unreadMessages !== 1 ? 's' : ''}`,
      onPress: () => router.push('/seller-hub/messages'),
    },
    s.openBuyerRequests > 0 && {
      key: 'requests',
      icon: <FileSearch size={16} color={COLORS.accent} />,
      text: `${s.openBuyerRequests} buyer request${s.openBuyerRequests !== 1 ? 's' : ''} looking for your products`,
      onPress: () => router.push('/seller-hub/buyer-requests'),
    },
    ...s.lowStockListings.map((l) => ({
      key: `stock-${l.id}`,
      icon: <AlertTriangle size={16} color={COLORS.danger} />,
      text: `"${l.title}" — only ${l.stock} left`,
      onPress: () => router.push(`/seller-hub/listings`),
    })),
  ].filter(Boolean) as { key: string; icon: React.ReactNode; text: string; onPress: () => void }[];

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
      }
    >
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        {/* Store Overview Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroHeader}>
            <View style={styles.storeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.storeBadgeText}>Live Store</Text>
            </View>
            <Text style={styles.heroLabel}>Total Revenue</Text>
          </View>
          <Text style={styles.heroRevenue}>
            {formatPriceShort(s.totalRevenue, currency)}
          </Text>
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>
              {s.completedSales} completed sale{s.completedSales !== 1 ? 's' : ''} across all listings
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              icon={<Package size={18} color={COLORS.primary} />}
              iconBg={COLORS.primaryMuted}
              value={s.activeListings}
              label="Active Listings"
              onPress={() => router.push('/seller-hub/listings')}
            />
            <StatCard
              icon={<ShoppingBag size={18} color={COLORS.accent} />}
              iconBg="rgba(45,155,111,0.12)"
              value={s.pendingOrders}
              label="Pending Orders"
              badge={s.pendingOrders}
              onPress={() => router.push('/seller-hub/orders')}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon={<CheckCircle size={18} color="#6366F1" />}
              iconBg="rgba(99,102,241,0.12)"
              value={s.completedSales}
              label="Completed Sales"
              onPress={() => router.push('/seller-hub/earnings')}
            />
            <StatCard
              icon={<MessageSquare size={18} color={COLORS.warning} />}
              iconBg="rgba(217,119,6,0.12)"
              value={s.unreadMessages}
              label="Unread Messages"
              badge={s.unreadMessages}
              onPress={() => router.push('/seller-hub/messages')}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.card}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActionsRow}>
            <QuickAction
              icon={<Plus size={18} color={COLORS.primary} />}
              label="New Listing"
              color={COLORS.primary}
              onPress={() => router.push('/(tabs)/(sell)')}
            />
            <QuickAction
              icon={<ShoppingBag size={18} color={COLORS.accent} />}
              label="Orders"
              color={COLORS.accent}
              onPress={() => router.push('/seller-hub/orders')}
            />
            <QuickAction
              icon={<TrendingUp size={18} color="#6366F1" />}
              label="Analytics"
              color="#6366F1"
              onPress={() => router.push('/seller-hub/analytics')}
            />
            <QuickAction
              icon={<Wallet size={18} color={COLORS.warning} />}
              label="Earnings"
              color={COLORS.warning}
              onPress={() => router.push('/seller-hub/earnings')}
            />
          </View>
        </View>

        {/* Needs Attention */}
        {needsAttentionItems.length > 0 && (
          <View style={styles.card}>
            <SectionHeader title="Needs Attention" />
            <View style={{ gap: 4 }}>
              {needsAttentionItems.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={item.onPress}
                  activeOpacity={0.8}
                  style={styles.attentionRow}
                >
                  <View style={styles.attentionIcon}>{item.icon}</View>
                  <Text style={styles.attentionText} numberOfLines={2}>
                    {item.text}
                  </Text>
                  <ChevronRight size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Buyer Requests CTA */}
        {s.openBuyerRequests > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/seller-hub/buyer-requests')}
            activeOpacity={0.85}
            style={styles.ctaBanner}
          >
            <View style={styles.ctaIconWrap}>
              <FileSearch size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaBannerTitle}>
                {s.openBuyerRequests} buyers looking for items
              </Text>
              <Text style={styles.ctaBannerSub}>Respond with your listings & secure sales</Text>
            </View>
            <ChevronRight size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </ScrollView>
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
  heroBanner: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(45,155,111,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  storeBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.accent,
  },
  heroLabel: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroRevenue: {
    fontSize: 32,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  heroFooter: {
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  heroFooterText: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  statsGrid: {
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  statBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  statBadgeText: {
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.text,
    letterSpacing: -0.1,
  },
  sectionAction: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.primary,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  attentionIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.text,
    lineHeight: 18,
  },
  ctaBanner: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '25',
  },
  ctaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBannerTitle: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.primary,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  ctaBannerSub: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
});
