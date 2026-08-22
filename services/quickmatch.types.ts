// ============================================================
// QuickSell Quick Match — Types
// ============================================================

import type { RankedListing } from './ranking.types';

// ─── Buyer Request System Types ─────────────────────────────────────────────

export type BuyerRequestStatus =
  | 'ACTIVE'
  | 'MATCHED'
  | 'FULFILLED'
  | 'EXPIRED'
  | 'CANCELLED';

export type ConditionPref = 'new' | 'like_new' | 'good' | 'fair' | 'any';

export type AvailabilityOption = 'in_stock' | 'available_now' | 'on_order' | 'made_to_order';

export const AVAILABILITY_OPTIONS: { value: AvailabilityOption; label: string }[] = [
  { value: 'in_stock',      label: 'In Stock' },
  { value: 'available_now', label: 'Available Now' },
  { value: 'on_order',     label: 'Order on Demand (1-3 days)' },
  { value: 'made_to_order', label: 'Made to Order' },
];

/** The full shape of a buyer_request row, as returned from the DB. */
export type BuyerRequest = {
  id:               string;
  buyer_id:         string;
  title:            string;
  description:      string | null;
  category_id:      string | null;
  category_name?:   string | null;
  keywords:         string[] | null;
  budget_min:       number | null;
  budget_max:       number | null;
  min_price?:       number | null;       // legacy alias for budget_min
  max_price?:       number | null;       // legacy alias for budget_max
  budget?:          number | null;
  desired_condition: ConditionPref | null;
  condition_pref?:  ConditionPref | null;
  location_label:   string | null;
  region:           string | null;
  district:         string | null;
  city:             string | null;
  country:          string | null;
  latitude:         number | null;
  longitude:        number | null;
  radius:           number;
  max_distance_km?: number;
  expires_at:       string | null;
  status:           BuyerRequestStatus;
  matched_count:    number;
  response_count:   number;
  buyer_name?:      string;
  buyer_avatar?:    string;
  created_at:       string;
  updated_at:       string;
};

/** Seller response/offer on a buyer request */
export type BuyerRequestResponse = {
  id:               string;
  request_id:       string;
  seller_id:        string;
  seller_name?:     string;
  seller_avatar?:   string;
  seller_trust_score?: number;
  seller_rating?:   number;
  seller_is_verified?: boolean;
  product_id:       string | null;
  listing_id?:      string | null;
  price:            number;
  availability:     AvailabilityOption;
  message:          string | null;
  conversation_id:  string | null;
  status:           'pending' | 'accepted' | 'ignored' | 'declined';
  product?: {
    id:          string;
    title:       string;
    price:       number;
    image_url:   string | null;
    condition:   string;
  } | null;
  created_at:       string;
  updated_at:       string;
};

export type BuyerRequestDetailsJSON = {
  request: BuyerRequest;
  responses: BuyerRequestResponse[];
};

export type QuickMatchInput = {
  rawQuery:       string;          // "iPhone 13 128GB under 1500000 near Kampala"
  // Parsed / manually selected fields:
  title?:         string;
  keywords?:      string[];
  categoryId?:    string;
  categoryName?:  string;
  minPrice?:      number;
  maxPrice?:      number;
  conditionPref?: ConditionPref;
  city?:          string;
  district?:      string;
  country?:       string;
  locationLabel?: string;
  maxDistanceKm?: number;
};

/** The complete state of a Quick Match search session. */
export type QuickMatchState =
  | { phase: 'input' }
  | { phase: 'searching' }
  | { phase: 'results'; results: RankedListing[]; totalCount: number }
  | { phase: 'no_results' }
  | { phase: 'request_form'; prefill: Partial<BuyerRequestFormData> }
  | { phase: 'request_submitted'; requestId: string; notifiedCount: number };

// ─── Buyer Request Form ───────────────────────────────────────────────────────

export type BuyerRequestFormData = {
  title:          string;
  description:    string;
  categoryId:     string;
  categoryName:   string;
  keywords:       string[];
  minPrice:       string;           // string for TextInput, parsed on submit
  maxPrice:       string;
  conditionPref:  ConditionPref;
  city:           string;
  district:       string;
  maxDistanceKm:  number;
  expiresInDays:  number;           // 3, 7, 14, 30
};

export const DEFAULT_FORM_DATA: BuyerRequestFormData = {
  title:          '',
  description:    '',
  categoryId:     '',
  categoryName:   '',
  keywords:       [],
  minPrice:       '',
  maxPrice:       '',
  conditionPref:  'any',
  city:           '',
  district:       '',
  maxDistanceKm:  25,
  expiresInDays:  7,
};

export const CONDITION_OPTIONS: { value: ConditionPref; label: string }[] = [
  { value: 'any',      label: 'Any condition' },
  { value: 'new',      label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good',     label: 'Good' },
  { value: 'fair',     label: 'Fair' },
];

export const EXPIRY_OPTIONS: { value: number; label: string }[] = [
  { value: 3,  label: '3 days' },
  { value: 7,  label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 30, label: '30 days' },
];

export const DISTANCE_OPTIONS: { value: number; label: string }[] = [
  { value: 5,   label: '5 km' },
  { value: 10,  label: '10 km' },
  { value: 25,  label: '25 km' },
  { value: 50,  label: '50 km' },
  { value: 100, label: '100 km' },
];

// ─── Seller Response ──────────────────────────────────────────────────────────

/** Result of the respond_to_buyer_request RPC. */
export type RespondResult = {
  response_id:      string;
  conversation_id:  string;
};
