import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { View, StyleSheet, Platform, StatusBar } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../src/shared/theme/colors";
import { SearchTopView, type HistoryEntry } from "../src/widgets/SearchTopView";
import { RouteComparisonSummary } from "../src/widgets/RouteComparisonSummary";
import { BackHeader, Toast } from "../src/components/ui";
import { MapSelectModal } from "../src/widgets/MapSelectModal";
import { ConditionEditSheet, setCachedFuelPriceAverages } from "../src/widgets/ConditionEditSheet";
import { LoadingSkeletonView } from "../src/widgets/LoadingSkeletonView";
import { ErrorStateView } from "../src/widgets/ErrorStateView";
import { useHarness } from "../src/harness/HarnessContext";
import { lightTheme } from "../src/shared/theme";
import type { RouteAnalysisResult } from "../src/contracts";
import { describeRouteError, type DescribedRouteError } from "../src/shared/api";
import { getCurrentLocationWithCoords, type Coordinates } from "../src/domain/location";
import {
  loadStoredHistory,
  saveStoredHistory,
  addOrUpdateHistoryItem,
  removeHistoryItem,
  formatHistoryDate,
} from "../src/domain/history";

export type ScreenMode = "input" | "loading" | "results" | "error_network" | "error_not_found";

interface ToastHostHandle {
  show: (message: string, type?: "Success" | "Error", duration?: number) => void;
  hide: () => void;
}

/**
 * トースト状態を独立管理することで、表示・自動非表示のたびに
 * 親画面（SearchTopView / RouteComparisonSummary / GoogleMapView）が再描画されるのを完全に防止
 */
const ToastHost = React.memo(
  forwardRef<ToastHostHandle, { hidden: boolean }>(function ToastHost({ hidden }, ref) {
    const insets = useSafeAreaInsets();
    const [toast, setToast] = useState<{
      visible: boolean;
      message: string;
      type: "Success" | "Error";
    }>({
      visible: false,
      message: "",
      type: "Success",
    });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hide = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setToast((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    }, []);

    const show = useCallback(
      (message: string, type: "Success" | "Error" = "Success", duration: number = 3500) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setToast({ visible: true, message, type });
        if (duration > 0) {
          timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            setToast((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          }, duration);
        }
      },
      [],
    );

    useImperativeHandle(ref, () => ({ show, hide }), [show, hide]);

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    if (!toast.visible || hidden) {
      return null;
    }

    return (
      <View
        style={[
          styles.toastOverlayContainer,
          { bottom: 84 + (insets.bottom > 0 ? insets.bottom : 16) },
        ]}
        pointerEvents="none"
      >
        <Toast message={toast.message} type={toast.type} />
      </View>
    );
  }),
);

export default function RouteComparisonScreen() {
  const { analyzeRoute, getFuelPrices } = useHarness();
  const [analysisResult, setAnalysisResult] = useState<RouteAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>("input");
  const [errorDetails, setErrorDetails] = useState<DescribedRouteError | null>(null);

  // Form State
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState<Coordinates | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinates | null>(null);
  const [fuelEfficiency, setFuelEfficiency] = useState("15.0");
  const [fuelPrice, setFuelPrice] = useState("170");
  const [vehicleType, setVehicleType] = useState("普通車");

  // Modal State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<"origin" | "destination">("origin");
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);

  // コールバック参照を安定化するため最新状態を Effect 内で Ref へ同期
  const stateRef = useRef({
    origin,
    destination,
    originCoords,
    destinationCoords,
    fuelEfficiency,
    fuelPrice,
    vehicleType,
    mapTarget,
    isFetchingLocation,
  });
  useEffect(() => {
    stateRef.current = {
      origin,
      destination,
      originCoords,
      destinationCoords,
      fuelEfficiency,
      fuelPrice,
      vehicleType,
      mapTarget,
      isFetchingLocation,
    };
  }, [
    origin,
    destination,
    originCoords,
    destinationCoords,
    fuelEfficiency,
    fuelPrice,
    vehicleType,
    mapTarget,
    isFetchingLocation,
  ]);

  // Load fuel prices on mount to initialize default price with surveyed average
  useEffect(() => {
    let isMounted = true;
    getFuelPrices()
      .then((res) => {
        if (!isMounted) return;
        setCachedFuelPriceAverages(res);
        const regular = res.prices.find((p) => p.label.includes("レギュラー")) ?? res.prices[0];
        if (regular && regular.value > 0) {
          setFuelPrice((prev) => (prev === "170" ? String(regular.value) : prev));
        }
      })
      .catch(() => {
        // Silently keep default fallback price
      });
    return () => {
      isMounted = false;
    };
  }, [getFuelPrices]);

  // History State
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);

  // Load history from AsyncStorage on mount
  useEffect(() => {
    let isMounted = true;
    loadStoredHistory().then((items) => {
      if (isMounted) {
        setHistoryList(items);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Toast Host Ref (Step 5: Figma 118:308 & 118:358)
  const toastHostRef = useRef<ToastHostHandle | null>(null);

  const showToast = useCallback(
    (message: string, type: "Success" | "Error" = "Success", duration: number = 3500) => {
      toastHostRef.current?.show(message, type, duration);
    },
    [],
  );

  const hideToast = useCallback(() => {
    toastHostRef.current?.hide();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__setRouteIQScreen = setScreenMode;
      (window as unknown as Record<string, unknown>).__showRouteIQToast = showToast;
    }
  }, [showToast]);

  const handleChangeOrigin = useCallback((text: string) => {
    setOrigin(text);
    setOriginCoords(null);
  }, []);

  const handleChangeDestination = useCallback((text: string) => {
    setDestination(text);
    setDestinationCoords(null);
  }, []);

  const handleSwap = useCallback(() => {
    const {
      origin: curOrigin,
      destination: curDestination,
      originCoords: curOriginCoords,
      destinationCoords: curDestinationCoords,
    } = stateRef.current;
    setOrigin(curDestination);
    setDestination(curOrigin);
    setOriginCoords(curDestinationCoords);
    setDestinationCoords(curOriginCoords);
  }, []);

  const handleCurrentLocationPress = useCallback(async () => {
    if (stateRef.current.isFetchingLocation) return;
    setIsFetchingLocation(true);
    try {
      const { address, coords } = await getCurrentLocationWithCoords();
      setOrigin(address);
      setOriginCoords(coords);
      showToast("現在地を取得しました", "Success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "現在地を取得できませんでした。再度お試しください。";
      showToast(msg, "Error");
    } finally {
      setIsFetchingLocation(false);
    }
  }, [showToast]);

  const handleSelectHistory = useCallback((item: HistoryEntry) => {
    setOrigin(item.origin);
    setDestination(item.destination);
    setOriginCoords(null);
    setDestinationCoords(null);
  }, []);

  const handleDeleteHistory = useCallback((id: string) => {
    setHistoryList((prev) => {
      const updated = removeHistoryItem(prev, id);
      void saveStoredHistory(updated);
      return updated;
    });
  }, []);

  const handleOpenMap = useCallback((target: "origin" | "destination") => {
    setMapTarget(target);
    setIsMapModalOpen(true);
  }, []);

  const handleCloseMapModal = useCallback(() => {
    setIsMapModalOpen(false);
  }, []);

  const handleConfirmMapLocation = useCallback((address: string, coords?: Coordinates) => {
    if (stateRef.current.mapTarget === "origin") {
      setOrigin(address);
      if (coords) setOriginCoords(coords);
    } else {
      setDestination(address);
      if (coords) setDestinationCoords(coords);
    }
  }, []);

  const handleOpenConditionModal = useCallback(() => {
    setIsConditionModalOpen(true);
  }, []);

  const handleCloseConditionModal = useCallback(() => {
    setIsConditionModalOpen(false);
  }, []);

  const handleSaveConditions = useCallback(
    (conditions: { fuelEfficiency: string; fuelPrice: string; vehicleType: string }) => {
      setFuelEfficiency(conditions.fuelEfficiency);
      setFuelPrice(conditions.fuelPrice);
      setVehicleType(conditions.vehicleType);
      showToast("設定を保存しました", "Success");
    },
    [showToast],
  );

  const handleBackToInput = useCallback(() => {
    setScreenMode("input");
  }, []);

  const handleCompareRoutes = useCallback(async () => {
    const {
      origin: curOrigin,
      destination: curDestination,
      fuelEfficiency: curFuelEfficiency,
      fuelPrice: curFuelPrice,
      vehicleType: curVehicleType,
    } = stateRef.current;

    setIsLoading(true);
    setScreenMode("loading");

    // Artificial delay for loading skeleton demonstration if fast
    const startTime = Date.now();
    try {
      const result = await analyzeRoute({
        origin: curOrigin,
        destination: curDestination,
        fuelEfficiencyKmPerLiter: parseFloat(curFuelEfficiency) || 15.0,
        fuelPriceYenPerLiter: parseFloat(curFuelPrice) || 170,
        prioritize: "balanced",
      });

      // Prevent UI flicker while ensuring snappy response (300ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 300) {
        await new Promise((r) => setTimeout(r, 300 - elapsed));
      }

      setAnalysisResult(result);
      setErrorDetails(null);
      setScreenMode("results");
      showToast("ルート検索が完了しました", "Success");

      // 履歴へ自動追加 & 永続化保存（重複排除・最大10件）
      const trimmedOrigin = curOrigin.trim();
      const trimmedDestination = curDestination.trim();
      if (trimmedOrigin && trimmedDestination) {
        const now = Date.now();
        const newItem: HistoryEntry = {
          id: `hist-${now}-${Math.random().toString(36).slice(2, 7)}`,
          origin: trimmedOrigin,
          destination: trimmedDestination,
          vehicleType: curVehicleType,
          date: formatHistoryDate(new Date(now)),
          timestamp: now,
        };
        setHistoryList((prev) => {
          const updated = addOrUpdateHistoryItem(prev, newItem, 10);
          void saveStoredHistory(updated);
          return updated;
        });
      }
    } catch (err: unknown) {
      const described = describeRouteError(err);
      setErrorDetails(described);
      if (described.type === "network") {
        setScreenMode("error_network");
      } else {
        setScreenMode("error_not_found");
      }
      // エラー画面（ErrorStateView）自体でエラー詳細とリカバリを表示するためトーストは不要
      hideToast();
    } finally {
      setIsLoading(false);
    }
  }, [analyzeRoute, showToast, hideToast]);

  const isErrorScreen = screenMode === "error_network" || screenMode === "error_not_found";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.neutral[50]} />
      <View style={styles.appContainer}>
        {/* 1. TOP（検索画面） (Figma 33:3268) */}
        {screenMode === "input" && (
          <View style={[styles.screenWrapper, isMapModalOpen && styles.hiddenBehindModal]}>
            <SearchTopView
              origin={origin}
              destination={destination}
              fuelEfficiency={fuelEfficiency}
              fuelPrice={fuelPrice}
              vehicleType={vehicleType}
              historyList={historyList}
              isLoading={isLoading}
              isFetchingLocation={isFetchingLocation}
              onChangeOrigin={handleChangeOrigin}
              onChangeDestination={handleChangeDestination}
              onSwapOriginDestination={handleSwap}
              onCurrentLocationPress={handleCurrentLocationPress}
              onMapSelectPress={handleOpenMap}
              onEditConditionsPress={handleOpenConditionModal}
              onSelectHistory={handleSelectHistory}
              onDeleteHistory={handleDeleteHistory}
              onSubmit={handleCompareRoutes}
            />
          </View>
        )}

        {/* 5. ローディングスケルトン (Figma 118:206) */}
        {screenMode === "loading" && <LoadingSkeletonView onBackPress={handleBackToInput} />}

        {/* 4. 検索結果画面 (Figma 33:3338) */}
        {screenMode === "results" && analysisResult?.routeComparison && (
          <View style={[styles.resultsContainer, isMapModalOpen && styles.hiddenBehindModal]}>
            <BackHeader title="比較結果" backLabel="戻る" onBackPress={handleBackToInput} />
            <RouteComparisonSummary
              theme={lightTheme}
              result={analysisResult.routeComparison}
              answerText={analysisResult.answer}
              origin={origin}
              destination={destination}
              originCoordinates={originCoords ?? undefined}
              destinationCoordinates={destinationCoords ?? undefined}
              onBackToSearch={handleBackToInput}
            />
          </View>
        )}

        {/* 5. 通信エラー (Figma 118:250) */}
        {screenMode === "error_network" && (
          <ErrorStateView
            type="network"
            title={errorDetails?.title}
            message={errorDetails?.message}
            recovery={errorDetails?.recovery}
            onBackPress={handleBackToInput}
            onActionPress={handleCompareRoutes}
          />
        )}

        {/* 5. ルート未検出 / サーバーエラー (Figma 118:279) */}
        {screenMode === "error_not_found" && (
          <ErrorStateView
            type={
              errorDetails?.type === "server"
                ? "server"
                : errorDetails?.type === "rate_limit"
                  ? "rate_limit"
                  : "not_found"
            }
            title={errorDetails?.title}
            message={errorDetails?.message}
            recovery={errorDetails?.recovery}
            onBackPress={handleBackToInput}
            onActionPress={errorDetails?.retryable ? handleCompareRoutes : handleBackToInput}
          />
        )}

        {/* 地図選択モーダル (Step 2: Figma 33:3383) */}
        <MapSelectModal
          visible={isMapModalOpen}
          target={mapTarget}
          currentAddress={mapTarget === "origin" ? origin : destination}
          onClose={handleCloseMapModal}
          onConfirm={handleConfirmMapLocation}
        />

        {/* 詳細条件編集シート (Step 3: Figma 33:3455) */}
        <ConditionEditSheet
          visible={isConditionModalOpen}
          fuelEfficiency={fuelEfficiency}
          fuelPrice={fuelPrice}
          vehicleType={vehicleType}
          onClose={handleCloseConditionModal}
          onSave={handleSaveConditions}
        />

        {/* トースト表示 (Step 5: Figma 118:308 & 118:358 - エラー画面では非表示) */}
        <ToastHost ref={toastHostRef} hidden={isErrorScreen} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[50], // #f4f6f4
  },
  appContainer: {
    flex: 1,
    maxWidth: Platform.OS === "web" ? 480 : undefined,
    width: "100%",
    alignSelf: "center",
    backgroundColor: colors.neutral[50],
    position: "relative",
  },
  screenWrapper: {
    flex: 1,
  },
  hiddenBehindModal: {
    display: "none",
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  toastOverlayContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
});
