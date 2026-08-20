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
  Image,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, MapPin, Check, ChevronRight, X, Plus, Navigation, Search, Sparkles } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '@/constants/Colors';
import { CATEGORIES, CONDITIONS } from '@/utils/mockData';
import { createListing } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { CategoryChip } from '@/components/CategoryChip';

const POPULAR_LOCATIONS = [
  'Brooklyn, NY',
  'Manhattan, NY',
  'Queens, NY',
  'Williamsburg, Brooklyn',
  'Park Slope, Brooklyn',
  'Austin, TX',
  'San Francisco, CA',
  'Los Angeles, CA',
];

const DEMO_PRESET_IMAGES = [
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?q=80&w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1580481072645-022f9a6d1270?q=80&w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=1000&auto=format&fit=crop',
];

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState('Brooklyn, NY');
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [customLocationInput, setCustomLocationInput] = useState('');
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
        setPhotos([]);
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, successScale, successOpacity]);

  // Image Picker Logic
  const handlePickPhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert('Photo Limit Reached', 'You can upload up to 5 photos per listing.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Access',
          'Would you like to add a sample product photo for this demo?',
          [
            {
              text: 'Add Sample Photo',
              onPress: () => {
                const nextDemo = DEMO_PRESET_IMAGES[photos.length % DEMO_PRESET_IMAGES.length];
                setPhotos((prev) => [...prev, nextDemo]);
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5 - photos.length,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris = result.assets.map((asset) => asset.uri);
        setPhotos((prev) => [...prev, ...newUris].slice(0, 5));
      }
    } catch (err) {
      console.error('[Sell] Photo picker error:', err);
      const nextDemo = DEMO_PRESET_IMAGES[photos.length % DEMO_PRESET_IMAGES.length];
      setPhotos((prev) => [...prev, nextDemo]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    console.log('[Sell] Removing photo at index:', index);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddDemoPhoto = () => {
    if (photos.length >= 5) return;
    const nextDemo = DEMO_PRESET_IMAGES[photos.length % DEMO_PRESET_IMAGES.length];
    setPhotos((prev) => [...prev, nextDemo]);
  };

  // Location logic
  const handleOpenLocationModal = () => {
    setCustomLocationInput(location);
    setLocationModalVisible(true);
  };

  const handleSelectLocation = (loc: string) => {
    console.log('[Sell] Selected location:', loc);
    setLocation(loc);
    setLocationModalVisible(false);
  };

  const handleApplyCustomLocation = () => {
    if (customLocationInput.trim()) {
      setLocation(customLocationInput.trim());
      setLocationModalVisible(false);
    }
  };

  const handleListItem = async () => {
    console.log('[Sell] List Item pressed:', { title, price, selectedCategory, selectedCondition, description, location, photosCount: photos.length });
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
        imageUrl: photos.length > 0 ? photos[0] : DEMO_PRESET_IMAGES[0],
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
          {/* Photo Picker Section */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  fontFamily: 'Nunito_600SemiBold',
                  color: COLORS.text,
                }}
              >
                Photos ({photos.length}/5)
              </Text>
              {photos.length < 5 && (
                <TouchableOpacity onPress={handleAddDemoPhoto} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={13} color={COLORS.primary} />
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: COLORS.primary }}>
                    Add Sample
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {photos.length === 0 ? (
              <AnimatedPressable onPress={handlePickPhoto}>
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
                    Select photos from library or camera
                  </Text>
                </View>
              </AnimatedPressable>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {photos.map((uri, index) => (
                  <View
                    key={index}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 14,
                      overflow: 'hidden',
                      position: 'relative',
                      backgroundColor: COLORS.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {index === 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 6,
                          left: 6,
                          backgroundColor: COLORS.primary,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>Cover</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(index)}
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}

                {photos.length < 5 && (
                  <TouchableOpacity
                    onPress={handlePickPhoto}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: COLORS.border,
                      borderStyle: 'dashed',
                      backgroundColor: COLORS.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={24} color={COLORS.primary} />
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: COLORS.primary }}>Add More</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>

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
              onPress={handleOpenLocationModal}
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

      {/* Location Selector Modal */}
      <Modal
        visible={locationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setLocationModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 20,
              maxHeight: '80%',
            }}
          >
            {/* Sheet Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: COLORS.border,
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />

            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={22} color={COLORS.primary} />
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: 'Nunito_800ExtraBold',
                    color: COLORS.text,
                  }}
                >
                  Select Location
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setLocationModalVisible(false)}
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

            {/* Custom location input */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Search size={18} color={COLORS.textTertiary} />
              <TextInput
                value={customLocationInput}
                onChangeText={setCustomLocationInput}
                placeholder="Enter city, neighborhood or zip code..."
                placeholderTextColor={COLORS.textTertiary}
                onSubmitEditing={handleApplyCustomLocation}
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.text,
                }}
              />
              {customLocationInput.trim().length > 0 && (
                <TouchableOpacity
                  onPress={handleApplyCustomLocation}
                  style={{
                    backgroundColor: COLORS.primary,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>Save</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Current Location Option */}
            <TouchableOpacity
              onPress={() => handleSelectLocation('Current Location (Brooklyn, NY)')}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderRadius: 12,
                backgroundColor: COLORS.primaryMuted,
                gap: 12,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: COLORS.primary,
              }}
            >
              <Navigation size={18} color={COLORS.primary} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.primary,
                }}
              >
                Use Current GPS Location
              </Text>
              <ChevronRight size={16} color={COLORS.primary} />
            </TouchableOpacity>

            {/* Popular Locations */}
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Nunito_700Bold',
                color: COLORS.textSecondary,
                marginBottom: 10,
              }}
            >
              Popular Nearby Locations
            </Text>

            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {POPULAR_LOCATIONS.map((loc) => {
                  const isSelected = location === loc;
                  return (
                    <TouchableOpacity
                      key={loc}
                      onPress={() => handleSelectLocation(loc)}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.primary : 'transparent',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <MapPin size={16} color={isSelected ? COLORS.primary : COLORS.textSecondary} />
                        <Text
                          style={{
                            fontSize: 15,
                            fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                            color: isSelected ? COLORS.primary : COLORS.text,
                          }}
                        >
                          {loc}
                        </Text>
                      </View>
                      {isSelected && <Check size={18} color={COLORS.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
