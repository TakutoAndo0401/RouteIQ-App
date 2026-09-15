import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { MapPin, X } from "lucide-react-native";
import { colors } from "../../shared/theme/colors";

export interface HistoryItemProps {
  routeText: string;
  metaText: string;
  onPress?: () => void;
  onDeletePress?: () => void;
  style?: ViewStyle;
}

export function HistoryItem({
  routeText,
  metaText,
  onPress,
  onDeletePress,
  style,
}: HistoryItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed, style]}
      accessibilityRole="button"
    >
      <View style={styles.left}>
        <MapPin size={16} color={colors.primary[500]} style={styles.pinIcon} />
        <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
          {routeText}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.metaText} numberOfLines={1}>
          {metaText}
        </Text>
        {onDeletePress && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDeletePress();
            }}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
            hitSlop={8}
            accessibilityLabel="履歴から削除"
          >
            <X size={10} color={colors.neutral[700]} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  pinIcon: {
    flexShrink: 0,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.neutral[900],
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  metaText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "normal",
    color: colors.neutral[600],
    flexShrink: 0,
  },
  deleteBtn: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnPressed: {
    backgroundColor: colors.neutral[200],
  },
  pressed: {
    opacity: 0.8,
  },
});
