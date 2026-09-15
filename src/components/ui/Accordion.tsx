import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react-native";
import { colors } from "../../shared/theme/colors";

export interface AccordionDetailItem {
  label: string;
  value: string;
}

export interface AccordionProps {
  title: string;
  items?: AccordionDetailItem[];
  state?: "Open" | "Closed";
  initiallyOpen?: boolean;
  onEditPress?: () => void;
  showEditButton?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export function Accordion({
  title,
  items,
  state,
  initiallyOpen = false,
  onEditPress,
  showEditButton = true,
  style,
  children,
}: AccordionProps) {
  const [internalOpen, setInternalOpen] = useState(
    state !== undefined ? state === "Open" : initiallyOpen,
  );
  const isOpen = state !== undefined ? state === "Open" : internalOpen;

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <Pressable onPress={() => setInternalOpen((prev) => !prev)} style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.actions}>
          {showEditButton && onEditPress && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onEditPress();
              }}
              accessibilityRole="button"
              accessibilityLabel="詳細条件を編集"
              hitSlop={8}
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
            >
              <Pencil size={13} color={colors.neutral[700]} />
              <Text style={styles.editText}>編集</Text>
            </Pressable>
          )}
          {isOpen ? (
            <ChevronUp size={16} color={colors.neutral[700]} />
          ) : (
            <ChevronDown size={16} color={colors.neutral[700]} />
          )}
        </View>
      </Pressable>

      {/* Content */}
      {isOpen && (
        <View style={styles.content}>
          <View style={styles.divider} />
          {items && items.length > 0 ? (
            <View style={styles.grid}>
              {items.map((item, index) => (
                <View key={index} style={styles.detailCol}>
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            children
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 20,
    padding: 18,
    gap: 12,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  editBtn: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  editBtnPressed: {
    backgroundColor: colors.neutral[100],
    transform: [{ scale: 0.96 }],
  },
  editText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  content: {
    gap: 10,
    width: "100%",
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    width: "100%",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    columnGap: 12,
  },
  detailCol: {
    width: 151,
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "normal",
    color: colors.neutral[700],
  },
  detailValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.neutral[900],
  },
});
