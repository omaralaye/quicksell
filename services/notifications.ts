import { supabase } from '@/integrations/supabase/client';
import { sendPushNotification } from './pushProvider';

export interface NotificationItem {
  id: string;
  type: string;
  eventType: string;
  title: string;
  body: string;
  read: boolean;
  entityType?: string;
  entityId?: string;
  related_entity_id?: string;
  deepLink?: string;
  idempotencyKey?: string;
  payload?: Record<string, any>;
  created_at: string;
  time: string;
}

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  const { data, error } = await (supabase as any)
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((n: any) => ({
    id: n.id,
    type: n.type || n.event_type || 'system',
    eventType: n.event_type || n.type || 'SYSTEM',
    title: n.title,
    body: n.body,
    read: Boolean(n.read),
    entityType: n.entity_type,
    entityId: n.entity_id,
    related_entity_id: n.related_entity_id || n.entity_id,
    deepLink: n.deep_link || (n.related_entity_id ? `/orders/${n.related_entity_id}` : undefined),
    idempotencyKey: n.idempotency_key,
    payload: n.payload || {},
    created_at: n.created_at,
    time: n.created_at,
  }));
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await (supabase as any)
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
  return count || 0;
}

export async function markNotificationAsRead(id: string) {
  const { error } = await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { error } = await (supabase as any)
    .from('notifications')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function clearAllNotifications(userId: string) {
  const { error } = await (supabase as any)
    .from('notifications')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Dispatch an event-driven notification through the database RPC (with idempotency handling)
 * and trigger push notification dispatch.
 */
export async function publishEventNotification(params: {
  userId: string;
  eventType: string;
  title: string;
  body: string;
  entityType?: 'ORDER' | 'LISTING' | 'BUYER_REQUEST' | 'CHAT' | 'PROFILE';
  entityId?: string;
  deepLink?: string;
  idempotencyKey?: string;
  payload?: Record<string, any>;
}): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('publish_notification_event', {
    p_user_id: params.userId,
    p_event_type: params.eventType,
    p_title: params.title,
    p_body: params.body,
    p_entity_type: params.entityType || null,
    p_entity_id: params.entityId || null,
    p_deep_link: params.deepLink || null,
    p_idempotency_key: params.idempotencyKey || null,
    p_payload: params.payload || {},
  });

  if (error) {
    console.error('Failed to publish notification event:', error);
    throw error;
  }

  // Trigger decoupled push notification provider async
  sendPushNotification({
    userId: params.userId,
    eventType: params.eventType,
    title: params.title,
    body: params.body,
    deepLink: params.deepLink,
    data: params.payload,
  }).catch((err) => console.error('Push notification dispatch error:', err));

  return data;
}

/**
 * Realtime subscription to notification table changes for the current user.
 */
export function subscribeToNotifications(
  userId: string,
  onNewNotification: (notification: NotificationItem) => void
) {
  const channel = supabase
    .channel(`public:notifications:user_id=eq.${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const n = payload.new as any;
        const item: NotificationItem = {
          id: n.id,
          type: n.type || n.event_type || 'system',
          eventType: n.event_type || n.type || 'SYSTEM',
          title: n.title,
          body: n.body,
          read: Boolean(n.read),
          entityType: n.entity_type,
          entityId: n.entity_id,
          related_entity_id: n.related_entity_id || n.entity_id,
          deepLink: n.deep_link,
          idempotencyKey: n.idempotency_key,
          payload: n.payload || {},
          created_at: n.created_at,
          time: n.created_at,
        };
        onNewNotification(item);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
