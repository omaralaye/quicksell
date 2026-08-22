// ============================================================
// Seller Hub — Messages (selling conversations only)
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
import { useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { fetchConversations } from '@/services/chat';
import type { ConversationWithDetails } from '@/services/types';

function timeDisplay(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function ConvRow({ conv, onPress }: { conv: ConversationWithDetails; onPress: () => void }) {
  const other = conv.other_user;
  const initials = other?.display_name?.[0]?.toUpperCase() ?? '?';
  const hasUnread = conv.unread;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.convRow, hasUnread && styles.convRowUnread]}>
      {/* Avatar */}
      {other?.avatar_url ? (
        <Image source={{ uri: other.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initials}</Text>
        </View>
      )}

      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.convHeader}>
          <Text style={[styles.convName, hasUnread && styles.convNameUnread]} numberOfLines={1}>
            {other?.display_name ?? 'Buyer'}
          </Text>
          <Text style={styles.convTime}>{timeDisplay(conv.last_message_at)}</Text>
        </View>

        {conv.listing && (
          <Text style={styles.convListing} numberOfLines={1}>
            Re: {conv.listing.title}
          </Text>
        )}

        <Text
          style={[styles.convPreview, hasUnread && styles.convPreviewUnread]}
          numberOfLines={1}
        >
          {conv.last_message ?? 'No messages yet'}
        </Text>
      </View>

      {hasUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export default function SellerMessages() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const all = await fetchConversations(user.id);
      // Only selling conversations
      const selling = all.filter((c) => c.role === 'selling');
      setConversations(selling);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error('[SellerMessages] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <Animated.ScrollView
      style={{ opacity: fadeAnim }}
      contentContainerStyle={[styles.scroll, conversations.length === 0 && styles.scrollEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          tintColor={COLORS.primary}
        />
      }
    >
      {conversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MessageSquare size={48} color={COLORS.textTertiary} />
          <Text style={styles.emptyTitle}>No selling conversations yet</Text>
          <Text style={styles.emptySub}>
            When buyers message you about your listings, conversations appear here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.headerWrap}>
            <Text style={styles.headerCount}>
              {conversations.filter((c) => c.unread).length > 0
                ? `${conversations.filter((c) => c.unread).length} unread`
                : `${conversations.length} conversations`}
            </Text>
          </View>
          {conversations.map((conv) => (
            <ConvRow
              key={conv.id}
              conv={conv}
              onPress={() => router.push(`/chat/${conv.id}`)}
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
    paddingTop: 12,
    paddingBottom: 60,
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
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerCount: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.textSecondary,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  convRowUnread: {
    backgroundColor: 'rgba(232,93,38,0.03)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSecondary,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.primary,
  },
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convName: {
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.text,
    flex: 1,
  },
  convNameUnread: {
    fontFamily: 'Nunito_800ExtraBold',
  },
  convTime: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
  },
  convListing: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  convPreview: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  convPreviewUnread: {
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.text,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
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
