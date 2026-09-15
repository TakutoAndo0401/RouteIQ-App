import React from "react";
import { Text, StyleSheet, Pressable, ViewStyle, TextStyle } from "react-native";
import { colors } from "../../shared/theme/colors";

export interface ChipButtonProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function ChipButton({
  label,
  selected = true,
  disabled = false,
  onPress,
  style,
  textStyle,
}: ChipButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        disabled && styles.chipDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          selected ? styles.textSelected : styles.textUnselected,
          disabled && styles.textDisabled,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: colors.primary[500],
  },
  chipUnselected: {
    backgroundColor: colors.base.white,
  },
  chipDisabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  textSelected: {
    color: colors.base.white,
  },
  textUnselected: {
    color: colors.neutral[700],
  },
  textDisabled: {
    color: colors.neutral[400],
  },
});
