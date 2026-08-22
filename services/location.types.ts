// ============================================================
// QuickSell Location Types
// ============================================================

/** Full structured location for internal use only (never sent to other users). */
export type UserCoordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;        // metres
  timestamp?: number;       // ms epoch
};

/** Hierarchical location context attached to profiles and listings. */
export type LocationContext = {
  country?: string;
  region?: string;          // e.g. "Central Region"
  district?: string;        // e.g. "Kampala District"
  city?: string;            // e.g. "Kampala"
  neighborhood?: string;    // e.g. "Ntinda"
  label?: string;           // "Ntinda, Kampala" — human-readable
};

/** What we publicly show to a buyer about a listing or seller location. */
export type PublicLocationDisplay = {
  label: string;            // "Ntinda" or "Kampala" depending on precision available
  distanceLabel?: string;   // "2.4 km away" — null if distance unknown
  distanceMeters?: number;
};

/** The set of radius presets available in the UI. */
export type RadiusPreset =
  | 'neighborhood'
  | 'city'
  | 'district'
  | 'region'
  | '1km'
  | '5km'
  | '10km'
  | '25km'
  | 'near_me'; // smart default ~10km

export const RADIUS_PRESET_METERS: Record<RadiusPreset, number | null> = {
  neighborhood: 1500,
  city:         10000,
  district:     30000,
  region:       100000,
  '1km':        1000,
  '5km':        5000,
  '10km':       10000,
  '25km':       25000,
  near_me:      10000,
};

export const RADIUS_PRESET_LABELS: Record<RadiusPreset, string> = {
  neighborhood: 'Same neighborhood',
  city:         'Same city',
  district:     'Same district',
  region:       'Same region',
  '1km':        'Within 1 km',
  '5km':        'Within 5 km',
  '10km':       'Within 10 km',
  '25km':       'Within 25 km',
  near_me:      'Near me',
};

// Order for display in the UI radius selector
export const RADIUS_PRESET_ORDER: RadiusPreset[] = [
  'near_me',
  '1km',
  '5km',
  '10km',
  '25km',
  'neighborhood',
  'city',
  'district',
  'region',
];

/** Possible states the location system can be in. */
export type LocationStatus =
  | 'idle'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'manual'    // user typed / picked a location manually
  | 'stale';    // location is older than STALE_THRESHOLD_MS

/** The shape of the location object stored in the app store. */
export type AppLocation = {
  coordinates: UserCoordinates | null;
  context: LocationContext | null;
  status: LocationStatus;
  /** Age of the location in ms — computed at read-time */
  ageMs?: number;
};

/** How old a cached location can be before we consider it stale (15 minutes). */
export const STALE_THRESHOLD_MS = 15 * 60 * 1000;

/** NearbyListing — the shape returned by get_nearby_listings RPC. */
export type NearbyListing = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url?: string | null;
  category_id: string | null;
  condition: string | null;
  neighborhood: string | null;
  city: string | null;
  district: string | null;
  location_label: string | null;
  distance_meters: number | null;
  ranking_score: number;
  status: string;
  created_at: string;
  updated_at: string;
  seller_display_name: string | null;
  seller_avatar_url: string | null;
  seller_rating: number | null;
  seller_total_sales: number | null;
  seller_response_rate: number | null;
  seller_neighborhood: string | null;
  seller_city: string | null;
  seller_is_verified: boolean;
};

/** NearbySeller — shape returned by get_nearby_sellers RPC. */
export type NearbySeller = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  neighborhood: string | null;
  city: string | null;
  rating: number | null;
  total_listings: number | null;
  total_sales: number | null;
  response_rate: number | null;
  is_verified: boolean;
  distance_meters: number | null;
};
