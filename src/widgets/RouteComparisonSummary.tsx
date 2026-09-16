import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Linking,
  Platform,
  Dimensions,
  StatusBar as RNStatusBar,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Map, Expand, ExternalLink, X } from "lucide-react-native";
import type { CompareRoutesResult } from "../contracts";
import type { ColorTheme } from "../shared/theme";
import { RouteCard, AlertBanner, ActionFooter } from "../components/ui";
import { GoogleMapView } from "../components/map/GoogleMapView";
import { colors } from "../shared/theme/colors";
import { buildGoogleMapsDirectionsUrl, type Coordinates } from "../domain/location";

export interface RouteComparisonSummaryProps {
  theme?: ColorTheme;
  result: CompareRoutesResult;
  answerText?: string;
  origin?: string;
  destination?: string;
  originCoordinates?: Coordinates;
  destinationCoordinates?: Coordinates;
  onBackToSearch?: () => void;
}

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}時間${m < 10 ? "0" + m : m}分`;
  return `${m}分`;
};

const formatETA = (minutes: number, baseDate: Date) => {
  const eta = new Date(baseDate.getTime() + minutes * 60 * 1000);
  const hh = eta.getHours();
  const mm = eta.getMinutes();
  return `${hh}:${mm < 10 ? "0" + mm : mm}着`;
};

export function RouteComparisonSummary({
  result,
  answerText,
  origin = "用賀IC",
  destination = "御殿場IC",
  originCoordinates,
  destinationCoordinates,
  onBackToSearch,
}: RouteComparisonSummaryProps) {
  const [baseDate] = useState(() => new Date());
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const safeTop =
    insets.top > 0 ? insets.top : Platform.OS === "ios" ? 44 : (RNStatusBar.currentHeight ?? 0);
  const safeBottom = insets.bottom > 0 ? insets.bottom : Platform.OS === "ios" ? 16 : 0;

  const isExpresswayRecommended = result.recommendedRoute === "expressway";
  const [selectedRouteType, setSelectedRouteType] = useState<"expressway" | "local">(
    isExpresswayRecommended ? "expressway" : "local",
  );

  const activeRoute =
    selectedRouteType === "expressway" ? result.expresswayRoute : result.localRoute;
  const secondaryRoute =
    selectedRouteType === "expressway" ? result.localRoute : result.expresswayRoute;

  const polylineCoords = activeRoute.routePolyline;
  const secondaryPolylineCoords = secondaryRoute.routePolyline;

  const effectiveOriginCoords = React.useMemo(() => {
    if (polylineCoords && polylineCoords.length > 0) {
      return { latitude: polylineCoords[0].lat, longitude: polylineCoords[0].lng };
    }
    return originCoordinates;
  }, [polylineCoords, originCoordinates]);

  const effectiveDestCoords = React.useMemo(() => {
    if (polylineCoords && polylineCoords.length > 0) {
      const last = polylineCoords[polylineCoords.length - 1];
      return { latitude: last.lat, longitude: last.lng };
    }
    return destinationCoordinates;
  }, [polylineCoords, destinationCoordinates]);

  const expresswayToll = result.expresswayRoute.tollYen ?? 3250;
  const distanceKm = activeRoute.distanceKm || (selectedRouteType === "expressway" ? 82.5 : 78.0);

  const viaHighway =
    result.expresswayRoute.majorHighway || result.expresswayRoute.highwayNames?.[0];

  const highwayBreakdown = React.useMemo(() => {
    const toll = result.expresswayRoute.tollYen;
    if (toll === null || toll === 0) {
      return undefined;
    }

    const tollStr = `¥${toll.toLocaleString()}`;
    const highwayNames = result.expresswayRoute.highwayNames ?? [];
    const major = result.expresswayRoute.majorHighway;

    if (highwayNames.length === 1) {
      return [{ label: highwayNames[0], amount: tollStr }];
    }

    if (highwayNames.length > 1) {
      const primary = major || highwayNames[0];
      const others = highwayNames.filter((name) => name !== primary);
      if (others.length > 0) {
        return [
          { label: primary, amount: tollStr },
          ...others.map((name) => ({ label: `（経由: ${name}）`, amount: "含む" })),
        ];
      }
      return [{ label: primary, amount: tollStr }];
    }

    if (major) {
      return [{ label: major, amount: tollStr }];
    }

    return [{ label: "高速・有料道路利用料", amount: tollStr }];
  }, [result.expresswayRoute]);

  const handleOpenExternalGoogleMaps = () => {
    const url = buildGoogleMapsDirectionsUrl(origin, destination);
    void Linking.openURL(url);
  };

  return (
    <View style={styles.outerContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* おすすめハイライト (Alert Banner) */}
        <AlertBanner
          type="Recommendation"
          title={isExpresswayRecommended ? "高速道路ルートがおすすめ" : "一般道ルートがおすすめ"}
          description={
            result.recommendationReason ||
            "所要時間を1時間10分短縮できます。時間価値を考慮すると高速道路がお得です。"
          }
          style={styles.alertBanner}
        />

        {/* 距離ストリップ */}
        <View style={styles.distanceStrip}>
          <Text style={styles.distanceText}>
            距離: {distanceKm.toFixed(1)} km（
            {selectedRouteType === "expressway" ? "高速優先" : "一般道"}）
          </Text>
        </View>

        {/* ルート比較カード (高速道路 & 一般道) */}
        <View style={styles.cardsContainer}>
          {/* 高速道路ルート */}
          <RouteCard
            type="highway"
            badgeLabel="高速道路ルート"
            viaHighway={viaHighway}
            durationText={formatDuration(result.expresswayRoute.durationMinutes || 75)}
            etaText={formatETA(result.expresswayRoute.durationMinutes || 75, baseDate)}
            tollText={`料金: ¥${expresswayToll.toLocaleString()}`}
            fuelText={`燃料費: 約${result.expresswayRoute.fuelCostYen.toLocaleString()}円`}
            isRecommended={isExpresswayRecommended}
            tollBreakdown={highwayBreakdown}
            totalTollText={`¥${expresswayToll.toLocaleString()}`}
            onPress={() => setSelectedRouteType("expressway")}
            style={selectedRouteType === "expressway" ? styles.selectedCardHighlight : undefined}
          />

          {/* 一般道ルート */}
          <RouteCard
            type="general"
            badgeLabel="一般道ルート"
            durationText={formatDuration(result.localRoute.durationMinutes || 145)}
            etaText={formatETA(result.localRoute.durationMinutes || 145, baseDate)}
            tollText="料金: なし (0円)"
            fuelText={`燃料費: 約${result.localRoute.fuelCostYen.toLocaleString()}円`}
            isRecommended={!isExpresswayRecommended}
            onPress={() => setSelectedRouteType("local")}
            style={selectedRouteType === "local" ? styles.selectedCardHighlight : undefined}
          />
        </View>

        {/* サマリー解説文 (Figma 33:3379) */}
        <Text style={styles.summaryNote}>
          {answerText ||
            "一般道に比べ、所要時間が50分短縮されます。ストップ＆ゴーが減るため燃費効率が向上し、結果的に燃料費もお得になります。"}
        </Text>

        {/* ルートマップセクション (Figma 202:613) */}
        <View style={styles.routeMapSection}>
          <View style={styles.routeMapHeader}>
            <View style={styles.sectionTitleRow}>
              <Map size={18} color={colors.route.active} />
              <Text style={styles.sectionTitle}>ルートマップ</Text>
            </View>

            {/* ルート切り替えスイッチ (高速 / 一般道) */}
            <View style={styles.routeSwitchGroup}>
              <Pressable
                onPress={() => setSelectedRouteType("expressway")}
                style={({ pressed }) => [
                  styles.routeSwitchBtn,
                  selectedRouteType === "expressway" && styles.routeSwitchBtnActive,
                  pressed && styles.routeSwitchBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="高速道路ルートを強調表示"
              >
                <View
                  style={[
                    styles.routeSwitchDot,
                    selectedRouteType === "expressway"
                      ? styles.routeSwitchDotActive
                      : styles.routeSwitchDotInactive,
                  ]}
                />
                <Text
                  style={[
                    styles.routeSwitchText,
                    selectedRouteType === "expressway" && styles.routeSwitchTextActive,
                  ]}
                >
                  高速優先
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedRouteType("local")}
                style={({ pressed }) => [
                  styles.routeSwitchBtn,
                  selectedRouteType === "local" && styles.routeSwitchBtnActive,
                  pressed && styles.routeSwitchBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="一般道ルートを強調表示"
              >
                <View
                  style={[
                    styles.routeSwitchDot,
                    selectedRouteType === "local"
                      ? styles.routeSwitchDotActive
                      : styles.routeSwitchDotInactive,
                  ]}
                />
                <Text
                  style={[
                    styles.routeSwitchText,
                    selectedRouteType === "local" && styles.routeSwitchTextActive,
                  ]}
                >
                  一般道
                </Text>
              </Pressable>
            </View>

            <View style={styles.mapActionRow}>
              {/* 全画面モーダル表示 */}
              <Pressable
                onPress={() => setIsFullscreenModalOpen(true)}
                style={({ pressed }) => [
                  styles.mapHeaderBtn,
                  styles.mapHeaderBtnPrimary,
                  pressed && styles.mapHeaderBtnPressed,
                ]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="地図を全画面で表示"
              >
                <Expand size={15} color={colors.primary[700]} />
                <Text style={[styles.mapHeaderBtnText, styles.mapHeaderBtnTextPrimary]}>
                  全画面
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Google Map View: 快適な固定高さ380px */}
          {!isFullscreenModalOpen ? (
            <GoogleMapView
              height={380}
              isRouteMap={true}
              originLabel={origin}
              destinationLabel={destination}
              originCoordinates={effectiveOriginCoords}
              destinationCoordinates={effectiveDestCoords}
              routeCoordinates={polylineCoords}
              secondaryRouteCoordinates={secondaryPolylineCoords}
              showCenterPin={false}
              showZoomControls={true}
              showFitButton={true}
            />
          ) : (
            <View style={[styles.inlineMapPlaceholder, { height: 380 }]} />
          )}

          {/* マップ下部操作案内 & 外部リンクバー */}
          <View style={styles.mapFooterBar}>
            <Text style={styles.mapHintText}>💡 ピンチやドラッグで操作 / 右上で全画面表示</Text>
            <Pressable
              onPress={handleOpenExternalGoogleMaps}
              style={({ pressed }) => [
                styles.openExternalLink,
                pressed && styles.openExternalLinkPressed,
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Googleマップアプリでナビを開始"
            >
              <Text style={styles.openExternalLinkText}>Googleマップで開く</Text>
              <ExternalLink size={14} color={colors.primary[600]} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* 固定フッター (条件を変更して再検索) */}
      <ActionFooter label="条件を変更して再検索" onPress={onBackToSearch} state="Default" />

      {/* 全画面地図モーダル */}
      <Modal
        visible={isFullscreenModalOpen}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsFullscreenModalOpen(false)}
        statusBarTranslucent={true}
        presentationStyle="fullScreen"
      >
        <SafeAreaProvider
          style={{ flex: 1, backgroundColor: colors.base.white }}
          initialMetrics={{
            frame: {
              x: 0,
              y: 0,
              width: Dimensions.get("window").width,
              height: Dimensions.get("window").height,
            },
            insets,
          }}
        >
          <View style={[styles.fullscreenContainer, { paddingBottom: safeBottom }]}>
            <StatusBar style="dark" backgroundColor={colors.base.white} translucent={true} />

            {/* Header: ステータスバー・Dynamic Island領域まで白背景を伸ばし、UI要素は安全領域下に配置 */}
            <View style={[styles.fullscreenHeader, { paddingTop: safeTop + 6 }]}>
              <Pressable
                onPress={() => setIsFullscreenModalOpen(false)}
                style={({ pressed }) => [
                  styles.fullscreenCloseBtn,
                  pressed && styles.fullscreenCloseBtnPressed,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="全画面表示を閉じる"
              >
                <X size={20} color={colors.neutral[800]} />
                <Text style={styles.fullscreenCloseText}>閉じる</Text>
              </Pressable>
              <Pressable
                onPress={handleOpenExternalGoogleMaps}
                style={({ pressed }) => [
                  styles.fullscreenExternalBtn,
                  pressed && styles.fullscreenExternalBtnPressed,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Googleマップアプリで開く"
              >
                <ExternalLink size={15} color={colors.base.white} />
                <Text style={styles.fullscreenExternalText}>外部アプリ</Text>
              </Pressable>
            </View>

            {/* Quick Route Summary Ribbon */}
            <View style={styles.fullscreenRibbon}>
              <Pressable
                onPress={() => setSelectedRouteType("expressway")}
                style={[
                  styles.ribbonItem,
                  selectedRouteType === "expressway" && styles.ribbonItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="高速道路ルートを選択"
              >
                <Text
                  style={[
                    styles.ribbonLabel,
                    selectedRouteType === "expressway" && styles.ribbonLabelActive,
                  ]}
                >
                  高速道路 {selectedRouteType === "expressway" ? "✓" : ""}
                </Text>
                <Text
                  style={[
                    styles.ribbonValue,
                    selectedRouteType === "expressway" && styles.ribbonValueActive,
                  ]}
                >
                  {formatDuration(result.expresswayRoute.durationMinutes || 75)}
                  {"  "}(¥{expresswayToll.toLocaleString()})
                </Text>
              </Pressable>
              <View style={styles.ribbonDivider} />
              <Pressable
                onPress={() => setSelectedRouteType("local")}
                style={[
                  styles.ribbonItem,
                  selectedRouteType === "local" && styles.ribbonItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="一般道ルートを選択"
              >
                <Text
                  style={[
                    styles.ribbonLabel,
                    selectedRouteType === "local" && styles.ribbonLabelActive,
                  ]}
                >
                  一般道 {selectedRouteType === "local" ? "✓" : ""}
                </Text>
                <Text
                  style={[
                    styles.ribbonValue,
                    selectedRouteType === "local" && styles.ribbonValueActive,
                  ]}
                >
                  {formatDuration(result.localRoute.durationMinutes || 145)}
                  {"  "}(¥0)
                </Text>
              </Pressable>
              <View style={styles.ribbonDivider} />
              <View style={styles.ribbonItem}>
                <Text style={styles.ribbonLabel}>総距離</Text>
                <Text style={styles.ribbonValue}>{distanceKm.toFixed(1)} km</Text>
              </View>
            </View>

            {/* Fullscreen Map Area */}
            <View style={styles.fullscreenMapBox}>
              {isFullscreenModalOpen && (
                <GoogleMapView
                  height="100%"
                  isRouteMap={true}
                  originLabel={origin}
                  destinationLabel={destination}
                  originCoordinates={effectiveOriginCoords}
                  destinationCoordinates={effectiveDestCoords}
                  routeCoordinates={polylineCoords}
                  secondaryRouteCoordinates={secondaryPolylineCoords}
                  showCenterPin={false}
                  showZoomControls={true}
                  showFitButton={true}
                  style={styles.fullscreenMapInner}
                />
              )}
            </View>
          </View>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: colors.neutral[50], // #f4f6f4
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  alertBanner: {
    width: "100%",
  },
  distanceStrip: {
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  cardsContainer: {
    gap: 12,
    width: "100%",
  },
  summaryNote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.neutral[700],
  },
  routeMapSection: {
    gap: 10,
    width: "100%",
  },
  routeMapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.neutral[900],
  },
  mapActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapHeaderBtn: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  mapHeaderBtnPressed: {
    backgroundColor: colors.neutral[100],
    transform: [{ scale: 0.96 }],
  },
  mapHeaderBtnPrimary: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  mapHeaderBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  mapHeaderBtnTextPrimary: {
    color: colors.primary[700],
    fontWeight: "700",
  },
  mapFooterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  mapHintText: {
    fontSize: 12,
    color: colors.neutral[500],
    flex: 1,
  },
  openExternalLink: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  openExternalLinkPressed: {
    opacity: 0.7,
    backgroundColor: colors.neutral[100],
    transform: [{ scale: 0.96 }],
  },
  openExternalLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary[700],
  },

  // 全画面モーダル用スタイル
  fullscreenContainer: {
    flex: 1,
    backgroundColor: colors.base.white,
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  fullscreenCloseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 6,
    borderRadius: 8,
  },
  fullscreenCloseBtnPressed: {
    opacity: 0.7,
    backgroundColor: colors.neutral[100],
  },
  fullscreenCloseText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  fullscreenExternalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.primary[500],
  },
  fullscreenExternalBtnPressed: {
    backgroundColor: colors.primary[700],
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  fullscreenExternalText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.base.white,
    letterSpacing: 0.2,
  },
  selectedCardHighlight: {
    borderColor: colors.route.active,
    borderWidth: 2,
  },
  routeSwitchGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    borderRadius: 10,
    padding: 3,
  },
  routeSwitchBtn: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  routeSwitchBtnActive: {
    backgroundColor: colors.base.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  routeSwitchBtnPressed: {
    opacity: 0.7,
  },
  routeSwitchDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  routeSwitchDotActive: {
    backgroundColor: colors.route.active,
  },
  routeSwitchDotInactive: {
    backgroundColor: colors.route.alternative,
  },
  routeSwitchText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[600],
  },
  routeSwitchTextActive: {
    color: colors.route.active,
    fontWeight: "700",
  },
  ribbonItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.route.active,
    paddingBottom: 2,
  },
  ribbonLabelActive: {
    color: colors.route.active,
    fontWeight: "700",
  },
  ribbonValueActive: {
    color: colors.route.active,
  },
  fullscreenRibbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.base.white,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  ribbonItem: {
    alignItems: "center",
  },
  ribbonLabel: {
    fontSize: 10,
    color: colors.neutral[500],
    fontWeight: "500",
  },
  ribbonValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral[800],
    marginTop: 2,
  },
  ribbonDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.neutral[200],
  },
  fullscreenMapBox: {
    flex: 1,
    position: "relative",
    backgroundColor: "#eef2ef",
    overflow: "hidden",
  },
  fullscreenMapInner: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "#eef2ef",
  },
  inlineMapPlaceholder: {
    width: "100%",
    backgroundColor: "#e5ede7",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
});
