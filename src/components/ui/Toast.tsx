import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Check, AlertCircle } from "lucide-react-native";
import { colors } from "../../shared/theme/colors";

export type ToastVariant = "success" | "error" | "Success" | "Error";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  type?: ToastVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Toast({ message, variant = "success", type, style, textStyle }: ToastProps) {
  const activeVariant = (type || variant).toLowerCase();
  const isError = activeVariant === "error";

  return (
    <View style={[styles.container, isError && styles.errorContainer, style]}>
      <View style={styles.iconContainer}>
        {isError ? (
          <AlertCircle size={16} color={colors.base.white} />
        ) : (
          <Check size={16} color={colors.base.white} strokeWidth={2.5} />
        )}
      </View>
      <Text style={[styles.text, textStyle]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[900], // #1c2420 in Figma
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.27,
    shadowRadius: 8,
    elevation: 6,
    alignSelf: "center",
  },
  errorContainer: {
    backgroundColor: colors.error[400], // #e07a5f in Figma
    borderWidth: 1,
    borderColor: colors.error[400],
  },
  iconContainer: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "bold",
    color: colors.base.white,
  },
});
