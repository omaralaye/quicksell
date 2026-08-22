// ============================================================
// QuickSell Quick Match — Service
// Pure functions, no React. Safe to call from hooks or screens.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import { rankListings } from './ranking';
import type { RankedListing, RankedListingsPage } from './ranking.types';
import type {
  BuyerRequest,
  BuyerRequestFormData,
  QuickMatchInput,
  RespondResult,
} from './quickmatch.types';

// ─── Query Parser ────────────────────────────────────────────────────────────
// Lightweight client-side parser. Extracts structured fields from a
// free-form string like "iPhone 13 128GB under 1,500,000 near Kampala".
// This is intentionally simple and rule-based so it can be swapped with
// an AI/NLP parser later without changing the rest of the feature.

const PRICE_PATTERNS = [
  /under\s+([\d,]+)/i,
  /below\s+([\d,]+)/i,
  /max\s+([\d,]+)/i,
  /budget\s+([\d,]+)/i,
  /ugx\s*([\d,]+)/i,
  /usx\s*([\d,]+)/i,
];

const LOCATION_PATTERN = /(?:near|in|around)\s+([A-Za-z\s]+?)(?:\s+under|\s+below|\s+max|$)/i;

const CONDITION_MAP: Record<string, string> = {
  new:      'new',
  'like new': 'like_new',
  'like-new': 'like_new',
  used:     'good',
  good:     'good',
  fair:     'fair',
};

/**
 * Parses a free-form search query into structured Quick Match input.
 * Returns the original rawQuery plus any fields it could extract.
 */
export function parseQuickMatchQuery(raw: string): QuickMatchInput {
  const lower = raw.toLowerCase();

  // --- Price extraction
  let maxPrice: number | undefined;
  for (const pattern of PRICE_PATTERNS) {
    const m = raw.match(pattern);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(num)) { maxPrice = num; break; }
    }
  }

  // --- Location extraction
  let city: string | undefined;
  const locMatch = raw.match(LOCATION_PATTERN);
  if (locMatch) city = locMatch[1].trim();

  // --- Condition extraction
  let conditionPref: QuickMatchInput['conditionPref'];
  for (const [key, val] of Object.entries(CONDITION_MAP)) {
    if (lower.includes(key)) { conditionPref = val as any; break; }
  }

  // --- Keywords: everything except price/location/condition stop words
  const stopWords = new Set([
    'under', 'below', 'max', 'budget', 'ugx', 'near', 'in', 'around',
    'new', 'like', 'used', 'good', 'fair', 'for', 'sale', 'a', 'the',
  ]);
  const keywords = raw
    .replace(LOCATION_PATTERN, '')
    .replace(/ugx\s*[\d,]+/gi, '')
    .replace(/under\s*[\d,]+/gi, '')
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

  // Title: the original query stripped of price/location suffixes
  const title = raw
    .replace(/under\s+[\d,]+/gi, '')
    .replace(/ugx\s*[\d,]+/gi, '')
    .replace(/near\s+[A-Za-z\s]+$/i, '')
    .replace(/in\s+[A-Za-z\s]+$/i, '')
    .trim();

  return {
    rawQuery:      raw,
    title:         title || raw,
    keywords:      keywords.length > 0 ? keywords : undefined,
    maxPrice,
    conditionPref,
    city,
    locationLabel: city,
    maxDistanceKm: 25,
  };
}

// ─── Instant Search ───────────────────────────────────────────────────────────

/**
 * Performs the instant marketplace search for a Quick Match query.
 * Delegates to the existing ranking engine so all scoring is consistent.
 */
export async function quickMatchSearch(
  input: QuickMatchInput,
  userLon: number,
  userLat: number,
): Promise<RankedListingsPage> {
  return rankListings({
    userLon,
    userLat,
    searchQuery:    input.title,
    radiusMeters:   (input.maxDistanceKm ?? 25) * 1000,
    categoryId:     input.categoryId,
    maxPrice:       input.maxPrice,
    minPrice:       input.minPrice,
    conditionFilter: input.conditionPref && input.conditionPref !== 'any'
                      ? input.conditionPref
                      : undefined,
    filterCity:     input.city,
    weightProfile:  'default',
    pageSize:       30,
    pageOffset:     0,
  });
}

// ─── Buyer Request CRUD ───────────────────────────────────────────────────────

/**
 * Creates a buyer request and notifies eligible sellers atomically.
 * Returns the request id and the number of sellers notified.
 */
export async function createBuyerRequest(
  buyerId: string,
  form: BuyerRequestFormData,
  userLon?: number,
  userLat?: number,
): Promise<{ requestId: string; notifiedCount: number }> {
  const expiresAt = new Date(
    Date.now() + form.expiresInDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const locationWKT =
    userLon != null && userLat != null
      ? `POINT(${userLon} ${userLat})`
      : null;

  const { data, error } = await supabase.rpc('create_buyer_request_with_notifications', {
    p_buyer_id:        buyerId,
    p_title:           form.title,
    p_description:     form.description || null,
    p_category_id:     form.categoryId  || null,
    p_keywords:        form.keywords.length > 0 ? form.keywords : null,
    p_min_price:       form.minPrice ? parseFloat(form.minPrice.replace(/,/g, '')) : null,
    p_max_price:       form.maxPrice ? parseFloat(form.maxPrice.replace(/,/g, '')) : null,
    p_condition:       form.conditionPref !== 'any' ? form.conditionPref : null,
    p_location:        locationWKT,
    p_location_label:  form.city || null,
    p_city:            form.city  || null,
    p_district:        form.district || null,
    p_country:         null,
    p_max_distance_km: form.maxDistanceKm,
    p_expires_at:      expiresAt,
  });

  if (error) {
    console.error('[quickmatch] createBuyerRequest error:', error.message);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { requestId: row.request_id, notifiedCount: row.notified_sellers };
}

/** Fetches the current user's active buyer requests. */
export async function fetchMyBuyerRequests(buyerId: string): Promise<BuyerRequest[]> {
  const { data, error } = await supabase
    .from('buyer_requests' as any)
    .select('*')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any) as BuyerRequest[];
}

/** Fetches active public buyer requests (for sellers to browse). */
export async function fetchActiveBuyerRequests(params: {
  city?: string;
  categoryId?: string;
  limit?: number;
}): Promise<BuyerRequest[]> {
  let query = supabase
    .from('buyer_requests' as any)
    .select('*')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50);

  if (params.city)       query = query.ilike('city', params.city);
  if (params.categoryId) query = query.eq('category_id', params.categoryId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as any) as BuyerRequest[];
}

/** Cancels the buyer's own request. */
export async function cancelBuyerRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('buyer_requests' as any)
    .update({ status: 'cancelled' })
    .eq('id', requestId);
  if (error) throw error;
}

// ─── Seller Response ──────────────────────────────────────────────────────────

/**
 * Seller taps "I HAVE THIS" on a buyer request.
 * Creates a conversation and returns its ID.
 */
export async function respondToBuyerRequest(
  sellerId: string,
  requestId: string,
  listingId?: string,
  message?: string,
): Promise<RespondResult> {
  const { data, error } = await supabase.rpc('respond_to_buyer_request', {
    p_seller_id:  sellerId,
    p_request_id: requestId,
    p_listing_id: listingId ?? null,
    p_message:    message   ?? null,
  });

  if (error) {
    console.error('[quickmatch] respondToBuyerRequest error:', error.message);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { response_id: row.response_id, conversation_id: row.conversation_id };
}

// ─── Extended Buyer Request System Functions ─────────────────────────────────

/**
 * Creates a detailed buyer request using submit_buyer_request_v2 RPC.
 */
export async function submitBuyerRequestV2(params: {
  buyerId: string;
  title: string;
  description?: string;
  categoryId?: string;
  budgetMin?: number;
  budgetMax?: number;
  desiredCondition?: string;
  region?: string;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  expiresInDays?: number;
}): Promise<{ requestId: string; notifiedCount: number }> {
  const { data, error } = await supabase.rpc('submit_buyer_request_v2', {
    p_buyer_id:          params.buyerId,
    p_title:             params.title,
    p_description:       params.description ?? null,
    p_category_id:       params.categoryId ?? null,
    p_budget_min:        params.budgetMin ?? null,
    p_budget_max:        params.budgetMax ?? null,
    p_desired_condition: params.desiredCondition ?? 'any',
    p_region:            params.region ?? null,
    p_district:          params.district ?? null,
    p_city:              params.city ?? null,
    p_latitude:          params.latitude ?? null,
    p_longitude:         params.longitude ?? null,
    p_radius:            params.radius ?? 25,
    p_expires_in_days:   params.expiresInDays ?? 7,
  });

  if (error) {
    console.error('[buyerRequests] submitBuyerRequestV2 error:', error.message);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { requestId: row.request_id, notifiedCount: row.notified_sellers };
}

/**
 * Seller sends an offer response to a buyer request with price, availability, and optional product linking.
 */
export async function respondToBuyerRequestWithOffer(params: {
  sellerId: string;
  requestId: string;
  message: string;
  price: number;
  productId?: string;
  availability?: string;
}): Promise<RespondResult> {
  const { data, error } = await supabase.rpc('respond_to_buyer_request_with_offer', {
    p_seller_id:    params.sellerId,
    p_request_id:   params.requestId,
    p_message:      params.message,
    p_price:        params.price,
    p_product_id:   params.productId ?? null,
    p_availability: params.availability ?? 'in_stock',
  });

  if (error) {
    console.error('[buyerRequests] respondToBuyerRequestWithOffer error:', error.message);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { response_id: row.response_id, conversation_id: row.conversation_id };
}

/** Buyer accepts a seller's offer response. Marks request as FULFILLED. */
export async function acceptBuyerRequestResponse(buyerId: string, responseId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('accept_buyer_request_response', {
    p_buyer_id:    buyerId,
    p_response_id: responseId,
  });

  if (error) {
    console.error('[buyerRequests] acceptBuyerRequestResponse error:', error.message);
    throw error;
  }
  return !!data;
}

/** Buyer ignores a seller's offer response. */
export async function ignoreBuyerRequestResponse(buyerId: string, responseId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('ignore_buyer_request_response', {
    p_buyer_id:    buyerId,
    p_response_id: responseId,
  });

  if (error) {
    console.error('[buyerRequests] ignoreBuyerRequestResponse error:', error.message);
    throw error;
  }
  return !!data;
}

/** Fetches complete JSON details for a request and all seller responses. */
export async function getBuyerRequestDetails(requestId: string): Promise<{
  request: BuyerRequest;
  responses: any[];
}> {
  const { data, error } = await supabase.rpc('get_buyer_request_details', {
    p_request_id: requestId,
  });

  if (error) {
    console.error('[buyerRequests] getBuyerRequestDetails error:', error.message);
    throw error;
  }

  const json = typeof data === 'string' ? JSON.parse(data) : data;
  return {
    request: json.request as BuyerRequest,
    responses: json.responses ?? [],
  };
}

/** Fetches active listings owned by a seller for linking in an offer response. */
export async function fetchSellerActiveListings(sellerId: string) {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, price, image_url, condition, status')
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Pre-fill helper ──────────────────────────────────────────────────────────

/**
 * Converts a parsed QuickMatchInput into a pre-filled BuyerRequestFormData.
 * Used when the buyer transitions from Quick Match results to the request form.
 */
export function prefillFormFromInput(
  input: QuickMatchInput,
): Partial<BuyerRequestFormData> {
  return {
    title:          input.title ?? input.rawQuery,
    keywords:       input.keywords ?? [],
    categoryId:     input.categoryId ?? '',
    categoryName:   input.categoryName ?? '',
    maxPrice:       input.maxPrice ? String(input.maxPrice) : '',
    minPrice:       input.minPrice ? String(input.minPrice) : '',
    conditionPref:  input.conditionPref ?? 'any',
    city:           input.city ?? '',
    maxDistanceKm:  input.maxDistanceKm ?? 25,
  };
}

