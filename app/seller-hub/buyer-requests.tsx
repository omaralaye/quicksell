// ============================================================
// Seller Hub — Buyer Requests Feed
// Sellers browse & respond to buyer requests using BuyerRequestCard
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { FileSearch } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { fetchActiveBuyerRequests } from '@/services/quickmatch';
import { BuyerRequestCard } from '@/components/BuyerRequestCard';
import type { BuyerRequest } from '@/services/quickmatch.types';

export default function SellerBuyerRequests() {
  const [requests, setRequests] = useState<BuyerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchActiveBuyerRequests({ limit: 50 });
      setRequests(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error('[SellerBuyerRequests] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && requests.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <Animated.ScrollView
      style={{ opacity: fadeAnim }}
      contentContainerStyle={[styles.scroll, requests.length === 0 && styles.scrollEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          tintColor={COLORS.primary}
        />
      }
    >
      {requests.length === 0 ? (
        <View style={styles.emptyWrap}>
          <FileSearch size={48} color={COLORS.textTertiary} />
          <Text style={styles.emptyTitle}>No active buyer requests</Text>
          <Text style={styles.emptySub}>
            When buyers post requests for items, they'll appear here for you to respond.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.headerWrap}>
            <Text style={styles.headerTitle}>{requests.length} Buyer Requests</Text>
            <Text style={styles.headerSub}>Tap "I HAVE THIS" to respond and start a conversation</Text>
          </View>

          {requests.map((req) => (
            <BuyerRequestCard
              key={req.id}
              request={req}
              sellerView
            />
          ))}
        </>
      )}
    </Animated.ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60,
    gap: 12,
  },
  scrollEmpty: {
    flexGrow: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrap: {
    gap: 4,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
