import { supabase } from '@/integrations/supabase/client';

export type VerificationStatus = 'unverified' | 'phone_verified' | 'id_verified' | 'fully_verified';

export type UserReputationMetrics = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  seller_rating: number;
  seller_rating_count: number;
  buyer_rating: number;
  buyer_rating_count: number;
  overall_rating: number;
  completed_sales: number;
  completed_purchases: number;
  cancelled_orders_count: number;
  cancellation_rate: number;
  response_rate: number;
  verification_status: VerificationStatus;
  seller_trust_score: number;
};

export type ReviewItem = {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  review_type: 'SELLER_REVIEW' | 'BUYER_REVIEW';
  created_at: string;
  reviewer?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
};

/**
 * Fetch full two-sided reputation metrics for a profile.
 */
export async function fetchUserReputation(userId: string): Promise<UserReputationMetrics> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      display_name,
      avatar_url,
      seller_rating,
      seller_rating_count,
      buyer_rating,
      buyer_rating_count,
      overall_rating,
      completed_sales,
      completed_purchases,
      cancelled_orders_count,
      cancellation_rate,
      response_rate,
      verification_status,
      seller_trust_score
    `)
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('[ReputationService] fetchUserReputation error:', error);
    throw error ?? new Error('User profile reputation not found');
  }

  return {
    id: data.id,
    display_name: data.display_name ?? 'User',
    avatar_url: data.avatar_url,
    seller_rating: Number(data.seller_rating ?? 0),
    seller_rating_count: Number(data.seller_rating_count ?? 0),
    buyer_rating: Number(data.buyer_rating ?? 0),
    buyer_rating_count: Number(data.buyer_rating_count ?? 0),
    overall_rating: Number(data.overall_rating ?? 0),
    completed_sales: Number(data.completed_sales ?? 0),
    completed_purchases: Number(data.completed_purchases ?? 0),
    cancelled_orders_count: Number(data.cancelled_orders_count ?? 0),
    cancellation_rate: Number(data.cancellation_rate ?? 0),
    response_rate: Number(data.response_rate ?? 100),
    verification_status: (data.verification_status ?? 'unverified') as VerificationStatus,
    seller_trust_score: Number(data.seller_trust_score ?? 50),
  };
}

/**
 * Submit a review for a COMPLETED order via the transactional RPC.
 */
export async function submitTransactionReview(
  orderId: string,
  rating: number,
  comment?: string
): Promise<{ success: boolean; review_id: string; reviewee_id: string; review_type: string }> {
  console.log('[ReputationService] submitTransactionReview:', { orderId, rating, comment });

  const { data, error } = await supabase.rpc('submit_transaction_review', {
    p_order_id: orderId,
    p_rating: rating,
    p_comment: comment ?? null,
  });

  if (error) {
    console.error('[ReputationService] submitTransactionReview RPC error:', error);
    throw new Error(error.message || 'Failed to submit review');
  }

  return data as any;
}

/**
 * Fetch reviews received by a user.
 */
export async function fetchUserReviews(
  userId: string,
  type: 'SELLER_REVIEW' | 'BUYER_REVIEW' | 'all' = 'all'
): Promise<ReviewItem[]> {
  let query = supabase
    .from('reviews')
    .select(`
      *,
      reviewer:profiles!reviews_reviewer_id_fkey(id, display_name, avatar_url)
    `)
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false });

  if (type !== 'all') {
    query = query.eq('review_type', type);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[ReputationService] fetchUserReviews error:', error);
    throw error;
  }

  return (data ?? []) as unknown as ReviewItem[];
}
