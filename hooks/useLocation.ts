// ============================================================
// useLocation — React hook for device GPS in QuickSell
// ============================================================
// Handles:
//   - Permission request flow (granted / denied)
//   - GPS unavailability
//   - Stale location detection (> 15 min)
//   - Inaccurate GPS (accuracy > 500m)
//   - Manual location override by the user
//   - One-shot reads (no continuous tracking)
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import type {
  UserCoordinates,
  LocationContext,
  LocationStatus,
  AppLocation,
} from '@/services/location.types';
import { STALE_THRESHOLD_MS } from '@/services/location.types';

// ─── Platform-aware location adapter ────────────────────────────────────────
// We use a dynamic import so the hook can be imported on web too.
// On web we fall back to the Geolocation Web API.

type RawPosition = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};

async function requestPermissionNative(): Promise<boolean> {
  try {
    // Dynamic import — expo-location is optional so we don't crash on web
    const Location = await import('expo-location').catch(() => null);
    if (!Location) return false;
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

async function getCurrentPositionNative(): Promise<RawPosition | null> {
  try {
    const Location = await import('expo-location').catch(() => null);
    if (!Location) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return pos;
  } catch {
    return null;
  }
}

function getCurrentPositionWeb(): Promise<RawPosition | null> {
  return new Promise((resolve) => {
    if (!navigator?.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }, timestamp: pos.timestamp }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });
}

async function getCurrentPosition(): Promise<RawPosition | null> {
  if (Platform.OS === 'web') return getCurrentPositionWeb();
  return getCurrentPositionNative();
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export type UseLocationOptions = {
  /** Ask for permission immediately on mount. Default: false (lazy). */
  autoRequest?: boolean;
  /** GPS accuracy threshold in metres; readings above this are flagged inaccurate. */
  accuracyThresholdMeters?: number;
};

export type UseLocationResult = {
  location: AppLocation;
  /** Ask the OS for location permission and fetch GPS. */
  getCurrentLocation: () => Promise<UserCoordinates | null>;
  /** Override the location with a manually selected position + context. */
  setManualLocation: (coords: UserCoordinates, context: LocationContext) => void;
  /** Clear any stored location. */
  clearLocation: () => void;
  /** Whether we are currently fetching. */
  loading: boolean;
};

export function useLocation(options: UseLocationOptions = {}): UseLocationResult {
  const { autoRequest = false, accuracyThresholdMeters = 500 } = options;

  const [location, setLocation] = useState<AppLocation>({
    coordinates: null,
    context: null,
    status: 'idle',
  });
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<UserCoordinates | null> => {
    if (!mountedRef.current) return null;
    setLoading(true);

    try {
      // --- Step 1: Request permission ---
      let permitted = false;

      if (Platform.OS === 'web') {
        // Web: try directly; browser will prompt
        permitted = !!navigator?.geolocation;
      } else {
        permitted = await requestPermissionNative();
      }

      if (!permitted) {
        if (!mountedRef.current) return null;
        setLocation(prev => ({ ...prev, status: 'denied', coordinates: null }));
        Alert.alert(
          'Location Permission Required',
          'QuickSell needs your location to show nearby listings. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS !== 'web') Linking.openSettings();
              },
            },
          ],
        );
        return null;
      }

      // --- Step 2: Get position ---
      const pos = await getCurrentPosition();

      if (!pos) {
        if (!mountedRef.current) return null;
        setLocation(prev => ({ ...prev, status: 'unavailable' }));
        Alert.alert(
          'GPS Unavailable',
          'Your location could not be determined. Please check your GPS or select your area manually.',
        );
        return null;
      }

      // --- Step 3: Check accuracy ---
      const coords: UserCoordinates = {
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy:  pos.coords.accuracy ?? undefined,
        timestamp: pos.timestamp,
      };

      const isInaccurate =
        coords.accuracy != null && coords.accuracy > accuracyThresholdMeters;

      if (!mountedRef.current) return null;

      setLocation(prev => ({
        coordinates: coords,
        context: prev.context,
        status: isInaccurate ? 'stale' : 'granted',
        ageMs: 0,
      }));

      if (isInaccurate) {
        console.warn(
          `[useLocation] GPS accuracy ${coords.accuracy}m exceeds threshold ${accuracyThresholdMeters}m`,
        );
      }

      return coords;
    } catch (err) {
      console.error('[useLocation] getCurrentLocation error:', err);
      if (!mountedRef.current) return null;
      setLocation(prev => ({ ...prev, status: 'unavailable' }));
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [accuracyThresholdMeters]);

  const setManualLocation = useCallback(
    (coords: UserCoordinates, context: LocationContext) => {
      setLocation({
        coordinates: coords,
        context,
        status: 'manual',
        ageMs: 0,
      });
    },
    [],
  );

  const clearLocation = useCallback(() => {
    setLocation({ coordinates: null, context: null, status: 'idle' });
  }, []);

  // Auto-request on mount if configured
  useEffect(() => {
    if (autoRequest) {
      getCurrentLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Staleness checker — recalculates ageMs every minute
  useEffect(() => {
    if (!location.coordinates?.timestamp) return;
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      const ageMs = Date.now() - (location.coordinates!.timestamp!);
      if (ageMs > STALE_THRESHOLD_MS && location.status === 'granted') {
        setLocation(prev => ({ ...prev, status: 'stale', ageMs }));
      } else {
        setLocation(prev => ({ ...prev, ageMs }));
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [location.coordinates?.timestamp, location.status]);

  return { location, getCurrentLocation, setManualLocation, clearLocation, loading };
}
