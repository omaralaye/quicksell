// ============================================================
// Concurrency & Reservation Test Verification Tool
// Demonstrates PostgreSQL FOR UPDATE row locking preventing double sales
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ShieldCheck, Zap, CheckCircle2, XCircle, AlertCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { testSimultaneousReservations, releaseExpiredReservations } from '@/services/inventory';
import type { ConcurrencyTestResult } from '@/services/inventory.types';
import { supabase } from '@/integrations/supabase/client';

export default function ConcurrencyTestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [listingId, setListingId] = useState('');
  const [buyer1Id, setBuyer1Id] = useState('');
  const [buyer2Id, setBuyer2Id] = useState('');
  const [testing, setTesting] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [result, setResult] = useState<ConcurrencyTestResult | null>(null);
  const [releasedCount, setReleasedCount] = useState<number | null>(null);

  const handleRunTest = async () => {
    if (!listingId.trim()) {
      Alert.alert('Listing ID Required', 'Please enter a valid listing UUID to test concurrency.');
      return;
    }

    // Default buyer IDs if blank (fetches current user id or uses generated UUIDs)
    let b1 = buyer1Id.trim();
    let b2 = buyer2Id.trim();

    if (!b1 || !b2) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (!b1) b1 = user.id;
        if (!b2) b2 = '00000000-0000-0000-0000-000000000002';
      } else {
        b1 = '00000000-0000-0000-0000-000000000001';
        b2 = '00000000-0000-0000-0000-000000000002';
      }
    }

    setTesting(true);
    setResult(null);
    try {
      const res = await testSimultaneousReservations(b1, b2, listingId.trim());
      setResult(res);
    } catch (err: any) {
      Alert.alert('Test Execution Error', err?.message ?? 'Failed to execute concurrency test.');
    } finally {
      setTesting(false);
    }
  };

  const handleSweepExpired = async () => {
    setReleasing(true);
    try {
      const count = await releaseExpiredReservations();
      setReleasedCount(count);
      Alert.alert('Sweep Complete', `Released ${count} expired order reservation(s).`);
    } catch (err: any) {
      Alert.alert('Sweep Error', err?.message ?? 'Failed to sweep expired reservations.');
    } finally {
      setReleasing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20,
        backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
            Concurrency Verification
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
            Atomic Row-Locking & Double-Sale Prevention
          </Text>
        </View>
        <ShieldCheck size={24} color={COLORS.primary} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        {/* Info Banner */}
        <View style={{
          padding: 16, borderRadius: 16, backgroundColor: COLORS.primaryMuted,
          borderWidth: 1, borderColor: COLORS.primary, gap: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color={COLORS.primary} />
            <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: COLORS.primary }}>
              Simultaneous Reservation Guarantee
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.text, lineHeight: 19 }}>
            This tool executes two concurrent server-side reservations on a single-quantity product using PostgreSQL <Text style={{ fontFamily: 'Nunito_700Bold' }}>FOR UPDATE row-level locking</Text>.
            The database will grant exactly ONE reservation and reject the second.
          </Text>
        </View>

        {/* Input Form */}
        <View style={{
          backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: COLORS.border, gap: 14,
        }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
              Target Listing UUID *
            </Text>
            <TextInput
              value={listingId}
              onChangeText={setListingId}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              placeholderTextColor={COLORS.textTertiary}
              style={{
                backgroundColor: COLORS.surfaceSecondary, borderRadius: 10,
                borderWidth: 1, borderColor: COLORS.border, padding: 12,
                fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.text,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
              Buyer 1 UUID (Optional)
            </Text>
            <TextInput
              value={buyer1Id}
              onChangeText={setBuyer1Id}
              placeholder="Auto-detects active user"
              placeholderTextColor={COLORS.textTertiary}
              style={{
                backgroundColor: COLORS.surfaceSecondary, borderRadius: 10,
                borderWidth: 1, borderColor: COLORS.border, padding: 12,
                fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.text,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
              Buyer 2 UUID (Simulated Rival)
            </Text>
            <TextInput
              value={buyer2Id}
              onChangeText={setBuyer2Id}
              placeholder="Auto-generates test UUID"
              placeholderTextColor={COLORS.textTertiary}
              style={{
                backgroundColor: COLORS.surfaceSecondary, borderRadius: 10,
                borderWidth: 1, borderColor: COLORS.border, padding: 12,
                fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.text,
              }}
            />
          </View>

          <TouchableOpacity
            onPress={handleRunTest}
            disabled={testing}
            activeOpacity={0.85}
            style={{
              backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14,
              alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
              marginTop: 6,
            }}
          >
            {testing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Zap size={18} color="#FFFFFF" />}
            <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
              {testing ? 'Simulating Race Condition…' : 'Run Concurrency Test'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sweep Expired Reservations Button */}
        <TouchableOpacity
          onPress={handleSweepExpired}
          disabled={releasing}
          activeOpacity={0.85}
          style={{
            backgroundColor: COLORS.surfaceSecondary, borderRadius: 14, paddingVertical: 14,
            alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
            flexDirection: 'row', gap: 8,
          }}
        >
          {releasing ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
          <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
            Sweep Expired Reservations
          </Text>
        </TouchableOpacity>

        {/* Test Output Results */}
        {result && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
              Concurrency Results:
            </Text>

            {/* Buyer 1 Result Card */}
            <View style={{
              backgroundColor: result.buyer1_success ? '#D1FAE5' : '#FEE2E2',
              borderRadius: 14, padding: 16, borderWidth: 1,
              borderColor: result.buyer1_success ? '#10B981' : '#EF4444', gap: 6,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                  Attempt 1 (Buyer 1)
                </Text>
                {result.buyer1_success ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={16} color='#10B981' />
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_800ExtraBold', color: '#065F46' }}>RESERVED</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <XCircle size={16} color='#EF4444' />
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_800ExtraBold', color: '#991B1B' }}>REJECTED</Text>
                  </View>
                )}
              </View>
              {result.buyer1_error && (
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#991B1B' }}>
                  Error: {result.buyer1_error}
                </Text>
              )}
            </View>

            {/* Buyer 2 Result Card */}
            <View style={{
              backgroundColor: result.buyer2_success ? '#D1FAE5' : '#FEE2E2',
              borderRadius: 14, padding: 16, borderWidth: 1,
              borderColor: result.buyer2_success ? '#10B981' : '#EF4444', gap: 6,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
                  Attempt 2 (Buyer 2 - Race Condition Rival)
                </Text>
                {result.buyer2_success ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={16} color='#10B981' />
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_800ExtraBold', color: '#065F46' }}>RESERVED</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <XCircle size={16} color='#EF4444' />
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_800ExtraBold', color: '#991B1B' }}>REJECTED</Text>
                  </View>
                )}
              </View>
              {result.buyer2_error && (
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#991B1B' }}>
                  Reason: {result.buyer2_error}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
