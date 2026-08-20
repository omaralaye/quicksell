import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Animated,
  ImageSourcePropType,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  MessageCircle,
  ChevronRight,
  MoreVertical,
  Trash2,
  Ban,
  Tag,
  ShoppingBag,
  X,
  ShieldAlert,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { getRelativeTime } from '@/utils/mockData';
import { fetchConversations } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';

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

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);

  // Selected conversation for action sheet modal
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    console.log('[Inbox] Fetching conversations for:', user.id);
    fetchConversations(user.id)
      .then((data) => {
        setConversations(data as ConversationItem[]);
      })
      .catch((err) => {
        console.error('[Inbox] fetchConversations error:', err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleOpenActionModal = (conv: ConversationItem, e: any) => {
    e.stopPropagation();
    console.log('[Inbox] Action modal opened for conv:', conv.id);
    setSelectedConv(conv);
    setActionModalVisible(true);
  };

  const handleDeleteConversation = () => {
    if (!selectedConv) return;
    const convId = selectedConv.id;
    const otherName = selectedConv.other_user?.display_name ?? 'User';

    Alert.alert(
      'Delete Conversation?',
      `Are you sure you want to delete your conversation with ${otherName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('[Inbox] Deleted conversation:', convId);
            setConversations((prev) => prev.filter((c) => c.id !== convId));
            setActionModalVisible(false);
            setSelectedConv(null);
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    if (!selectedConv) return;
    const otherUser = selectedConv.other_user;
    if (!otherUser) return;

    Alert.alert(
      `Block ${otherUser.display_name}?`,
      `They will no longer be able to message you or view your listings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block User',
          style: 'destructive',
          onPress: () => {
            console.log('[Inbox] Blocked user:', otherUser.id);
            setBlockedUserIds((prev) => [...prev, otherUser.id]);
            setConversations((prev) => prev.filter((c) => c.other_user?.id !== otherUser.id));
            setActionModalVisible(false);
            setSelectedConv(null);
            Alert.alert('User Blocked', `${otherUser.display_name} has been blocked.`);
          },
        },
      ]
    );
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (conv.other_user?.id && blockedUserIds.includes(conv.other_user.id)) return false;
    if (activeTab === 'buying') return conv.role === 'buying';
    if (activeTab === 'selling') return conv.role === 'selling';
    return true;
  });

  const buyingCount = conversations.filter((c) => c.role === 'buying' && !blockedUserIds.includes(c.other_user?.id ?? '')).length;
  const sellingCount = conversations.filter((c) => c.role === 'selling' && !blockedUserIds.includes(c.other_user?.id ?? '')).length;
  const unreadCount = conversations.filter((c) => c.unread && !blockedUserIds.includes(c.other_user?.id ?? '')).length;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '800',
                fontFamily: 'Nunito_800ExtraBold',
                color: COLORS.text,
                letterSpacing: -0.5,
              }}
            >
              Inbox
            </Text>
            {unreadCount > 0 && (
              <View
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Nunito_700Bold',
                    color: COLORS.primary,
                  }}
                >
                  {unreadCount} unread
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Buying vs Selling Tabs */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            marginBottom: 16,
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('all')}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: activeTab === 'all' ? COLORS.primary : COLORS.surface,
              borderWidth: 1,
              borderColor: activeTab === 'all' ? COLORS.primary : COLORS.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Nunito_700Bold',
                color: activeTab === 'all' ? '#FFFFFF' : COLORS.textSecondary,
              }}
            >
              All Messages ({conversations.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('buying')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: activeTab === 'buying' ? COLORS.primary : COLORS.surface,
              borderWidth: 1,
              borderColor: activeTab === 'buying' ? COLORS.primary : COLORS.border,
            }}
          >
            <ShoppingBag size={14} color={activeTab === 'buying' ? '#FFFFFF' : COLORS.primary} />
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Nunito_700Bold',
                color: activeTab === 'buying' ? '#FFFFFF' : COLORS.text,
              }}
            >
              Buying ({buyingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('selling')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: activeTab === 'selling' ? COLORS.primary : COLORS.surface,
              borderWidth: 1,
              borderColor: activeTab === 'selling' ? COLORS.primary : COLORS.border,
            }}
          >
            <Tag size={14} color={activeTab === 'selling' ? '#FFFFFF' : '#D97706'} />
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Nunito_700Bold',
                color: activeTab === 'selling' ? '#FFFFFF' : COLORS.text,
              }}
            >
              Selling ({sellingCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conversations List */}
        {!loading && filteredConversations.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              paddingTop: 70,
              paddingHorizontal: 32,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: COLORS.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <MessageCircle size={32} color={COLORS.primary} />
            </View>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                fontFamily: 'Nunito_700Bold',
                color: COLORS.text,
              }}
            >
              No {activeTab !== 'all' ? activeTab : ''} messages
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.textSecondary,
                textAlign: 'center',
                maxWidth: 260,
              }}
            >
              {activeTab === 'selling'
                ? 'When buyers message you about your items, they will show up here.'
                : 'Start by messaging sellers about items you want to buy.'}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {filteredConversations.map((conv) => {
              const timeDisplay = getRelativeTime(conv.last_message_at ?? '');
              const otherUserName = conv.other_user?.display_name ?? 'User';
              const otherUserAvatar = conv.other_user?.avatar_url ?? undefined;
              const listingTitle = conv.listing?.title ?? '';
              const listingImage = conv.listing?.image_url ?? undefined;
              const isUnread = conv.unread ?? false;
              const isBuying = conv.role === 'buying';

              return (
                <AnimatedPressable
                  key={conv.id}
                  onPress={() => router.push(`/chat/${conv.id}`)}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: COLORS.surface,
                      borderRadius: 14,
                      padding: 12,
                      gap: 12,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    {/* User Avatar */}
                    <View style={{ position: 'relative' }}>
                      <Image
                        source={resolveImageSource(otherUserAvatar)}
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: COLORS.surfaceSecondary,
                        }}
                      />
                      {isUnread && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: COLORS.primary,
                            borderWidth: 2,
                            borderColor: COLORS.surface,
                          }}
                        />
                      )}
                    </View>

                    {/* Listing Thumbnail */}
                    <Image
                      source={resolveImageSource(listingImage)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: COLORS.surfaceSecondary,
                      }}
                    />

                    {/* Conversation Info */}
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: '700',
                              fontFamily: 'Nunito_700Bold',
                              color: COLORS.text,
                            }}
                          >
                            {otherUserName}
                          </Text>
                          {/* Role Tag Badge */}
                          <View
                            style={{
                              backgroundColor: isBuying ? '#DEF7EC' : '#FEF3C7',
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: 'Nunito_700Bold',
                                color: isBuying ? '#03543F' : '#92400E',
                              }}
                            >
                              {isBuying ? 'BUYING' : 'SELLING'}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: 'Nunito_400Regular',
                            color: COLORS.textTertiary,
                          }}
                        >
                          {timeDisplay}
                        </Text>
                      </View>

                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 13,
                          fontFamily: 'Nunito_600SemiBold',
                          color: COLORS.textSecondary,
                        }}
                      >
                        {listingTitle}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 13,
                          fontFamily: 'Nunito_400Regular',
                          color: isUnread ? COLORS.text : COLORS.textSecondary,
                          fontWeight: isUnread ? '700' : '400',
                        }}
                      >
                        {conv.last_message}
                      </Text>
                    </View>

                    {/* Options Menu Button */}
                    <TouchableOpacity
                      onPress={(e) => handleOpenActionModal(conv, e)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{
                        padding: 6,
                        borderRadius: 16,
                        backgroundColor: COLORS.surfaceSecondary,
                      }}
                    >
                      <MoreVertical size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Conversation Action Sheet Modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setActionModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 20,
            }}
          >
            {/* Sheet Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: COLORS.border,
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />

            {/* Selected User Header */}
            {selectedConv && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                }}
              >
                <Image
                  source={resolveImageSource(selectedConv.other_user?.avatar_url ?? undefined)}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
                    {selectedConv.other_user?.display_name ?? 'User'}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                    {selectedConv.listing?.title}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setActionModalVisible(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: COLORS.surfaceSecondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Actions */}
            <View style={{ gap: 10 }}>
              {/* Delete Conversation Button */}
              <TouchableOpacity
                onPress={handleDeleteConversation}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: COLORS.surfaceSecondary,
                }}
              >
                <Trash2 size={20} color={COLORS.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>
                    Delete Conversation
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                    Remove this message thread from your inbox
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Block User Button */}
              <TouchableOpacity
                onPress={handleBlockUser}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: COLORS.surfaceSecondary,
                }}
              >
                <Ban size={20} color={COLORS.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>
                    Block {selectedConv?.other_user?.display_name ?? 'User'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                    Stop receiving messages and block access
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
