import { describe, expect, it, vi } from "vitest";
import {
  analyzeRouteInProcess,
  buildInitialAnswer,
} from "../src/domain/services/routeAnalysisService";
import type { ProviderRouteResult } from "../src/domain/types";
import { GoogleRoutesProvider } from "../src/domain/providers/googleRoutesProvider";

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

describe("routeAnalysisService", () => {
  it("throws error when Google Maps API key is missing and no provider is passed", async () => {
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

  it("computes expressway and local routes in parallel and returns valid RouteAnalysisResult", async () => {
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

  it("buildInitialAnswer creates a concise summary in Japanese", () => {
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
});
