// ============================================================
// QuickSell Ranking Engine — Types
// ============================================================
// All types used by the ranking engine service and hook.
// Kept separate so the DB shape and UI shape can diverge cleanly.
// ============================================================

// ─── Weight Configuration ─────────────────────────────────────────────────────

/**
 * The configurable weight profile for the ranking engine.
 * All values must be 0–1, and their sum must equal 1.0.
 *
 * This is the ONLY place weights are defined in frontend code.
 * Any change here propagates automatically — no grep-and-replace needed.
 */
export type RankingWeights = {
  text:         number;  // text relevance
  distance:     number;  // geographic proximity
  price:        number;  // price competitiveness
  seller:       number;  // seller trust score
  condition:    number;  // product condition
  freshness:    number;  // listing freshness
  response:     number;  // seller response rate
  availability: number;  // stock availability
};

/** Named weight profiles that map to the DB ranking_weights table. */
export type WeightProfile = 'default' | 'price_focused' | 'proximity_focused' | (string & {});

/** Default weights — mirrors the DB `default` profile. */
export const DEFAULT_WEIGHTS: RankingWeights = {
  text:         0.30,
  distance:     0.25,
  price:        0.15,
  seller:       0.15,
  condition:    0.05,
  freshness:    0.05,
  response:     0.03,
  availability: 0.02,
} as const;

// ─── Per-listing score breakdown ──────────────────────────────────────────────

/**
 * The complete score breakdown for a single listing.
 * All component scores are normalised to [0, 1].
 */
export type ListingScores = {
  text:         number;
  distance:     number;
  price:        number;
  seller:       number;
  condition:    number;
  freshness:    number;
  response:     number;
  availability: number;
  final:        number;
};

/** Human-readable labels for each scoring signal. */
export const SCORE_LABELS: Record<keyof Omit<ListingScores, 'final'>, string> = {
  text:         'Text Match',
  distance:     'Distance',
  price:        'Price',
  seller:       'Seller Trust',
  condition:    'Condition',
  freshness:    'Freshness',
  response:     'Response Rate',
  availability: 'Availability',
};

// ─── Ranked result shape ──────────────────────────────────────────────────────

/** A single ranked marketplace result returned from the `rank_listings` RPC. */
export type RankedListing = {
  // Identity
  listing_id:   string;
  seller_id:    string;

  // Display
  title:        string;
  description:  string | null;
  price:        number;
  condition:    string | null;
  category_id:  string | null;
  neighborhood: string | null;
  city:         string | null;
  location_label: string | null;
  quantity:     number;

  // Scores (component + final)
  scores:       ListingScores;

  // Distance for display (metres, privacy-safe)
  distance_meters: number | null;

  // Seller public info
  seller_display_name:  string | null;
  seller_avatar_url:    string | null;
  seller_rating:        number | null;
  seller_trust_score:   number | null;
  seller_total_sales:   number | null;
  seller_response_rate: number | null;
  seller_is_verified:   boolean;
  seller_neighborhood:  string | null;
  seller_city:          string | null;
};

/** Paginated result wrapper. */
export type RankedListingsPage = {
  results:      RankedListing[];
  totalCount:   number;
  pageSize:     number;
  pageOffset:   number;
  hasMore:      boolean;
};

// ─── Search params ────────────────────────────────────────────────────────────

export type RankingSearchParams = {
  userLon:          number;
  userLat:          number;
  searchQuery?:     string;
  radiusMeters?:    number;
  categoryId?:      string;
  minPrice?:        number;
  maxPrice?:        number;
  conditionFilter?: string;
  filterCity?:      string;
  filterDistrict?:  string;
  filterNeighborhood?: string;
  weightProfile?:   WeightProfile;
  pageSize?:        number;
  pageOffset?:      number;
};
