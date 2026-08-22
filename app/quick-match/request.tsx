import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, FileText, CheckCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useLocation } from '@/hooks/useLocation';
import { createBuyerRequest, submitBuyerRequestV2 } from '@/services/quickmatch';
import {
  DEFAULT_FORM_DATA,
  CONDITION_OPTIONS,
  EXPIRY_OPTIONS,
  DISTANCE_OPTIONS,
} from '@/services/quickmatch.types';
import type { BuyerRequestFormData, ConditionPref } from '@/services/quickmatch.types';
import { supabase } from '@/integrations/supabase/client';


// ─── Chip selector ────────────────────────────────────────────────────────────

function ChipSelector<T extends string | number>({
  options, selected, onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, flexDirection: 'row' }}>
      {options.map(opt => {
        const active = opt.value === selected;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.8}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
              backgroundColor: active ? COLORS.primary : COLORS.surfaceSecondary,
              borderWidth: 1, borderColor: active ? COLORS.primary : COLORS.border,
            }}
          >
            <Text style={{
              fontSize: 13, fontFamily: active ? 'Nunito_700Bold' : 'Nunito_400Regular',
              color: active ? '#FFFFFF' : COLORS.text,
            }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Field label ─────────────────────────────────────────────────────────────

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 8, gap: 2 }}>
      <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
        {label}
      </Text>
      {hint && (
        <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
          {hint}
        </Text>
      )}
    </View>
  );
}

// ─── Text input wrapper ───────────────────────────────────────────────────────

function StyledInput({
  value, onChangeText, placeholder, multiline = false, keyboardType = 'default',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textTertiary}
      keyboardType={keyboardType}
      multiline={multiline}
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 14, fontFamily: 'Nunito_400Regular', color: COLORS.text,
        minHeight: multiline ? 80 : 46,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BuyerRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefill: prefillJson } = useLocalSearchParams<{ prefill?: string }>();
  const { location } = useLocation({ autoRequest: false });

  const [form, setForm] = useState<BuyerRequestFormData>(() => {
    if (prefillJson) {
      try {
        return { ...DEFAULT_FORM_DATA, ...JSON.parse(prefillJson) };
      } catch { /* ignore */ }
    }
    return DEFAULT_FORM_DATA;
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notifiedCount, setNotifiedCount] = useState(0);

  const set = <K extends keyof BuyerRequestFormData>(key: K, val: BuyerRequestFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Alert.alert('Title required', 'Please describe what you are looking for.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to post a buyer request.');
      return;
    }

    setSubmitting(true);
    try {
      const bMin = form.minPrice ? parseFloat(form.minPrice.replace(/,/g, '')) : undefined;
      const bMax = form.maxPrice ? parseFloat(form.maxPrice.replace(/,/g, '')) : undefined;

      const result = await submitBuyerRequestV2({
        buyerId: user.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
        budgetMin: bMin,
        budgetMax: bMax,
        desiredCondition: form.conditionPref,
        city: form.city.trim() || location.context?.city || undefined,
        district: location.context?.district || undefined,
        region: location.context?.region || undefined,
        latitude: location.coordinates?.latitude,
        longitude: location.coordinates?.longitude,
        radius: form.maxDistanceKm,
        expiresInDays: form.expiresInDays,
      });

      setNotifiedCount(result.notifiedCount);
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to post request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  // ── Success state
  if (submitted) {
    return (
      <View style={{
        flex: 1, backgroundColor: COLORS.background,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 32, gap: 20,
      }}>
        <View style={{
          width: 88, height: 88, borderRadius: 24,
          backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle size={44} color='#10B981' />
        </View>
        <Text style={{ fontSize: 24, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text, textAlign: 'center' }}>
          Request Posted!
        </Text>
        <Text style={{
          fontSize: 14, fontFamily: 'Nunito_400Regular',
          color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22,
        }}>
          {notifiedCount > 0
            ? `We notified ${notifiedCount} seller${notifiedCount !== 1 ? 's' : ''} who may have what you're looking for. Check your inbox for replies.`
            : 'Your request is live. Sellers can now discover and respond to it.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/(inbox)')}
            activeOpacity={0.85}
            style={{
              flex: 1, backgroundColor: COLORS.primary,
              borderRadius: 14, paddingVertical: 14, alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
              Go to Inbox
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/(explore)')}
            activeOpacity={0.85}
            style={{
              flex: 1, backgroundColor: COLORS.surfaceSecondary,
              borderRadius: 14, paddingVertical: 14, alignItems: 'center',
              borderWidth: 1, borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.text }}>
              Keep Browsing
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
            Create Buyer Request
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
            Let sellers come to you
          </Text>
        </View>
        <View style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={18} color={COLORS.primary} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── What you're looking for ── */}
        <Section title="What are you looking for?">
          <FieldLabel label="Title *" hint="Be specific — e.g. iPhone 13 128GB Black" />
          <StyledInput
            value={form.title}
            onChangeText={v => set('title', v)}
            placeholder="iPhone 13 128GB Black"
          />
          <View style={{ marginTop: 16 }}>
            <FieldLabel label="Description" hint="Add any extra details, preferred specs, etc." />
            <StyledInput
              value={form.description}
              onChangeText={v => set('description', v)}
              placeholder="Looking for one that comes with original box and accessories. Open to unlocked only."
              multiline
            />
          </View>
        </Section>

        {/* ── Budget ── */}
        <Section title="Budget">
          <FieldLabel label="Maximum Price (UGX)" />
          <StyledInput
            value={form.maxPrice}
            onChangeText={v => set('maxPrice', v)}
            placeholder="1,500,000"
            keyboardType="numeric"
          />
          <View style={{ marginTop: 12 }}>
            <FieldLabel label="Minimum Price (UGX)" hint="Optional — skip if any price is fine" />
            <StyledInput
              value={form.minPrice}
              onChangeText={v => set('minPrice', v)}
              placeholder="Optional"
              keyboardType="numeric"
            />
          </View>
        </Section>

        {/* ── Condition ── */}
        <Section title="Condition">
          <ChipSelector
            options={CONDITION_OPTIONS}
            selected={form.conditionPref}
            onSelect={v => set('conditionPref', v as ConditionPref)}
          />
        </Section>

        {/* ── Location ── */}
        <Section title="Location">
          <FieldLabel label="City / Area" hint="Where should the seller be located?" />
          <StyledInput
            value={form.city}
            onChangeText={v => set('city', v)}
            placeholder="Kampala, Ntinda, Entebbe…"
          />
          <View style={{ marginTop: 16 }}>
            <FieldLabel label="Maximum Distance" />
            <ChipSelector
              options={DISTANCE_OPTIONS}
              selected={form.maxDistanceKm}
              onSelect={v => set('maxDistanceKm', v as number)}
            />
          </View>
        </Section>

        {/* ── Expiry ── */}
        <Section title="Request Expiry">
          <FieldLabel hint="Your request will automatically close after this time." label="Keep active for" />
          <ChipSelector
            options={EXPIRY_OPTIONS}
            selected={form.expiresInDays}
            onSelect={v => set('expiresInDays', v as number)}
          />
        </Section>

        {/* ── Submit ── */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
          style={{
            backgroundColor: submitting ? COLORS.textTertiary : COLORS.primary,
            borderRadius: 16, paddingVertical: 16,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
          }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : null}
          <Text style={{ fontSize: 16, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
            {submitting ? 'Posting Request…' : 'Post Buyer Request'}
          </Text>
        </TouchableOpacity>

        <Text style={{
          fontSize: 12, fontFamily: 'Nunito_400Regular',
          color: COLORS.textTertiary, textAlign: 'center', lineHeight: 18,
        }}>
          Only sellers with matching products in your area will be notified.
          We never spam every seller on the platform.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{
        fontSize: 16, fontFamily: 'Nunito_800ExtraBold',
        color: COLORS.text, marginBottom: 12,
      }}>
        {title}
      </Text>
      {children}
    </View>
  );
}
