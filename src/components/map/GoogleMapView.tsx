import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
  type GestureResponderEvent,
} from "react-native";
import { Maximize2, Minimize2, ExternalLink, ArrowRight } from "lucide-react-native";
import { colors } from "../../shared/theme/colors";
import {
  type Coordinates,
  resolveCoordinatesFromText,
  geocodeAddress,
} from "../../domain/location";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

import type { GoogleMapViewProps } from "./GoogleMapView.types";
export type { GoogleMapViewProps };

export function GoogleMapView({
  height = 340,
  centerAddress = "東京駅",
  pinLabel = "選択位置",
  zoom: initialZoom = 15,
  showCenterPin: _showCenterPin = true,
  showZoomControls: _showZoomControls = true,
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
  // 基準座標の決定
  const defaultCoords = useMemo<Coordinates>(() => {
    if (initialCoordinates) return initialCoordinates;
    return resolveCoordinatesFromText(centerAddress, { latitude: 35.6812, longitude: 139.7671 });
  }, [initialCoordinates, centerAddress]);

  // 初回マウント時の開始座標（iframeの不要な再生成・リロードを防ぐため初回値を固定保持）
  const [initialMapCoords] = useState<Coordinates>(() => initialCoordinates ?? defaultCoords);

  const [pickedCoords, setPickedCoords] = useState<Coordinates | null>(null);
  const currentCoords = pickedCoords ?? initialCoordinates ?? defaultCoords;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 外部から座標が更新された場合はiframeを再生成せずpostMessageでカメラとピンをスムーズに移動
  useEffect(() => {
    if (!initialCoordinates) return;
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "ROUTEIQ_MAP_SET_VIEW",
          latitude: initialCoordinates.latitude,
          longitude: initialCoordinates.longitude,
        },
        "*",
      );
    }
  }, [initialCoordinates]);

  // Web環境: iframe 内の Leaflet から postMessage を受信
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "ROUTEIQ_MAP_PIN_SELECT") {
        const { latitude, longitude } = event.data;
        if (typeof latitude === "number" && typeof longitude === "number") {
          const newCoords: Coordinates = { latitude, longitude };
          setPickedCoords(newCoords);
          onLocationSelect?.(newCoords);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onLocationSelect]);

  // 非同期ジオコーディング（プロップで明示的な座標が渡されなかった場合の補完）
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
  const routePoints = useMemo(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      return routeCoordinates.map((c) => {
        const lat = "lat" in c ? c.lat : c.latitude;
        const lng = "lng" in c ? c.lng : c.longitude;
        return [lat, lng];
      });
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
        [originCoords.latitude, originCoords.longitude],
        [35.4336, 139.3957], // 海老名
        [35.3105, 138.9818], // 足柄
        [destCoords.latitude, destCoords.longitude],
      ];
    }

    // 一般ルート: 始点から終点への直線
    return [
      [originCoords.latitude, originCoords.longitude],
      [destCoords.latitude, destCoords.longitude],
    ];
  }, [routeCoordinates, originCoords, destCoords]);

  // 代替ルート座標列
  const secondaryRoutePoints = useMemo<number[][] | null>(() => {
    if (!secondaryRouteCoordinates || secondaryRouteCoordinates.length === 0) {
      return null;
    }
    return secondaryRouteCoordinates.map((c) => [
      "lat" in c ? c.lat : c.latitude,
      "lng" in c ? c.lng : c.longitude,
    ]);
  }, [secondaryRouteCoordinates]);

  // 視認性の高いルートカラー解決（デフォルトは鮮やかなナビゲーションブルーと白ケーシング）
  const resolvedRouteColor = routeColor ?? colors.route.active;
  const resolvedRouteCasingColor = routeCasingColor ?? colors.route.activeCasing;

  // Leaflet HTML (Web用インタラクティブマップ)
  // 注意: pickedCoords や currentCoords を依存配列に含めないこと。
  // 含めるとピン移動のたびにiframeがリロードされ、ズームや地図状態がリセットされてしまいます。
  const leafletSrcDoc = useMemo(() => {
    const balloonColor = pinLabel.includes("出発")
      ? colors.warning[500] // Coral orange
      : pinLabel.includes("目的")
        ? colors.primary[600] // Deep calm green
        : colors.primary[700];

    if (isRouteMap) {
      // ルート比較画面用
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #e5ede7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .leaflet-control-attribution { font-size: 9px !important; background: #ffffff !important; padding: 0 4px !important; border-radius: 4px; }
    .leaflet-bar { border: none !important; box-shadow: 0 2px 6px rgba(0,0,0,0.12) !important; border-radius: 8px !important; overflow: hidden; }
    .leaflet-bar a { background: #fff !important; color: #1c2420 !important; width: 32px !important; height: 32px !important; line-height: 32px !important; font-size: 15px !important; font-weight: bold !important; }
    .route-pin { display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #ffffff; padding: 5px 12px; border-radius: 16px; font-size: 12px; line-height: 16px; font-weight: 700; color: #1c2420; box-shadow: 0 3px 8px rgba(0,0,0,0.18); border: 1.5px solid #dce3dd; white-space: nowrap; min-width: 68px; }
    .route-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const orig = [${originCoords.latitude}, ${originCoords.longitude}];
    const dest = [${destCoords.latitude}, ${destCoords.longitude}];
    const map = L.map('map', {
      zoomControl: false,
      scrollWheelZoom: false
    });
    
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const origIcon = L.divIcon({
      className: '',
      html: '<div class="route-pin"><div class="route-dot" style="background:${colors.route.origin};"></div><span>${escapeHtml(originPinLabel)}</span></div>',
      iconSize: [76, 30],
      iconAnchor: [38, 15]
    });
    const destIcon = L.divIcon({
      className: '',
      html: '<div class="route-pin"><div class="route-dot" style="background:${colors.route.destination};"></div><span>${escapeHtml(destinationPinLabel)}</span></div>',
      iconSize: [76, 30],
      iconAnchor: [38, 15]
    });

    L.marker(orig, { icon: origIcon }).addTo(map);
    L.marker(dest, { icon: destIcon }).addTo(map);

    // 代替ルート描画（存在する場合）
    const secondaryPoints = ${JSON.stringify(secondaryRoutePoints)};
    if (secondaryPoints && secondaryPoints.length > 0) {
      L.polyline(secondaryPoints, {
        color: '${colors.route.alternativeCasing}',
        weight: 7,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      L.polyline(secondaryPoints, {
        color: '${colors.route.alternative}',
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    // 選択中ルート 外枠ケーシング描画（高コントラスト確保）
    const routePoints = ${JSON.stringify(routePoints)};
    L.polyline(routePoints, {
      color: '${resolvedRouteCasingColor}',
      weight: 9,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // 選択中ルート メインライン描画（鮮やかなナビゲーションブルー）
    L.polyline(routePoints, {
      color: '${resolvedRouteColor}',
      weight: 5,
      opacity: 1.0,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    if (routePoints.length > 1) {
      map.fitBounds(routePoints, { padding: [40, 40], maxZoom: 16 });
    } else {
      map.fitBounds([orig, dest], { padding: [40, 40], maxZoom: 16 });
    }
  </script>
</body>
</html>`;
    }

    // 地図選択モーダル用インタラクティブマップ
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #e5ede7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .leaflet-control-attribution { font-size: 8px !important; background: #ffffff !important; padding: 0 4px !important; border-radius: 4px; }
    .leaflet-bar { border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important; border-radius: 10px !important; overflow: hidden; margin-right: 12px !important; margin-bottom: 12px !important; }
    .leaflet-bar a { background: #fff !important; color: #1c2420 !important; width: 38px !important; height: 38px !important; line-height: 38px !important; font-size: 18px !important; font-weight: bold !important; border-bottom: 1px solid #dce3dd !important; }
    .leaflet-bar a:hover { background: #f4f6f4 !important; }
    .leaflet-tile { filter: saturate(0.82) contrast(1.02); }

    /* Custom Pin & Balloon: Exact 0px offset alignment */
    .custom-pin-container {
      width: 120px;
      height: 42px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      cursor: grab;
      user-select: none;
      margin: 0;
      padding: 0;
    }
    .custom-pin-container:active {
      cursor: grabbing;
    }
    .pin-balloon {
      height: 22px;
      line-height: 14px;
      background: ${balloonColor};
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 4px 8px rgba(28, 36, 32, 0.25);
      letter-spacing: 0.2px;
      pointer-events: none;
    }
    .pin-arrow {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid ${balloonColor};
      margin-bottom: 1px;
      pointer-events: none;
    }
    .pin-core {
      position: relative;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .pin-dot {
      width: 12px;
      height: 12px;
      background: ${balloonColor};
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.35);
      position: relative;
      z-index: 2;
    }
    .pin-radius-ring {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: ${balloonColor}1a;
      border: 1.5px dashed ${balloonColor}80;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: pulseRing 2.4s infinite ease-in-out;
    }
    @keyframes pulseRing {
      0% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.7; }
      50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.7; }
    }
    .tap-hint {
      position: absolute;
      top: 10px;
      left: 10px;
      background: #ffffff;
      border: 1px solid #dce3dd;
      padding: 4px 10px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 600;
      color: #38423d;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      pointer-events: none;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="tap-hint">タップまたはドラッグでピンを移動</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const lat = ${initialMapCoords.latitude};
    const lng = ${initialMapCoords.longitude};
    const zoom = ${initialZoom || 15};
    const pinText = ${JSON.stringify(pinLabel || "選択位置")};

    // scrollWheelZoom: false により、トラックパッド操作やスクロール時の意図しない拡大・縮小を防止
    const map = L.map('map', {
      center: [lat, lng],
      zoom: zoom,
      zoomControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      touchZoom: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // iconAnchor: [60, 35] により、pin-dot の中心 (x=60, y=22+6+7=35) が座標と完全に一致
    const customIcon = L.divIcon({
      className: '',
      html: \`
        <div class="custom-pin-container">
          <div class="pin-balloon">\${pinText}</div>
          <div class="pin-arrow"></div>
          <div class="pin-core">
            <div class="pin-dot"></div>
            <div class="pin-radius-ring"></div>
          </div>
        </div>
      \`,
      iconSize: [120, 42],
      iconAnchor: [60, 35],
    });

    const marker = L.marker([lat, lng], {
      icon: customIcon,
      draggable: true,
      autoPan: false
    }).addTo(map);

    function emitPin(latVal, lngVal) {
      window.parent.postMessage({
        type: 'ROUTEIQ_MAP_PIN_SELECT',
        latitude: latVal,
        longitude: lngVal
      }, '*');
    }

    // タップ時: カメラを急激に移動させず、ピンだけをタップした正確な位置へ移動
    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      emitPin(e.latlng.lat, e.latlng.lng);
    });

    marker.on('dragend', function(e) {
      const pos = marker.getLatLng();
      emitPin(pos.lat, pos.lng);
    });

    // 外部からの座標変更（現在地ボタンなど）を受信してカメラ・ピンを移動
    window.addEventListener('message', function(event) {
      if (!event.data) return;
      if (event.data.type === 'ROUTEIQ_MAP_SET_VIEW') {
        const nextLatLng = [event.data.latitude, event.data.longitude];
        marker.setLatLng(nextLatLng);
        map.setView(nextLatLng, map.getZoom(), { animate: true });
      }
    });
  </script>
</body>
</html>`;
  }, [
    isRouteMap,
    originCoords,
    destCoords,
    originPinLabel,
    destinationPinLabel,
    pinLabel,
    initialZoom,
    initialMapCoords,
    routePoints,
  ]);

  // Native環境用のタップハンドラ
  const handleNativePress = (event: GestureResponderEvent) => {
    if (isRouteMap) return;
    const { locationX, locationY } = event.nativeEvent;
    // 画面タップ座標から微小オフセットを加えてピン移動をシミュレート
    const offsetLat = (170 - locationY) * 0.0003;
    const offsetLng = (locationX - 170) * 0.0003;
    const newCoords: Coordinates = {
      latitude: currentCoords.latitude + offsetLat,
      longitude: currentCoords.longitude + offsetLng,
    };
    setPickedCoords(newCoords);
    onLocationSelect?.(newCoords);
  };

  return (
    <View style={[styles.container, { height }, style]}>
      {Platform.OS === "web" ? (
        <iframe
          ref={iframeRef}
          srcDoc={leafletSrcDoc}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            pointerEvents: "auto",
            backgroundColor: "#e5ede7",
          }}
          title="RouteIQ Map"
        />
      ) : (
        /* Native Fallback: タップでピン移動可能なスタイライズドマップ */
        <Pressable style={styles.nativeMapContainer} onPress={handleNativePress}>
          <View style={styles.nativeGrid}>
            <View style={styles.nativeWaterArea} />
            <View style={styles.nativeRoadH} />
            <View style={styles.nativeRoadV} />
            <View style={styles.nativeRoadD} />
          </View>
          <View style={styles.nativeCenterPin} pointerEvents="none">
            <View
              style={[
                styles.nativeBalloon,
                pinLabel.includes("出発")
                  ? { backgroundColor: colors.warning[500] }
                  : { backgroundColor: colors.primary[600] },
              ]}
            >
              <Text style={styles.nativeBalloonText}>{pinLabel}</Text>
            </View>
            <View style={styles.nativePinDot} />
            <View style={styles.nativeRadiusRing} />
          </View>
          <View style={styles.nativeHintBadge} pointerEvents="none">
            <Text style={styles.nativeHintText}>タップでピンを移動</Text>
          </View>
        </Pressable>
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
    backgroundColor: "#e5ede7",
  },
  nativeMapContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#e5ede7",
    alignItems: "center",
    justifyContent: "center",
  },
  nativeGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  nativeWaterArea: {
    position: "absolute",
    bottom: -20,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#d0e6e9",
  },
  nativeRoadH: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.base.white,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  nativeRoadV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "35%",
    width: 6,
    backgroundColor: colors.base.white,
  },
  nativeRoadD: {
    position: "absolute",
    top: 20,
    left: -40,
    width: 380,
    height: 4,
    backgroundColor: colors.base.white,
    transform: [{ rotate: "25deg" }],
  },
  nativeCenterPin: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  nativeBalloon: {
    backgroundColor: colors.warning[500],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  nativeBalloonText: {
    color: colors.base.white,
    fontSize: 11,
    fontWeight: "bold",
  },
  nativePinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.warning[500],
    borderWidth: 2,
    borderColor: colors.base.white,
  },
  nativeRadiusRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(224, 122, 95, 0.5)",
    backgroundColor: "rgba(224, 122, 95, 0.1)",
    top: "50%",
    left: "50%",
    marginLeft: -36,
    marginTop: -22,
  },
  nativeHintBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.base.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  nativeHintText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  topRightControls: {
    position: "absolute",
    top: 12,
    right: 12,
    gap: 8,
    alignItems: "center",
    zIndex: 100,
  },
  singleControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  controlBtnPressed: {
    backgroundColor: colors.neutral[100],
    transform: [{ scale: 0.94 }],
  },
  routeOverlayContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 56,
    zIndex: 100,
  },
  routePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.base.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  routePillItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  routePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral[800],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
