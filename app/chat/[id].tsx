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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { MOCK_CONVERSATIONS, MOCK_MESSAGES, Message } from '@/utils/mockData';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function resolveImageSource(source: string | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');

  const conversation = MOCK_CONVERSATIONS.find((c) => c.id === id);
  const [messages, setMessages] = useState<Message[]>(
    MOCK_MESSAGES[id ?? ''] ?? []
  );

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, []);

  const handleBack = () => {
    console.log('[Chat] Back pressed');
    router.back();
  };

  const handleListingPress = () => {
    if (conversation) {
      console.log('[Chat] Listing preview pressed:', conversation.listingId);
      router.push(`/listing/${conversation.listingId}`);
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    console.log('[Chat] Send message pressed:', inputText.trim());
    const newMessage: Message = {
      id: `m${Date.now()}`,
      senderId: 'me',
      text: inputText.trim(),
      time: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const otherUserName = conversation?.otherUserName ?? 'Seller';
  const listingTitle = conversation?.listingTitle ?? '';
  const listingImage = conversation?.listingImage;
  const otherUserAvatar = conversation?.otherUserAvatar;

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

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isMe = msg.senderId === 'me';
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
    </KeyboardAvoidingView>
  );
}
