import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle, TextStyle } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../../shared/theme/colors";

export interface HeaderProps {
  title?: string;
  tag?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  tagStyle?: TextStyle;
}

export function Header({
  title = "道路状況チェック",
  tag = "ROUTEIQ | CALM UTILITY",
  style,
  titleStyle,
  tagStyle,
}: HeaderProps) {
  return (
    <View style={[styles.brandHeader, style]}>
      <Text style={[styles.brandTag, tagStyle]}>{tag}</Text>
      <Text style={[styles.brandTitle, titleStyle]}>{title}</Text>
    </View>
  );
}

export interface BackHeaderProps {
  title: string;
  backLabel?: string;
  onBackPress?: () => void;
  style?: ViewStyle;
  titleStyle?: TextStyle;
}

export function BackHeader({
  title,
  backLabel = "戻る",
  onBackPress,
  style,
  titleStyle,
}: BackHeaderProps) {
  return (
    <View style={[styles.backHeader, style]}>
      <View style={styles.backTitleContainer} pointerEvents="box-none">
        <Text style={[styles.backTitle, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Pressable onPress={onBackPress} style={styles.backBtn} hitSlop={8}>
        <ArrowLeft size={16} color={colors.primary[500]} />
        <Text style={styles.backLabel}>{backLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 4,
    width: "100%",
  },
  brandTag: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "bold",
    color: colors.primary[500],
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  brandTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
  backHeader: {
    position: "relative",
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 48,
    width: "100%",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 1,
  },
  backLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.primary[500],
  },
  backTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 80,
  },
  backTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "bold",
    color: colors.neutral[900],
    textAlign: "center",
  },
});
