import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ImageSourcePropType,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut, Pencil, MapPin, Package, ShoppingBag, Star, Store } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  region: string | null;
  rating: number | null;
  total_listings: number | null;
  total_sales: number | null;
};

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.trim()[0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return '?';
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    console.log('[Profile] Fetching profile for user:', user.id);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          console.error('[Profile] fetchProfile error:', error.message);
        } else {
          const profileData = data as Profile | null;
          console.log('[Profile] Profile loaded:', profileData?.display_name);
          setProfile(profileData);
        }
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [user]);

  const handleSignOut = () => {
    console.log('[Profile] Sign out pressed');
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          console.log('[Profile] Confirming sign out');
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleMyListings = () => {
    console.log('[Profile] My Listings pressed');
    router.push('/my-listings');
  };

  const handleEditProfile = () => {
    console.log('[Profile] Edit Profile pressed');
    setEditName(profile?.display_name ?? '');
    setEditRegion(profile?.region ?? '');
    setEditVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    console.log('[Profile] Saving profile:', { editName, editRegion });
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: editName, region: editRegion });

    if (error) {
      console.error('[Profile] Save profile error:', error.message);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } else {
      console.log('[Profile] Profile saved successfully');
      setProfile((prev) =>
        prev
          ? { ...prev, display_name: editName, region: editRegion }
          : { id: user.id, display_name: editName, avatar_url: null, region: editRegion, rating: null, total_listings: null, total_sales: null }
      );
      setEditVisible(false);
    }
    setSaving(false);
  };

  const displayName = profile?.display_name ?? user?.user_metadata?.full_name ?? null;
  const email = user?.email ?? '';
  const initials = getInitials(displayName, email);
  const region = profile?.region ?? null;
  const rating = profile?.rating ?? null;
  const totalListings = profile?.total_listings ?? 0;
  const totalSales = profile?.total_sales ?? 0;
  const ratingDisplay = rating !== null ? Number(rating).toFixed(1) : '—';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
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
            Profile
          </Text>
        </View>

        {profileLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <>
            {/* Avatar + name card */}
            <View
              style={{
                marginHorizontal: 16,
                backgroundColor: COLORS.surface,
                borderRadius: 20,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 10,
              }}
            >
              {/* Avatar */}
              {profile?.avatar_url ? (
                <Image
                  source={resolveImageSource(profile.avatar_url)}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: COLORS.surfaceSecondary,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: COLORS.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 28,
                      fontFamily: 'Nunito_800ExtraBold',
                      color: COLORS.primary,
                    }}
                  >
                    {initials}
                  </Text>
                </View>
              )}

              {/* Name */}
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Nunito_800ExtraBold',
                  color: COLORS.text,
                  letterSpacing: -0.3,
                }}
              >
                {displayName ?? 'New User'}
              </Text>

              {/* Email */}
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Nunito_400Regular',
                  color: COLORS.textSecondary,
                }}
              >
                {email}
              </Text>

              {/* Region chip */}
              {region !== null && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    gap: 5,
                  }}
                >
                  <MapPin size={13} color={COLORS.textSecondary} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Nunito_600SemiBold',
                      color: COLORS.textSecondary,
                    }}
                  >
                    {region}
                  </Text>
                </View>
              )}
            </View>

            {/* Stats row */}
            <View
              style={{
                flexDirection: 'row',
                marginHorizontal: 16,
                marginTop: 14,
                gap: 10,
              }}
            >
              <StatCard icon={<Package size={18} color={COLORS.primary} />} value={String(totalListings)} label="Listings" />
              <StatCard icon={<ShoppingBag size={18} color={COLORS.accent} />} value={String(totalSales)} label="Sales" />
              <StatCard icon={<Star size={18} color="#D97706" />} value={ratingDisplay} label="Rating" />
            </View>

            {/* Seller Hub CTA */}
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Seller Hub pressed');
                router.push('/seller-hub' as any);
              }}
              style={{
                marginHorizontal: 16,
                marginTop: 20,
                backgroundColor: COLORS.primary,
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Store size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Nunito_800ExtraBold',
                    color: '#FFFFFF',
                    letterSpacing: -0.2,
                  }}
                >
                  Seller Hub
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Nunito_400Regular',
                    color: 'rgba(255,255,255,0.75)',
                    marginTop: 1,
                  }}
                >
                  Manage listings, orders & earnings
                </Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
            </AnimatedPressable>

            {/* Actions */}
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 12,
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                overflow: 'hidden',
              }}
            >
              <ActionRow
                label="My Listings"
                icon={<Package size={18} color={COLORS.primary} />}
                onPress={handleMyListings}
                showDivider
              />
              <ActionRow
                label="Edit Profile"
                icon={<Pencil size={18} color={COLORS.textSecondary} />}
                onPress={handleEditProfile}
              />
            </View>

            {/* Sign out */}
            <TouchableOpacity
              onPress={handleSignOut}
              activeOpacity={0.8}
              style={{
                marginHorizontal: 16,
                marginTop: 16,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: COLORS.danger,
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <LogOut size={18} color={COLORS.danger} />
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Nunito_700Bold',
                  color: COLORS.danger,
                }}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: insets.bottom + 24,
              gap: 16,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Nunito_800ExtraBold',
                color: COLORS.text,
                letterSpacing: -0.3,
              }}
            >
              Edit Profile
            </Text>

            <View style={{ gap: 12 }}>
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                    color: COLORS.textSecondary,
                  }}
                >
                  Display Name
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={(t) => {
                    console.log('[Profile] Edit name changed');
                    setEditName(t);
                  }}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.textTertiary}
                  style={{
                    backgroundColor: COLORS.surfaceSecondary,
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

              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Nunito_600SemiBold',
                    color: COLORS.textSecondary,
                  }}
                >
                  Region
                </Text>
                <TextInput
                  value={editRegion}
                  onChangeText={(t) => {
                    console.log('[Profile] Edit region changed');
                    setEditRegion(t);
                  }}
                  placeholder="e.g. Brooklyn, NY"
                  placeholderTextColor={COLORS.textTertiary}
                  style={{
                    backgroundColor: COLORS.surfaceSecondary,
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
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  console.log('[Profile] Edit cancelled');
                  setEditVisible(false);
                }}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  height: 50,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: 'Nunito_600SemiBold',
                    color: COLORS.textSecondary,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={saving}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  height: 50,
                  borderRadius: 12,
                  backgroundColor: COLORS.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Nunito_700Bold',
                      color: '#FFFFFF',
                    }}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 18,
          fontFamily: 'Nunito_800ExtraBold',
          color: COLORS.text,
          letterSpacing: -0.3,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Nunito_400Regular',
          color: COLORS.textSecondary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ActionRow({
  label,
  icon,
  onPress,
  showDivider,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  showDivider?: boolean;
}) {
  return (
    <>
      <AnimatedPressable onPress={onPress}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 16,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              fontFamily: 'Nunito_600SemiBold',
              color: COLORS.text,
            }}
          >
            {label}
          </Text>
          <ChevronRight size={18} color={COLORS.textTertiary} />
        </View>
      </AnimatedPressable>
      {showDivider && (
        <View
          style={{
            height: 1,
            backgroundColor: COLORS.divider,
            marginHorizontal: 16,
          }}
        />
      )}
    </>
  );
}
