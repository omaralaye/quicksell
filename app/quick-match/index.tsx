import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Animated, KeyboardAvoidingView, Platform, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Sparkles, Search, MapPin, ArrowRight, RefreshCw,
  Tag, DollarSign, Ruler, Star, Package, BadgeCheck, X,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useLocation } from '@/hooks/useLocation';
import {
  parseQuickMatchQuery, quickMatchSearch, prefillFormFromInput,
} from '@/services/quickmatch';
import { formatDistance } from '@/services/location';
import { getScoreTier, getRankedListingLocationLabel } from '@/services/ranking';
import type { QuickMatchInput, QuickMatchState } from '@/services/quickmatch.types';
import type { RankedListing } from '@/services/ranking.types';

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'iPhone 13 128GB under 1,500,000 near Kampala',
  'Samsung TV 55 inch good condition',
  'Mountain bike under 800,000 Ntinda',
  'MacBook Pro near Kampala under 3,000,000',
];

// ─── Result Card ─────────────────────────────────────────────────────────────

function MatchCard({ item, onPress }: { item: RankedListing; onPress: () => void }) {
  const tier = getScoreTier(item.scores.final);
  const locationLabel = getRankedListingLocationLabel(item);
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          flexDirection: 'row',
          gap: 14,
        }}
      >
        {/* Match tier badge */}
        <View style={{
          width: 48, height: 48, borderRadius: 12,
          backgroundColor: `${tier.color}20`,
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={22} color={tier.color} />
        </View>

        <View style={{ flex: 1 }}>
          {/* Title + tier */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text
              numberOfLines={2}
              style={{
                flex: 1, fontSize: 15, fontFamily: 'Nunito_700Bold',
                color: COLORS.text,
              }}
            >
              {item.title}
            </Text>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
              backgroundColor: `${tier.color}18`,
            }}>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: tier.color }}>
                {tier.label}
              </Text>
            </View>
          </View>

          {/* Price */}
          <Text style={{
            fontSize: 16, fontFamily: 'Nunito_800ExtraBold',
            color: COLORS.primary, marginTop: 4,
          }}>
            UGX {Number(item.price).toLocaleString()}
          </Text>

          {/* Metadata row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {/* Location / Distance */}
            {locationLabel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MapPin size={12} color={COLORS.textSecondary} />
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                  {locationLabel}
                </Text>
              </View>
            ) : null}

            {/* Condition */}
            {item.condition ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Tag size={12} color={COLORS.textSecondary} />
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                  {item.condition.replace('_', ' ')}
                </Text>
              </View>
            ) : null}

            {/* Seller rating */}
            {item.seller_rating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Star size={12} color='#F59E0B' fill='#F59E0B' />
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                  {Number(item.seller_rating).toFixed(1)}
                </Text>
              </View>
            ) : null}

            {/* Verified badge */}
            {item.seller_is_verified && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <BadgeCheck size={12} color='#10B981' />
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: '#10B981' }}>
                  Verified
                </Text>
              </View>
            )}

            {/* Availability */}
            {item.quantity != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Package size={12} color={item.quantity > 0 ? '#10B981' : '#EF4444'} />
                <Text style={{
                  fontSize: 12, fontFamily: 'Nunito_400Regular',
                  color: item.quantity > 0 ? '#10B981' : '#EF4444',
                }}>
                  {item.quantity > 0 ? `${item.quantity} available` : 'Out of stock'}
                </Text>
              </View>
            )}
          </View>

          {/* Seller name */}
          <Text style={{
            fontSize: 12, fontFamily: 'Nunito_400Regular',
            color: COLORS.textTertiary, marginTop: 6,
          }}>
            by {item.seller_display_name ?? 'Unknown seller'}
          </Text>
        </View>

        <View style={{ justifyContent: 'center' }}>
          <ArrowRight size={18} color={COLORS.textTertiary} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function NoResultsState({
  input, onCreateRequest,
}: {
  input: QuickMatchInput;
  onCreateRequest: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 16 }}>
      <View style={{
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: COLORS.primaryMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Search size={36} color={COLORS.primary} />
      </View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
          No exact matches found
        </Text>
        <Text style={{
          fontSize: 14, fontFamily: 'Nunito_400Regular',
          color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20,
        }}>
          We couldn't find{' '}
          <Text style={{ fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
            "{input.title}"
          </Text>
          {input.city ? ` near ${input.city}` : ''} right now.
        </Text>
      </View>

      <View style={{
        width: '100%', padding: 20, borderRadius: 18,
        backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
        gap: 12,
      }}>
        <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
          🔔 Create a Buyer Request
        </Text>
        <Text style={{
          fontSize: 13, fontFamily: 'Nunito_400Regular',
          color: COLORS.textSecondary, lineHeight: 18,
        }}>
          Post what you're looking for. We'll notify relevant sellers who have
          matching products so they can reach out to you directly.
        </Text>
        <TouchableOpacity
          onPress={onCreateRequest}
          activeOpacity={0.85}
          style={{
            backgroundColor: COLORS.primary, borderRadius: 14,
            paddingVertical: 14, alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
            Create Buyer Request
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuickMatchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);

  const { location } = useLocation({ autoRequest: false });
  const [query, setQuery] = useState('');
  const [parsedInput, setParsedInput] = useState<QuickMatchInput | null>(null);
  const [phase, setPhase] = useState<'input' | 'searching' | 'results' | 'no_results'>('input');
  const [results, setResults] = useState<RankedListing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const titleFade = useRef(new Animated.Value(1)).current;

  // ── Submit search
  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    const parsed = parseQuickMatchQuery(trimmed);
    setParsedInput(parsed);
    setPhase('searching');
    setError(null);

    Animated.timing(titleFade, { toValue: 0, duration: 200, useNativeDriver: true }).start();

    try {
      const lon = location.coordinates?.longitude ?? 32.5825; // Kampala default
      const lat = location.coordinates?.latitude  ?? 0.3476;
      const page = await quickMatchSearch(parsed, lon, lat);
      setResults(page.results);
      setTotalCount(page.totalCount);
      setPhase(page.results.length > 0 ? 'results' : 'no_results');
    } catch (err: any) {
      setError(err?.message ?? 'Search failed');
      setPhase('no_results');
    }
  }, [location.coordinates, titleFade]);

  const handleClear = () => {
    setQuery('');
    setPhase('input');
    setResults([]);
    setParsedInput(null);
    Animated.timing(titleFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    inputRef.current?.focus();
  };

  const handleCreateRequest = () => {
    const prefill = parsedInput ? prefillFormFromInput(parsedInput) : {};
    router.push({
      pathname: '/quick-match/request',
      params: { prefill: JSON.stringify(prefill) },
    });
  };

  const handleResultPress = (item: RankedListing) => {
    router.push({ pathname: '/listing/[id]', params: { id: item.listing_id } });
  };

  // ── Derived UI
  const hasResults = phase === 'results' && results.length > 0;
  const isSearching = phase === 'searching';
  const isNoResults = phase === 'no_results';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}>
          <Animated.View style={{ opacity: titleFade }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: COLORS.primaryMuted,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={18} color={COLORS.primary} />
              </View>
              <Text style={{
                fontSize: 24, fontFamily: 'Nunito_800ExtraBold',
                color: COLORS.text, letterSpacing: -0.5,
              }}>
                Quick Match
              </Text>
            </View>
            <Text style={{
              fontSize: 14, fontFamily: 'Nunito_400Regular',
              color: COLORS.textSecondary, lineHeight: 20,
            }}>
              Tell us what you're looking for in plain words and we'll find the best match.
            </Text>
          </Animated.View>

          {/* ── Search input ─────────────────────────────────────────────── */}
          <View style={{
            marginTop: 20,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: COLORS.surface, borderRadius: 16,
            paddingHorizontal: 16, paddingVertical: 14,
            borderWidth: 1.5,
            borderColor: phase !== 'input' ? COLORS.primary : COLORS.border,
            gap: 10,
          }}>
            <Search size={18} color={phase !== 'input' ? COLORS.primary : COLORS.textTertiary} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => handleSearch(query)}
              placeholder={'e.g. "iPhone 13 128GB under 1,500,000 near Kampala"'}
              placeholderTextColor={COLORS.textTertiary}
              returnKeyType="search"
              style={{
                flex: 1, fontSize: 14,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.text,
                minHeight: 22,
              }}
              multiline
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <X size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search button */}
          <TouchableOpacity
            onPress={() => handleSearch(query)}
            disabled={query.trim().length === 0 || isSearching}
            activeOpacity={0.85}
            style={{
              marginTop: 12,
              backgroundColor: query.trim() ? COLORS.primary : COLORS.surfaceSecondary,
              borderRadius: 14, paddingVertical: 14,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Sparkles size={16} color={query.trim() ? '#FFFFFF' : COLORS.textTertiary} />
            )}
            <Text style={{
              fontSize: 15, fontFamily: 'Nunito_700Bold',
              color: query.trim() ? '#FFFFFF' : COLORS.textTertiary,
            }}>
              {isSearching ? 'Searching…' : 'Find Matches'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Suggestions (only in input phase) ───────────────────────────── */}
        {phase === 'input' && (
          <View style={{ paddingHorizontal: 20, gap: 8 }}>
            <Text style={{
              fontSize: 13, fontFamily: 'Nunito_600SemiBold',
              color: COLORS.textSecondary, marginBottom: 4,
            }}>
              Try searching for…
            </Text>
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { setQuery(s); handleSearch(s); }}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 14, paddingVertical: 10,
                  backgroundColor: COLORS.surface, borderRadius: 12,
                  borderWidth: 1, borderColor: COLORS.border,
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                }}
              >
                <Search size={14} color={COLORS.textTertiary} />
                <Text style={{
                  flex: 1, fontSize: 13, fontFamily: 'Nunito_400Regular',
                  color: COLORS.text,
                }}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Skeleton loading ─────────────────────────────────────────────── */}
        {isSearching && (
          <View style={{ paddingHorizontal: 20, marginTop: 8, gap: 12 }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{
                height: 110, borderRadius: 16,
                backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
                overflow: 'hidden',
              }}>
                <SkeletonCard />
              </View>
            ))}
          </View>
        )}

        {/* ── Parsed query chip row ─────────────────────────────────────────── */}
        {parsedInput && (phase === 'results' || phase === 'no_results') && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 8, flexDirection: 'row' }}
            style={{ marginBottom: 4 }}
          >
            {parsedInput.maxPrice && (
              <ChipBadge icon={<DollarSign size={11} color={COLORS.primary} />}
                label={`UGX ${Number(parsedInput.maxPrice).toLocaleString()} max`} />
            )}
            {parsedInput.city && (
              <ChipBadge icon={<MapPin size={11} color={COLORS.primary} />}
                label={parsedInput.city} />
            )}
            {parsedInput.conditionPref && parsedInput.conditionPref !== 'any' && (
              <ChipBadge icon={<Tag size={11} color={COLORS.primary} />}
                label={parsedInput.conditionPref.replace('_', ' ')} />
            )}
            {parsedInput.maxDistanceKm && (
              <ChipBadge icon={<Ruler size={11} color={COLORS.primary} />}
                label={`Within ${parsedInput.maxDistanceKm} km`} />
            )}
          </ScrollView>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {hasResults && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 16,
            }}>
              <Text style={{
                fontSize: 16, fontFamily: 'Nunito_700Bold', color: COLORS.text,
              }}>
                {totalCount} Match{totalCount !== 1 ? 'es' : ''}
              </Text>
              <TouchableOpacity
                onPress={handleCreateRequest}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={{
                  fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: COLORS.primary,
                }}>
                  Post a request
                </Text>
                <ArrowRight size={13} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {results.map(item => (
              <MatchCard
                key={item.listing_id}
                item={item}
                onPress={() => handleResultPress(item)}
              />
            ))}

            {/* Request CTA below results */}
            <TouchableOpacity
              onPress={handleCreateRequest}
              activeOpacity={0.85}
              style={{
                marginTop: 8, padding: 16, borderRadius: 16,
                backgroundColor: COLORS.surfaceSecondary,
                borderWidth: 1, borderColor: COLORS.border,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: COLORS.primaryMuted,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <RefreshCw size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                  Didn't find exactly what you need?
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
                  Post a request — let sellers come to you
                </Text>
              </View>
              <ArrowRight size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── No results ─────────────────────────────────────────────────── */}
        {isNoResults && parsedInput && (
          <NoResultsState input={parsedInput} onCreateRequest={handleCreateRequest} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Tiny chip badge ─────────────────────────────────────────────────────────

function ChipBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 5,
      backgroundColor: COLORS.primaryMuted, borderRadius: 20,
      borderWidth: 1, borderColor: COLORS.primary,
    }}>
      {icon}
      <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: COLORS.primary }}>
        {label}
      </Text>
    </View>
  );
}
