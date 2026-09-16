// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { act } from "react";

vi.mock("lucide-react-native", () => ({
  Maximize2: () => null,
  Minimize2: () => null,
  ExternalLink: () => null,
  ArrowRight: () => null,
}));

import { GoogleMapView } from "../src/components/map/GoogleMapView";

declare module "react-dom/client" {
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

describe("GoogleMapView（ルート比較ピンの文言・スタイリング検証）", () => {
  let container: HTMLDivElement | null = null;
  let root: ReactDOM.Root | null = null;

  beforeEach(() => {
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

  describe("正常系テスト", () => {
    it("ルートマップ表示時、ピンに住所ではなく『出発地』『目的地』が描画され、文字途切れ防止スタイルが適用される", () => {
      act(() => {
        root!.render(
          <GoogleMapView
            isRouteMap={true}
            originLabel="東京都世田谷区用賀4丁目99-99 非常に長い住所"
            destinationLabel="静岡県御殿場市深沢99-99 非常に長い住所"
            originCoordinates={{ latitude: 35.6266, longitude: 139.63 }}
            destinationCoordinates={{ latitude: 35.3157, longitude: 138.9348 }}
          />,
        );
      });

      const iframe = container!.querySelector("iframe");
      expect(iframe).not.toBeNull();
      const srcDoc = iframe?.getAttribute("srcdoc") || "";

      // ピンの文字に「出発地」「目的地」が含まれている
      expect(srcDoc).toContain("<span>出発地</span>");
      expect(srcDoc).toContain("<span>目的地</span>");

      // 長い住所文字列がピンのspanタグに直接混入して文字溢れを起こしていないことを検証
      expect(srcDoc).not.toContain("<span>東京都世田谷区用賀4丁目99-99 非常に長い住所</span>");
      expect(srcDoc).not.toContain("<span>静岡県御殿場市深沢99-99 非常に長い住所</span>");

      // ピンサイズと文字途切れ防止のスタイルが適用されている
      expect(srcDoc).toContain("min-width: 68px");
      expect(srcDoc).toContain("padding: 5px 12px");
      expect(srcDoc).toContain("white-space: nowrap");
      expect(srcDoc).toContain("font-size: 12px");
    });

    it("カスタムの originPinLabel / destinationPinLabel が指定された場合は指定した文言がピンに反映される", () => {
      act(() => {
        root!.render(
          <GoogleMapView
            isRouteMap={true}
            originPinLabel="東京IC"
            destinationPinLabel="名古屋IC"
            originCoordinates={{ latitude: 35.6266, longitude: 139.63 }}
            destinationCoordinates={{ latitude: 35.3157, longitude: 138.9348 }}
          />,
        );
      });

      const iframe = container!.querySelector("iframe");
      expect(iframe).not.toBeNull();
      const srcDoc = iframe?.getAttribute("srcdoc") || "";

      expect(srcDoc).toContain("<span>東京IC</span>");
      expect(srcDoc).toContain("<span>名古屋IC</span>");
    });
  });
});
