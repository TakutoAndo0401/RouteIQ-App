// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { act } from "react";
import { StyleSheet } from "react-native";

const capturedTextStyles: Array<{ text: string; style: Record<string, unknown> }> = [];
const capturedBalloonStyles: Array<Record<string, unknown>> = [];

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    Platform: {
      ...actual.Platform,
      OS: "android",
      select: (obj: Record<string, unknown>) => obj.android ?? obj.default,
    },
    View: ({ children, style }: Record<string, unknown>) => {
      const flat = StyleSheet.flatten(style as never) as Record<string, unknown> | undefined;
      if (flat && flat.borderRadius === 14 && flat.minWidth === 68) {
        capturedBalloonStyles.push(flat);
      }
      return React.createElement("div", null, children as React.ReactNode);
    },
    Text: ({ children, style }: Record<string, unknown>) => {
      const flat = (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
      capturedTextStyles.push({ text: String(children ?? ""), style: flat });
      return React.createElement("span", null, children as React.ReactNode);
    },
  };
});

vi.mock("react-native-maps", () => {
  const MockMapView = React.forwardRef(function MockMapView(
    { children }: { children?: React.ReactNode },
    _ref,
  ) {
    return <div data-testid="native-map">{children}</div>;
  });
  return {
    __esModule: true,
    default: MockMapView,
    PROVIDER_DEFAULT: "default",
    Marker: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="native-marker">{children}</div>
    ),
    Polyline: () => <div data-testid="native-polyline" />,
  };
});

vi.mock("lucide-react-native", () => ({
  Maximize2: () => null,
  Minimize2: () => null,
  ExternalLink: () => null,
  ArrowRight: () => null,
  Plus: () => null,
  Minus: () => null,
  Navigation: () => null,
}));

import { GoogleMapView } from "../src/components/map/GoogleMapView.native";

declare module "react-dom/client" {
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

describe("GoogleMapView.native（Android チップ内テキスト中央揃え・見切れ防止）", () => {
  let container: HTMLDivElement | null = null;
  let root: ReactDOM.Root | null = null;

  beforeEach(() => {
    capturedTextStyles.length = 0;
    capturedBalloonStyles.length = 0;
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

  it("地点選択ピンの『目的地』チップとヒントチップがAndroidで上下左右中央揃え・見切れ防止スタイルを持つ", () => {
    act(() => {
      root!.render(
        <GoogleMapView
          isRouteMap={false}
          pinLabel="目的地"
          initialCoordinates={{ latitude: 35.6812, longitude: 139.7671 }}
        />,
      );
    });

    const destText = capturedTextStyles.find((entry) => entry.text === "目的地");
    expect(destText).toBeDefined();
    expect(destText?.style.textAlign).toBe("center");
    expect(destText?.style.textAlignVertical).toBe("center");
    expect(destText?.style.includeFontPadding).toBe(false);
    expect(destText?.style.lineHeight).toBeGreaterThanOrEqual(18);
    expect(destText?.style.letterSpacing).toBeUndefined();

    expect(capturedBalloonStyles.length).toBeGreaterThanOrEqual(1);
    const balloonStyle = capturedBalloonStyles[0];
    expect(balloonStyle.alignItems).toBe("center");
    expect(balloonStyle.justifyContent).toBe("center");
    expect(balloonStyle.minHeight).toBeGreaterThanOrEqual(28);
    expect(Number(balloonStyle.paddingBottom)).toBeGreaterThan(Number(balloonStyle.paddingTop));

    const hintText = capturedTextStyles.find((entry) =>
      entry.text.includes("タップまたはドラッグでピンを移動"),
    );
    expect(hintText).toBeDefined();
    expect(hintText?.style.textAlign).toBe("center");
    expect(hintText?.style.textAlignVertical).toBe("center");
    expect(hintText?.style.includeFontPadding).toBe(false);
    expect(hintText?.style.lineHeight).toBeGreaterThanOrEqual(16);
  });

  it("ルートマップの『出発地』『目的地』両ピンチップにも同じ中央揃え・見切れ防止スタイルが適用される", () => {
    act(() => {
      root!.render(
        <GoogleMapView
          isRouteMap={true}
          originLabel="東京駅"
          destinationLabel="箱根"
          originCoordinates={{ latitude: 35.6812, longitude: 139.7671 }}
          destinationCoordinates={{ latitude: 35.2324, longitude: 139.1069 }}
        />,
      );
    });

    for (const label of ["出発地", "目的地"]) {
      const entry = capturedTextStyles.find((item) => item.text === label);
      expect(entry).toBeDefined();
      expect(entry?.style.textAlign).toBe("center");
      expect(entry?.style.textAlignVertical).toBe("center");
      expect(entry?.style.includeFontPadding).toBe(false);
      expect(entry?.style.lineHeight).toBeGreaterThanOrEqual(18);
    }
    expect(capturedBalloonStyles).toHaveLength(2);
  });
});
