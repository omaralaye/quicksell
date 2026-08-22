// ============================================================
// Seller Hub — Analytics
// Revenue, sales, response rate, conversion, 7-day chart
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { BarChart2, TrendingUp, ShoppingBag, MessageSquare, Percent, Zap } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerContext } from './_layout';
import { fetchSellerAnalytics, formatPrice, formatPriceShort, type SellerAnalyticsData } from '@/services/seller';

type Range = 7 | 30 | 90;

function MetricCard({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function BarChartView({ data, currency }: { data: SellerAnalyticsData['dailyRevenue']; currency: string }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  // Show last 7 days only for clarity
  const slice = data.slice(-14);

  return (
    <View style={styles.chartWrap}>
      {/* Y-axis label */}
      <View style={styles.chartBars}>
        {slice.map((d, i) => {
          const height = Math.max((d.revenue / maxRevenue) * 100, d.revenue > 0 ? 4 : 2);
          const isWeekend = new Date(d.date).getDay() % 6 === 0;
          return (
            <View key={d.date} style={styles.chartBarWrap}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: `${height}%` as any,
                    backgroundColor: d.revenue > 0 ? COLORS.primary : COLORS.border,
                    opacity: d.revenue > 0 ? 1 : 0.4,
                  },
                ]}
              />
              {i % 2 === 0 && (
                <Text style={styles.chartLabel}>
                  {new Date(d.date).toLocaleDateString('en', { weekday: 'narrow' })}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function SellerAnalytics() {
  const { user } = useAuth();
  const { currency } = useSellerContext();
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<SellerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const result = await fetchSellerAnalytics(user.id, range, currency as any);
      setData(result);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error('[SellerAnalytics] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, range, currency]);

  useEffect(() => { fadeAnim.setValue(0); load(); }, [load]);

  const RANGES: { key: Range; label: string }[] = [
    { key: 7, label: '7D' },
    { key: 30, label: '30D' },
    { key: 90, label: '90D' },
  ];

  if (loading && !data) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const d = data!;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.primary} />
      }
    >
      <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
        {/* Range selector */}
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>Performance</Text>
          <View style={styles.rangeToggle}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r.key}
                onPress={() => setRange(r.key)}
                activeOpacity={0.8}
                style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
              >
                <Text style={[styles.rangeText, range === r.key && styles.rangeTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Hero Revenue card */}
        <View style={styles.heroCard}>
          <View style={[styles.metricIcon, { backgroundColor: COLORS.primaryMuted }]}>
            <TrendingUp size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.heroValue}>{formatPriceShort(d.totalRevenue, currency as any)}</Text>
          <Text style={styles.heroLabel}>Total Revenue</Text>
          <Text style={styles.heroSub}>Last {range} days</Text>
        </View>

        {/* Bar chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Revenue</Text>
          <BarChartView data={d.dailyRevenue} currency={currency} />
        </View>

        {/* Metrics grid */}
        <View style={styles.metricsGrid}>
          <MetricCard
            icon={<ShoppingBag size={18} color={COLORS.accent} />}
            iconBg="rgba(45,155,111,0.1)"
            label="Total Sales"
            value={String(d.totalSales)}
          />
          <MetricCard
            icon={<BarChart2 size={18} color="#6366F1" />}
            iconBg="rgba(99,102,241,0.1)"
            label="Avg. Order"
            value={formatPriceShort(d.avgOrderValue, currency as any)}
          />
          <MetricCard
            icon={<MessageSquare size={18} color={COLORS.warning} />}
            iconBg="rgba(217,119,6,0.1)"
            label="Response Rate"
            value={d.responseRate != null ? `${Math.round(d.responseRate)}%` : '—'}
          />
          <MetricCard
            icon={<Percent size={18} color={COLORS.primary} />}
            iconBg={COLORS.primaryMuted}
            label="Conversion"
            value={d.conversionRate != null ? `${d.conversionRate}%` : '—'}
          />
          <MetricCard
            icon={<Zap size={18} color="#F59E0B" />}
            iconBg="rgba(245,158,11,0.1)"
            label="Active Listings"
            value={String(d.activeListings)}
          />
        </View>
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
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  rangeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 2,
  },
  rangeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rangeChipActive: {
    backgroundColor: COLORS.primary,
  },
  rangeText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
  },
  rangeTextActive: {
    color: '#FFFFFF',
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroValue: {
    fontSize: 36,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -1,
    marginTop: 4,
  },
  heroLabel: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.textSecondary,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.text,
  },
  chartWrap: {
    height: 120,
    paddingTop: 8,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingBottom: 20,
  },
  chartBarWrap: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 4,
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 9,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
    position: 'absolute',
    bottom: 0,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  metricSub: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
  },
});
