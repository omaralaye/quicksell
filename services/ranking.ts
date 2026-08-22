// ============================================================
// QuickSell Ranking Engine — Service
// ============================================================
// Pure async functions, no React. Safe to call from hooks,
// Edge Functions, or server-side code.
//
// The ranking engine is intentionally modular:
//   - The primary entry point is `rankListings()` which calls the DB.
//   - `reRankClient()` allows client-side re-ranking of an existing
//     result set (e.g. after a filter toggle) without another round-trip.
//   - `computeScores()` exposes the individual signal scores for debugging.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  RankedListing,
  RankedListingsPage,
  RankingSearchParams,
  RankingWeights,
  ListingScores,
  WeightProfile,
} from './ranking.types';
import { DEFAULT_WEIGHTS } from './ranking.types';
import { formatDistance } from './location';

// ─── DB Row shape (raw from Supabase RPC) ────────────────────────────────────

type RankListingsRow = {
  listing_id:          string;
  seller_id:           string;
  title:               string;
  description:         string | null;
  price:               number;
  condition:           string | null;
  category_id:         string | null;
  neighborhood:        string | null;
  city:                string | null;
  location_label:      string | null;
  quantity:            number;
  score_text:          number;
  score_distance:      number;
  score_price:         number;
  score_seller:        number;
  score_condition:     number;
  score_freshness:     number;
  score_response:      number;
  score_availability:  number;
  final_score:         number;
  distance_meters:     number | null;
  seller_display_name: string | null;
  seller_avatar_url:   string | null;
  seller_rating:       number | null;
  seller_trust_score:  number | null;
  seller_total_sales:  number | null;
  seller_response_rate: number | null;
  seller_is_verified:  boolean;
  seller_neighborhood: string | null;
  seller_city:         string | null;
  total_count:         number;
};

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapRow(row: RankListingsRow): RankedListing {
  return {
    listing_id:           row.listing_id,
    seller_id:            row.seller_id,
    title:                row.title,
    description:          row.description,
    price:                row.price,
    condition:            row.condition,
    category_id:          row.category_id,
    neighborhood:         row.neighborhood,
    city:                 row.city,
    location_label:       row.location_label,
    quantity:             row.quantity,
    scores: {
      text:         row.score_text,
      distance:     row.score_distance,
      price:        row.score_price,
      seller:       row.score_seller,
      condition:    row.score_condition,
      freshness:    row.score_freshness,
      response:     row.score_response,
      availability: row.score_availability,
      final:        row.final_score,
    },
    distance_meters:      row.distance_meters,
    seller_display_name:  row.seller_display_name,
    seller_avatar_url:    row.seller_avatar_url,
    seller_rating:        row.seller_rating,
    seller_trust_score:   row.seller_trust_score,
    seller_total_sales:   row.seller_total_sales,
    seller_response_rate: row.seller_response_rate,
    seller_is_verified:   row.seller_is_verified,
    seller_neighborhood:  row.seller_neighborhood,
    seller_city:          row.seller_city,
  };
}

// ─── Primary entry point ──────────────────────────────────────────────────────

/**
 * Calls the `rank_listings` Postgres RPC.
 *
 * The database handles all scoring and sorting in a single query.
 * The weight profile name is resolved server-side from `ranking_weights`.
 * No N+1 queries — all seller info is joined in the same CTE.
 */
export async function rankListings(
  params: RankingSearchParams,
): Promise<RankedListingsPage> {
  const {
    userLon,
    userLat,
    searchQuery,
    radiusMeters   = 10000,
    categoryId,
    minPrice,
    maxPrice,
    conditionFilter,
    filterCity,
    filterDistrict,
    filterNeighborhood,
    weightProfile   = 'default',
    pageSize        = 20,
    pageOffset      = 0,
  } = params;

  const { data, error } = await supabase.rpc('rank_listings', {
    user_lon:             userLon,
    user_lat:             userLat,
    search_query:         searchQuery         ?? null,
    radius_meters:        radiusMeters,
    category_filter:      categoryId          ?? null,
    min_price:            minPrice            ?? null,
    max_price:            maxPrice            ?? null,
    condition_filter:     conditionFilter     ?? null,
    filter_city:          filterCity          ?? null,
    filter_district:      filterDistrict      ?? null,
    filter_neighborhood:  filterNeighborhood  ?? null,
    weight_profile:       weightProfile,
    page_size:            pageSize,
    page_offset:          pageOffset,
  });

  if (error) {
    console.error('[ranking] rankListings error:', error.message);
    throw error;
  }

  const rows = (data ?? []) as RankListingsRow[];
  const totalCount = rows[0]?.total_count ?? 0;
  const results = rows.map(mapRow);

  return {
    results,
    totalCount,
    pageSize,
    pageOffset,
    hasMore: pageOffset + pageSize < totalCount,
  };
}

// ─── Client-side re-ranking (no additional DB round-trip) ────────────────────

/**
 * Re-applies a weight set to an already-loaded result set client-side.
 * Use this for instant re-sorting after a user changes the weight profile
 * locally — the component score signals are already present in each result.
 */
export function reRankClient(
  results: RankedListing[],
  weights: RankingWeights = DEFAULT_WEIGHTS,
): RankedListing[] {
  return results
    .map(r => ({
      ...r,
      scores: {
        ...r.scores,
        final: computeFinalScore(r.scores, weights),
      },
    }))
    .sort((a, b) => b.scores.final - a.scores.final);
}

/**
 * Computes the weighted final score from component signals and a weight set.
 */
export function computeFinalScore(
  scores: Omit<ListingScores, 'final'>,
  weights: RankingWeights = DEFAULT_WEIGHTS,
): number {
  return (
    scores.text         * weights.text +
    scores.distance     * weights.distance +
    scores.price        * weights.price +
    scores.seller       * weights.seller +
    scores.condition    * weights.condition +
    scores.freshness    * weights.freshness +
    scores.response     * weights.response +
    scores.availability * weights.availability
  );
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Returns the human-readable location line for a ranked listing card.
 * e.g. "Ntinda · 2.4 km away"
 */
export function getRankedListingLocationLabel(listing: RankedListing): string {
  const area = listing.location_label ?? listing.neighborhood ?? listing.city ?? '';
  const dist = formatDistance(listing.distance_meters);
  if (area && dist) return `${area} · ${dist}`;
  return area || dist || 'Nearby';
}

/**
 * Returns a colour-coded relevance tier based on final_score.
 * Useful for UI badges or heatmaps.
 */
export function getScoreTier(finalScore: number): {
  label: 'Top Match' | 'Good Match' | 'Match';
  color: string;
} {
  if (finalScore >= 0.75) return { label: 'Top Match',  color: '#10B981' };
  if (finalScore >= 0.50) return { label: 'Good Match', color: '#F59E0B' };
  return                         { label: 'Match',      color: '#6B7280' };
}

// ─── Weight validation ────────────────────────────────────────────────────────

/**
 * Validates that a custom weight set sums to 1.0 and all values are ≥ 0.
 * Returns null if valid, or an error string if not.
 */
export function validateWeights(weights: RankingWeights): string | null {
  const values = Object.values(weights);
  if (values.some(v => v < 0)) return 'All weights must be non-negative.';
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.001) return `Weights must sum to 1.0 (current: ${sum.toFixed(3)}).`;
  return null;
}
