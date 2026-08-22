/**
 * Inbox Screen
 * WhatsApp/iMessage-style conversation list:
 *  - No card borders. Full-width rows with bottom dividers.
 *  - Unread: left 3px accent bar + bold name + bold preview.
 *  - Skeleton loading rows instead of empty screen.
 *  - Buying / Selling / All filter tabs.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle, MoreVertical, Trash2, Ban, Tag, ShoppingBag, X } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { getRelativeTime } from '@/utils/mockData';
import { fetchConversations } from '@/services/chat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SkeletonConversationRow } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';

function resolveImageSource(source: string | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

export type ConversationItem = {
  id: string;
  role?: 'buying' | 'selling';
  other_user: { id: string; display_name: string; avatar_url: string | null } | null;
  listing: { id: string; title: string; image_url: string | null; price: number } | null;
  last_message: string | null;
  last_message_at: string | null;
  unread: boolean | null;
};

type FilterTab = 'all' | 'buying' | 'selling';

// ─── Filter tab pill ──────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.pill, active && styles.pillActive]}
    >
      {icon}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Single conversation row ──────────────────────────────────────────────────

function ConversationRow({
  conv,
  onPress,
  onOptions,
}: {
  conv: ConversationItem;
  onPress: () => void;
  onOptions: (e: any) => void;
}) {
  const isUnread = !!conv.unread;
  const isBuying = conv.role === 'buying';
  const timeDisplay = getRelativeTime(conv.last_message_at ?? '');
  const initials = conv.other_user?.display_name?.[0]?.toUpperCase() ?? '?';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.rowWrap}>
      {/* Unread accent bar */}
      {isUnread && <View style={styles.unreadBar} />}

      <View style={[styles.row, isUnread && styles.rowUnread]}>
        {/* Avatar */}
        <View style={{ position: 'relative' }}>
          {conv.other_user?.avatar_url ? (
            <Image
              source={resolveImageSource(conv.other_user.avatar_url)}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          {isUnread && <View style={styles.unreadDot} />}
        </View>

        {/* Content */}
        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.name, isUnread && styles.nameUnread]}
                numberOfLines={1}
              >
                {conv.other_user?.display_name ?? 'User'}
              </Text>
              {/* Role badge */}
              <View style={[styles.roleBadge, isBuying ? styles.roleBadgeBuying : styles.roleBadgeSelling]}>
                <Text style={[styles.roleText, isBuying ? styles.roleTextBuying : styles.roleTextSelling]}>
                  {isBuying ? 'BUYING' : 'SELLING'}
                </Text>
              </View>
            </View>
            <Text style={styles.timestamp}>{timeDisplay}</Text>
          </View>

          {/* Listing title */}
          {conv.listing?.title ? (
            <Text numberOfLines={1} style={styles.listingTitle}>
              {conv.listing.title}
            </Text>
          ) : null}

          {/* Last message */}
          <Text
            numberOfLines={1}
            style={[styles.preview, isUnread && styles.previewUnread]}
          >
            {conv.last_message ?? 'No messages yet'}
          </Text>
        </View>

        {/* Options button */}
        <TouchableOpacity
          onPress={onOptions}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.optionsBtn}
        >
          <MoreVertical size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Divider — inset from avatar left edge */}
      <View style={styles.divider} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);

  const loadConversations = () => {
    if (!user) return;
    fetchConversations(user.id)
      .then((data) => setConversations(data as ConversationItem[]))
      .catch((err) => console.error('[Inbox] fetchConversations error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    loadConversations();
    const channel = supabase
      .channel(`inbox_${user.id}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, loadConversations)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleOpenOptions = (conv: ConversationItem, e: any) => {
    e.stopPropagation();
    setSelectedConv(conv);
    setActionModalVisible(true);
  };

  const handleDelete = () => {
    if (!selectedConv) return;
    const name = selectedConv.other_user?.display_name ?? 'User';
    Alert.alert(
      'Delete Conversation?',
      `Delete your conversation with ${name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            setConversations(prev => prev.filter(c => c.id !== selectedConv.id));
            setActionModalVisible(false);
          },
        },
      ]
    );
  };

  const handleBlock = () => {
    if (!selectedConv?.other_user) return;
    const { id, display_name } = selectedConv.other_user;
    Alert.alert(
      `Block ${display_name}?`,
      'They will no longer be able to message you or view your listings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block User', style: 'destructive',
          onPress: () => {
            setBlockedUserIds(prev => [...prev, id]);
            setConversations(prev => prev.filter(c => c.other_user?.id !== id));
            setActionModalVisible(false);
            Alert.alert('User Blocked', `${display_name} has been blocked.`);
          },
        },
      ]
    );
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  const visibleConvs = conversations.filter(c =>
    !blockedUserIds.includes(c.other_user?.id ?? '')
  );
  const filteredConvs = visibleConvs.filter(c => {
    if (activeTab === 'buying')  return c.role === 'buying';
    if (activeTab === 'selling') return c.role === 'selling';
    return true;
  });

  const buyingCount  = visibleConvs.filter(c => c.role === 'buying').length;
  const sellingCount = visibleConvs.filter(c => c.role === 'selling').length;
  const unreadCount  = visibleConvs.filter(c => c.unread).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: COLORS.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Inbox</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unreadCount} unread</Text>
              </View>
            )}
          </View>
        </View>

        {/* Filter tabs */}
        <View style={styles.tabsRow}>
          <FilterPill
            label={`All (${visibleConvs.length})`}
            active={activeTab === 'all'}
            onPress={() => setActiveTab('all')}
          />
          <FilterPill
            label={`Buying (${buyingCount})`}
            active={activeTab === 'buying'}
            onPress={() => setActiveTab('buying')}
            icon={<ShoppingBag size={13} color={activeTab === 'buying' ? '#FFFFFF' : COLORS.primary} />}
          />
          <FilterPill
            label={`Selling (${sellingCount})`}
            active={activeTab === 'selling'}
            onPress={() => setActiveTab('selling')}
            icon={<Tag size={13} color={activeTab === 'selling' ? '#FFFFFF' : COLORS.warning} />}
          />
        </View>

        {/* List */}
        <View style={styles.list}>
          {loading ? (
            // Skeleton rows
            <>
              {[0, 1, 2, 3, 4].map(i => <SkeletonConversationRow key={i} />)}
            </>
          ) : filteredConvs.length === 0 ? (
            <EmptyState
              icon={<MessageCircle size={36} color={COLORS.primary} />}
              title={
                activeTab === 'selling'
                  ? 'No selling conversations'
                  : activeTab === 'buying'
                  ? 'No buying conversations'
                  : 'No messages yet'
              }
              subtitle={
                activeTab === 'selling'
                  ? "When buyers message you about your items, they'll appear here."
                  : 'Start by messaging sellers about items you want to buy.'
              }
            />
          ) : (
            filteredConvs.map(conv => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                onPress={() => router.push(`/chat/${conv.id}`)}
                onOptions={(e) => handleOpenOptions(conv, e)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Action sheet modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setActionModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.sheetHandle} />

            {/* User header */}
            {selectedConv && (
              <View style={styles.sheetHeader}>
                <Image
                  source={resolveImageSource(selectedConv.other_user?.avatar_url ?? undefined)}
                  style={styles.sheetAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetName}>
                    {selectedConv.other_user?.display_name ?? 'User'}
                  </Text>
                  {selectedConv.listing?.title ? (
                    <Text style={styles.sheetSub} numberOfLines={1}>
                      {selectedConv.listing.title}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => setActionModalVisible(false)}
                  style={styles.sheetClose}
                >
                  <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Actions */}
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={handleDelete} activeOpacity={0.8} style={styles.sheetAction}>
                <Trash2 size={20} color={COLORS.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetActionTitle}>Delete Conversation</Text>
                  <Text style={styles.sheetActionSub}>Remove this thread from your inbox</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBlock} activeOpacity={0.8} style={styles.sheetAction}>
                <Ban size={20} color={COLORS.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetActionTitle}>
                    Block {selectedConv?.other_user?.display_name ?? 'User'}
                  </Text>
                  <Text style={styles.sheetActionSub}>Stop messages and block access to your listings</Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  unreadCountBadge: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  unreadCountText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.primary,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  list: {
    backgroundColor: COLORS.surface,
    marginTop: 8,
  },
  // ── Conversation row ──────────────────────────────────────────────────────
  rowWrap: {
    position: 'relative',
    backgroundColor: COLORS.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowUnread: {
    backgroundColor: 'rgba(232,93,38,0.025)',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surfaceSecondary,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryMuted,
  },
  avatarInitial: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.primary,
  },
  unreadDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.text,
    flexShrink: 1,
  },
  nameUnread: {
    fontFamily: 'Nunito_800ExtraBold',
  },
  roleBadge: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  roleBadgeBuying: { backgroundColor: 'rgba(45,155,111,0.12)' },
  roleBadgeSelling: { backgroundColor: 'rgba(217,119,6,0.12)' },
  roleText: {
    fontSize: 9,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.3,
  },
  roleTextBuying: { color: '#065F46' },
  roleTextSelling: { color: '#92400E' },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textTertiary,
    flexShrink: 0,
  },
  listingTitle: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.textSecondary,
  },
  preview: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
  },
  previewUnread: {
    fontFamily: 'Nunito_600SemiBold',
    color: COLORS.text,
  },
  optionsBtn: {
    padding: 6,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginLeft: 78, // inset past avatar
  },
  // ── Action sheet ──────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceSecondary,
  },
  sheetName: {
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
  },
  sheetSub: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActions: {
    gap: 8,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSecondary,
  },
  sheetActionTitle: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.danger,
  },
  sheetActionSub: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
