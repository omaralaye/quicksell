// ============================================================
// useRankedListings — React hook for the ranking engine
// ============================================================
// Manages search state, pagination, debounce, and calls
// the rankListings service. Keeps all ranking logic out of
// the component tree.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { rankListings, reRankClient } from '@/services/ranking';
import type {
  RankedListing,
  RankedListingsPage,
  RankingSearchParams,
  WeightProfile,
  RankingWeights,
} from '@/services/ranking.types';
import type { UserCoordinates } from '@/services/location.types';

const DEFAULT_PAGE_SIZE = 20;
const DEBOUNCE_MS       = 300;

export type UseRankedListingsOptions = {
  coordinates:       UserCoordinates | null;
  searchQuery?:      string;
  radiusMeters?:     number;
  categoryId?:       string;
  minPrice?:         number;
  maxPrice?:         number;
  conditionFilter?:  string;
  filterCity?:       string;
  filterDistrict?:   string;
  filterNeighborhood?: string;
  weightProfile?:    WeightProfile;
  pageSize?:         number;
  /** Enable automatic fetch on mount and filter changes. Default true. */
  autoFetch?:        boolean;
};

export type UseRankedListingsResult = {
  results:         RankedListing[];
  loading:         boolean;
  loadingMore:     boolean;
  error:           string | null;
  totalCount:      number;
  hasMore:         boolean;
  /** Fetch next page and append results. */
  loadMore:        () => void;
  /** Reset and re-fetch from page 0. */
  refresh:         () => void;
  /** Apply a client-side weight override without a new DB round-trip. */
  applyWeights:    (weights: RankingWeights) => void;
};

// Fallback location (San Francisco default) if GPS is pending/unavailable
const DEFAULT_COORDINATES: UserCoordinates = {
  latitude: 37.7749,
  longitude: -122.4194,
};

export function useRankedListings(
  options: UseRankedListingsOptions,
): UseRankedListingsResult {
  const {
    coordinates,
    searchQuery,
    radiusMeters    = 10000,
    categoryId,
    minPrice,
    maxPrice,
    conditionFilter,
    filterCity,
    filterDistrict,
    filterNeighborhood,
    weightProfile   = 'default',
    pageSize        = DEFAULT_PAGE_SIZE,
    autoFetch       = true,
  } = options;

  const [results, setResults]         = useState<RankedListing[]>([]);
  const [totalCount, setTotalCount]   = useState(0);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [pageOffset, setPageOffset]   = useState(0);

  const mountedRef      = useRef(true);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Core fetch ─────────────────────────────────────────────────────────────

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const activeCoords = coordinates || DEFAULT_COORDINATES;

      const setter = append ? setLoadingMore : setLoading;
      setter(true);
      setError(null);

      try {
        const params: RankingSearchParams = {
          userLon:           activeCoords.longitude,
          userLat:           activeCoords.latitude,
          searchQuery:       searchQuery || undefined,
          radiusMeters,
          categoryId,
          minPrice,
          maxPrice,
          conditionFilter,
          filterCity,
          filterDistrict,
          filterNeighborhood,
          weightProfile,
          pageSize,
          pageOffset:        offset,
        };

        const page: RankedListingsPage = await rankListings(params);

        if (!mountedRef.current) return;

        setResults(prev => append ? [...prev, ...page.results] : page.results);
        setTotalCount(page.totalCount);
        setPageOffset(offset);
      } catch (err: any) {
        if (!mountedRef.current) return;
        setError(err?.message ?? 'Failed to load listings');
        console.error('[useRankedListings] error:', err);
      } finally {
        if (mountedRef.current) setter(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      coordinates?.latitude, coordinates?.longitude,
      searchQuery, radiusMeters, categoryId,
      minPrice, maxPrice, conditionFilter,
      filterCity, filterDistrict, filterNeighborhood,
      weightProfile, pageSize,
    ],
  );

  // ─── Auto-fetch with debounce ────────────────────────────────────────────────

  useEffect(() => {
    if (!autoFetch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPage(0, false);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // We intentionally depend on fetchPage (which is memoized on filter changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, autoFetch]);

  // ─── Public API ──────────────────────────────────────────────────────────────

  const loadMore = useCallback(() => {
    const nextOffset = pageOffset + pageSize;
    if (nextOffset < totalCount) {
      fetchPage(nextOffset, true);
    }
  }, [fetchPage, pageOffset, pageSize, totalCount]);

  const refresh = useCallback(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  /**
   * Re-rank the already-loaded page client-side using a custom weight set.
   * Useful for instant A/B preview without an additional network round-trip.
   */
  const applyWeights = useCallback((weights: RankingWeights) => {
    setResults(prev => reRankClient(prev, weights));
  }, []);

  return {
    results,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore: pageOffset + pageSize < totalCount,
    loadMore,
    refresh,
    applyWeights,
  };
}
