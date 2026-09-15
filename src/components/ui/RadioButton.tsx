import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle, TextStyle } from "react-native";
import { colors } from "../../shared/theme/colors";

export interface RadioButtonProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export function RadioButton({
  label,
  selected = false,
  onPress,
  style,
  textStyle,
  disabled = false,
}: RadioButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[styles.indicator, selected ? styles.indicatorSelected : styles.indicatorUnselected]}
      >
        {selected && <View style={styles.indicatorDot} />}
      </View>
      <Text
        style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected, textStyle]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  indicatorSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.base.white,
  },
  indicatorUnselected: {
    borderColor: colors.neutral[200],
    backgroundColor: colors.base.white,
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary[500],
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
  },
  labelSelected: {
    color: colors.primary[500],
  },
  labelUnselected: {
    color: colors.neutral[700],
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
