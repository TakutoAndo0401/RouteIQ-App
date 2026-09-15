import { describe, expect, it } from "vitest";
import {
  buildCompareRoutesResult,
  buildComparison,
  chooseRecommendedRoute,
  toRouteCostSummary,
} from "../src/domain/recommendation";
import type { ProviderRouteResult, RouteCostSummary } from "../src/domain/types";

function createRoute(overrides: Partial<ProviderRouteResult>): ProviderRouteResult {
  return {
    routeType: "expressway",
    distanceKm: 100,
    durationMinutes: 60,
    tollYen: 2500,
    tollConfidence: "api",
    trafficSummary: "normal",
    congestionLevel: "low",
    trafficIncidents: [],
    roadClosures: [],
    warnings: [],
    dataSources: ["Google Maps"],
    apiFailures: [],
    ...overrides,
  };
}

describe("ルート推奨・コスト比較ロジック (recommendation domain logic)", () => {
  describe("toRouteCostSummary（ルートコスト集計への変換）", () => {
    describe("正常系テスト", () => {
      it("有料道路料金がある場合、ガソリン代と総額を正確に計算できる", () => {
        // 100km / 20km/L * 180yen/L = 900yen ガソリン代
        // 合計 = 2500 + 900 = 3400円
        const summary = toRouteCostSummary(
          createRoute({ distanceKm: 100, tollYen: 2500 }),
          20,
          180,
        );
        expect(summary.fuelCostYen).toBe(900);
        expect(summary.totalCostYen).toBe(3400);
        expect(summary.tollConfidence).toBe("api");
      });
    });

    describe("境界値テスト", () => {
      it("有料道路料金が未確定（null）の場合は、総額（totalCostYen）も未確定（null）として扱う", () => {
        const summary = toRouteCostSummary(
          createRoute({ distanceKm: 100, tollYen: null, tollConfidence: "unavailable" }),
          20,
          180,
        );
        expect(summary.fuelCostYen).toBe(900);
        expect(summary.totalCostYen).toBeNull();
        expect(summary.tollConfidence).toBe("unavailable");
      });
    });
  });

  describe("buildComparison（高速と一般道の比較メトリクス算出）", () => {
    describe("正常系テスト", () => {
      it("短縮時間、差額、および1分あたりの短縮価値を正確に算出できる", () => {
        const expressway: RouteCostSummary = {
          distanceKm: 100,
          durationMinutes: 60,
          tollYen: 2000,
          tollConfidence: "api",
          fuelCostYen: 1000,
          totalCostYen: 3000,
          trafficSummary: "smooth",
        };
        const local: RouteCostSummary = {
          distanceKm: 90,
          durationMinutes: 90,
          tollYen: 0,
          tollConfidence: "api",
          fuelCostYen: 900,
          totalCostYen: 900,
          trafficSummary: "moderate",
        };

        const comparison = buildComparison(expressway, local);
        expect(comparison.timeDifferenceMinutes).toBe(30); // 90 - 60
        expect(comparison.costDifferenceYen).toBe(2100); // 3000 - 900
        expect(comparison.valueOfTimeSavedYenPerMinute).toBe(70); // 2100 / 30 = 70
      });
    });

    describe("境界値テスト", () => {
      it("高速道路の方が時間がかかる（短縮時間が0分以下）場合は、短縮価値をnullとして扱う", () => {
        const expressway: RouteCostSummary = {
          distanceKm: 100,
          durationMinutes: 90,
          tollYen: 2000,
          tollConfidence: "api",
          fuelCostYen: 1000,
          totalCostYen: 3000,
          trafficSummary: "congested",
        };
        const local: RouteCostSummary = {
          distanceKm: 80,
          durationMinutes: 80,
          tollYen: 0,
          tollConfidence: "api",
          fuelCostYen: 800,
          totalCostYen: 800,
          trafficSummary: "smooth",
        };

        const comparison = buildComparison(expressway, local);
        expect(comparison.timeDifferenceMinutes).toBe(-10); // 80 - 90 = -10
        expect(comparison.costDifferenceYen).toBe(2200);
        expect(comparison.valueOfTimeSavedYenPerMinute).toBeNull();
      });

      it("総額が未確定（null）の場合は、差額および短縮価値もnullとして扱う", () => {
        const expressway: RouteCostSummary = {
          distanceKm: 100,
          durationMinutes: 60,
          tollYen: null,
          tollConfidence: "unavailable",
          fuelCostYen: 1000,
          totalCostYen: null,
          trafficSummary: "smooth",
        };
        const local: RouteCostSummary = {
          distanceKm: 90,
          durationMinutes: 90,
          tollYen: 0,
          tollConfidence: "api",
          fuelCostYen: 900,
          totalCostYen: 900,
          trafficSummary: "smooth",
        };

        const comparison = buildComparison(expressway, local);
        expect(comparison.timeDifferenceMinutes).toBe(30);
        expect(comparison.costDifferenceYen).toBeNull();
        expect(comparison.valueOfTimeSavedYenPerMinute).toBeNull();
      });
    });
  });

  describe("chooseRecommendedRoute（推奨ルート判定ロジック）", () => {
    const makeSummary = (duration: number, totalCost: number | null): RouteCostSummary => ({
      distanceKm: 50,
      durationMinutes: duration,
      tollYen: totalCost,
      tollConfidence: totalCost !== null ? "api" : "unavailable",
      fuelCostYen: 500,
      totalCostYen: totalCost !== null ? totalCost + 500 : null,
      trafficSummary: "test",
    });

    describe("時間優先（prioritize: 'time'）", () => {
      describe("正常系テスト", () => {
        it("高速道路が一般道より早い場合は高速道路ルートを推奨する", () => {
          const exp = makeSummary(50, 2000);
          const loc = makeSummary(80, 0);
          const comp = buildComparison(exp, loc);
          const result = chooseRecommendedRoute(exp, loc, comp, "time");
          expect(result.recommendedRoute).toBe("expressway");
          expect(result.recommendationReason).toContain(
            "時間優先のため、所要時間が短い高速道路ルートをおすすめします",
          );
        });

        it("一般道の方が高速道路より早い場合は一般道ルートを推奨する", () => {
          const exp = makeSummary(90, 2000);
          const loc = makeSummary(70, 0);
          const comp = buildComparison(exp, loc);
          const result = chooseRecommendedRoute(exp, loc, comp, "time");
          expect(result.recommendedRoute).toBe("local");
          expect(result.recommendationReason).toContain(
            "時間優先でも一般道ルートの方が短時間のため",
          );
        });
      });
    });

    describe("費用優先（prioritize: 'cost'）", () => {
      describe("正常系テスト", () => {
        it("一般道の方が総額が安い場合は一般道ルートを推奨する", () => {
          const exp = makeSummary(50, 2000); // total 2500
          const loc = makeSummary(80, 0); // total 500
          const comp = buildComparison(exp, loc);
          const result = chooseRecommendedRoute(exp, loc, comp, "cost");
          expect(result.recommendedRoute).toBe("local");
          expect(result.recommendationReason).toContain(
            "費用優先のため、総額が安い一般道ルートをおすすめします",
          );
        });

        it("距離の差などで高速道路の方が総額が安くなる例外ケースでは高速道路ルートを推奨する", () => {
          // e.g., expressway has much shorter distance so fuel savings exceed toll
          const exp: RouteCostSummary = {
            distanceKm: 10,
            durationMinutes: 20,
            tollYen: 100,
            tollConfidence: "api",
            fuelCostYen: 100,
            totalCostYen: 200,
            trafficSummary: "",
          };
          const loc: RouteCostSummary = {
            distanceKm: 50,
            durationMinutes: 60,
            tollYen: 0,
            tollConfidence: "api",
            fuelCostYen: 500,
            totalCostYen: 500,
            trafficSummary: "",
          };
          const comp = buildComparison(exp, loc);
          const result = chooseRecommendedRoute(exp, loc, comp, "cost");
          expect(result.recommendedRoute).toBe("expressway");
          expect(result.recommendationReason).toContain(
            "費用優先でも高速道路ルートの総額が安いため",
          );
        });
      });

      describe("境界値テスト", () => {
        it("高速料金が未確定で費用比較ができない場合は、所要時間の短いルートにフォールバックして判定する", () => {
          const exp = makeSummary(50, null); // total null
          const loc = makeSummary(80, 0); // total 500
          const comp = buildComparison(exp, loc);
          const result = chooseRecommendedRoute(exp, loc, comp, "cost");
          expect(result.recommendedRoute).toBe("expressway");
          expect(result.recommendationReason).toContain(
            "料金未確定のため費用だけでは判断できません",
          );
        });
      });
    });

    describe("バランス重視（prioritize: 'balanced'）", () => {
      describe("正常系テスト", () => {
        it("時間短縮のコスパが良好（80円/分以下）な場合は高速道路ルートを推奨する", () => {
          // 30 min saved, cost diff 1500 yen => 50 yen/min
          const exp: RouteCostSummary = {
            distanceKm: 60,
            durationMinutes: 50,
            tollYen: 1500,
            tollConfidence: "api",
            fuelCostYen: 600,
            totalCostYen: 2100,
            trafficSummary: "",
          };
          const loc: RouteCostSummary = {
            distanceKm: 60,
            durationMinutes: 80,
            tollYen: 0,
            tollConfidence: "api",
            fuelCostYen: 600,
            totalCostYen: 600,
            trafficSummary: "",
          };
          const comp = buildComparison(exp, loc);
          expect(comp.valueOfTimeSavedYenPerMinute).toBe(50);

          const result = chooseRecommendedRoute(exp, loc, comp, "balanced");
          expect(result.recommendedRoute).toBe("expressway");
          expect(result.recommendationReason).toContain(
            "時間短縮に対する追加費用が小さいため、バランス重視で高速道路ルートをおすすめします",
          );
        });

        it("時間短縮のコスパが悪い（80円/分超）な場合は一般道ルートを推奨する", () => {
          // 20 min saved, cost diff 1620 yen => 81 yen/min
          const exp: RouteCostSummary = {
            distanceKm: 50,
            durationMinutes: 40,
            tollYen: 1620,
            tollConfidence: "api",
            fuelCostYen: 500,
            totalCostYen: 2120,
            trafficSummary: "",
          };
          const loc: RouteCostSummary = {
            distanceKm: 50,
            durationMinutes: 60,
            tollYen: 0,
            tollConfidence: "api",
            fuelCostYen: 500,
            totalCostYen: 500,
            trafficSummary: "",
          };
          const comp = buildComparison(exp, loc);
          expect(comp.valueOfTimeSavedYenPerMinute).toBe(81);

          const result = chooseRecommendedRoute(exp, loc, comp, "balanced");
          expect(result.recommendedRoute).toBe("local");
          expect(result.recommendationReason).toContain(
            "高速道路ルートの時間短縮に対する追加費用が大きいため",
          );
        });
      });

      describe("境界値テスト", () => {
        it("短縮価値がちょうど閾値（80円/分）ちょうどの場合は高速道路ルートを推奨する", () => {
          // 20 min saved, cost diff 1600 yen => exactly 80 yen/min
          const exp: RouteCostSummary = {
            distanceKm: 50,
            durationMinutes: 40,
            tollYen: 1600,
            tollConfidence: "api",
            fuelCostYen: 500,
            totalCostYen: 2100,
            trafficSummary: "",
          };
          const loc: RouteCostSummary = {
            distanceKm: 50,
            durationMinutes: 60,
            tollYen: 0,
            tollConfidence: "api",
            fuelCostYen: 500,
            totalCostYen: 500,
            trafficSummary: "",
          };
          const comp = buildComparison(exp, loc);
          expect(comp.valueOfTimeSavedYenPerMinute).toBe(80);

          const result = chooseRecommendedRoute(exp, loc, comp, "balanced");
          expect(result.recommendedRoute).toBe("expressway");
        });

        it("総額が未確定でコスパ計算ができない場合は所要時間をもとに適切にフォールバックする", () => {
          const exp = makeSummary(50, null);
          const loc = makeSummary(70, null);
          const comp = buildComparison(exp, loc);
          const result = chooseRecommendedRoute(exp, loc, comp, "balanced");
          expect(result.recommendedRoute).toBe("expressway");
          expect(result.recommendationReason).toContain("費用の一部が未確定のため");
        });
      });
    });
  });

  describe("buildCompareRoutesResult（比較結果全体の統合ビルド）", () => {
    describe("正常系テスト", () => {
      it("各ルートの警告やデータ提供元、障害情報などの重複を適切に排除して結合する", () => {
        const expRoute = createRoute({
          routeType: "expressway",
          warnings: ["重複警告A", "高速警告"],
          dataSources: ["Google Maps Routes API", "共通ソース"],
          apiFailures: ["APIエラー1"],
          trafficIncidents: ["東名工事"],
        });
        const locRoute = createRoute({
          routeType: "local",
          tollYen: 0,
          warnings: ["重複警告A", "一般道警告"],
          dataSources: ["OpenStreetMap", "共通ソース"],
          apiFailures: ["APIエラー1", "APIエラー2"],
          trafficIncidents: ["国道混雑"],
        });

        const result = buildCompareRoutesResult({
          origin: "東京駅",
          destination: "横浜駅",
          fuelEfficiencyKmPerLiter: 15,
          fuelPriceYenPerLiter: 175,
          prioritize: "balanced",
          expresswayRoute: expRoute,
          localRoute: locRoute,
          warnings: ["重複警告A", "トップレベル警告"],
        });

        // warnings は重複なしで4件
        expect(result.warnings).toHaveLength(4);
        expect(result.warnings).toEqual([
          "重複警告A",
          "トップレベル警告",
          "高速警告",
          "一般道警告",
        ]);

        // dataSources は重複なしで3件
        expect(result.dataSources).toHaveLength(3);
        expect(result.dataSources).toEqual([
          "Google Maps Routes API",
          "共通ソース",
          "OpenStreetMap",
        ]);

        // apiFailures は重複なしで2件
        expect(result.apiFailures).toHaveLength(2);
        expect(result.apiFailures).toEqual(["APIエラー1", "APIエラー2"]);

        // trafficIncidents は結合されて2件
        expect(result.trafficIncidents).toEqual(["東名工事", "国道混雑"]);
      });

      it("出発時刻や車種などの任意の入力項目が渡された場合も結果オブジェクトに反映する", () => {
        const result = buildCompareRoutesResult({
          origin: "東京駅",
          destination: "名古屋駅",
          departureTime: "2026-09-15T08:00:00Z",
          vehicleType: "中型車",
          fuelEfficiencyKmPerLiter: 12,
          fuelPriceYenPerLiter: 180,
          prioritize: "time",
          expresswayRoute: createRoute({ durationMinutes: 180 }),
          localRoute: createRoute({ durationMinutes: 300, tollYen: 0 }),
          warnings: [],
        });

        expect(result.input.departureTime).toBe("2026-09-15T08:00:00Z");
        expect(result.input.vehicleType).toBe("中型車");
        expect(result.recommendedRoute).toBe("expressway");
      });
    });
  });
});
