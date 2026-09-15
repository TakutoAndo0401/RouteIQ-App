import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Check, AlertCircle, Info } from "lucide-react-native";
import { colors } from "../../shared/theme/colors";

export type AlertBannerVariant =
  | "recommendation"
  | "warning"
  | "info"
  | "Recommendation"
  | "Warning"
  | "Traffic";

export interface AlertBannerProps {
  title: string;
  description: string;
  variant?: AlertBannerVariant;
  type?: AlertBannerVariant;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  descriptionStyle?: TextStyle;
}

export function AlertBanner({
  title,
  description,
  variant,
  type,
  style,
  titleStyle,
  descriptionStyle,
}: AlertBannerProps) {
  const activeVariant = (type || variant || "recommendation").toLowerCase();
  const isWarning = activeVariant === "warning";
  const isInfo = activeVariant === "info" || activeVariant === "traffic";
  const isRec = !isWarning && !isInfo;

  return (
    <View
      style={[
        styles.container,
        isRec && styles.recommendationContainer,
        isWarning && styles.warningContainer,
        isInfo && styles.infoContainer,
        style,
      ]}
    >
      <View style={styles.titleRow}>
        <View
          style={[
            styles.iconBadge,
            isRec && styles.recommendationIconBadge,
            isWarning && styles.warningIconBadge,
            isInfo && styles.infoIconBadge,
          ]}
        >
          {isWarning ? (
            <AlertCircle size={12} color={colors.base.white} />
          ) : isInfo ? (
            <Info size={12} color={colors.base.white} />
          ) : (
            <Check size={12} color={colors.base.white} strokeWidth={3} />
          )}
        </View>
        <Text
          style={[
            styles.title,
            isRec && styles.recommendationTitle,
            isWarning && styles.warningTitle,
            isInfo && styles.infoTitle,
            titleStyle,
          ]}
        >
          {title}
        </Text>
      </View>
      <Text style={[styles.description, isRec && styles.recommendationDesc, descriptionStyle]}>
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  recommendationContainer: {
    backgroundColor: colors.neutral[100], // #e8efe9
    borderColor: colors.primary[500],
  },
  warningContainer: {
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[500],
  },
  infoContainer: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[300],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationIconBadge: {
    backgroundColor: colors.primary[500],
  },
  warningIconBadge: {
    backgroundColor: colors.warning[500],
  },
  infoIconBadge: {
    backgroundColor: colors.neutral[600],
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "bold",
  },
  recommendationTitle: {
    color: colors.primary[500],
  },
  warningTitle: {
    color: colors.warning[700],
  },
  infoTitle: {
    color: colors.neutral[900],
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "normal",
  },
  recommendationDesc: {
    color: colors.neutral[700],
  },
});
