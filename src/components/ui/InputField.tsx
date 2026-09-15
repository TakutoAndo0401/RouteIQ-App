import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import { MapPin } from "lucide-react-native";
import { colors } from "../../shared/theme/colors";
import { ChipButton } from "./ChipButton";

export interface InputFieldProps {
  label?: string;
  value?: string;
  placeholder?: string;
  state?: "現在地ボタンあり" | "現在地ボタンなし" | "取得中";
  onChangeText?: (text: string) => void;
  onCurrentLocationPress?: () => void;
  onMapSelectPress?: () => void;
  showCurrentLocationChip?: boolean;
  showMapSelectChip?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  readOnly?: boolean;
}

export function InputField({
  label,
  value = "",
  placeholder = "IC名や地名を入力",
  state,
  onChangeText,
  onCurrentLocationPress,
  onMapSelectPress,
  showCurrentLocationChip = true,
  showMapSelectChip = true,
  style,
  inputStyle,
  readOnly = false,
}: InputFieldProps) {
  const hasCurrentLoc = state
    ? state === "現在地ボタンあり" || state === "取得中"
    : showCurrentLocationChip;
  const isFetching = state === "取得中";

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputContainer}>
        {isFetching ? (
          <ActivityIndicator size="small" color={colors.primary[600]} />
        ) : (
          <MapPin size={16} color={colors.neutral[700]} />
        )}
        <TextInput
          value={isFetching ? "現在地を取得中..." : value}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral[500]}
          onChangeText={onChangeText}
          editable={!readOnly && !isFetching}
          style={[styles.input, inputStyle, isFetching && styles.inputFetching]}
        />
        <View style={styles.chips}>
          {hasCurrentLoc && (
            <ChipButton
              label={isFetching ? "取得中..." : "現在地"}
              selected={!isFetching}
              disabled={isFetching}
              onPress={isFetching ? undefined : onCurrentLocationPress}
            />
          )}
          {showMapSelectChip && !isFetching && (
            <ChipButton label="地図" onPress={onMapSelectPress} />
          )}
        </View>
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
    fontWeight: "bold",
    color: colors.neutral[700],
  },
  inputContainer: {
    backgroundColor: colors.neutral[50], // #f4f6f4
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: colors.neutral[900],
    padding: 0,
  },
  inputFetching: {
    color: colors.neutral[500],
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
});
