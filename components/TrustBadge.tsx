import React from 'react';
import { View, Text } from 'react-native';
import { Star, ShieldCheck, CheckCircle, TrendingUp, Award } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import type { UserReputationMetrics } from '@/services/reputation';

interface TrustBadgeProps {
  metrics: Partial<UserReputationMetrics>;
  showDetails?: boolean;
  compact?: boolean;
}

export function TrustBadge({ metrics, showDetails = true, compact = false }: TrustBadgeProps) {
  const rating = metrics.seller_rating ?? metrics.overall_rating ?? 0;
  const ratingCount = metrics.seller_rating_count ?? 0;
  const completedSales = metrics.completed_sales ?? 0;
  const completedPurchases = metrics.completed_purchases ?? 0;
  const cancellationRate = metrics.cancellation_rate ?? 0;
  const verifStatus = metrics.verification_status ?? 'unverified';
  const trustScore = metrics.seller_trust_score ?? 50;

  // True Verified Status calculations based strictly on database values
  const isPhoneVerified = verifStatus === 'phone_verified' || verifStatus === 'fully_verified';
  const isIdVerified = verifStatus === 'id_verified' || verifStatus === 'fully_verified';
  const isReliableSeller = trustScore >= 80 && completedSales >= 5 && cancellationRate <= 5.0;

  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Star size={14} color={COLORS.warning} fill={COLORS.warning} />
          <Text style={{ fontSize: 13, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
            {rating > 0 ? rating.toFixed(1) : 'New'}
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: COLORS.textTertiary }}>
          ({completedSales} sales)
        </Text>
        {isReliableSeller && (
          <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Nunito_800ExtraBold', color: '#059669' }}>
              ✓ Reliable
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {/* Primary Rating & Sales Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Star size={16} color={COLORS.warning} fill={COLORS.warning} />
          <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: COLORS.text }}>
            {rating > 0 ? rating.toFixed(1) : 'New User'}
          </Text>
          {ratingCount > 0 && (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito_400Regular', color: COLORS.textSecondary }}>
              ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})
            </Text>
          )}
        </View>

        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.textTertiary }} />

        <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>
          {completedSales} sales completed
        </Text>
      </View>

      {/* Verified Status Pills & Badges */}
      {showDetails && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Phone Verified Pill */}
          {isPhoneVerified && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#EFF6FF',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#BFDBFE',
              }}
            >
              <CheckCircle size={12} color="#2563EB" />
              <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#1E40AF' }}>
                Phone Verified
              </Text>
            </View>
          )}

          {/* ID Verified Pill */}
          {isIdVerified && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#F0FDF4',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#BBF7D0',
              }}
            >
              <ShieldCheck size={12} color="#16A34A" />
              <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#166534' }}>
                ID Verified
              </Text>
            </View>
          )}

          {/* Reliable Seller Badge */}
          {isReliableSeller && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#FEF3C7',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#FDE68A',
              }}
            >
              <Award size={12} color="#D97706" />
              <Text style={{ fontSize: 11, fontFamily: 'Nunito_800ExtraBold', color: '#92400E' }}>
                Reliable Seller
              </Text>
            </View>
          )}

          {/* Buyer Rep indicator if user has completed purchases */}
          {completedPurchases > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: COLORS.surfaceSecondary,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Nunito_600SemiBold', color: COLORS.textSecondary }}>
                {completedPurchases} purchases
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
