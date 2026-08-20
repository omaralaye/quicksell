import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  Tag,
  DollarSign,
  Star,
  CheckCircle2,
  Trash2,
  CheckCheck,
  Sparkles,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';

type NotificationType = 'offer' | 'message' | 'price_drop' | 'review' | 'sold' | 'system';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  targetId?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    type: 'price_drop',
    title: 'Price Drop Alert!',
    body: 'Vintage Leather Jacket dropped in price from $60 to $45.',
    time: '10m ago',
    read: false,
  },
  {
    id: 'n2',
    type: 'offer',
    title: 'New Offer Received',
    body: 'Sarah offered $120 for your Wooden Coffee Table.',
    time: '1h ago',
    read: false,
  },
  {
    id: 'n3',
    type: 'message',
    title: 'New Message',
    body: 'Alex: "Is the Mechanical Keyboard still available for pickup?"',
    time: '3h ago',
    read: false,
  },
  {
    id: 'n4',
    type: 'review',
    title: 'New 5-Star Review',
    body: 'Marcus left a review: "Awesome seller, super fast communication!"',
    time: '1d ago',
    read: true,
  },
  {
    id: 'n5',
    type: 'sold',
    title: 'Item Marked as Sold',
    body: 'Your Sony WH-1000XM4 Headphones listing has been completed.',
    time: '2d ago',
    read: true,
  },
  {
    id: 'n6',
    type: 'system',
    title: 'Welcome to NearSwap',
    body: 'Start exploring great deals and selling items nearby in Brooklyn, NY.',
    time: '3d ago',
    read: true,
  },
];

type FilterTab = 'all' | 'unread' | 'offers' | 'system';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleToggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleDeleteItem = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'offers') return n.type === 'offer' || n.type === 'price_drop';
    if (activeTab === 'system') return n.type === 'system' || n.type === 'sold' || n.type === 'review';
    return true;
  });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'offer':
        return <DollarSign size={20} color={COLORS.primary} />;
      case 'price_drop':
        return <Tag size={20} color="#D97706" />;
      case 'message':
        return <MessageSquare size={20} color="#2563EB" />;
      case 'review':
        return <Star size={20} color="#EAB308" />;
      case 'sold':
        return <CheckCircle2 size={20} color={COLORS.accent} />;
      case 'system':
      default:
        return <Sparkles size={20} color={COLORS.primary} />;
    }
  };

  const getIconBg = (type: NotificationType) => {
    switch (type) {
      case 'offer':
        return COLORS.primaryMuted;
      case 'price_drop':
        return 'rgba(217, 119, 6, 0.12)';
      case 'message':
        return 'rgba(37, 99, 235, 0.12)';
      case 'review':
        return 'rgba(234, 179, 8, 0.15)';
      case 'sold':
        return 'rgba(45, 155, 111, 0.12)';
      case 'system':
      default:
        return COLORS.primaryMuted;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Top Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 16,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={COLORS.text} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Nunito_800ExtraBold',
                color: COLORS.text,
              }}
            >
              Notifications
            </Text>
            {unreadCount > 0 && (
              <View
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Nunito_700Bold',
                    color: '#FFFFFF',
                  }}
                >
                  {unreadCount}
                </Text>
              </View>
            )}
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              activeOpacity={0.7}
            >
              <CheckCheck size={16} color={COLORS.primary} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.primary,
                }}
              >
                Read all
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleClearAll}
              disabled={notifications.length === 0}
              style={{ opacity: notifications.length === 0 ? 0.4 : 1 }}
              activeOpacity={0.7}
            >
              <Trash2 size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: 16 }}
        >
          {(['all', 'unread', 'offers', 'system'] as FilterTab[]).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab.charAt(0).toUpperCase() + tab.slice(1);
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isActive ? COLORS.primary : COLORS.surfaceSecondary,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: isActive ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                    color: isActive ? '#FFFFFF' : COLORS.textSecondary,
                  }}
                >
                  {label}
                  {tab === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {filteredNotifications.length > 0 ? (
          <View style={{ gap: 12 }}>
            {filteredNotifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleToggleRead(item.id)}
                activeOpacity={0.9}
                style={{
                  backgroundColor: item.read ? COLORS.surface : 'rgba(232, 93, 38, 0.04)',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: item.read ? COLORS.border : 'rgba(232, 93, 38, 0.25)',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 14,
                }}
              >
                {/* Icon badge */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: getIconBg(item.type),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getIcon(item.type)}
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: item.read ? 'Nunito_700Bold' : 'Nunito_800ExtraBold',
                        color: COLORS.text,
                        flex: 1,
                        marginRight: 8,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Nunito_400Regular',
                        color: COLORS.textTertiary,
                      }}
                    >
                      {item.time}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Nunito_400Regular',
                      color: COLORS.textSecondary,
                      lineHeight: 20,
                    }}
                  >
                    {item.body}
                  </Text>
                </View>

                {/* Delete / Read indicator dot */}
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  {!item.read && (
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: COLORS.primary,
                        marginTop: 4,
                      }}
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => handleDeleteItem(item.id)}
                    style={{ padding: 4, marginTop: item.read ? 0 : 8 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={15} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 80,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: COLORS.surfaceSecondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={32} color={COLORS.textTertiary} />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Nunito_800ExtraBold',
                color: COLORS.text,
              }}
            >
              No notifications yet
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
              We'll notify you when you get updates on offers, messages, or price drops.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
