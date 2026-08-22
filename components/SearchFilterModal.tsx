import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, Filter, Star, DollarSign, Sparkles } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { CATEGORIES } from '@/utils/mockData';
import type { RadiusPreset } from '@/services/location.types';

export interface FilterState {
  category: string;
  minPrice: string;
  maxPrice: string;
  condition: string;
  radius: RadiusPreset;
  availability: 'all' | 'active' | 'reserved';
  minRating: number;
}

interface SearchFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (newFilters: FilterState) => void;
  onResetFilters: () => void;
}

const CONDITIONS = [
  { id: 'all', label: 'All Conditions' },
  { id: 'NEW', label: 'Brand New' },
  { id: 'LIKE_NEW', label: 'Like New' },
  { id: 'GOOD', label: 'Good' },
  { id: 'FAIR', label: 'Fair' },
];

const AVAILABILITY_OPTIONS = [
  { id: 'all', label: 'All Items' },
  { id: 'active', label: 'Available Now' },
  { id: 'reserved', label: 'Reserved Items' },
];

const RATING_OPTIONS = [
  { value: 0, label: 'Any Rating' },
  { value: 4.0, label: '4.0+ Stars ★' },
  { value: 4.5, label: '4.5+ Stars ★' },
];

export function SearchFilterModal({
  visible,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
}: SearchFilterModalProps) {
  const insets = useSafeAreaInsets();
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const defaultState: FilterState = {
      category: 'All',
      minPrice: '',
      maxPrice: '',
      condition: 'all',
      radius: 'near_me',
      availability: 'all',
      minRating: 0,
    };
    setLocalFilters(defaultState);
    onResetFilters();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{
            backgroundColor: COLORS.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85%',
            paddingTop: 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          {/* Header handle */}
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: COLORS.border,
              alignSelf: 'center',
              marginBottom: 12,
            }}
          />

          {/* Title Bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Filter size={20} color={COLORS.primary} />
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Nunito_800ExtraBold',
                  color: COLORS.text,
                }}
              >
                Search Filters
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: COLORS.surfaceSecondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Price Range */}
            <View>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                  marginBottom: 10,
                }}
              >
                Price Range ($)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <DollarSign size={16} color={COLORS.textTertiary} />
                  <TextInput
                    value={localFilters.minPrice}
                    onChangeText={val => setLocalFilters({ ...localFilters, minPrice: val })}
                    placeholder="Min"
                    placeholderTextColor={COLORS.textTertiary}
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      marginLeft: 4,
                      fontSize: 14,
                      fontFamily: 'Nunito_600SemiBold',
                      color: COLORS.text,
                    }}
                  />
                </View>
                <Text style={{ fontSize: 14, color: COLORS.textTertiary }}>to</Text>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <DollarSign size={16} color={COLORS.textTertiary} />
                  <TextInput
                    value={localFilters.maxPrice}
                    onChangeText={val => setLocalFilters({ ...localFilters, maxPrice: val })}
                    placeholder="Max"
                    placeholderTextColor={COLORS.textTertiary}
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      marginLeft: 4,
                      fontSize: 14,
                      fontFamily: 'Nunito_600SemiBold',
                      color: COLORS.text,
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Condition */}
            <View>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                  marginBottom: 10,
                }}
              >
                Item Condition
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CONDITIONS.map(cond => {
                  const isSelected = localFilters.condition === cond.id;
                  return (
                    <TouchableOpacity
                      key={cond.id}
                      onPress={() => setLocalFilters({ ...localFilters, condition: cond.id })}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.primary : COLORS.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                          color: isSelected ? COLORS.primary : COLORS.textSecondary,
                        }}
                      >
                        {cond.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Seller Rating Filter */}
            <View>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                  marginBottom: 10,
                }}
              >
                Minimum Seller Rating
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {RATING_OPTIONS.map(opt => {
                  const isSelected = localFilters.minRating === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setLocalFilters({ ...localFilters, minRating: opt.value })}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.primary : COLORS.border,
                        flexDirection: 'row',
                        gap: 4,
                      }}
                    >
                      {opt.value > 0 && <Star size={14} color="#F59E0B" fill="#F59E0B" />}
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                          color: isSelected ? COLORS.primary : COLORS.text,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Availability */}
            <View>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                  marginBottom: 10,
                }}
              >
                Availability Status
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {AVAILABILITY_OPTIONS.map(avail => {
                  const isSelected = localFilters.availability === avail.id;
                  return (
                    <TouchableOpacity
                      key={avail.id}
                      onPress={() =>
                        setLocalFilters({
                          ...localFilters,
                          availability: avail.id as 'all' | 'active' | 'reserved',
                        })
                      }
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.primary : COLORS.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                          color: isSelected ? COLORS.primary : COLORS.textSecondary,
                        }}
                      >
                        {avail.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingTop: 12,
              gap: 12,
              borderTopWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <TouchableOpacity
              onPress={handleReset}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: COLORS.surfaceSecondary,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: COLORS.textSecondary }}>
                Reset All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              style={{
                flex: 2,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
