import React from "react";
import { View, Text, TextInput, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors } from "../../shared/theme/colors";

export interface FormFieldProps {
  label: string;
  value: string;
  unit?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  style?: ViewStyle;
  inputStyle?: TextStyle;
  readOnly?: boolean;
}

export function FormField({
  label,
  value,
  unit,
  placeholder,
  onChangeText,
  keyboardType = "decimal-pad",
  style,
  inputStyle,
  readOnly = false,
}: FormFieldProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral[500]}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          editable={!readOnly}
          style={[styles.input, inputStyle]}
        />
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
    width: "100%",
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  inputContainer: {
    backgroundColor: colors.neutral[50], // #f4f6f4
    borderWidth: 1,
    borderColor: colors.neutral[200], // #dce3dd
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "bold",
    color: colors.neutral[900],
    padding: 0,
  },
  unit: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[700],
  },
});
