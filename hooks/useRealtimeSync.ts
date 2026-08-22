import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/store/useAppStore';
import { fetchNotifications } from '@/services/notifications';

export function useRealtimeSync() {
  const { user } = useAuth();
  const setIsConnected = useAppStore((state) => state.setIsConnected);
  const addNotification = useAppStore((state) => state.addNotification);
  const incrementUnreadMessageCount = useAppStore((state) => state.incrementUnreadMessageCount);

  useEffect(() => {
    if (!user) return;

    console.log('[RealtimeSync] Initializing subscriptions for user:', user.id);

    // Initial fetch for notifications
    fetchNotifications(user.id).then((initialNotifications) => {
      useAppStore.getState().setNotifications(initialNotifications);
    }).catch((err) => console.error('[RealtimeSync] Error fetching notifications:', err));

    // 1. Subscribe to Notifications
    const notificationsChannel = supabase
      .channel(`notifications_${user.id}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[RealtimeSync] New notification received:', payload.new);
          addNotification(payload.new as any);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeSync] Subscribed to notifications');
          setIsConnected(true);
        }
      });

    // 2. Subscribe to new Messages (for global unread count / push)
    const messagesChannel = supabase
      .channel(`messages_global_${user.id}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Because RLS is active, this only fires for messages in conversations the user is part of.
          // We only care if the sender is NOT the current user.
          if (payload.new.sender_id !== user.id) {
            console.log('[RealtimeSync] New message received:', payload.new);
            incrementUnreadMessageCount();
          }
        }
      )
      .subscribe();

    // 3. Subscribe to Presence
    const presenceChannel = supabase.channel(`online_users_${user.id}_${Date.now()}`);
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const onlineMap: Record<string, boolean> = {};
        for (const key in newState) {
          newState[key].forEach((presence: any) => {
            if (presence.user_id) onlineMap[presence.user_id] = true;
          });
        }
        useAppStore.getState().setOnlineUsers(onlineMap);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence: any) => {
          if (presence.user_id) useAppStore.getState().updateOnlineUser(presence.user_id, true);
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: any) => {
          if (presence.user_id) useAppStore.getState().updateOnlineUser(presence.user_id, false);
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id });
        }
      });

    return () => {
      console.log('[RealtimeSync] Tearing down subscriptions');
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
      setIsConnected(false);
    };
  }, [user, addNotification, incrementUnreadMessageCount, setIsConnected]);
}
