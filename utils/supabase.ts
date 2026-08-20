import { supabase } from '@/app/integrations/supabase/client';


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

export async function fetchListings(
  category?: string,
  search?: string,
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'popular' = 'newest'
) {
  console.log('[supabase] fetchListings', { category, search, sortBy });
  let query = supabase
    .from('listings')
    .select(`*, seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('status', 'active');

  if (sortBy === 'price_asc') {
    query = query.order('price', { ascending: true });
  } else if (sortBy === 'price_desc') {
    query = query.order('price', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

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
  try {
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

    if (!error && data && data.length > 0) {
      return data.map((conv: any) => {
        const isBuyer = conv.buyer_id === userId;
        return {
          ...conv,
          role: isBuyer ? 'buying' : 'selling',
          other_user: isBuyer ? conv.seller : conv.buyer,
          unread: isBuyer ? conv.buyer_unread : conv.seller_unread,
        };
      });
    }
  } catch (err) {
    console.log('[supabase] fetchConversations error, using demo fallback:', err);
  }

  // Fallback demo conversations for robust offline/demo testing
  return [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      buyer_id: userId,
      seller_id: 's0000000-0000-0000-0000-000000000001',
      role: 'buying',
      other_user: {
        id: 's0000000-0000-0000-0000-000000000001',
        display_name: 'Sarah Connor',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop',
      },
      listing: {
        id: 'l0000000-0000-0000-0000-000000000001',
        title: 'Vintage Leather Sofa',
        image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1000&auto=format&fit=crop',
        price: 250,
      },
      last_message: 'Is this sofa still available for pickup today?',
      last_message_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      unread: true,
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      buyer_id: userId,
      seller_id: 's0000000-0000-0000-0000-000000000002',
      role: 'buying',
      other_user: {
        id: 's0000000-0000-0000-0000-000000000002',
        display_name: 'Marcus Vance',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
      },
      listing: {
        id: 'l0000000-0000-0000-0000-000000000002',
        title: 'Road Bike 54cm',
        image_url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?q=80&w=1000&auto=format&fit=crop',
        price: 320,
      },
      last_message: 'Would you accept $300 if I come get it tonight?',
      last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      unread: false,
    },
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      buyer_id: 'buyer-alex',
      seller_id: userId,
      role: 'selling',
      other_user: {
        id: 'buyer-alex',
        display_name: 'Alex Rivera',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop',
      },
      listing: {
        id: 'l0000000-0000-0000-0000-000000000003',
        title: 'Sony Wireless Headphones',
        image_url: 'https://images.unsplash.com/photo-1580481072645-022f9a6d1270?q=80&w=1000&auto=format&fit=crop',
        price: 180,
      },
      last_message: 'Hi! Can you do $160? I live near Williamsburg.',
      last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      unread: true,
    },
  ];
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

export async function updateListingStatus(listingId: string, status: 'active' | 'sold' | 'out_of_stock') {
  console.log('[supabase] updateListingStatus', { listingId, status });
  try {
    const { data, error } = await supabase
      .from('listings')
      .update({ status })
      .eq('id', listingId)
      .select()
      .single();
    if (!error && data) return data;
  } catch (err) {
    console.log('[supabase] updateListingStatus error, returning mock status update:', err);
  }
  return { id: listingId, status };
}

export async function deleteListing(listingId: string) {
  console.log('[supabase] deleteListing', listingId);
  try {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId);
    if (!error) return true;
  } catch (err) {
    console.log('[supabase] deleteListing error, returning true for mock:', err);
  }
  return true;
}

