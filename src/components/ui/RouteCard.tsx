import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { colors } from "../../shared/theme/colors";

export type RouteType = "highway" | "general";

export interface TollBreakdownItem {
  label: string;
  amount: string;
}

export interface RouteCardProps {
  type: RouteType;
  title?: string;
  badgeLabel?: string;
  durationText?: string;
  durationMinutes?: number;
  etaText?: string;
  tollText?: string;
  tollYen?: number | null;
  fuelText?: string;
  fuelCostYen?: number;
  totalCostYen?: number;
  trafficNote?: string;
  distanceKm?: number;
  isRecommended?: boolean;
  tollBreakdown?: TollBreakdownItem[];
  totalTollText?: string;
  style?: ViewStyle;
  onPress?: () => void;
}

const formatMinutes = (minutes?: number) => {
  if (minutes === undefined) return "1時間19分";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}時間${m < 10 ? "0" + m : m}分`;
  return `${m}分`;
};

export function RouteCard({
  type,
  title,
  badgeLabel,
  durationText,
  durationMinutes,
  etaText,
  tollText,
  tollYen,
  fuelText,
  fuelCostYen,
  totalCostYen: _totalCostYen,
  trafficNote: _trafficNote,
  distanceKm: _distanceKm,
  isRecommended = type === "highway",
  tollBreakdown,
  totalTollText,
  style,
  onPress,
}: RouteCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const isHighway = type === "highway";

  const resolvedBadge =
    badgeLabel || title || (isHighway ? "高速優先ルート（最速）" : "一般道優先ルート（節約）");

  const resolvedDuration = durationText || formatMinutes(durationMinutes);

  const [initialNow] = useState(() => Date.now());

  const resolvedEta =
    etaText ||
    (durationMinutes
      ? (() => {
          const eta = new Date(initialNow + durationMinutes * 60 * 1000);
          const hh = eta.getHours();
          const mm = eta.getMinutes();
          return `到着予定: ${hh}:${mm < 10 ? "0" + mm : mm}`;
        })()
      : isHighway
        ? "到着予定: 11:00"
        : "到着予定: 11:50");

  const resolvedToll =
    tollText ||
    (isHighway
      ? tollYen === null || tollYen === undefined
        ? "料金: 未確認"
        : `料金: ¥${tollYen.toLocaleString()}`
      : "料金: なし (0円)");

  const resolvedFuel =
    fuelText ||
    (fuelCostYen !== undefined
      ? `燃料費: 約${fuelCostYen.toLocaleString()}円`
      : isHighway
        ? "燃料費: 約824円"
        : "燃料費: 約964円");

  const resolvedBreakdown =
    tollBreakdown ||
    (isHighway && tollYen
      ? [{ label: "通常料金", amount: `¥${tollYen.toLocaleString()}` }]
      : undefined);

  const resolvedTotalToll = totalTollText || (tollYen ? `¥${tollYen.toLocaleString()}` : undefined);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        isHighway ? styles.highwayCard : styles.generalCard,
        isRecommended && styles.recommendedCard,
        style,
      ]}
    >
      {/* Badge */}
      <View style={[styles.badge, isHighway ? styles.highwayBadge : styles.generalBadge]}>
        <Text
          style={[styles.badgeText, isHighway ? styles.highwayBadgeText : styles.generalBadgeText]}
        >
          {resolvedBadge}
        </Text>
      </View>

      {/* Metrics */}
      <View style={styles.metricsRow}>
        <Text style={styles.durationText}>{resolvedDuration}</Text>
        <Text style={styles.etaText}>{resolvedEta}</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Costs */}
      <View style={styles.costs}>
        <Text style={styles.tollText}>{resolvedToll}</Text>
        <Text style={styles.fuelText}>{resolvedFuel}</Text>
      </View>

      {/* Breakdown Accordion (Highway only) */}
      {isHighway && resolvedBreakdown && resolvedBreakdown.length > 0 && (
        <View style={styles.breakdownSection}>
          <Pressable
            onPress={() => setBreakdownOpen((prev) => !prev)}
            style={styles.breakdownHeader}
          >
            <Text style={styles.breakdownTitle}>料金内訳</Text>
            {breakdownOpen ? (
              <ChevronUp size={16} color={colors.neutral[700]} />
            ) : (
              <ChevronDown size={16} color={colors.neutral[700]} />
            )}
          </Pressable>

          {breakdownOpen && (
            <View style={styles.breakdownDetails}>
              {resolvedBreakdown.map((item, index) => (
                <View key={index} style={styles.breakdownRow}>
                  <Text style={styles.breakdownItemLabel}>{item.label}</Text>
                  <Text style={styles.breakdownItemAmount}>{item.amount}</Text>
                </View>
              ))}
              {resolvedTotalToll && (
                <View style={[styles.breakdownRow, styles.totalRow]}>
                  <Text style={styles.totalRowText}>合計</Text>
                  <Text style={styles.totalRowText}>{resolvedTotalToll}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.base.white,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    width: "100%",
  },
  highwayCard: {
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  generalCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  recommendedCard: {
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  badge: {
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  highwayBadge: {
    backgroundColor: colors.neutral[100], // #e8efe9
  },
  generalBadge: {
    backgroundColor: colors.neutral[50], // #f3f4f6
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "bold",
  },
  highwayBadgeText: {
    color: colors.primary[500],
  },
  generalBadgeText: {
    color: colors.neutral[700],
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  durationText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
  etaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    width: "100%",
  },
  costs: {
    gap: 2,
    width: "100%",
  },
  tollText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
  fuelText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "normal",
    color: colors.neutral[700],
  },
  breakdownSection: {
    width: "100%",
    paddingTop: 4,
    gap: 6,
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  breakdownTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  breakdownDetails: {
    gap: 4,
    paddingTop: 4,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breakdownItemLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "normal",
    color: colors.neutral[700],
  },
  breakdownItemAmount: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "normal",
    color: colors.neutral[700],
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  totalRowText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
});
