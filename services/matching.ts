import { supabase } from '@/integrations/supabase/client';
import { withRetry } from './resilience';

export interface BuyerRequest {
  id: string;
  buyer_id: string;
  title: string;
  description: string | null;
  budget: number | null;
  status: 'active' | 'fulfilled' | 'cancelled';
  created_at: string;
}

export interface MatchedSeller {
  seller_id: string;
  display_name: string;
  avatar_url: string | null;
  rating: number;
  completed_sales: number;
  distance_km: number;
  match_score: number;
  is_verified: boolean;
}

/**
 * Creates a new Buyer Request with location coordinates and budget.
 */
export async function createBuyerRequest({
  buyerId,
  title,
  description,
  budget,
  latitude,
  longitude,
}: {
  buyerId: string;
  title: string;
  description?: string;
  budget?: number;
  latitude?: number;
  longitude?: number;
}): Promise<BuyerRequest> {
  return withRetry(async () => {
    let pointWkt: string | null = null;
    if (latitude !== undefined && longitude !== undefined) {
      pointWkt = `POINT(${longitude} ${latitude})`;
    }

    const { data, error } = await supabase
      .from('buyer_requests')
      .insert({
        buyer_id: buyerId,
        title,
        description: description ?? null,
        budget: budget ?? null,
        location: pointWkt,
        status: 'active',
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[MatchingService] createBuyerRequest error:', error);
      throw error ?? new Error('Could not create buyer request');
    }

    return (data as unknown) as BuyerRequest;
  });
}

/**
 * Invokes the QuickSell Matching Engine RPC to find eligible sellers for a buyer request.
 */
export async function findMatchedSellers(
  requestId: string,
  maxDistanceKm = 50.0
): Promise<MatchedSeller[]> {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('find_eligible_sellers_for_buyer_request', {
      p_request_id: requestId,
      p_max_distance_km: maxDistanceKm,
    });

    if (error) {
      console.error('[MatchingService] findMatchedSellers RPC error:', error);
      throw error;
    }

    return ((data ?? []) as unknown) as MatchedSeller[];
  });
}

/**
 * Fetches existing buyer requests for a user.
 */
export async function fetchUserBuyerRequests(buyerId: string): Promise<BuyerRequest[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('buyer_requests')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MatchingService] fetchUserBuyerRequests error:', error);
      throw error;
    }

    return ((data ?? []) as unknown) as BuyerRequest[];
  });
}
