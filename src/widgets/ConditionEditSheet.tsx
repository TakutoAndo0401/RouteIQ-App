import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import { FormField } from "../components/ui/FormField";
import { RadioButton } from "../components/ui/RadioButton";
import { Button } from "../components/ui/Button";
import { colors } from "../shared/theme/colors";

import { useHarness } from "../harness/HarnessContext";
import type { FuelPriceAveragesResponse } from "../contracts";
import { defaultFuelPriceAverages } from "../harness/fixtures";

// Module-level cache to keep fuel price averages stable and avoid layout shifts
let cachedFuelPrices: FuelPriceAveragesResponse | null = null;

export function setCachedFuelPriceAverages(prices: FuelPriceAveragesResponse) {
  cachedFuelPrices = prices;
}

export interface ConditionEditSheetProps {
  visible: boolean;
  fuelEfficiency: string;
  fuelPrice: string;
  vehicleType: string;
  onClose: () => void;
  onSave: (conditions: { fuelEfficiency: string; fuelPrice: string; vehicleType: string }) => void;
}

// Figma bezier curve: [0.16, 1, 0.3, 1]
const FIGMA_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const ENTRANCE_TRANSLATE_Y = 80; // Figma nodeId: 33:3500 initial y: 80

interface ConditionFormProps {
  initialEfficiency: string;
  initialPrice: string;
  initialVehicle: string;
  onSave: (conditions: { fuelEfficiency: string; fuelPrice: string; vehicleType: string }) => void;
}

function ConditionForm({
  initialEfficiency,
  initialPrice,
  initialVehicle,
  onSave,
}: ConditionFormProps) {
  const { getFuelPrices } = useHarness();
  const [efficiency, setEfficiency] = useState(initialEfficiency);
  const [price, setPrice] = useState(initialPrice);
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [fuelPrices, setFuelPrices] = useState<FuelPriceAveragesResponse>(
    () => cachedFuelPrices ?? defaultFuelPriceAverages,
  );

  useEffect(() => {
    let ignore = false;
    getFuelPrices()
      .then((res) => {
        if (!ignore && res && res.prices && res.prices.length > 0) {
          cachedFuelPrices = res;
          setFuelPrices(res);
        }
      })
      .catch(() => {
        // Silently keep current/default fuel prices
      });
    return () => {
      ignore = true;
    };
  }, [getFuelPrices]);

  const vehicleOptions = ["普通車", "大型車", "軽自動車"];

  return (
    <>
      {/* Inputs Row: 燃費 & ガソリン単価 */}
      <View style={styles.formRow}>
        <View style={styles.formCol}>
          <FormField
            label="燃費 (km/L)"
            value={efficiency}
            unit="km/L"
            keyboardType="decimal-pad"
            onChangeText={setEfficiency}
          />
        </View>
        <View style={styles.formCol}>
          <FormField
            label="ガソリン単価 (円/L)"
            value={price}
            unit="円/L"
            keyboardType="numeric"
            onChangeText={setPrice}
          />
        </View>
      </View>

      {/* 全国平均ガソリン価格クイック選択 */}
      {fuelPrices && fuelPrices.prices.length > 0 && (
        <View style={styles.fuelAverageSection}>
          <View style={styles.fuelAverageHeader}>
            <Text style={styles.fuelAverageTitle}>全国平均価格</Text>
            {fuelPrices.prices[0]?.surveyedAt ? (
              <Text style={styles.fuelAverageDate}>{fuelPrices.prices[0].surveyedAt}時点</Text>
            ) : null}
          </View>
          <View style={styles.fuelChipsRow}>
            {fuelPrices.prices.map((item) => {
              const isSelected = price === String(item.value);
              return (
                <Pressable
                  key={item.label}
                  onPress={() => setPrice(String(item.value))}
                  style={({ pressed }) => [
                    styles.fuelChip,
                    isSelected && styles.fuelChipActive,
                    pressed && styles.fuelChipPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label} ${item.value}円/Lを設定`}
                >
                  <Text style={[styles.fuelChipLabel, isSelected && styles.fuelChipTextActive]}>
                    {item.label} {item.value}円
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fuelAverageSource}>出典: {fuelPrices.sourceLabel}</Text>
        </View>
      )}

      {/* Vehicle Type Section */}
      <View style={styles.vehicleSection}>
        <Text style={styles.sectionLabel}>車両条件</Text>
        <View style={styles.radioGroup}>
          {vehicleOptions.map((opt) => (
            <RadioButton
              key={opt}
              label={opt}
              selected={vehicle === opt}
              onPress={() => setVehicle(opt)}
            />
          ))}
        </View>
      </View>

      {/* Save Button */}
      <Button
        label="設定を保存"
        onPress={() =>
          onSave({
            fuelEfficiency: efficiency,
            fuelPrice: price,
            vehicleType: vehicle,
          })
        }
        style={styles.saveBtn}
      />
    </>
  );
}

export function ConditionEditSheet({
  visible,
  fuelEfficiency,
  fuelPrice,
  vehicleType,
  onClose,
  onSave,
}: ConditionEditSheetProps) {
  // Animated values initialized via lazy useState
  // Scrim: 0 -> 1 (Figma node 33:3499, duration: 250ms, ease: [0.16, 1, 0.3, 1])
  const [scrimOpacity] = useState(() => new Animated.Value(0));
  // Sheet: y 80 -> 0, opacity 0 -> 1 (Figma node 33:3500, duration: 500ms, ease: [0.16, 1, 0.3, 1])
  const [sheetTranslateY] = useState(() => new Animated.Value(ENTRANCE_TRANSLATE_Y));
  const [sheetOpacity] = useState(() => new Animated.Value(0));

  const runExitAnimation = useCallback(
    (onComplete: () => void) => {
      Animated.parallel([
        // Sheet slides down to 80px and fades out
        Animated.timing(sheetTranslateY, {
          toValue: ENTRANCE_TRANSLATE_Y,
          duration: 250,
          easing: FIGMA_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 0,
          duration: 200,
          easing: FIGMA_EASING,
          useNativeDriver: true,
        }),
        // Scrim fades out
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete();
      });
    },
    [scrimOpacity, sheetOpacity, sheetTranslateY],
  );

  const handleDismiss = useCallback(() => {
    runExitAnimation(onClose);
  }, [runExitAnimation, onClose]);

  const handleSaveAndDismiss = useCallback(
    (conditions: { fuelEfficiency: string; fuelPrice: string; vehicleType: string }) => {
      runExitAnimation(() => {
        onSave(conditions);
        onClose();
      });
    },
    [runExitAnimation, onSave, onClose],
  );

  useEffect(() => {
    if (visible) {
      // Reset values to initial entrance state
      scrimOpacity.setValue(0);
      sheetTranslateY.setValue(ENTRANCE_TRANSLATE_Y);
      sheetOpacity.setValue(0);

      // 1. Scrim entrance animation (250ms, ease: [0.16, 1, 0.3, 1])
      const scrimAnimation = Animated.timing(scrimOpacity, {
        toValue: 1,
        duration: 250,
        easing: FIGMA_EASING,
        useNativeDriver: true,
      });

      // 2. Sheet entrance animation (500ms, ease: [0.16, 1, 0.3, 1], delayed by 60ms)
      const sheetAnimation = Animated.sequence([
        Animated.delay(60),
        Animated.parallel([
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: 500,
            easing: FIGMA_EASING,
            useNativeDriver: true,
          }),
          Animated.timing(sheetOpacity, {
            toValue: 1,
            duration: 500,
            easing: FIGMA_EASING,
            useNativeDriver: true,
          }),
        ]),
      ]);

      Animated.parallel([scrimAnimation, sheetAnimation]).start();
    }
  }, [visible, scrimOpacity, sheetOpacity, sheetTranslateY]);

  // Swipe-down gesture handler to dismiss (Figma annotation: 閉じる操作はスワイプダウンのみ)
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 60 || gestureState.vy > 0.5) {
          runExitAnimation(onClose);
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent={true} animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.container}>
        {/* Scrim Overlay (Figma: scrim-overlay 33:3499) */}
        <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
          <Pressable
            style={styles.overlayPressable}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="モーダルを閉じる"
          />
        </Animated.View>

        {/* Bottom Sheet Card (Figma: bottom-sheet 33:3500) */}
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          {/* Drag Handle area with PanResponder */}
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>詳細条件を編集</Text>
          </View>

          {/* Form contents */}
          <ConditionForm
            key={visible ? "open" : "closed"}
            initialEfficiency={fuelEfficiency}
            initialPrice={fuelPrice}
            initialVehicle={vehicleType}
            onSave={handleSaveAndDismiss}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28, 36, 32, 0.48)", // Figma: color/text/primary #1c2420 overlay
  },
  overlayPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.base.white,
    borderTopLeftRadius: 30, // Figma: rounded-tl-[30px]
    borderTopRightRadius: 30, // Figma: rounded-tr-[30px]
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
    // Figma drop-shadow: drop-shadow-[0px_-10px_15px_rgba(28,36,32,0.13)]
    shadowColor: "#1c2420",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.13,
    shadowRadius: 15,
    elevation: 10,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  dragHandle: {
    width: 40, // Figma: w-[40px]
    height: 4, // Figma: h-[4px]
    borderRadius: 2, // Figma: rounded-[var(--radius/xs,2px)]
    backgroundColor: colors.neutral[200], // Figma: #dce3dd
  },
  header: {
    alignItems: "center",
    paddingBottom: 4,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "bold",
    color: colors.neutral[900], // Figma: #1c2420
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  formCol: {
    flex: 1,
  },
  fuelAverageSection: {
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  fuelAverageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fuelAverageTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  fuelAverageDate: {
    fontSize: 10,
    color: colors.neutral[500],
  },
  fuelChipsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  fuelChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  fuelChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  fuelChipPressed: {
    opacity: 0.7,
  },
  fuelChipLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral[800],
  },
  fuelChipTextActive: {
    color: colors.primary[700],
    fontWeight: "600",
  },
  fuelAverageSource: {
    fontSize: 9,
    color: colors.neutral[400],
  },
  vehicleSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.neutral[700], // Figma: #56625d
  },
  radioGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 4,
  },
  saveBtn: {
    marginTop: 6,
  },
});
