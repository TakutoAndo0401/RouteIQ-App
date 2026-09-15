// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { act } from "react";
import { Linking } from "react-native";
import type { CompareRoutesResult } from "../src/contracts";
import type { GoogleMapViewProps } from "../src/components/map/GoogleMapView";

declare module "react-dom/client" {
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

let lastGoogleMapViewProps: GoogleMapViewProps | null = null;

vi.mock("react-native", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("react-native");
  return {
    ...actual,
    Linking: {
      openURL: vi.fn(),
    },
    Modal: ({
      children,
      visible,
      statusBarTranslucent,
      onRequestClose,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
      statusBarTranslucent?: boolean;
      onRequestClose?: () => void;
    }) =>
      visible ? (
        <div
          data-testid="fullscreen-modal"
          data-statusbartranslucent={String(statusBarTranslucent)}
        >
          <button data-testid="modal-hardware-back" onClick={() => onRequestClose?.()} />
          {children}
        </div>
      ) : null,
  };
});

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

vi.mock("../src/components/map/GoogleMapView", () => ({
  GoogleMapView: (props: GoogleMapViewProps) => {
    lastGoogleMapViewProps = props;
    return <div data-testid="mock-google-map" />;
  },
}));

vi.mock("lucide-react-native", () => {
  const dummy = () => null;
  return new Proxy(
    {
      Map: dummy,
      Expand: dummy,
      ExternalLink: dummy,
      X: dummy,
      Check: dummy,
      AlertTriangle: dummy,
      Info: dummy,
      Bell: dummy,
      Clock: dummy,
      DollarSign: dummy,
      Fuel: dummy,
      Navigation: dummy,
      ShieldCheck: dummy,
      Share2: dummy,
      RotateCcw: dummy,
      ArrowRight: dummy,
      ChevronRight: dummy,
    },
    {
      has: () => true,
      get: (target, prop) => {
        if (prop === "then") return undefined;
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        return dummy;
      },
    },
  );
});

import { RouteComparisonSummary } from "../src/widgets/RouteComparisonSummary";

const sampleResult: CompareRoutesResult = {
  input: {
    origin: "東京駅",
    destination: "箱根",
    fuelEfficiencyKmPerLiter: 15,
  },
  recommendedRoute: "expressway",
  recommendationReason: "時間短縮のため高速をおすすめします。",
  expresswayRoute: {
    distanceKm: 80,
    durationMinutes: 60,
    tollYen: 2000,
    tollConfidence: "api",
    fuelCostYen: 800,
    totalCostYen: 2800,
    trafficSummary: "順調",
  },
  localRoute: {
    distanceKm: 85,
    durationMinutes: 120,
    tollYen: 0,
    tollConfidence: "api",
    fuelCostYen: 850,
    totalCostYen: 850,
    trafficSummary: "混雑",
  },
  comparison: {
    timeDifferenceMinutes: 60,
    costDifferenceYen: 1950,
    valueOfTimeSavedYenPerMinute: 33,
  },
  trafficIncidents: [],
  warnings: [],
  dataSources: ["Google Maps"],
  apiFailures: [],
};

describe("ルート比較サマリー画面 (RouteComparisonSummary)", () => {
  let container: HTMLDivElement | null = null;
  let root: ReactDOM.Root | null = null;

  beforeEach(() => {
    lastGoogleMapViewProps = null;
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
  });

  describe("UIボタンの整理と重複排除", () => {
    describe("正常系テスト", () => {
      it("ヘッダーに「全画面」ボタンのみを表示し、重複する「拡大/縮小」テキストは表示しない", () => {
        act(() => {
          root!.render(
            <RouteComparisonSummary
              result={sampleResult}
              origin="千代田区大手町"
              destination="丸の内東京駅"
            />,
          );
        });

        const textContent = container!.textContent ?? "";
        expect(textContent).toContain("全画面");
        expect(textContent).not.toContain("拡大");
        expect(textContent).not.toContain("縮小");
      });

      it("埋め込みGoogleMapViewに対して重複する拡大・外部連携ボタンの表示フラグを渡さない", () => {
        act(() => {
          root!.render(
            <RouteComparisonSummary
              result={sampleResult}
              origin="千代田区大手町"
              destination="丸の内東京駅"
            />,
          );
        });

        expect(lastGoogleMapViewProps).not.toBeNull();
        expect(lastGoogleMapViewProps?.showExpandButton).toBeFalsy();
        expect(lastGoogleMapViewProps?.showExternalButton).toBeFalsy();
      });

      it("「Googleマップで開く」ボタンが1つのみ描画され、押下時にナビ開始URLをブラウザやアプリで開く", () => {
        act(() => {
          root!.render(
            <RouteComparisonSummary
              result={sampleResult}
              origin="千代田区大手町"
              destination="丸の内東京駅"
            />,
          );
        });

        const externalButtons = Array.from(
          container!.querySelectorAll('[aria-label="Googleマップアプリでナビを開始"]'),
        );
        expect(externalButtons).toHaveLength(1);

        act(() => {
          externalButtons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(Linking.openURL).toHaveBeenCalledTimes(1);
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining("https://www.google.com/maps/dir/?api=1"),
        );
      });
    });
  });

  describe("全画面地図モーダル表示機能", () => {
    describe("正常系テスト", () => {
      it("「全画面」ボタンを押下すると全画面モーダルが開き、閉じるボタンで閉じることができる", () => {
        act(() => {
          root!.render(
            <RouteComparisonSummary
              result={sampleResult}
              origin="千代田区大手町"
              destination="丸の内東京駅"
            />,
          );
        });

        expect(container!.querySelector('[data-testid="fullscreen-modal"]')).toBeNull();

        const fullscreenButton = container!.querySelector('[aria-label="地図を全画面で表示"]');
        expect(fullscreenButton).not.toBeNull();

        act(() => {
          fullscreenButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        const modalElement = container!.querySelector('[data-testid="fullscreen-modal"]');
        expect(modalElement).not.toBeNull();
        // Androidのエッジトゥエッジ対応（statusBarTranslucentが有効）
        expect(modalElement?.getAttribute("data-statusbartranslucent")).toBe("true");

        const closeButton = container!.querySelector('[aria-label="全画面表示を閉じる"]');
        expect(closeButton).not.toBeNull();

        act(() => {
          closeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(container!.querySelector('[data-testid="fullscreen-modal"]')).toBeNull();
      });

      it("Android端末の戻るハードウェアボタン（onRequestClose）押下時にも全画面モーダルが閉じる", () => {
        act(() => {
          root!.render(
            <RouteComparisonSummary
              result={sampleResult}
              origin="千代田区大手町"
              destination="丸の内東京駅"
            />,
          );
        });

        const fullscreenButton = container!.querySelector('[aria-label="地図を全画面で表示"]');
        act(() => {
          fullscreenButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(container!.querySelector('[data-testid="fullscreen-modal"]')).not.toBeNull();

        // Android戻るボタンのシミュレート (onRequestClose)
        const backButton = container!.querySelector('[data-testid="modal-hardware-back"]');
        expect(backButton).not.toBeNull();
        act(() => {
          backButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(container!.querySelector('[data-testid="fullscreen-modal"]')).toBeNull();
      });
    });
  });

  describe("地図座標とルート切り替え連動", () => {
    describe("正常系テスト", () => {
      it("高速道と一般道の両方のポリラインを渡し、切り替えボタン押下でアクティブ表示が切り替わる", () => {
        const expresswayPolyline = [
          { lat: 35.6865, lng: 139.7644 },
          { lat: 35.6812, lng: 139.7671 },
        ];
        const localPolyline = [
          { lat: 35.6865, lng: 139.7644 },
          { lat: 35.683, lng: 139.765 },
          { lat: 35.6812, lng: 139.7671 },
        ];

        const resultWithBothPolylines: CompareRoutesResult = {
          ...sampleResult,
          recommendedRoute: "expressway",
          expresswayRoute: {
            ...sampleResult.expresswayRoute,
            routePolyline: expresswayPolyline,
          },
          localRoute: {
            ...sampleResult.localRoute,
            routePolyline: localPolyline,
          },
        };

        act(() => {
          root!.render(
            <RouteComparisonSummary
              result={resultWithBothPolylines}
              origin="千代田区大手町"
              destination="東京駅"
            />,
          );
        });

        // 初期状態: 高速道が推奨かつ選択中
        expect(lastGoogleMapViewProps?.routeCoordinates).toEqual(expresswayPolyline);
        expect(lastGoogleMapViewProps?.secondaryRouteCoordinates).toEqual(localPolyline);

        // 一般道切り替えボタンを押下
        const localButton = container!.querySelector('[aria-label="一般道ルートを強調表示"]');
        expect(localButton).not.toBeNull();
        act(() => {
          localButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        // アクティブなルートが一般道になり、副ルートが高速道になること
        expect(lastGoogleMapViewProps?.routeCoordinates).toEqual(localPolyline);
        expect(lastGoogleMapViewProps?.secondaryRouteCoordinates).toEqual(expresswayPolyline);
      });
    });

    describe("境界値テスト", () => {
      it("出発地・目的地の個別座標およびルートポリラインが指定された場合、漏れなくGoogleMapViewに伝達される", () => {
        const resultWithPolyline: CompareRoutesResult = {
          ...sampleResult,
          expresswayRoute: {
            ...sampleResult.expresswayRoute,
            routePolyline: [
              { lat: 35.6865, lng: 139.7644 },
              { lat: 35.6812, lng: 139.7671 },
            ],
          },
        };

        act(() => {
          root!.render(
            <RouteComparisonSummary
              result={resultWithPolyline}
              origin="千代田区大手町永代通り"
              destination="千代田区丸の内東京駅"
              originCoordinates={{ latitude: 35.6865, longitude: 139.7644 }}
              destinationCoordinates={{ latitude: 35.6812, longitude: 139.7671 }}
            />,
          );
        });

        expect(lastGoogleMapViewProps).not.toBeNull();
        expect(lastGoogleMapViewProps?.originCoordinates).toEqual({
          latitude: 35.6865,
          longitude: 139.7644,
        });
        expect(lastGoogleMapViewProps?.destinationCoordinates).toEqual({
          latitude: 35.6812,
          longitude: 139.7671,
        });
        expect(lastGoogleMapViewProps?.routeCoordinates).toEqual([
          { lat: 35.6865, lng: 139.7644 },
          { lat: 35.6812, lng: 139.7671 },
        ]);
      });
    });
  });
});
