import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Image, Animated, ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle, ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { MOCK_CONVERSATIONS, getRelativeTime } from '@/utils/mockData';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function resolveImageSource(source: string | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  return { uri: source };
}

function ConversationRow({
  conversation,
  index,
}: {
  conversation: (typeof MOCK_CONVERSATIONS)[0];
  index: number;
}) {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, index]);

  const timeDisplay = getRelativeTime(conversation.lastMessageTime);

  const handlePress = () => {
    console.log('[Inbox] Conversation pressed:', conversation.id, conversation.otherUserName);
    router.push(`/chat/${conversation.id}`);
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable onPress={handlePress}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.surface,
            borderRadius: 14,
            padding: 14,
            gap: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Avatar */}
          <View style={{ position: 'relative' }}>
            <Image
              source={resolveImageSource(conversation.otherUserAvatar)}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: COLORS.surfaceSecondary,
              }}
            />
            {conversation.unread && (
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

          {/* Listing thumbnail */}
          <Image
            source={resolveImageSource(conversation.listingImage)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              backgroundColor: COLORS.surfaceSecondary,
            }}
          />

          {/* Content */}
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                }}
              >
                {conversation.otherUserName}
              </Text>
              <Text
                style={{
                  fontSize: 12,
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
              {conversation.listingTitle}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontFamily: 'Nunito_400Regular',
                color: conversation.unread ? COLORS.text : COLORS.textSecondary,
                fontWeight: conversation.unread ? '600' : '400',
              }}
            >
              {conversation.lastMessage}
            </Text>
          </View>

          <ChevronRight size={16} color={COLORS.textTertiary} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const unreadCount = MOCK_CONVERSATIONS.filter((c) => c.unread).length;
  const unreadText = unreadCount > 0 ? `${unreadCount} unread` : '';

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
            paddingBottom: 20,
          }}
        >
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
          {unreadText !== '' && (
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.textSecondary,
                marginTop: 4,
              }}
            >
              {unreadText}
            </Text>
          )}
        </View>

        {MOCK_CONVERSATIONS.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              paddingTop: 80,
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
                marginBottom: 8,
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
              No messages yet
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
              Start by messaging a seller about a listing you like
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {MOCK_CONVERSATIONS.map((conv, index) => (
              <ConversationRow key={conv.id} conversation={conv} index={index} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
