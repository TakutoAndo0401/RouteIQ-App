import { describe, expect, it, vi } from "vitest";
import {
  toSimplifiedLatLngTuples,
  toSimplifiedNativeCoordinates,
} from "../src/components/map/polylineUtils";
import { analyzeRouteInProcess } from "../src/domain/services/routeAnalysisService";
import {
  extractHighwayNames,
  isHighwayName,
  type GoogleRoute,
} from "../src/domain/providers/googleRoutesProvider";
import type { GoogleRoutesProvider } from "../src/domain/providers/googleRoutesProvider";
import type { RouteCoordinate } from "../src/contracts";

function generateCurvePolyline(count: number): RouteCoordinate[] {
  const pts: RouteCoordinate[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    pts.push({
      lat: 35.6266 - t * 0.33 + Math.sin(t * 20) * 0.006,
      lng: 139.63 - t * 0.7 + Math.cos(t * 15) * 0.005,
    });
  }
  return pts;
}

describe("パフォーマンス最適化の動作・デグレ防止テスト (performanceOptimizations)", () => {
  describe("polylineUtils（ポリライン間引き・WeakMapキャッシュ）", () => {
    it("300点以下の短いポリラインは間引かず全点をそのまま保持する", () => {
      const shortPoly: RouteCoordinate[] = [
        { lat: 35.6812, lng: 139.7671 },
        { lat: 35.658, lng: 139.7016 },
        { lat: 35.4437, lng: 139.638 },
      ];
      const tuples = toSimplifiedLatLngTuples(shortPoly);
      expect(tuples).toEqual([
        [35.6812, 139.7671],
        [35.658, 139.7016],
        [35.4437, 139.638],
      ]);

      const nativeCoords = toSimplifiedNativeCoordinates(shortPoly);
      expect(nativeCoords).toEqual([
        { latitude: 35.6812, longitude: 139.7671 },
        { latitude: 35.658, longitude: 139.7016 },
        { latitude: 35.4437, longitude: 139.638 },
      ]);
    });

    it("2,500点の長距離ポリラインは始点・終点を維持したまま大幅に軽量化され、同一参照はキャッシュから返却される", () => {
      const longPoly = generateCurvePolyline(2500);

      const tuples1 = toSimplifiedLatLngTuples(longPoly);
      const tuples2 = toSimplifiedLatLngTuples(longPoly);
      expect(tuples1).toBe(tuples2); // WeakMap キャッシュヒット
      expect(tuples1.length).toBeLessThan(300);
      expect(tuples1.length).toBeGreaterThan(20);
      expect(tuples1[0][0]).toBeCloseTo(longPoly[0].lat, 4);
      expect(tuples1[0][1]).toBeCloseTo(longPoly[0].lng, 4);
      expect(tuples1[tuples1.length - 1][0]).toBeCloseTo(longPoly[longPoly.length - 1].lat, 4);
      expect(tuples1[tuples1.length - 1][1]).toBeCloseTo(longPoly[longPoly.length - 1].lng, 4);

      const native1 = toSimplifiedNativeCoordinates(longPoly);
      const native2 = toSimplifiedNativeCoordinates(longPoly);
      expect(native1).toBe(native2); // WeakMap キャッシュヒット
      expect(native1.length).toBe(tuples1.length);
      expect(native1[0]).toEqual({ latitude: longPoly[0].lat, longitude: longPoly[0].lng });
      expect(native1[native1.length - 1]).toEqual({
        latitude: longPoly[longPoly.length - 1].lat,
        longitude: longPoly[longPoly.length - 1].lng,
      });
    });
  });

  describe("fuelPriceService（インフライトリクエスト重複排除）", () => {
    it("キャッシュ未保持時に複数箇所から同時呼び出しされても外部fetchは1セット(3件)のみ実行される", async () => {
      vi.resetModules();
      const { fetchFuelPriceAverages } = await import("../src/domain/services/fuelPriceService");

      let fetchCount = 0;
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        fetchCount += 1;
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          text: async () => "最新価格 176.5円（2026年09月15日）",
        };
      }) as unknown as typeof fetch;

      try {
        const results = await Promise.all([
          fetchFuelPriceAverages(),
          fetchFuelPriceAverages(),
          fetchFuelPriceAverages(),
          fetchFuelPriceAverages(),
        ]);
        expect(fetchCount).toBe(3); // 3油種×1回のみ
        expect(results[0]).toBe(results[1]);
        expect(results[0].prices[0].value).toBe(176.5);
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe("routeAnalysisService（並列実行とポリライン保持検証）", () => {
    it("燃料価格未指定でもルート探索と並行実行され、大規模ポリラインも欠損せず返却される", async () => {
      const expPoly = generateCurvePolyline(1200);
      const localPoly = generateCurvePolyline(1200);

      const mockProvider = {
        name: "google",
        computeRoute: vi.fn().mockImplementation(async ({ routeType }) => ({
          routeType,
          distanceKm: routeType === "expressway" ? 80 : 86,
          durationMinutes: routeType === "expressway" ? 65 : 135,
          tollYen: routeType === "expressway" ? 2450 : 0,
          tollConfidence: "api",
          trafficSummary: "順調",
          congestionLevel: "low",
          trafficIncidents: [],
          roadClosures: [],
          warnings: [],
          dataSources: ["Google Maps Routes API"],
          apiFailures: [],
          routePolyline: routeType === "expressway" ? expPoly : localPoly,
        })),
      } as unknown as GoogleRoutesProvider;

      const result = await analyzeRouteInProcess(
        {
          origin: "東京駅",
          destination: "御殿場IC",
          fuelEfficiencyKmPerLiter: 15,
          fuelPriceYenPerLiter: 175,
          prioritize: "balanced",
        },
        { provider: mockProvider },
      );

      expect(result.routeComparison?.expresswayRoute.routePolyline).toHaveLength(1200);
      expect(result.routeComparison?.localRoute.routePolyline).toHaveLength(1200);
      expect(result.routeComparison?.expresswayRoute.routePolyline?.[0]).toEqual(expPoly[0]);
    });
  });

  describe("googleRoutesProvider（高速プレフィルタの網羅性・境界値検証）", () => {
    it("代表的な高速・有料道路名を漏れなく判定し、一般道名は誤検出しない", () => {
      const expectedHighways = [
        "東名高速道路",
        "首都高速3号渋谷線",
        "中央自動車道",
        "東京湾アクアライン",
        "第三京浜",
        "横浜新道",
        "小田原厚木道路",
        "西湘バイパス",
        "京葉道路",
        "東京外環自動車道",
        "外環道",
        "圏央道",
        "箱根新道有料道路",
      ];
      for (const name of expectedHighways) {
        expect(isHighwayName(name)).toBe(true);
      }

      const expectedNonHighways = ["国道246号", "環七通り", "高速", "一般道を直進する", "左折する"];
      for (const name of expectedNonHighways) {
        expect(isHighwayName(name)).toBe(false);
      }
    });

    it("より詳細な名称が後から出現した場合に短い名称を正しく置換する", () => {
      const route: GoogleRoute = {
        legs: [
          {
            steps: [
              { navigationInstruction: { instructions: "東名高速 に入る" } },
              { navigationInstruction: { instructions: "東名高速道路 を進む" } },
            ],
          },
        ],
      };
      const res = extractHighwayNames(route);
      expect(res.highwayNames).toEqual(["東名高速道路"]);
      expect(res.majorHighway).toBe("東名高速道路");
    });
  });
});
