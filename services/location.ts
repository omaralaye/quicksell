// ============================================================
// QuickSell Location Service
// Pure functions — no React, no hooks. Safe to call anywhere.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  UserCoordinates,
  LocationContext,
  PublicLocationDisplay,
  NearbyListing,
  NearbySeller,
  RadiusPreset,
  RADIUS_PRESET_METERS,
} from './location.types';
import { RADIUS_PRESET_METERS as PRESET_METERS } from './location.types';

// ─── Distance Calculation ─────────────────────────────────────────────────────

/**
 * Haversine distance between two coordinates in metres.
 * Used client-side when PostGIS data is already returned.
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Formats a distance in metres to a human-readable string.
 * e.g. 450 → "450 m away", 2400 → "2.4 km away"
 */
export function formatDistance(metres: number | null | undefined): string | undefined {
  if (metres == null) return undefined;
  if (metres < 1000) return `${Math.round(metres)} m away`;
  return `${(metres / 1000).toFixed(1)} km away`;
}

/**
 * Returns the human-readable location label to show a buyer.
 * Prioritises neighborhood, falls back to city, district, region.
 * Never reveals exact coordinates.
 */
export function buildPublicLocationDisplay(
  listing: { neighborhood?: string | null; city?: string | null; location_label?: string | null },
  distanceMeters?: number | null,
): PublicLocationDisplay {
  const label =
    listing.location_label ||
    [listing.neighborhood, listing.city].filter(Boolean).join(', ') ||
    'Unknown location';

  return {
    label,
    distanceLabel: formatDistance(distanceMeters ?? undefined),
    distanceMeters: distanceMeters ?? undefined,
  };
}

// ─── Supabase RPC Calls ───────────────────────────────────────────────────────

export type NearbyListingsParams = {
  userLon: number;
  userLat: number;
  radiusMeters?: number;
  categoryId?: string;
  searchQuery?: string;
  // Hierarchy filters — when set, radius is ignored
  filterNeighborhood?: string;
  filterCity?: string;
  filterDistrict?: string;
  filterCountry?: string;
};

/**
 * Searches for nearby active listings using the PostGIS RPC.
 * Returns privacy-safe fields only (no exact coordinates).
 */
export async function searchNearbyProducts(
  params: NearbyListingsParams,
): Promise<NearbyListing[]> {
  const {
    userLon,
    userLat,
    radiusMeters = 10000,
    categoryId,
    searchQuery,
    filterNeighborhood,
    filterCity,
    filterDistrict,
    filterCountry,
  } = params;

  const { data, error } = await supabase.rpc('get_nearby_listings', {
    user_lon:             userLon,
    user_lat:             userLat,
    radius_meters:        radiusMeters,
    category_filter:      categoryId ?? null,
    search_query:         searchQuery ?? null,
    filter_neighborhood:  filterNeighborhood ?? null,
    filter_city:          filterCity ?? null,
    filter_district:      filterDistrict ?? null,
    filter_country:       filterCountry ?? null,
  });

  if (error) {
    console.error('[location] searchNearbyProducts error:', error.message);
    throw error;
  }

  return (data ?? []) as NearbyListing[];
}

export type NearbySellersParams = {
  userLon: number;
  userLat: number;
  radiusMeters?: number;
  filterCity?: string;
  filterDistrict?: string;
};

/**
 * Searches for nearby sellers.
 * Returns public profile info only (neighborhood, city, rating).
 */
export async function searchNearbySellers(
  params: NearbySellersParams,
): Promise<NearbySeller[]> {
  const { userLon, userLat, radiusMeters = 10000, filterCity, filterDistrict } = params;

  const { data, error } = await supabase.rpc('get_nearby_sellers', {
    user_lon:        userLon,
    user_lat:        userLat,
    radius_meters:   radiusMeters,
    filter_city:     filterCity ?? null,
    filter_district: filterDistrict ?? null,
  });

  if (error) {
    console.error('[location] searchNearbySellers error:', error.message);
    throw error;
  }

  return (data ?? []) as NearbySeller[];
}

/**
 * Updates the authenticated user's location in their profile.
 * Stores both the exact `location` (private) and a snapped
 * `public_location` (shown to others) via the database function.
 */
export async function updateUserLocation(
  userId: string,
  coords: UserCoordinates,
  context: LocationContext,
): Promise<void> {
  const locationWKT = `POINT(${coords.longitude} ${coords.latitude})`;

  const { error } = await supabase
    .from('profiles')
    .update({
      location:            locationWKT,
      country:             context.country ?? null,
      region_name:         context.region ?? null,
      district:            context.district ?? null,
      city:                context.city ?? null,
      neighborhood:        context.neighborhood ?? null,
      location_updated_at: new Date().toISOString(),
      // public_location is set by the DB via a trigger (see migration)
    })
    .eq('id', userId);

  if (error) {
    console.error('[location] updateUserLocation error:', error.message);
    throw error;
  }
}

/**
 * Resolves a radius preset to metres.
 * When a hierarchy filter preset is returned, the caller should
 * pass the matching filterCity/filterDistrict/filterNeighborhood instead of radius.
 */
export function resolveRadiusPreset(preset: RadiusPreset): {
  radiusMeters: number | null;
  hierarchyKey: 'neighborhood' | 'city' | 'district' | 'region' | null;
} {
  const metres = PRESET_METERS[preset];
  const hierarchyMap: Partial<Record<RadiusPreset, 'neighborhood' | 'city' | 'district' | 'region'>> = {
    neighborhood: 'neighborhood',
    city:         'city',
    district:     'district',
    region:       'region',
  };
  return {
    radiusMeters:  typeof metres === 'number' ? metres : null,
    hierarchyKey:  hierarchyMap[preset] ?? null,
  };
}
