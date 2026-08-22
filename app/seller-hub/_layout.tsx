import React, { createContext, useContext, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  BarChart2,
  FileSearch,
  MessageSquare,
  Wallet,
  ArrowLeft,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import type { CurrencyCode } from '@/services/seller';

// ─── Seller Context ───────────────────────────────────────────────────────────
// Shared state across all seller-hub screens

type SellerContextType = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
};

const SellerContext = createContext<SellerContextType>({
  currency: 'UGX',
  setCurrency: () => {},
});

export function useSellerContext() {
  return useContext(SellerContext);
}

// ─── Tab Definitions ──────────────────────────────────────────────────────────

type TabDef = {
  name: string;
  route: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  segment: string;
};

const SELLER_TABS: TabDef[] = [
  {
    name: 'index',
    route: '/seller-hub',
    label: 'Dashboard',
    segment: 'index',
    icon: (a) => <LayoutDashboard size={18} color={a ? COLORS.primary : COLORS.textSecondary} strokeWidth={a ? 2.5 : 2} />,
  },
  {
    name: 'listings',
    route: '/seller-hub/listings',
    label: 'Listings',
    segment: 'listings',
    icon: (a) => <Package size={18} color={a ? COLORS.primary : COLORS.textSecondary} strokeWidth={a ? 2.5 : 2} />,
  },
  {
    name: 'orders',
    route: '/seller-hub/orders',
    label: 'Orders',
    segment: 'orders',
    icon: (a) => <ShoppingBag size={18} color={a ? COLORS.primary : COLORS.textSecondary} strokeWidth={a ? 2.5 : 2} />,
  },
  {
    name: 'buyer-requests',
    route: '/seller-hub/buyer-requests',
    label: 'Requests',
    segment: 'buyer-requests',
    icon: (a) => <FileSearch size={18} color={a ? COLORS.primary : COLORS.textSecondary} strokeWidth={a ? 2.5 : 2} />,
  },
  {
    name: 'messages',
    route: '/seller-hub/messages',
    label: 'Messages',
    segment: 'messages',
    icon: (a) => <MessageSquare size={18} color={a ? COLORS.primary : COLORS.textSecondary} strokeWidth={a ? 2.5 : 2} />,
  },
  {
    name: 'earnings',
    route: '/seller-hub/earnings',
    label: 'Earnings',
    segment: 'earnings',
    icon: (a) => <Wallet size={18} color={a ? COLORS.primary : COLORS.textSecondary} strokeWidth={a ? 2.5 : 2} />,
  },
  {
    name: 'analytics',
    route: '/seller-hub/analytics',
    label: 'Analytics',
    segment: 'analytics',
    icon: (a) => <BarChart2 size={18} color={a ? COLORS.primary : COLORS.textSecondary} strokeWidth={a ? 2.5 : 2} />,
  },
];

// ─── Custom Seller Tab Bar ─────────────────────────────────────────────────────

function SellerTabBar({ activeSegment }: { activeSegment: string }) {
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabBarContent}
      style={styles.tabBarScroll}
      bounces={false}
    >
      {SELLER_TABS.map((tab) => {
        const isActive = activeSegment === tab.segment || (activeSegment === '' && tab.segment === 'index');
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => router.replace(tab.route as any)}
            activeOpacity={0.75}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
          >
            {tab.icon(isActive)}
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SellerHubLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const [currency, setCurrency] = useState<CurrencyCode>('UGX');

  // Determine active segment: segments looks like ['seller-hub', 'orders'] etc.
  // When on the root, it's just ['seller-hub']
  const lastSegment = segments[segments.length - 1] ?? '';
  const activeSegment = lastSegment === 'seller-hub' ? 'index' : lastSegment;

  return (
    <SellerContext.Provider value={{ currency, setCurrency }}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 8 },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color={COLORS.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Seller Hub</Text>
            <Text style={styles.headerSubtitle}>Manage your business</Text>
          </View>

          {/* Currency Toggle */}
          <View style={styles.currencyToggle}>
            {(['UGX', 'USD'] as CurrencyCode[]).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCurrency(c)}
                activeOpacity={0.8}
                style={[
                  styles.currencyChip,
                  currency === c && styles.currencyChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.currencyText,
                    currency === c && styles.currencyTextActive,
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tab Bar */}
        <SellerTabBar activeSegment={activeSegment} />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Screen content */}
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="listings" />
          <Stack.Screen name="orders" />
          <Stack.Screen name="buyer-requests" />
          <Stack.Screen name="messages" />
          <Stack.Screen name="earnings" />
          <Stack.Screen name="analytics" />
          <Stack.Screen name="edit-listing/[id]" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
        </Stack>
      </View>
    </SellerContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  currencyToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 2,
  },
  currencyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  currencyChipActive: {
    backgroundColor: COLORS.primary,
  },
  currencyText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
  },
  currencyTextActive: {
    color: '#FFFFFF',
  },
  tabBarScroll: {
    backgroundColor: COLORS.surface,
    maxHeight: 56,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabItemActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary + '25',
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.textSecondary,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontFamily: 'Nunito_800ExtraBold',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
});
