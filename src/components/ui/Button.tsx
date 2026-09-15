import React from "react";
import { Text, StyleSheet, ActivityIndicator, Pressable, ViewStyle, TextStyle } from "react-native";
import { colors } from "../../shared/theme/colors";

export type ButtonState =
  | "Default"
  | "Hover"
  | "Pressed"
  | "Disabled"
  | "Focus"
  | "Compact"
  | "Compact Outline";

export interface ButtonProps {
  label: string;
  state?: ButtonState;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  state = "Default",
  disabled = false,
  loading = false,
  onPress,
  style,
  textStyle,
}: ButtonProps) {
  const isCompact = state === "Compact" || state === "Compact Outline";
  const isOutline = state === "Compact Outline";
  const isDisabled = disabled || state === "Disabled";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled || loading}
      style={({ pressed }) => [
        styles.base,
        isCompact ? styles.compact : styles.regular,
        isOutline ? styles.outline : styles.solid,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        state === "Focus" && styles.focus,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isOutline ? colors.primary[500] : colors.base.white}
        />
      ) : (
        <Text
          style={[
            styles.baseText,
            isCompact ? styles.compactText : styles.regularText,
            isOutline ? styles.outlineText : styles.solidText,
            isDisabled && styles.disabledText,
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  regular: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    // Figma: drop-shadow [0px_4px_12px_rgba(78,106,86,0.17)]
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.17,
    shadowRadius: 12,
    elevation: 4,
  },
  compact: {
    height: 46,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  solid: {
    backgroundColor: colors.primary[500],
  },
  outline: {
    backgroundColor: colors.base.white,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  pressed: {
    backgroundColor: colors.primary[700], // #314335 in Figma
    opacity: 0.9,
  },
  disabled: {
    backgroundColor: colors.neutral[200],
    borderColor: colors.neutral[200],
    shadowOpacity: 0,
    elevation: 0,
  },
  focus: {
    borderWidth: 3,
    borderColor: colors.primary[400], // #6e9478 in Figma
  },
  baseText: {
    fontWeight: "bold",
    textAlign: "center",
  },
  regularText: {
    fontSize: 16,
    lineHeight: 20,
  },
  compactText: {
    fontSize: 15,
    lineHeight: 18,
  },
  solidText: {
    color: colors.base.white,
  },
  outlineText: {
    color: colors.primary[500],
  },
  disabledText: {
    color: colors.neutral[300], // #C5CFC8 in Figma
  },
});
