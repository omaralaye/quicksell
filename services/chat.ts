import { supabase } from '@/integrations/supabase/client';
import type { ConversationWithDetails, MessageRow } from '@/services/types';

export async function fetchConversations(userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      listing:listings!conversations_listing_id_fkey(id, title, image_url, price),
      buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url),
      seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url)
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  
  if (data && data.length > 0) {
    return data.map((conv: any) => {
      const isBuyer = conv.buyer_id === userId;
      return {
        ...conv,
        role: isBuyer ? 'buying' : 'selling',
        other_user: isBuyer ? conv.seller : conv.buyer,
        unread: isBuyer ? conv.buyer_unread : conv.seller_unread,
      };
    }) as ConversationWithDetails[];
  }
  return [];
}

export async function fetchConversationById(conversationId: string, userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      listing:listings!conversations_listing_id_fkey(id, title, image_url, price),
      buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url),
      seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url)
    `)
    .eq('id', conversationId)
    .single();

  if (error) throw error;
  if (!data) return null;

  const conv = data as any;
  const isBuyer = conv.buyer_id === userId;
  return {
    ...conv,
    role: isBuyer ? 'buying' : 'selling',
    other_user: isBuyer ? conv.seller : conv.buyer,
    unread: isBuyer ? conv.buyer_unread : conv.seller_unread,
  } as ConversationWithDetails;
}

export async function fetchMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as MessageRow[];
}

export async function markConversationAsRead(conversationId: string, userId: string) {
  if (!conversationId || !userId) return;
  
  const { error } = await supabase.rpc('mark_conversation_as_read', {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });

  if (error) {
    // Fallback direct update if RPC fails
    const { data: conv } = await supabase
      .from('conversations')
      .select('buyer_id, seller_id')
      .eq('id', conversationId)
      .single();
    if (conv) {
      const isBuyer = conv.buyer_id === userId;
      await supabase
        .from('conversations')
        .update(isBuyer ? { buyer_unread: false } : { seller_unread: false })
        .eq('id', conversationId);
    }
  }
}

export async function getOrCreateConversation(
  buyerId: string,
  sellerId: string,
  listingId?: string | null,
  orderId?: string | null,
  buyerRequestId?: string | null
) {
  if (buyerId === sellerId) {
    throw new Error('You cannot message yourself');
  }

  let query: any = supabase
    .from('conversations')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId);

  if (listingId) {
    query = query.eq('listing_id', listingId);
  } else if (orderId) {
    query = query.eq('order_id', orderId);
  } else if (buyerRequestId) {
    query = query.eq('buyer_request_id', buyerRequestId);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    return (existing as any).id;
  }

  const { data: created, error: createErr } = await (supabase as any)
    .from('conversations')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId || null,
      order_id: orderId || null,
      buyer_request_id: buyerRequestId || null,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (createErr) throw createErr;
  return created.id;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  imageUrl?: string | null,
  orderId?: string | null
) {
  const { data, error } = await (supabase as any)
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      text: text.trim() || (imageUrl ? 'Attachment' : ''),
      image_url: imageUrl || null,
      order_id: orderId || null,
    })
    .select()
    .single();
  if (error) throw error;

  // Determine participant roles for unread flag setting
  const { data: conv } = await supabase
    .from('conversations')
    .select('buyer_id, seller_id')
    .eq('id', conversationId)
    .single();

  const previewText = text.trim() || (imageUrl ? '📷 Image attachment' : 'Message');
  const updatePayload: Record<string, any> = {
    last_message: previewText,
    last_message_at: new Date().toISOString(),
  };

  if (conv) {
    if (senderId === conv.buyer_id) {
      updatePayload.seller_unread = true;
    } else if (senderId === conv.seller_id) {
      updatePayload.buyer_unread = true;
    }
  }

  await (supabase as any)
    .from('conversations')
    .update(updatePayload)
    .eq('id', conversationId);

  return data as MessageRow;
}
