import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
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
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        {/* Click outside to close */}
        <Pressable style={styles.overlayPressable} onPress={handleClose} />

        {/* Modal Card (Figma: 350px card with 24px radius) */}
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Map size={18} color={colors.primary[600]} />
              <Text style={styles.titleText}>{modalTitle}</Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              hitSlop={8}
              accessibilityLabel="閉じる"
            >
              <X size={18} color={colors.neutral[700]} />
            </Pressable>
          </View>

          {/* Clean Interactive Map View */}
          <View style={styles.mapWrapper}>
            <GoogleMapView
              key={`${target}-${visible}`}
              height={320}
              centerAddress={resolvedInitialAddress}
              initialCoordinates={selectedCoords || undefined}
              pinLabel={pinLabel}
              onLocationSelect={handleLocationSelect}
              showCenterPin={true}
              showZoomControls={true}
            />
          </View>

          {/* Address Preview Bar */}
          <View style={styles.addressBar}>
            <View style={styles.addressBarHeader}>
              <MapPin
                size={14}
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
            <Text style={styles.addressBarText} numberOfLines={1}>
              {isResolvingAddress ? "住所を取得中..." : selectedAddress}
            </Text>
          </View>

          {/* Confirm Button */}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 354,
    backgroundColor: colors.base.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 20,
    gap: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  mapWrapper: {
    width: "100%",
    height: 320,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#eef2ef",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
  },
  closeBtnPressed: {
    backgroundColor: colors.neutral[200],
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
    gap: 4,
  },
  addressBarLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.neutral[700],
    fontWeight: "500",
  },
  addressBarText: {
    fontSize: 13,
    lineHeight: 18,
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
