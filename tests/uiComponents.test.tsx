// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { act } from "react";

declare module "react-dom/client" {
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets,
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react-native", () => ({
  MapPin: () => <span data-testid="icon-mappin" />,
  X: () => <span data-testid="icon-x" />,
  ChevronDown: () => <span data-testid="icon-chevrondown" />,
  ChevronUp: () => <span data-testid="icon-chevronup" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  ArrowUpDown: () => <span data-testid="icon-arrowupdown" />,
  Navigation: () => <span data-testid="icon-navigation" />,
  Map: () => <span data-testid="icon-map" />,
}));

import { HistoryItem } from "../src/components/ui/HistoryItem";
import { ActionFooter } from "../src/components/ui/ActionFooter";
import { Accordion } from "../src/components/ui/Accordion";
import { SearchTopView } from "../src/widgets/SearchTopView";

describe("HistoryItem Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReactDOM.Root | null = null;

  beforeEach(() => {
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
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

  it("renders route text and meta text properly without overlap", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    act(() => {
      root!.render(
        <HistoryItem
          routeText="東京都中央区日本橋室町1丁目4-22 → 東京都江東区豊洲2丁目"
          metaText="普通車 • 9/14"
          onPress={onSelect}
          onDeletePress={onDelete}
        />,
      );
    });

    const textContent = container!.textContent ?? "";
    expect(textContent).toContain("東京都中央区日本橋室町1丁目4-22 → 東京都江東区豊洲2丁目");
    expect(textContent).toContain("普通車 • 9/14");
    expect(container!.querySelector('[data-testid="icon-mappin"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="icon-x"]')).not.toBeNull();
  });

  it("fires onDeletePress when delete button is pressed", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    act(() => {
      root!.render(
        <HistoryItem
          routeText="東京駅 → 新横浜駅"
          metaText="普通車 • 9/14"
          onPress={onSelect}
          onDeletePress={onDelete}
        />,
      );
    });

    const deleteBtn = container!.querySelector('[aria-label="履歴から削除"]');
    expect(deleteBtn).not.toBeNull();

    act(() => {
      deleteBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("ActionFooter Component", () => {
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

  it("renders label and handles onPress", () => {
    const onPress = vi.fn();
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

    act(() => {
      root!.render(<ActionFooter label="ルートを比較する" onPress={onPress} />);
    });

    expect(container!.textContent).toContain("ルートを比較する");
  });

  it("handles loading state properly", () => {
    mockInsets = { top: 0, bottom: 34, left: 0, right: 0 };

    act(() => {
      root!.render(
        <ActionFooter
          label="ルートを比較する"
          state="Loading"
          loadingText="最適なルートを計算中..."
        />,
      );
    });

    expect(container!.textContent).toContain("最適なルートを計算中...");
  });
});

describe("Accordion Component", () => {
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

  it("renders open when initiallyOpen is true", () => {
    act(() => {
      root!.render(
        <Accordion
          title="詳細条件 (普通車 / 15.0km/L)"
          initiallyOpen={true}
          items={[
            { label: "燃費", value: "15.0 km/L" },
            { label: "ガソリン単価", value: "170円 / L" },
            { label: "車両条件", value: "普通車" },
          ]}
        />,
      );
    });

    expect(container!.textContent).toContain("15.0 km/L");
    expect(container!.textContent).toContain("170円 / L");
    expect(container!.textContent).toContain("普通車");
    expect(container!.querySelector('[data-testid="icon-chevronup"]')).not.toBeNull();
  });
});

describe("SearchTopView Component", () => {
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

  it("renders accordion initially open by default", () => {
    act(() => {
      root!.render(
        <SearchTopView
          origin="東京駅"
          destination="御殿場IC"
          fuelEfficiency="15.0"
          fuelPrice="170"
          vehicleType="普通車"
          historyList={[]}
          onChangeOrigin={vi.fn()}
          onChangeDestination={vi.fn()}
          onSwapOriginDestination={vi.fn()}
          onCurrentLocationPress={vi.fn()}
          onMapSelectPress={vi.fn()}
          onEditConditionsPress={vi.fn()}
          onSelectHistory={vi.fn()}
          onDeleteHistory={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
    });

    // 詳細条件のアコーディオンが初期状態で開いており、燃費や単価の項目が表示されていること
    expect(container!.textContent).toContain("15.0 km/L");
    expect(container!.textContent).toContain("170円 / L");
    expect(container!.textContent).toContain("普通車");
  });

  it("respects conditionsAccordionInitiallyOpen=false when specified", () => {
    act(() => {
      root!.render(
        <SearchTopView
          origin="東京駅"
          destination="御殿場IC"
          fuelEfficiency="15.0"
          fuelPrice="170"
          vehicleType="普通車"
          historyList={[]}
          conditionsAccordionInitiallyOpen={false}
          onChangeOrigin={vi.fn()}
          onChangeDestination={vi.fn()}
          onSwapOriginDestination={vi.fn()}
          onCurrentLocationPress={vi.fn()}
          onMapSelectPress={vi.fn()}
          onEditConditionsPress={vi.fn()}
          onSelectHistory={vi.fn()}
          onDeleteHistory={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
    });

    // 閉じているため、アコーディオン内部のテキストは表示されない
    expect(container!.textContent).not.toContain("15.0 km/L");
    expect(container!.textContent).not.toContain("170円 / L");
  });
});
