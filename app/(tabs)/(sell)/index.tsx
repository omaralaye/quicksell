import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, MapPin, Check, ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { CATEGORIES, CONDITIONS } from '@/utils/mockData';
import { createListing } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { CategoryChip } from '@/components/CategoryChip';

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [location] = useState('Brooklyn, NY');
  const [success, setSuccess] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const sellCategories = CATEGORIES.filter((c) => c !== 'All');

  useEffect(() => {
    if (!success) return;

    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 12,
        speed: 8,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(successScale, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setSuccess(false);
        setTitle('');
        setDescription('');
        setPrice('');
        setSelectedCategory('');
        setSelectedCondition('');
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, successScale, successOpacity]);

  const handleListItem = async () => {
    console.log('[Sell] List Item pressed:', { title, price, selectedCategory, selectedCondition, description, location });
    if (!user) {
      Alert.alert('Error', 'You must be signed in to list an item.');
      return;
    }
    try {
      await createListing({
        sellerId: user.id,
        title,
        description,
        price: parseFloat(price),
        category: selectedCategory,
        condition: selectedCondition,
        region: location,
      });
      console.log('[Sell] Listing created successfully');
      setSuccess(true);
    } catch (err) {
      console.error('[Sell] createListing error:', err);
      Alert.alert('Error', 'Failed to create listing. Please try again.');
    }
  };

  const handleCategorySelect = (cat: string) => {
    console.log('[Sell] Category selected:', cat);
    setSelectedCategory(cat);
  };

  const handleConditionSelect = (cond: string) => {
    console.log('[Sell] Condition selected:', cond);
    setSelectedCondition(cond);
  };

  const handlePhotoPress = () => {
    console.log('[Sell] Photo picker pressed');
  };

  const isValid = title.trim() !== '' && price.trim() !== '' && selectedCategory !== '' && selectedCondition !== '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              fontFamily: 'Nunito_800ExtraBold',
              color: COLORS.text,
              letterSpacing: -0.5,
            }}
          >
            List an Item
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Nunito_400Regular',
              color: COLORS.textSecondary,
              marginTop: 4,
            }}
          >
            Sell to people in your neighborhood
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 20 }}>
          {/* Photo picker */}
          <AnimatedPressable onPress={handlePhotoPress}>
            <View
              style={{
                borderWidth: 2,
                borderColor: COLORS.border,
                borderStyle: 'dashed',
                borderRadius: 16,
                padding: 32,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.surface,
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Camera size={26} color={COLORS.primary} />
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  fontFamily: 'Nunito_600SemiBold',
                  color: COLORS.text,
                }}
              >
                Add Photos
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.textTertiary,
                }}
              >
                Add up to 5 photos
              </Text>
            </View>
          </AnimatedPressable>

          {/* Title */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.text,
              }}
            >
              Title <Text style={{ color: COLORS.danger }}>*</Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={(t) => {
                console.log('[Sell] Title changed:', t);
                setTitle(t);
              }}
              placeholder="e.g. Vintage Leather Sofa"
              placeholderTextColor={COLORS.textTertiary}
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                fontSize: 15,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.text,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            />
          </View>

          {/* Category */}
          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.text,
              }}
            >
              Category <Text style={{ color: COLORS.danger }}>*</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {sellCategories.map((cat) => (
                <CategoryChip
                  key={cat}
                  label={cat}
                  selected={selectedCategory === cat}
                  onPress={() => handleCategorySelect(cat)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Condition */}
          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.text,
              }}
            >
              Condition <Text style={{ color: COLORS.danger }}>*</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CONDITIONS.map((cond) => {
                const isSelected = selectedCondition === cond;
                return (
                  <AnimatedPressable
                    key={cond}
                    onPress={() => handleConditionSelect(cond)}
                    style={{
                      backgroundColor: isSelected ? COLORS.primary : COLORS.surface,
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderWidth: 1,
                      borderColor: isSelected ? COLORS.primary : COLORS.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        fontFamily: 'Nunito_600SemiBold',
                        color: isSelected ? '#FFFFFF' : COLORS.textSecondary,
                      }}
                    >
                      {cond}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          {/* Price */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.text,
              }}
            >
              Price <Text style={{ color: COLORS.danger }}>*</Text>
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.primary,
                  marginRight: 4,
                }}
              >
                $
              </Text>
              <TextInput
                value={price}
                onChangeText={(t) => {
                  console.log('[Sell] Price changed:', t);
                  setPrice(t);
                }}
                placeholder="0"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="numeric"
                style={{
                  flex: 1,
                  fontSize: 18,
                  fontWeight: '700',
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.text,
                  paddingVertical: 13,
                }}
              />
            </View>
          </View>

          {/* Description */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.text,
              }}
            >
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={(t) => {
                console.log('[Sell] Description changed');
                setDescription(t);
              }}
              placeholder="Describe your item — condition details, what's included, etc."
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                fontSize: 15,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.text,
                borderWidth: 1,
                borderColor: COLORS.border,
                minHeight: 100,
              }}
            />
          </View>

          {/* Location */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'Nunito_600SemiBold',
                color: COLORS.text,
              }}
            >
              Location
            </Text>
            <AnimatedPressable
              onPress={() => console.log('[Sell] Location edit pressed')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 10,
              }}
            >
              <MapPin size={18} color={COLORS.primary} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontFamily: 'Nunito_600SemiBold',
                  color: COLORS.text,
                }}
              >
                {location}
              </Text>
              <ChevronRight size={16} color={COLORS.textTertiary} />
            </AnimatedPressable>
          </View>

          {/* Submit button */}
          <AnimatedPressable
            onPress={handleListItem}
            disabled={!isValid}
            style={{
              backgroundColor: isValid ? COLORS.primary : COLORS.surfaceSecondary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                fontFamily: 'Nunito_700Bold',
                color: isValid ? '#FFFFFF' : COLORS.textTertiary,
              }}
            >
              List Item
            </Text>
          </AnimatedPressable>
        </View>
      </ScrollView>

      {/* Success overlay */}
      {success && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(247, 245, 242, 0.95)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View
            style={{
              opacity: successOpacity,
              transform: [{ scale: successScale }],
              alignItems: 'center',
              gap: 16,
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: COLORS.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={40} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                fontFamily: 'Nunito_800ExtraBold',
                color: COLORS.text,
                letterSpacing: -0.3,
              }}
            >
              Your item is listed!
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Nunito_400Regular',
                color: COLORS.textSecondary,
              }}
            >
              Buyers nearby will see it soon
            </Text>
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
