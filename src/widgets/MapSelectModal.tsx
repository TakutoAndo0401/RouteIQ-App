import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Map, X, MapPin } from "lucide-react-native";
import { Button } from "../components/ui/Button";
import { GoogleMapView } from "../components/map/GoogleMapView";
import { colors } from "../shared/theme/colors";
import {
  type Coordinates,
  geocodeAddress,
  reverseGeocodeCoordinates,
  formatFallbackCoordinates,
} from "../domain/location";

export interface MapSelectModalProps {
  visible: boolean;
  target: "origin" | "destination";
  currentAddress?: string;
  onClose: () => void;
  onConfirm: (address: string, coords?: Coordinates) => void;
}

export function MapSelectModal({
  visible,
  target,
  currentAddress = "東京駅",
  onClose,
  onConfirm,
}: MapSelectModalProps) {
  const resolvedInitialAddress = useMemo(() => {
    if (!currentAddress || currentAddress.includes("現在地")) {
      return "東京駅";
    }
    return currentAddress;
  }, [currentAddress]);

  const [customAddress, setCustomAddress] = useState<string | null>(null);
  const selectedAddress = customAddress ?? resolvedInitialAddress;
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsResolvingAddress(false);
    setCustomAddress(null);
    setSelectedCoords(null);
    onClose();
  }, [onClose]);

  // モーダル表示時に初期座標を非同期で解決
  useEffect(() => {
    if (!visible) return;

    let isCancelled = false;
    geocodeAddress(resolvedInitialAddress).then((coords) => {
      if (!isCancelled) {
        setSelectedCoords((prev) => prev ?? coords);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [visible, resolvedInitialAddress]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ピン移動時のハンドラ（デバウンスして逆ジオコーディング）
  const handleLocationSelect = useCallback((coords: Coordinates) => {
    setSelectedCoords(coords);
    setIsResolvingAddress(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const addr = await reverseGeocodeCoordinates(coords);
        if (addr) {
          setCustomAddress(addr);
        } else {
          setCustomAddress(formatFallbackCoordinates(coords));
        }
      } catch {
        setCustomAddress(formatFallbackCoordinates(coords));
      } finally {
        setIsResolvingAddress(false);
      }
    }, 250);
  }, []);

  const modalTitle = target === "origin" ? "出発地を地図で選択" : "目的地を地図で選択";
  const pinLabel = target === "origin" ? "出発地" : "目的地";

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
      presentationStyle="fullScreen"
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.safeAreaContainer} edges={["top", "bottom", "left", "right"]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Map size={20} color={colors.primary[600]} />
              <Text style={styles.titleText}>{modalTitle}</Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="閉じる"
            >
              <X size={20} color={colors.neutral[700]} />
            </Pressable>
          </View>

          {/* Clean Interactive Map View (Expanded full screen) */}
          <View style={styles.mapWrapper}>
            <GoogleMapView
              key={`${target}-${visible}`}
              height="100%"
              style={styles.googleMap}
              centerAddress={resolvedInitialAddress}
              initialCoordinates={selectedCoords || undefined}
              pinLabel={pinLabel}
              onLocationSelect={handleLocationSelect}
              showCenterPin={true}
              showZoomControls={true}
            />
          </View>

          {/* Footer: Address Preview Bar & Confirm Button */}
          <View style={styles.footer}>
            <View style={styles.addressBar}>
              <View style={styles.addressBarHeader}>
                <MapPin
                  size={15}
                  color={target === "origin" ? colors.warning[600] : colors.primary[600]}
                />
                <Text style={styles.addressBarLabel}>現在選択されている位置</Text>
                {isResolvingAddress && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary[600]}
                    style={styles.spinner}
                  />
                )}
              </View>
              <Text style={styles.addressBarText} numberOfLines={2}>
                {isResolvingAddress ? "住所を取得中..." : selectedAddress}
              </Text>
            </View>

            <Button
              label="この位置を設定"
              disabled={isResolvingAddress}
              onPress={() => {
                if (isResolvingAddress) return;
                onConfirm(selectedAddress, selectedCoords ?? undefined);
                handleClose();
              }}
              style={styles.confirmBtn}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: colors.base.white,
  },
  safeAreaContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: colors.base.white,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.base.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    zIndex: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
  },
  closeBtnPressed: {
    backgroundColor: colors.neutral[200],
    transform: [{ scale: 0.94 }],
  },
  mapWrapper: {
    flex: 1,
    width: "100%",
    backgroundColor: "#eef2ef",
  },
  googleMap: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
  },
  footer: {
    backgroundColor: colors.base.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  addressBar: {
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  addressBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addressBarLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.neutral[700],
    fontWeight: "500",
  },
  addressBarText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
  confirmBtn: {
    width: "100%",
  },
  spinner: {
    marginLeft: 6,
  },
});
