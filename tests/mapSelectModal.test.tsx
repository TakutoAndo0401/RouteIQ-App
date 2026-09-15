// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { act } from "react";
import type { Coordinates } from "../src/domain/location";

declare module "react-dom/client" {
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

let mockLocationSelectCallback: ((coords: Coordinates) => void) | null = null;

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("react-native", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("react-native");
  return {
    ...actual,
    Modal: ({ children, visible }: { children?: React.ReactNode; visible?: boolean }) =>
      visible ? children : null,
  };
});

vi.mock("../src/components/map/GoogleMapView", () => ({
  GoogleMapView: ({ onLocationSelect }: { onLocationSelect?: (coords: Coordinates) => void }) => {
    mockLocationSelectCallback = onLocationSelect ?? null;
    return <div data-testid="mock-google-map" />;
  },
}));

vi.mock("lucide-react-native", () => ({
  Map: () => null,
  X: () => null,
  MapPin: () => null,
  Maximize2: () => null,
  Minimize2: () => null,
  ExternalLink: () => null,
  ArrowRight: () => null,
}));

vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  geocodeAsync: vi.fn().mockResolvedValue([{ latitude: 35.6266, longitude: 139.63 }]),
  reverseGeocodeAsync: vi.fn().mockResolvedValue([{ city: "渋谷区", street: "道玄坂" }]),
}));

import { MapSelectModal } from "../src/widgets/MapSelectModal";
import { Button } from "../src/components/ui/Button";

describe("地図位置選択モーダル (MapSelectModal) およびボタン状態", () => {
  let container: HTMLDivElement | null = null;
  let root: ReactDOM.Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLocationSelectCallback = null;
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
    vi.useRealTimers();
  });

  describe("Buttonコンポーネントの無効化状態", () => {
    describe("正常系テスト", () => {
      it("無効フラグ（disabled=true）が指定された場合はボタンが無効状態（aria-disabled='true'）として描画される", () => {
        act(() => {
          root!.render(<Button label="この位置を設定" disabled={true} />);
        });
        const buttonElement = container!.querySelector("[aria-disabled='true']");
        expect(buttonElement).not.toBeNull();
        expect(container!.textContent).toContain("この位置を設定");
      });
    });
  });

  describe("MapSelectModal（位置選択操作と住所逆引き連動）", () => {
    describe("正常系テスト", () => {
      it("ピン移動中は確定ボタンが無効化（住所を取得中...）され、逆引き完了後に有効化されて選択住所がコールバックに渡る", async () => {
        const onConfirmMock = vi.fn();

        act(() => {
          root!.render(
            <MapSelectModal
              visible={true}
              target="origin"
              currentAddress="東京都世田谷区用賀4丁目"
              onClose={vi.fn()}
              onConfirm={onConfirmMock}
            />,
          );
        });

        // 初期状態: disabled ではない
        const initialButton = container!.querySelector("[aria-disabled='true']");
        expect(initialButton).toBeNull();
        expect(container!.textContent).toContain("この位置を設定");

        // ピン移動（位置選択）をシミュレート
        expect(mockLocationSelectCallback).toBeDefined();
        act(() => {
          mockLocationSelectCallback!({ latitude: 35.658, longitude: 139.7016 });
        });

        // ピン移動直後: 住所特定処理中のため disabled になっているべき
        const disabledButton = container!.querySelector("[aria-disabled='true']");
        expect(disabledButton).not.toBeNull();
        expect(container!.textContent).toContain("住所を取得中...");

        // disabled 中にクリックしても onConfirm は発火しない
        act(() => {
          disabledButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(onConfirmMock).not.toHaveBeenCalled();

        // デバウンス & 非同期ジオコーディングの完了を進める
        await act(async () => {
          vi.advanceTimersByTime(300);
          await Promise.resolve();
          await Promise.resolve();
        });

        // 解決後: disabled が解除される
        const resolvedDisabledButton = container!.querySelector("[aria-disabled='true']");
        expect(resolvedDisabledButton).toBeNull();
        expect(container!.textContent).not.toContain("住所を取得中...");

        // クリックすると onConfirm が住所と座標を渡して発火する
        const enabledButton = Array.from(
          container!.querySelectorAll<HTMLElement>('[role="button"], button'),
        ).find((el) => el.textContent?.includes("この位置を設定"));
        expect(enabledButton).toBeDefined();

        act(() => {
          enabledButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(onConfirmMock).toHaveBeenCalledWith("渋谷区道玄坂", {
          latitude: 35.658,
          longitude: 139.7016,
        });
      });
    });

    describe("境界値テスト", () => {
      it("出発地の住所が空文字の場合は初期地点として「東京駅」がデフォルト設定される", async () => {
        await act(async () => {
          root!.render(
            <MapSelectModal
              visible={true}
              target="origin"
              currentAddress=""
              onClose={vi.fn()}
              onConfirm={vi.fn()}
            />,
          );
          await Promise.resolve();
        });

        expect(container!.textContent).toContain("東京駅");
        expect(container!.textContent).toContain("出発地を地図で選択");
      });

      it("目的地の住所が省略（未指定）の場合は初期地点として「東京駅」がデフォルト設定される", async () => {
        await act(async () => {
          root!.render(
            <MapSelectModal
              visible={true}
              target="destination"
              onClose={vi.fn()}
              onConfirm={vi.fn()}
            />,
          );
          await Promise.resolve();
        });

        expect(container!.textContent).toContain("東京駅");
        expect(container!.textContent).toContain("目的地を地図で選択");
      });

      it("住所に「現在地」という表示文字列が含まれる場合は座標取得の基準を「東京駅」にフォールバックする", async () => {
        await act(async () => {
          root!.render(
            <MapSelectModal
              visible={true}
              target="origin"
              currentAddress="現在地 (東京都世田谷区用賀)"
              onClose={vi.fn()}
              onConfirm={vi.fn()}
            />,
          );
          await Promise.resolve();
        });

        expect(container!.textContent).toContain("東京駅");
      });

      it("閉じるボタンを押すと onClose が呼ばれる", async () => {
        const onCloseMock = vi.fn();
        await act(async () => {
          root!.render(
            <MapSelectModal
              visible={true}
              target="origin"
              currentAddress="東京駅"
              onClose={onCloseMock}
              onConfirm={vi.fn()}
            />,
          );
          await Promise.resolve();
        });

        const closeBtn = container!.querySelector("[aria-label='閉じる']");
        expect(closeBtn).not.toBeNull();
        act(() => {
          closeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(onCloseMock).toHaveBeenCalled();
      });
    });
  });
});
