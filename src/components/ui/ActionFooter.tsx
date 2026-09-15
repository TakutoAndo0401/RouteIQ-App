import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../shared/theme/colors";
import { Button } from "./Button";

export interface ActionFooterProps {
  label: string;
  onPress?: () => void;
  state?: "Default" | "Disabled" | "Loading";
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  style?: ViewStyle;
}

export function ActionFooter({
  label,
  onPress,
  state = "Default",
  disabled,
  loading,
  loadingText = "最適なルートを計算中...",
  style,
}: ActionFooterProps) {
  const insets = useSafeAreaInsets();
  const isDisabled = disabled ?? state === "Disabled";
  const isLoading = loading ?? state === "Loading";

  // Use safe area bottom inset to seamlessly extend footer background to bottom of screen
  // while ensuring interactive elements sit safely above the home indicator
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 16;

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }, style]}>
      {isLoading ? (
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      ) : (
        <Button
          label={label}
          onPress={onPress}
          disabled={isDisabled}
          state={isDisabled ? "Disabled" : "Default"}
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.base.white,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  loadingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 51, // Matches button height so footer doesn't shift
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 16,
    color: colors.neutral[900], // #1C2420 in Figma
    fontWeight: "normal",
  },
  button: {
    width: "100%",
  },
});
