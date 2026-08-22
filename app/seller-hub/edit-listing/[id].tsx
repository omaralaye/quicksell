// ============================================================
// Seller Hub — Quick-Edit Listing Sheet
// A modal bottom sheet for fast edits: price, title, status
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { supabase } from '@/integrations/supabase/client';

type ListingStatus = 'ACTIVE' | 'SOLD' | 'ARCHIVED';

const STATUS_OPTIONS: { key: ListingStatus; label: string; color: string; bg: string }[] = [
  { key: 'ACTIVE', label: 'Active', color: COLORS.accent, bg: 'rgba(45,155,111,0.12)' },
  { key: 'SOLD', label: 'Sold', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { key: 'ARCHIVED', label: 'Archived', color: COLORS.textSecondary, bg: COLORS.surfaceSecondary },
];

export default function EditListingSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ListingStatus>('ACTIVE');

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Load listing
    (async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('listings')
          .select('id, title, price, description, status')
          .eq('id', id)
          .single();
        if (error) throw error;
        setTitle(data.title ?? '');
        setPrice(String(data.price ?? ''));
        setDescription(data.description ?? '');
        setStatus((data.status as ListingStatus) ?? 'ACTIVE');
      } catch (err) {
        console.error('[EditListingSheet] load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => router.back());
  };

  const handleSave = async () => {
    if (!id) return;
    const numericPrice = parseFloat(price.replace(/,/g, ''));
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title for this listing.');
      return;
    }
    if (isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ title: title.trim(), price: numericPrice, description: description.trim(), status })
        .eq('id', id);
      if (error) throw error;
      dismiss();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ justifyContent: 'flex-end', flex: 1 }}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 24,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Edit Listing</Text>
              <Text style={styles.headerSub}>Quick edits — price, title, and status</Text>
            </View>
            <TouchableOpacity onPress={dismiss} hitSlop={10} activeOpacity={0.7}>
              <X size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <View style={styles.form}>
              {/* Title */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Listing title"
                  placeholderTextColor={COLORS.textTertiary}
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              {/* Price */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Price (UGX)</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="e.g. 250000"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="numeric"
                  style={[styles.input, styles.priceInput]}
                  returnKeyType="next"
                />
              </View>

              {/* Description */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Description (optional)</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Brief description…"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  style={[styles.input, styles.textArea]}
                />
              </View>

              {/* Status */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((opt) => {
                    const active = status === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setStatus(opt.key)}
                        activeOpacity={0.8}
                        style={[
                          styles.statusChip,
                          { borderColor: active ? opt.color : COLORS.border },
                          active && { backgroundColor: opt.bg },
                        ]}
                      >
                        {active && <CheckCircle size={12} color={opt.color} />}
                        <Text style={[styles.statusText, { color: active ? opt.color : COLORS.textSecondary }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Save button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.88}
                style={[styles.saveButton, saving && { opacity: 0.7 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.text,
  },
  priceInput: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.primary,
    fontSize: 17,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.textSecondary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    color: '#FFFFFF',
  },
});
