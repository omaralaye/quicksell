import { supabase } from '@/integrations/supabase/client';
import type { OrderStatus, OrderWithDetails, OrderStatusHistoryRow } from './orders.types';

/**
 * Fetch orders for a user as either buyer, seller, or both.
 */
export async function fetchUserOrders(
  userId: string,
  role: 'buyer' | 'seller' | 'all' = 'all'
): Promise<OrderWithDetails[]> {
  let query = supabase
    .from('orders')
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(id, display_name, avatar_url),
      seller:profiles!orders_seller_id_fkey(id, display_name, avatar_url),
      items:order_items(
        *,
        listing:listings(id, title, image_url, price)
      )
    `)
    .order('created_at', { ascending: false });

  if (role === 'buyer') {
    query = query.eq('buyer_id', userId);
  } else if (role === 'seller') {
    query = query.eq('seller_id', userId);
  } else {
    query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[OrdersService] fetchUserOrders error:', error);
    throw error;
  }
  return (data ?? []) as unknown as OrderWithDetails[];
}

/**
 * Fetch full order details including line items, buyer/seller profiles, and status history.
 */
export async function fetchOrderDetails(
  orderId: string,
  userId: string
): Promise<OrderWithDetails> {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(id, display_name, avatar_url),
      seller:profiles!orders_seller_id_fkey(id, display_name, avatar_url),
      items:order_items(
        *,
        listing:listings(id, title, image_url, price)
      )
    `)
    .eq('id', orderId)
    .single();

  if (orderErr || !order) {
    console.error('[OrdersService] fetchOrderDetails error:', orderErr);
    throw orderErr ?? new Error('Order not found');
  }

  // Fetch status history timeline
  const { data: history, error: historyErr } = await supabase
    .from('order_status_history')
    .select(`
      *,
      actor:profiles!order_status_history_actor_id_fkey(id, display_name)
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (historyErr) {
    console.warn('[OrdersService] fetchOrderDetails history warn:', historyErr);
  }

  return {
    ...(order as unknown as OrderWithDetails),
    history: (history ?? []) as unknown as OrderStatusHistoryRow[],
  };
}

/**
 * Transition order status atomically using the transition_order_status PostgreSQL RPC.
 */
export async function transitionOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  actorId: string,
  reason?: string
): Promise<{ success: boolean; previous_status: string; new_status: string }> {
  console.log('[OrdersService] transitionOrderStatus:', { orderId, newStatus, actorId, reason });
  
  const { data, error } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_actor_id: actorId,
    p_reason: reason ?? null,
  });

  if (error) {
    console.error('[OrdersService] transitionOrderStatus RPC error:', error);
    throw new Error(error.message || `Failed to transition order status to ${newStatus}`);
  }

  return data as any;
}
