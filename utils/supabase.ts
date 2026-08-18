import { supabase } from '@/app/integrations/supabase/client';

// The "current user" for demo purposes (no auth yet) — Maria K.
export const DEMO_USER_ID = 'a0000000-0000-0000-0000-000000000001';

export type ListingWithSeller = {
  id: string;
  title: string;
  price: number;
  category: string;
  condition: string;
  description: string | null;
  image_url: string | null;
  region: string;
  status: string | null;
  created_at: string | null;
  seller_id: string | null;
  seller: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    region: string | null;
    rating: number | null;
    total_listings: number | null;
    total_sales: number | null;
    response_rate: number | null;
  } | null;
};

export type ConversationWithDetails = {
  id: string;
  listing_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  buyer_unread: boolean | null;
  seller_unread: boolean | null;
  listing: {
    id: string;
    title: string;
    image_url: string | null;
    price: number;
  } | null;
  other_user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string | null;
  sender_id: string | null;
  text: string;
  created_at: string | null;
};

export async function fetchListings(category?: string, search?: string) {
  console.log('[supabase] fetchListings', { category, search });
  let query = supabase
    .from('listings')
    .select(`*, seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (category && category !== 'All') {
    query = query.eq('category', category);
  }
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ListingWithSeller[];
}

export async function fetchListing(id: string) {
  console.log('[supabase] fetchListing', id);
  const { data, error } = await supabase
    .from('listings')
    .select(`*, seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as ListingWithSeller;
}

export async function fetchSellerProfile(sellerId: string) {
  console.log('[supabase] fetchSellerProfile', sellerId);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', sellerId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSellerListings(sellerId: string) {
  console.log('[supabase] fetchSellerListings', sellerId);
  const { data, error } = await supabase
    .from('listings')
    .select(`*, seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ListingWithSeller[];
}

export async function fetchMyListings(userId: string) {
  console.log('[supabase] fetchMyListings', userId);
  const { data, error } = await supabase
    .from('listings')
    .select(`*, seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ListingWithSeller[];
}

export async function fetchConversations(userId: string) {
  console.log('[supabase] fetchConversations', userId);
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

  // Normalize: attach "other_user" relative to current user
  return (data ?? []).map((conv: any) => {
    const isBuyer = conv.buyer_id === userId;
    return {
      ...conv,
      other_user: isBuyer ? conv.seller : conv.buyer,
      unread: isBuyer ? conv.buyer_unread : conv.seller_unread,
    };
  });
}

export async function fetchMessages(conversationId: string) {
  console.log('[supabase] fetchMessages', conversationId);
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as MessageRow[];
}

export async function sendMessage(conversationId: string, senderId: string, text: string) {
  console.log('[supabase] sendMessage', { conversationId, senderId, text });
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, text })
    .select()
    .single();
  if (error) throw error;

  // Update conversation last_message
  await supabase
    .from('conversations')
    .update({ last_message: text, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as MessageRow;
}

export async function createListing(params: {
  sellerId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  region: string;
  imageUrl?: string;
}) {
  console.log('[supabase] createListing', params);
  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: params.sellerId,
      title: params.title,
      description: params.description,
      price: params.price,
      category: params.category,
      condition: params.condition,
      region: params.region,
      image_url: params.imageUrl ?? null,
      status: 'active',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
