import { supabase } from '@/integrations/supabase/client';
import type { ListingWithSeller } from '@/services/types';

// Cache for mapping category names to IDs and vice-versa
let categoriesMap: Record<string, string> | null = null;
let categoryIdToNameMap: Record<string, string> | null = null;

async function ensureCategories() {
  if (categoriesMap) return;
  const { data } = await supabase.from('categories').select('id, name');
  categoriesMap = {};
  categoryIdToNameMap = {};
  if (data) {
    data.forEach((c) => {
      categoriesMap![c.name] = c.id;
      categoryIdToNameMap![c.id] = c.name;
    });
  }
}

export async function fetchListings(
  category?: string,
  search?: string,
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'popular' = 'newest'
) {
  await ensureCategories();

  let query = supabase
    .from('listings')
    .select(`*, categories(name), seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('status', 'ACTIVE');

  if (sortBy === 'price_asc') {
    query = query.order('price', { ascending: true });
  } else if (sortBy === 'price_desc') {
    query = query.order('price', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (category && category !== 'All') {
    const categoryId = categoriesMap![category];
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
  }
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return (data as any[]).map((item) => ({
    ...item,
    category: item.categories?.name ?? 'Unknown',
  })) as ListingWithSeller[];
}

export async function fetchNearbyListings(
  userLon: number,
  userLat: number,
  radiusMeters: number = 50000,
  category?: string,
  search?: string
) {
  await ensureCategories();
  const categoryId = category && category !== 'All' ? categoriesMap![category] : null;

  // @ts-ignore: get_nearby_listings not yet in generated types
  const { data, error } = await supabase.rpc('get_nearby_listings', {
    user_lon: userLon,
    user_lat: userLat,
    radius_meters: radiusMeters,
    category_filter: categoryId,
    search_query: search || null,
  });

  if (error) throw error;
  
  return ((data as any[]) || []).map((row: any) => ({
    id: row.id,
    seller_id: row.seller_id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category_id ? categoryIdToNameMap![row.category_id] : 'Unknown',
    condition: row.condition,
    image_url: row.image_url,
    region: row.region,
    location: row.location,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    distance_meters: row.distance_meters,
    ranking_score: row.ranking_score,
    seller: {
      id: row.seller_id,
      display_name: row.seller_display_name,
      avatar_url: row.seller_avatar_url,
      rating: row.seller_rating,
      total_sales: row.seller_total_sales,
      response_rate: row.seller_response_rate,
    }
  }));
}

export async function fetchListing(id: string) {
  await ensureCategories();
  const { data, error } = await supabase
    .from('listings')
    .select(`*, categories(name), seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('id', id)
    .single();
  if (error) throw error;
  
  return {
    ...data,
    category: data.categories?.name ?? 'Unknown',
  } as ListingWithSeller;
}

export async function fetchSellerListings(sellerId: string) {
  await ensureCategories();
  const { data, error } = await supabase
    .from('listings')
    .select(`*, categories(name), seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('seller_id', sellerId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map((item) => ({
    ...item,
    category: item.categories?.name ?? 'Unknown',
  })) as ListingWithSeller[];
}

export async function fetchMyListings(userId: string) {
  await ensureCategories();
  const { data, error } = await supabase
    .from('listings')
    .select(`*, categories(name), seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, region, rating, total_listings, total_sales, response_rate)`)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map((item) => ({
    ...item,
    category: item.categories?.name ?? 'Unknown',
  })) as ListingWithSeller[];
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
  await ensureCategories();
  const categoryId = categoriesMap![params.category] || null;

  // Ensure the seller's profile exists to satisfy the listings_seller_id_fkey constraint
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: params.sellerId }, { onConflict: 'id', ignoreDuplicates: true });

  if (profileError) {
    console.warn('[supabase] Failed to ensure profile exists:', profileError);
  }

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: params.sellerId,
      title: params.title,
      description: params.description,
      price: params.price,
      category_id: categoryId,
      condition: params.condition,
      region: params.region,
      image_url: params.imageUrl ?? null,
      status: 'ACTIVE',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateListingStatus(listingId: string, status: 'ACTIVE' | 'SOLD' | 'ARCHIVED') {
  try {
    const { data, error } = await supabase
      .from('listings')
      .update({ status })
      .eq('id', listingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[supabase] updateListingStatus error:', err);
    return { id: listingId, status };
  }
}

export async function deleteListing(listingId: string) {
  try {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[supabase] deleteListing error:', err);
    return true;
  }
}
