import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
  ShoppingBag,
  Truck,
  PackageCheck,
  XCircle,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchNotifications,
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification, 
  clearAllNotifications,
  subscribeToNotifications,
  NotificationItem
} from '@/services/notifications';

type FilterTab = 'all' | 'unread' | 'orders' | 'messages' | 'system';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const notifications = useAppStore(state => state.notifications);
  const setNotificationsStore = useAppStore(state => state.setNotifications);
  const addNotificationStore = useAppStore(state => state.addNotification);
  const markNotificationReadStore = useAppStore(state => state.markNotificationRead);
  const markAllNotificationsReadStore = useAppStore(state => state.markAllNotificationsRead);
  const deleteNotificationStore = useAppStore(state => state.deleteNotification);
  const clearAllNotificationsStore = useAppStore(state => state.clearAllNotifications);
  
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Initial fetch and Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications(user.id)
      .then((data) => setNotificationsStore(data))
      .catch((err) => console.error('Failed to fetch initial notifications:', err));

    const unsubscribe = subscribeToNotifications(user.id, (newNotification) => {
      addNotificationStore(newNotification);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsAsRead(user.id);
      markAllNotificationsReadStore();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await markNotificationAsRead(item.id);
        markNotificationReadStore(item.id);
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }

    // Execute Deep Link Routing
    if (item.deepLink) {
      router.push(item.deepLink as any);
      return;
    }

    // Fallback deep links based on entity structure
    if (item.entityType === 'ORDER' || item.type?.startsWith('ORDER_') || item.type?.startsWith('PAYMENT_')) {
      const orderId = item.entityId || item.related_entity_id;
      if (orderId) router.push(`/orders/${orderId}` as any);
    } else if (item.entityType === 'CHAT' || item.type === 'NEW_MESSAGE') {
      const convId = item.entityId || item.related_entity_id;
      if (convId) router.push(`/chat/${convId}` as any);
    } else if (item.entityType === 'LISTING' || item.type?.startsWith('PRODUCT_')) {
      const listingId = item.entityId || item.related_entity_id;
      if (listingId) router.push(`/listing/${listingId}` as any);
    } else if (item.type === 'NEW_RATING' || item.entityType === 'PROFILE') {
      const userId = item.entityId || item.related_entity_id;
      if (userId) router.push(`/seller/${userId}` as any);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteNotification(id);
      deleteNotificationStore(id);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    try {
      await clearAllNotifications(user.id);
      clearAllNotificationsStore();
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    const eventType = n.eventType || n.type || '';
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'orders') {
      return (
        eventType.startsWith('ORDER_') ||
        eventType.startsWith('PAYMENT_') ||
        n.entityType === 'ORDER' ||
        n.type === 'offer'
      );
    }
    if (activeTab === 'messages') {
      return eventType === 'NEW_MESSAGE' || n.type === 'message' || n.entityType === 'CHAT';
    }
    if (activeTab === 'system') {
      return (
        eventType === 'NEW_RATING' ||
        eventType.startsWith('PRODUCT_') ||
        eventType.startsWith('BUYER_REQUEST') ||
        n.type === 'system'
      );
    }
    return true;
  });

  const getIcon = (item: NotificationItem) => {
    const type = item.eventType || item.type || '';
    if (type.includes('ORDER') || type.includes('PAYMENT')) {
      if (type.includes('CANCELLED') || type.includes('REJECTED')) return <XCircle size={20} color="#EF4444" />;
      if (type.includes('DELIVERED') || type.includes('COMPLETED')) return <PackageCheck size={20} color={COLORS.accent} />;
      if (type.includes('SHIPPED') || type.includes('READY')) return <Truck size={20} color="#2563EB" />;
      return <ShoppingBag size={20} color={COLORS.primary} />;
    }
    if (type === 'NEW_MESSAGE' || type === 'message') return <MessageSquare size={20} color="#2563EB" />;
    if (type === 'NEW_RATING' || type === 'review') return <Star size={20} color="#EAB308" />;
    if (type.includes('PRODUCT') || type.includes('BUYER_REQUEST') || type.includes('MATCH')) return <Tag size={20} color="#D97706" />;
    
    return <Sparkles size={20} color={COLORS.primary} />;
  };

  const getIconBg = (item: NotificationItem) => {
    const type = item.eventType || item.type || '';
    if (type.includes('CANCELLED') || type.includes('REJECTED')) return 'rgba(239, 68, 68, 0.12)';
    if (type.includes('DELIVERED') || type.includes('COMPLETED')) return 'rgba(45, 155, 111, 0.12)';
    if (type === 'NEW_MESSAGE' || type === 'message') return 'rgba(37, 99, 235, 0.12)';
    if (type === 'NEW_RATING' || type === 'review') return 'rgba(234, 179, 8, 0.15)';
    if (type.includes('PRODUCT') || type.includes('BUYER_REQUEST')) return 'rgba(217, 119, 6, 0.12)';
    return COLORS.primaryMuted;
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
          {(['all', 'unread', 'orders', 'messages', 'system'] as FilterTab[]).map((tab) => {
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
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.85}
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
                    backgroundColor: getIconBg(item),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getIcon(item)}
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
                    {item.created_at && (
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'Nunito_400Regular',
                          color: COLORS.textTertiary,
                        }}
                      >
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
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
                        marginBottom: 8,
                      }}
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => handleDeleteItem(item.id)}
                    style={{ padding: 4 }}
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
              We'll notify you when you get updates on orders, messages, ratings, or matches.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
