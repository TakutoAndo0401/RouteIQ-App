import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  type Region,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from "react-native-maps";
import {
  Maximize2,
  Minimize2,
  ExternalLink,
  ArrowRight,
  Plus,
  Minus,
  Navigation,
} from "lucide-react-native";
import { colors } from "../../shared/theme/colors";
import {
  type Coordinates,
  resolveCoordinatesFromText,
  geocodeAddress,
} from "../../domain/location";
import type { GoogleMapViewProps } from "./GoogleMapView.types";

export type { GoogleMapViewProps };

export function GoogleMapView({
  height = 340,
  centerAddress = "東京駅",
  pinLabel = "選択位置",
  zoom: _initialZoom = 15,
  showCenterPin: _showCenterPin = true,
  showZoomControls = true,
  isRouteMap = false,
  originLabel = "用賀IC",
  destinationLabel = "御殿場IC",
  originPinLabel = "出発地",
  destinationPinLabel = "目的地",
  originCoordinates,
  destinationCoordinates,
  routeCoordinates,
  secondaryRouteCoordinates,
  routeColor,
  routeCasingColor,
  initialCoordinates,
  onLocationSelect,
  showExpandButton = false,
  isExpanded = false,
  onExpandPress,
  showExternalButton = false,
  onOpenExternal,
  showFitButton: _showFitButton = true,
  style,
}: GoogleMapViewProps) {
  const mapRef = useRef<MapView | null>(null);

  // 基準座標の決定
  const defaultCoords = useMemo<Coordinates>(() => {
    if (initialCoordinates) return initialCoordinates;
    return resolveCoordinatesFromText(centerAddress, { latitude: 35.6812, longitude: 139.7671 });
  }, [initialCoordinates, centerAddress]);

  const [pickedCoords, setPickedCoords] = useState<Coordinates | null>(null);
  const currentCoords = pickedCoords ?? initialCoordinates ?? defaultCoords;

  // 非同期ジオコーディング（ルートマップ用補完）
  const [geocodedOrigin, setGeocodedOrigin] = useState<Coordinates | null>(null);
  const [geocodedDest, setGeocodedDest] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (!isRouteMap) return;
    let isCancelled = false;

    if (!originCoordinates && originLabel) {
      geocodeAddress(originLabel).then((coords) => {
        if (!isCancelled) setGeocodedOrigin(coords);
      });
    }
    if (!destinationCoordinates && destinationLabel) {
      geocodeAddress(destinationLabel).then((coords) => {
        if (!isCancelled) setGeocodedDest(coords);
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [isRouteMap, originCoordinates, destinationCoordinates, originLabel, destinationLabel]);

  const originCoords = useMemo<Coordinates>(() => {
    if (originCoordinates) return originCoordinates;
    if (geocodedOrigin) return geocodedOrigin;
    return resolveCoordinatesFromText(originLabel, { latitude: 35.6812, longitude: 139.7671 });
  }, [originCoordinates, geocodedOrigin, originLabel]);

  const destCoords = useMemo<Coordinates>(() => {
    if (destinationCoordinates) return destinationCoordinates;
    if (geocodedDest) return geocodedDest;
    return resolveCoordinatesFromText(destinationLabel, { latitude: 35.6812, longitude: 139.7671 });
  }, [destinationCoordinates, geocodedDest, destinationLabel]);

  // 描画用ルート座標列
  const routePoints = useMemo<Coordinates[]>(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      return routeCoordinates.map((c) => ({
        latitude: "lat" in c ? c.lat : c.latitude,
        longitude: "lng" in c ? c.lng : c.longitude,
      }));
    }

    // デモ用Yoga〜Gotembaルートの場合のみ、東名高速カーブのサンプル中継点を挿入
    const isYoga =
      Math.abs(originCoords.latitude - 35.6266) < 0.02 &&
      Math.abs(originCoords.longitude - 139.63) < 0.02;
    const isGotemba =
      Math.abs(destCoords.latitude - 35.2974) < 0.02 &&
      Math.abs(destCoords.longitude - 138.9348) < 0.02;
    if (isYoga && isGotemba) {
      return [
        { latitude: originCoords.latitude, longitude: originCoords.longitude },
        { latitude: 35.4336, longitude: 139.3957 }, // 海老名
        { latitude: 35.3105, longitude: 138.9818 }, // 足柄
        { latitude: destCoords.latitude, longitude: destCoords.longitude },
      ];
    }

    return [
      { latitude: originCoords.latitude, longitude: originCoords.longitude },
      { latitude: destCoords.latitude, longitude: destCoords.longitude },
    ];
  }, [routeCoordinates, originCoords, destCoords]);

  // 代替ルート描画用座標列（比較表示用）
  const secondaryRoutePoints = useMemo<Coordinates[]>(() => {
    if (secondaryRouteCoordinates && secondaryRouteCoordinates.length > 0) {
      return secondaryRouteCoordinates.map((c) => ({
        latitude: "lat" in c ? c.lat : c.latitude,
        longitude: "lng" in c ? c.lng : c.longitude,
      }));
    }
    return [];
  }, [secondaryRouteCoordinates]);

  const resolvedRouteColor = routeColor ?? colors.route.active;
  const resolvedRouteCasingColor = routeCasingColor ?? colors.route.activeCasing;

  // 初期カメラリージョン
  const initialRegion = useMemo<Region>(() => {
    if (isRouteMap) {
      const midLat = (originCoords.latitude + destCoords.latitude) / 2;
      const midLng = (originCoords.longitude + destCoords.longitude) / 2;
      const deltaLat = Math.max(Math.abs(originCoords.latitude - destCoords.latitude) * 1.5, 0.05);
      const deltaLng = Math.max(
        Math.abs(originCoords.longitude - destCoords.longitude) * 1.5,
        0.05,
      );
      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: deltaLat,
        longitudeDelta: deltaLng,
      };
    }

    return {
      latitude: defaultCoords.latitude,
      longitude: defaultCoords.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
  }, [isRouteMap, originCoords, destCoords, defaultCoords]);

  // 外部からの初期座標変更時にカメラを移動
  useEffect(() => {
    if (isRouteMap) {
      if (routePoints.length > 0 && mapRef.current) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(routePoints, {
            edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
            animated: true,
          });
        }, 100);
      }
      return;
    }

    if (initialCoordinates && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: initialCoordinates.latitude,
          longitude: initialCoordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        300,
      );
    }
  }, [isRouteMap, initialCoordinates, routePoints]);

  // 地図タップ時のピン移動ハンドラ
  const handleMapPress = (e: MapPressEvent) => {
    if (isRouteMap) return;
    const coords = e.nativeEvent.coordinate;
    setPickedCoords(coords);
    onLocationSelect?.(coords);
  };

  // ピンのドラッグ終了時ハンドラ
  const handleMarkerDragEnd = (e: MarkerDragStartEndEvent) => {
    if (isRouteMap) return;
    const coords = e.nativeEvent.coordinate;
    setPickedCoords(coords);
    onLocationSelect?.(coords);
  };

  // ズームイン・アウト操作
  const handleZoom = (zoomIn: boolean) => {
    if (!mapRef.current) return;
    mapRef.current
      .getCamera()
      .then((camera) => {
        if (camera.altitude) {
          camera.altitude = zoomIn ? camera.altitude / 2 : camera.altitude * 2;
          mapRef.current?.animateCamera(camera, { duration: 250 });
        } else if (camera.zoom !== undefined) {
          camera.zoom = zoomIn ? camera.zoom + 1 : camera.zoom - 1;
          mapRef.current?.animateCamera(camera, { duration: 250 });
        }
      })
      .catch(() => {
        // フォールバック
      });
  };

  // 選択位置へカメラをリセット
  const handleRecenter = () => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      300,
    );
  };

  const isOriginPin = pinLabel.includes("出発");
  const balloonColor = isOriginPin ? colors.warning[500] : colors.primary[600];

  return (
    <View style={[styles.container, { height }, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#eef2ef" }]}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {isRouteMap ? (
          <>
            {/* 代替ルート（存在する場合、背景に落ち着いたスレートグレーで描画） */}
            {secondaryRoutePoints.length > 0 && (
              <>
                <Polyline
                  coordinates={secondaryRoutePoints}
                  strokeColor={colors.route.alternativeCasing}
                  strokeWidth={7}
                  lineCap="round"
                  lineJoin="round"
                />
                <Polyline
                  coordinates={secondaryRoutePoints}
                  strokeColor={colors.route.alternative}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              </>
            )}

            {/* 選択中ルート 外枠ケーシング（昼夜・水域・緑地・ダークモード問わず高コントラストを保証） */}
            <Polyline
              coordinates={routePoints}
              strokeColor={resolvedRouteCasingColor}
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
            />
            {/* 選択中ルート メインライン（鮮やかで視認性の高いナビゲーションブルー） */}
            <Polyline
              coordinates={routePoints}
              strokeColor={resolvedRouteColor}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />

            {/* 出発地マーカー */}
            <Marker coordinate={originCoords} anchor={{ x: 0.5, y: 0.82 }}>
              <View style={styles.routePinContainer}>
                <View style={[styles.pinBalloon, { backgroundColor: colors.route.origin }]}>
                  <Text style={styles.pinBalloonText} numberOfLines={1}>
                    {originPinLabel}
                  </Text>
                </View>
                <View style={[styles.pinArrow, { borderTopColor: colors.route.origin }]} />
                <View style={styles.pinCore}>
                  <View style={[styles.pinDot, { backgroundColor: colors.route.origin }]} />
                </View>
              </View>
            </Marker>

            {/* 目的地マーカー */}
            <Marker coordinate={destCoords} anchor={{ x: 0.5, y: 0.82 }}>
              <View style={styles.routePinContainer}>
                <View style={[styles.pinBalloon, { backgroundColor: colors.route.destination }]}>
                  <Text style={styles.pinBalloonText} numberOfLines={1}>
                    {destinationPinLabel}
                  </Text>
                </View>
                <View style={[styles.pinArrow, { borderTopColor: colors.route.destination }]} />
                <View style={styles.pinCore}>
                  <View style={[styles.pinDot, { backgroundColor: colors.route.destination }]} />
                </View>
              </View>
            </Marker>
          </>
        ) : (
          /* 地点選択用マーカー */
          <Marker
            coordinate={currentCoords}
            draggable
            onDragEnd={handleMarkerDragEnd}
            anchor={{ x: 0.5, y: 0.8 }}
          >
            <View style={styles.customPinContainer}>
              <View style={[styles.pinBalloon, { backgroundColor: balloonColor }]}>
                <Text style={styles.pinBalloonText}>{pinLabel}</Text>
              </View>
              <View style={[styles.pinArrow, { borderTopColor: balloonColor }]} />
              <View style={styles.pinCore}>
                <View style={[styles.pinDot, { backgroundColor: balloonColor }]} />
                <View
                  style={[
                    styles.pinRadiusRing,
                    { backgroundColor: `${balloonColor}1a`, borderColor: `${balloonColor}80` },
                  ]}
                />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* 地点選択用ヒントバッジ */}
      {!isRouteMap && (
        <View style={styles.hintBadge} pointerEvents="none">
          <Text style={styles.hintText}>タップまたはドラッグでピンを移動</Text>
        </View>
      )}

      {/* ズーム & リセンター コントロール */}
      {showZoomControls && !isRouteMap && (
        <View style={styles.mapControlsGroup}>
          <Pressable
            style={({ pressed }) => [styles.controlMiniBtn, pressed && styles.controlBtnPressed]}
            onPress={() => handleZoom(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="ズームイン"
          >
            <Plus size={16} color={colors.neutral[800]} />
          </Pressable>
          <View style={styles.controlDivider} />
          <Pressable
            style={({ pressed }) => [styles.controlMiniBtn, pressed && styles.controlBtnPressed]}
            onPress={() => handleZoom(false)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="ズームアウト"
          >
            <Minus size={16} color={colors.neutral[800]} />
          </Pressable>
          <View style={styles.controlDivider} />
          <Pressable
            style={({ pressed }) => [styles.controlMiniBtn, pressed && styles.controlBtnPressed]}
            onPress={handleRecenter}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="ピン位置に合わせる"
          >
            <Navigation size={15} color={colors.primary[600]} />
          </Pressable>
        </View>
      )}

      {/* ルートマップ表示時の情報バッジ */}
      {isRouteMap && (
        <View style={styles.routeOverlayContainer} pointerEvents="none">
          <View style={styles.routePill}>
            <View style={styles.routePillItem}>
              <View style={[styles.dot, { backgroundColor: colors.route.origin }]} />
              <Text style={styles.routePillText} numberOfLines={1}>
                {originLabel}
              </Text>
            </View>
            <ArrowRight size={12} color={colors.neutral[400]} />
            <View style={styles.routePillItem}>
              <View style={[styles.dot, { backgroundColor: colors.route.destination }]} />
              <Text style={styles.routePillText} numberOfLines={1}>
                {destinationLabel}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 右上のコントロール（展開、外部リンク） */}
      {(showExpandButton || showExternalButton) && (
        <View style={styles.topRightControls}>
          {showExpandButton && onExpandPress && (
            <Pressable
              onPress={onExpandPress}
              style={({ pressed }) => [
                styles.singleControlBtn,
                pressed && styles.controlBtnPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isExpanded ? "地図を縮小" : "地図を拡大"}
            >
              {isExpanded ? (
                <Minimize2 size={16} color={colors.neutral[800]} />
              ) : (
                <Maximize2 size={16} color={colors.neutral[800]} />
              )}
            </Pressable>
          )}
          {showExternalButton && onOpenExternal && (
            <Pressable
              onPress={onOpenExternal}
              style={({ pressed }) => [
                styles.singleControlBtn,
                pressed && styles.controlBtnPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="外部地図アプリで開く"
            >
              <ExternalLink size={15} color={colors.primary[600]} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#eef2ef",
  },
  hintBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: "#dce3dd",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  hintText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#38423d",
  },
  customPinContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinBalloon: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#1c2420",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  pinBalloonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  pinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginBottom: 1,
  },
  pinCore: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 2,
  },
  pinRadiusRing: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    zIndex: 1,
  },
  routePinContainer: {
    width: 96,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControlsGroup: {
    position: "absolute",
    right: 10,
    bottom: 12,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dce3dd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
    zIndex: 10,
  },
  controlMiniBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  controlDivider: {
    height: 1,
    backgroundColor: "#eef2ef",
  },
  controlBtnPressed: {
    backgroundColor: "#f0f4f1",
    transform: [{ scale: 0.94 }],
  },
  routeOverlayContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    alignItems: "center",
    zIndex: 10,
  },
  routePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.base.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    gap: 6,
  },
  routePillItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  topRightControls: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    gap: 6,
    zIndex: 10,
  },
  singleControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.base.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
