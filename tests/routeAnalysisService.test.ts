import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeRouteInProcess,
  buildInitialAnswer,
} from "../src/domain/services/routeAnalysisService";
import type { ProviderRouteResult } from "../src/domain/types";
import { GoogleRoutesProvider } from "../src/domain/providers/googleRoutesProvider";
import type { RouteDecisionEvaluator } from "../src/domain/providers/geminiDecisionProvider";

const mockExpressway: ProviderRouteResult = {
  routeType: "expressway",
  distanceKm: 85.0,
  durationMinutes: 72,
  tollYen: 2850,
  tollConfidence: "api",
  trafficSummary: "順調 主な経路: 東名高速道路",
  congestionLevel: "low",
  trafficIncidents: [],
  roadClosures: [],
  warnings: [],
  dataSources: ["Google Maps Routes API"],
  apiFailures: [],
};

const mockLocal: ProviderRouteResult = {
  routeType: "local",
  distanceKm: 92.5,
  durationMinutes: 145,
  tollYen: 0,
  tollConfidence: "api",
  trafficSummary: "一部混雑 主な経路: 国道246号",
  congestionLevel: "moderate",
  trafficIncidents: [],
  roadClosures: [],
  warnings: ["Google Routes API の回避指定"],
  dataSources: ["Google Maps Routes API"],
  apiFailures: [],
};

describe("ルート分析・オーケストレーションサービス (routeAnalysisService)", () => {
  const originalPublicGeminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalPublicGeminiKey === undefined) {
      delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_GEMINI_API_KEY = originalPublicGeminiKey;
    }
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  describe("正常系テスト", () => {
    it("高速道路と一般道のルートを並行取得し、推奨結果を含む分析レポートを生成できる", async () => {
      const mockProvider = {
        name: "google",
        computeRoute: vi.fn().mockImplementation(async ({ routeType }) => {
          return routeType === "expressway" ? mockExpressway : mockLocal;
        }),
      } as unknown as GoogleRoutesProvider;

      const result = await analyzeRouteInProcess(
        {
          origin: "東京都世田谷区用賀1丁目",
          destination: "静岡県御殿場市新橋",
          fuelEfficiencyKmPerLiter: 15,
          fuelPriceYenPerLiter: 175,
          prioritize: "balanced",
        },
        { provider: mockProvider },
      );

      expect(result.input.origin).toBe("東京都世田谷区用賀1丁目");
      expect(result.input.destination).toBe("静岡県御殿場市新橋");
      expect(result.routeComparison).toBeDefined();
      expect(result.routeComparison?.recommendedRoute).toBe("expressway");
      expect(result.routeComparison?.expresswayRoute.durationMinutes).toBe(72);
      expect(result.routeComparison?.localRoute.durationMinutes).toBe(145);
      expect(result.routeComparison?.comparison.timeDifferenceMinutes).toBe(73); // 145 - 72
      expect(result.answer).toContain("高速優先");
      expect(result.contextId).toMatch(/^routeiq-/);
    });

    it("初期回答テキスト（buildInitialAnswer）で出発地・目的地と推奨理由を自然な日本語サマリーとして作成できる", () => {
      const text = buildInitialAnswer({
        input: {
          origin: "用賀",
          destination: "御殿場",
          fuelEfficiencyKmPerLiter: 15,
          fuelPriceYenPerLiter: 175,
        },
        routeComparison: {
          input: {
            origin: "用賀",
            destination: "御殿場",
            fuelEfficiencyKmPerLiter: 15,
            fuelPriceYenPerLiter: 175,
            prioritize: "balanced",
          },
          recommendedRoute: "expressway",
          recommendationReason: "高速道路ルートをおすすめします。",
          expresswayRoute: {
            distanceKm: 85,
            durationMinutes: 70,
            tollYen: 2800,
            tollConfidence: "api",
            fuelCostYen: 992,
            totalCostYen: 3792,
            trafficSummary: "順調",
          },
          localRoute: {
            distanceKm: 90,
            durationMinutes: 140,
            tollYen: 0,
            tollConfidence: "api",
            fuelCostYen: 1050,
            totalCostYen: 1050,
            trafficSummary: "混雑",
          },
          comparison: {
            timeDifferenceMinutes: 70,
            costDifferenceYen: 2742,
            valueOfTimeSavedYenPerMinute: 39,
          },
          trafficIncidents: [],
          warnings: [],
          dataSources: ["Google Maps"],
          apiFailures: [],
        },
        apiFailures: [],
      });

      expect(text).toContain("用賀 から 御殿場");
      expect(text).toContain("高速優先 を推奨します");
      expect(text).toContain("70分 / 85km");
    });

    it("decisionProvider が設定されている場合、Decisions API の判定結果と確信度を優先して採用する", async () => {
      const mockProvider = {
        name: "google",
        computeRoute: vi.fn().mockImplementation(async ({ routeType }) => {
          return routeType === "expressway" ? mockExpressway : mockLocal;
        }),
      } as unknown as GoogleRoutesProvider;

      const decideRouteMock = vi.fn().mockResolvedValue({
        recommendedRoute: "local" as const,
        recommendationReason: "費用優先の方針に基づき、一般道ルートをおすすめします。",
        decision: {
          source: "gemini-decisions-api" as const,
          model: "gemini-decision-1",
          confidence: 0.87,
          probabilities: { expressway: 0.13, local: 0.87 },
          primaryReasonCode: "user_priority_cost" as const,
          worthPayingTollProbability: 0.18,
        },
        dataSources: ["Gemini Decisions API (gemini-decision-1)"],
      });

      const mockDecisionProvider: RouteDecisionEvaluator = {
        decideRoute: decideRouteMock,
      };

      const result = await analyzeRouteInProcess(
        {
          origin: "東京都世田谷区用賀1丁目",
          destination: "静岡県御殿場市新橋",
          fuelEfficiencyKmPerLiter: 15,
          fuelPriceYenPerLiter: 175,
          vehicleType: "大型車",
          prioritize: "cost",
        },
        {
          provider: mockProvider,
          decisionProvider: mockDecisionProvider,
        },
      );

      expect(decideRouteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prioritize: "cost",
          vehicleType: "大型車",
        }),
      );
      expect(result.routeComparison?.recommendedRoute).toBe("local");
      expect(result.routeComparison?.decision?.source).toBe("gemini-decisions-api");
      expect(result.routeComparison?.decision?.confidence).toBe(0.87);
      expect(result.dataSources).toContain("Gemini Decisions API (gemini-decision-1)");
      expect(result.answer).toContain("確信度 87%");
    });

    it("Decisions API が失敗した場合は既存ルールベース判定へ自動フォールバックし、警告と失敗理由を記録する", async () => {
      const mockProvider = {
        name: "google",
        computeRoute: vi.fn().mockImplementation(async ({ routeType }) => {
          return routeType === "expressway" ? mockExpressway : mockLocal;
        }),
      } as unknown as GoogleRoutesProvider;

      const failingDecisionProvider: RouteDecisionEvaluator = {
        decideRoute: vi.fn().mockRejectedValue(new Error("HTTP 429 rate limit exceeded")),
      };

      const result = await analyzeRouteInProcess(
        {
          origin: "東京都世田谷区用賀1丁目",
          destination: "静岡県御殿場市新橋",
          fuelEfficiencyKmPerLiter: 15,
          fuelPriceYenPerLiter: 175,
          prioritize: "balanced",
        },
        {
          provider: mockProvider,
          decisionProvider: failingDecisionProvider,
        },
      );

      expect(result.routeComparison?.recommendedRoute).toBe("expressway");
      expect(result.routeComparison?.decision?.source).toBe("rule-based-fallback");
      expect(result.routeComparison?.decision?.fallbackReason).toContain("429");
      expect(result.warnings.some((w) => w.includes("Gemini Decisions API での判定に失敗"))).toBe(
        true,
      );
      expect(result.apiFailures.some((f) => f.includes("Gemini Decisions API"))).toBe(true);
    });
  });

  describe("異常系テスト", () => {
    it("Google Maps APIキーが環境変数にもプロバイダーにも設定されていない場合は設定エラーを発生させる", async () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.EXPO_PUBLIC_API_KEY;

      await expect(
        analyzeRouteInProcess({
          origin: "東京都世田谷区用賀",
          destination: "静岡県御殿場市新橋",
          fuelEfficiencyKmPerLiter: 15,
          fuelPriceYenPerLiter: 175,
        }),
      ).rejects.toThrow("Google Maps API キーが設定されていません");
    });
  });
});
