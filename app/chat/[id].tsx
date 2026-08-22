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
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Trash2,
  Ban,
  Flag,
  X,
  Camera,
  ImageIcon,
  ShoppingBag,
  Clock,
  CheckCheck,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '@/constants/Colors';
import {
  fetchMessages,
  fetchConversationById,
  sendMessage,
  markConversationAsRead,
} from '@/services/chat';
import type { MessageRow, ConversationWithDetails } from '@/services/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function resolveImageSource(source: string | undefined | null): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null) return 'UGX 0';
  return `UGX ${price.toLocaleString()}`;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [conversation, setConversation] = useState<ConversationWithDetails | null>(null);
  const [sending, setSending] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  // Action Menu Sheet state
  const [menuVisible, setMenuVisible] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    console.log('[Chat] Loading conversation and messages for:', id);

    // Fetch conversation & messages
    Promise.all([
      fetchConversationById(id, user.id),
      fetchMessages(id),
    ])
      .then(([conv, msgs]) => {
        setConversation(conv);
        setMessages(msgs);
        // Mark conversation read automatically when opened
        markConversationAsRead(id, user.id).catch((e) =>
          console.warn('[Chat] markRead error:', e)
        );
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: false });
        }, 100);
      })
      .catch((err) => {
        console.error('[Chat] load error:', err);
      });

    // 1. Subscribe to new messages using unique channel topic
    const messageChannel = supabase
      .channel(`chat_msgs_${id}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Clear unread receipt since chat is active
          if (user?.id) {
            markConversationAsRead(id, user.id).catch(() => {});
          }

          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    // 2. Realtime Broadcast channel for typing indicators
    const presenceChannel = supabase.channel(`chat_presence_${id}`);
    presenceChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload?.payload?.userId !== user.id) {
          setIsPeerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsPeerTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(presenceChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [id, user]);

  const broadcastTyping = () => {
    if (!id || !user) return;
    supabase.channel(`chat_presence_${id}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const handleListingPress = () => {
    if (conversation?.listing_id) {
      router.push(`/listing/${conversation.listing_id}`);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Please allow access to your photos to send image attachments.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('[Chat] image pick error:', err);
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !selectedImage) || !id || !user || sending) return;
    const text = inputText.trim();
    const imageToUpload = selectedImage;

    setInputText('');
    setSelectedImage(null);
    setSending(true);

    try {
      const newMsg = await sendMessage(id, user.id, text, imageToUpload);
      setMessages((prev) => {
        if (prev.find((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      console.error('[Chat] sendMessage error:', err);
      Alert.alert('Send Error', err?.message ?? 'Failed to send message.');
    } finally {
      setSending(false);
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

  const otherUserName = conversation?.other_user?.display_name ?? 'User';
  const otherUserAvatar = conversation?.other_user?.avatar_url ?? undefined;
  const listingTitle = conversation?.listing?.title ?? 'General Marketplace Inquiry';
  const listingPrice = conversation?.listing?.price;
  const listingImage = conversation?.listing?.image_url;
  const isBuyer = conversation?.role === 'buying';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Top Navigation Bar */}
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
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: COLORS.surfaceSecondary,
          }}
        />

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
            {/* Role indicator pill */}
            <View
              style={{
                backgroundColor: isBuyer ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: isBuyer ? COLORS.primary : COLORS.border,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: 'Nunito_800ExtraBold',
                  color: isBuyer ? COLORS.primary : COLORS.textSecondary,
                }}
              >
                {isBuyer ? 'BUYING FROM' : 'SELLING TO'}
              </Text>
            </View>
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              fontFamily: 'Nunito_400Regular',
              color: isPeerTyping ? COLORS.primary : COLORS.textSecondary,
            }}
          >
            {isPeerTyping ? 'typing…' : listingTitle}
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

      {/* Prominent Context Banner (Product & UGX Price) */}
      {conversation?.listing && (
        <AnimatedPressable onPress={handleListingPress}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: COLORS.surface,
              marginHorizontal: 16,
              marginTop: 12,
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: COLORS.primary,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Image
              source={resolveImageSource(listingImage)}
              style={{
                width: 52,
                height: 52,
                borderRadius: 10,
                backgroundColor: COLORS.surfaceSecondary,
              }}
            />

            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ShoppingBag size={13} color={COLORS.primary} />
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Nunito_800ExtraBold',
                    color: COLORS.primary,
                    textTransform: 'uppercase',
                  }}
                >
                  Product Context
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                }}
              >
                {listingTitle}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '800',
                  fontFamily: 'Nunito_800ExtraBold',
                  color: COLORS.primary,
                }}
              >
                Price: {formatPrice(listingPrice)}
              </Text>
            </View>
          </View>
        </AnimatedPressable>
      )}

      {/* Messages List */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
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
                  maxWidth: '80%',
                  backgroundColor: isMe ? COLORS.primary : COLORS.surface,
                  borderRadius: 18,
                  borderBottomRightRadius: isMe ? 4 : 18,
                  borderBottomLeftRadius: isMe ? 18 : 4,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: isMe ? 0 : 1,
                  borderColor: COLORS.border,
                  gap: 6,
                }}
              >
                {/* Image attachment if present */}
                {msg.image_url ? (
                  <Image
                    source={{ uri: msg.image_url }}
                    style={{
                      width: 200,
                      height: 150,
                      borderRadius: 12,
                      marginBottom: 4,
                    }}
                    resizeMode="cover"
                  />
                ) : null}

                {msg.text ? (
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
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Nunito_400Regular',
                      color: isMe ? 'rgba(255,255,255,0.75)' : COLORS.textTertiary,
                    }}
                  >
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </Text>
                  {isMe ? <CheckCheck size={12} color="rgba(255,255,255,0.85)" /> : null}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Image Preview attachment row if selected */}
      {selectedImage && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: COLORS.surfaceSecondary,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            gap: 10,
          }}
        >
          <Image
            source={{ uri: selectedImage }}
            style={{ width: 44, height: 44, borderRadius: 8 }}
          />
          <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: COLORS.text }}>
            Image attachment ready
          </Text>
          <TouchableOpacity onPress={() => setSelectedImage(null)} hitSlop={8}>
            <X size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
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
        {/* Media / Camera Button */}
        <TouchableOpacity
          onPress={handlePickImage}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageIcon size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <TextInput
          value={inputText}
          onChangeText={(t) => {
            setInputText(t);
            broadcastTyping();
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
          disabled={(!inputText.trim() && !selectedImage) || sending}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: inputText.trim() || selectedImage ? COLORS.primary : COLORS.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={18} color={inputText.trim() || selectedImage ? '#FFFFFF' : COLORS.textTertiary} />
          )}
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
