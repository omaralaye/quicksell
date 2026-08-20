import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ImageSourcePropType,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send, MoreVertical, Trash2, Ban, Flag, X } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { fetchMessages, fetchConversations, sendMessage, MessageRow } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function resolveImageSource(source: string | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

type ConversationDetail = {
  id: string;
  listing_id: string | null;
  listing: { id: string; title: string; image_url: string | null; price: number } | null;
  other_user: { id: string; display_name: string; avatar_url: string | null } | null;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);

  // Action Menu Sheet state
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    console.log('[Chat] Loading conversation and messages for:', id);

    Promise.all([
      fetchConversations(user.id),
      fetchMessages(id),
    ])
      .then(([convs, msgs]) => {
        const found = (convs as ConversationDetail[]).find((c) => c.id === id) ?? null;
        setConversation(found);
        setMessages(msgs);
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: false });
        }, 100);
      })
      .catch((err) => {
        console.error('[Chat] load error:', err);
      });
  }, [id, user]);

  const handleBack = () => {
    console.log('[Chat] Back pressed');
    router.back();
  };

  const handleListingPress = () => {
    if (conversation?.listing_id) {
      console.log('[Chat] Listing preview pressed:', conversation.listing_id);
      router.push(`/listing/${conversation.listing_id}`);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !id || !user) return;
    const text = inputText.trim();
    console.log('[Chat] Send message pressed:', text);
    setInputText('');
    try {
      const newMsg = await sendMessage(id, user.id, text);
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('[Chat] sendMessage error:', err);
    }
  };

  const handleDeleteConversation = () => {
    setMenuVisible(false);
    const otherName = conversation?.other_user?.display_name ?? 'User';
    Alert.alert(
      'Delete Conversation?',
      `Are you sure you want to delete your conversation with ${otherName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('[Chat] Deleted conversation:', id);
            router.back();
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    setMenuVisible(false);
    const otherName = conversation?.other_user?.display_name ?? 'User';
    Alert.alert(
      `Block ${otherName}?`,
      `They will no longer be able to message you or view your listings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block User',
          style: 'destructive',
          onPress: () => {
            console.log('[Chat] Blocked user in chat:', conversation?.other_user?.id);
            Alert.alert('User Blocked', `${otherName} has been blocked.`);
            router.back();
          },
        },
      ]
    );
  };

  const handleReportUser = () => {
    setMenuVisible(false);
    const otherName = conversation?.other_user?.display_name ?? 'User';
    Alert.alert(
      'Report User',
      `Report ${otherName} for inappropriate behavior?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Report Submitted', 'Thank you for keeping QuickSell safe.');
          },
        },
      ]
    );
  };

  const otherUserName = conversation?.other_user?.display_name ?? 'Seller';
  const listingTitle = conversation?.listing?.title ?? '';
  const listingImage = conversation?.listing?.image_url ?? undefined;
  const otherUserAvatar = conversation?.other_user?.avatar_url ?? undefined;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
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
          onPress={handleBack}
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

        <Image
          source={resolveImageSource(otherUserAvatar)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: COLORS.surfaceSecondary,
          }}
        />

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              fontFamily: 'Nunito_700Bold',
              color: COLORS.text,
            }}
          >
            {otherUserName}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              fontFamily: 'Nunito_400Regular',
              color: COLORS.textSecondary,
            }}
          >
            {listingTitle}
          </Text>
        </View>

        {/* Options Button */}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MoreVertical size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Listing preview card */}
      {conversation && (
        <AnimatedPressable onPress={handleListingPress}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: COLORS.surface,
              marginHorizontal: 16,
              marginTop: 12,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Image
              source={resolveImageSource(listingImage)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                backgroundColor: COLORS.surfaceSecondary,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.textTertiary,
                }}
              >
                Listing
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  fontFamily: 'Nunito_600SemiBold',
                  color: COLORS.text,
                }}
              >
                {listingTitle}
              </Text>
            </View>
          </View>
        </AnimatedPressable>
      )}

      {/* Messages List */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <View
              key={msg.id}
              style={{
                alignItems: isMe ? 'flex-end' : 'flex-start',
              }}
            >
              <View
                style={{
                  maxWidth: '75%',
                  backgroundColor: isMe ? COLORS.primary : COLORS.surface,
                  borderRadius: 16,
                  borderBottomRightRadius: isMe ? 4 : 16,
                  borderBottomLeftRadius: isMe ? 16 : 4,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: isMe ? 0 : 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: 'Nunito_400Regular',
                    color: isMe ? '#FFFFFF' : COLORS.text,
                    lineHeight: 21,
                  }}
                >
                  {msg.text}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Input bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
        }}
      >
        <TextInput
          value={inputText}
          onChangeText={(t) => {
            setInputText(t);
          }}
          placeholder="Type a message…"
          placeholderTextColor={COLORS.textTertiary}
          style={{
            flex: 1,
            backgroundColor: COLORS.surfaceSecondary,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 15,
            fontFamily: 'Nunito_400Regular',
            color: COLORS.text,
            maxHeight: 100,
          }}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <AnimatedPressable
          onPress={handleSend}
          disabled={!inputText.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: inputText.trim() ? COLORS.primary : COLORS.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={18} color={inputText.trim() ? '#FFFFFF' : COLORS.textTertiary} />
        </AnimatedPressable>
      </View>

      {/* Options Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
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

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
                Chat Options
              </Text>
              <TouchableOpacity
                onPress={() => setMenuVisible(false)}
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

            <View style={{ gap: 10 }}>
              {/* Delete Conversation */}
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
                <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>
                  Delete Conversation
                </Text>
              </TouchableOpacity>

              {/* Block User */}
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
                <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.danger }}>
                  Block {otherUserName}
                </Text>
              </TouchableOpacity>

              {/* Report User */}
              <TouchableOpacity
                onPress={handleReportUser}
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
                <Flag size={20} color={COLORS.textSecondary} />
                <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                  Report User
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}
