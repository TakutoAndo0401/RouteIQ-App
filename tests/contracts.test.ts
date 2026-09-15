import { describe, expect, it } from "vitest";
import {
  routeRequestSchema,
  routeAnalysisRequestSchema,
  routeProviderRequestSchema,
  providerRouteResultSchema,
  routeCostSummarySchema,
  routeComparisonSchema,
  compareRoutesResultSchema,
  comparisonHistoryItemSchema,
  fuelPriceAveragesResponseSchema,
  clientConfigResponseSchema,
} from "../src/contracts";

describe("Contracts & Zod Schema Validation", () => {
  describe("routeRequestSchema", () => {
    const validRequest = {
      origin: "東京駅",
      destination: "横浜駅",
      fuelEfficiencyKmPerLiter: 15.0,
      fuelPriceYenPerLiter: 175,
      prioritize: "balanced" as const,
    };

    it("accepts valid route request data", () => {
      const parsed = routeRequestSchema.safeParse(validRequest);
      expect(parsed.success).toBe(true);
    });

    it("accepts valid ISO datetime for departureTime", () => {
      const parsed = routeRequestSchema.safeParse({
        ...validRequest,
        departureTime: "2026-09-15T08:30:00Z",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid datetime format for departureTime", () => {
      const parsed = routeRequestSchema.safeParse({
        ...validRequest,
        departureTime: "invalid-date-string",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects empty origin or destination", () => {
      expect(routeRequestSchema.safeParse({ ...validRequest, origin: "" }).success).toBe(false);
      expect(routeRequestSchema.safeParse({ ...validRequest, destination: "" }).success).toBe(
        false,
      );
    });

    it("rejects non-positive fuelEfficiencyKmPerLiter", () => {
      expect(
        routeRequestSchema.safeParse({ ...validRequest, fuelEfficiencyKmPerLiter: 0 }).success,
      ).toBe(false);
      expect(
        routeRequestSchema.safeParse({ ...validRequest, fuelEfficiencyKmPerLiter: -5 }).success,
      ).toBe(false);
    });

    it("rejects negative fuelPriceYenPerLiter but accepts zero", () => {
      expect(
        routeRequestSchema.safeParse({ ...validRequest, fuelPriceYenPerLiter: -1 }).success,
      ).toBe(false);
      expect(
        routeRequestSchema.safeParse({ ...validRequest, fuelPriceYenPerLiter: 0 }).success,
      ).toBe(true);
    });

    it("rejects unrecognized prioritize mode", () => {
      expect(routeRequestSchema.safeParse({ ...validRequest, prioritize: "fastest" }).success).toBe(
        false,
      );
    });
  });

  describe("routeAnalysisRequestSchema", () => {
    it("extends routeRequest with optional question", () => {
      const parsed = routeAnalysisRequestSchema.safeParse({
        origin: "東京駅",
        destination: "横浜駅",
        fuelEfficiencyKmPerLiter: 15.0,
        question: "どちらがおすすめですか？",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.question).toBe("どちらがおすすめですか？");
      }
    });

    it("rejects empty question string when specified", () => {
      const parsed = routeAnalysisRequestSchema.safeParse({
        origin: "東京駅",
        destination: "横浜駅",
        fuelEfficiencyKmPerLiter: 15.0,
        question: "",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("routeProviderRequestSchema", () => {
    it("validates valid provider request with routeType", () => {
      const parsed = routeProviderRequestSchema.safeParse({
        origin: "東京駅",
        destination: "名古屋駅",
        routeType: "expressway",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid routeType", () => {
      const parsed = routeProviderRequestSchema.safeParse({
        origin: "東京駅",
        destination: "名古屋駅",
        routeType: "airway",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("routeCostSummarySchema", () => {
    it("validates summary with toll and fuel cost", () => {
      const parsed = routeCostSummarySchema.safeParse({
        distanceKm: 50,
        durationMinutes: 45,
        tollYen: 1500,
        tollConfidence: "api",
        fuelCostYen: 500,
        totalCostYen: 2000,
        trafficSummary: "順調",
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts null for tollYen and totalCostYen", () => {
      const parsed = routeCostSummarySchema.safeParse({
        distanceKm: 50,
        durationMinutes: 45,
        tollYen: null,
        tollConfidence: "unavailable",
        fuelCostYen: 500,
        totalCostYen: null,
        trafficSummary: "順調",
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts optional routePolyline coordinates array", () => {
      const parsed = routeCostSummarySchema.safeParse({
        distanceKm: 2.0,
        durationMinutes: 6,
        tollYen: 0,
        tollConfidence: "api",
        fuelCostYen: 30,
        totalCostYen: 30,
        trafficSummary: "順調",
        routePolyline: [
          { lat: 35.6865, lng: 139.7644 },
          { lat: 35.6812, lng: 139.7671 },
        ],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.routePolyline).toHaveLength(2);
      }
    });
  });

  describe("providerRouteResultSchema", () => {
    const validProviderResult = {
      routeType: "expressway" as const,
      distanceKm: 85.5,
      durationMinutes: 65,
      tollYen: 2850,
      tollConfidence: "api" as const,
      trafficSummary: "順調",
      congestionLevel: "low" as const,
      trafficIncidents: [],
      roadClosures: [],
      warnings: [],
      dataSources: ["Google Maps"],
      apiFailures: [],
    };

    it("validates successful provider route result", () => {
      const parsed = providerRouteResultSchema.safeParse(validProviderResult);
      expect(parsed.success).toBe(true);
    });

    it("allows null for tollYen when toll is unavailable", () => {
      const parsed = providerRouteResultSchema.safeParse({
        ...validProviderResult,
        tollYen: null,
        tollConfidence: "unavailable",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid tollConfidence or congestionLevel values", () => {
      expect(
        providerRouteResultSchema.safeParse({
          ...validProviderResult,
          tollConfidence: "estimated",
        }).success,
      ).toBe(false);

      expect(
        providerRouteResultSchema.safeParse({
          ...validProviderResult,
          congestionLevel: "extreme",
        }).success,
      ).toBe(false);
    });
  });

  describe("compareRoutesResultSchema", () => {
    const validComparisonResult = {
      input: {
        origin: "東京",
        destination: "箱根",
        fuelEfficiencyKmPerLiter: 15,
      },
      recommendedRoute: "expressway" as const,
      recommendationReason: "時間短縮のため高速をおすすめします。",
      expresswayRoute: {
        distanceKm: 80,
        durationMinutes: 60,
        tollYen: 2000,
        tollConfidence: "api" as const,
        fuelCostYen: 800,
        totalCostYen: 2800,
        trafficSummary: "順調",
      },
      localRoute: {
        distanceKm: 85,
        durationMinutes: 120,
        tollYen: 0,
        tollConfidence: "api" as const,
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

    it("validates full route comparison result structure", () => {
      const parsed = compareRoutesResultSchema.safeParse(validComparisonResult);
      expect(parsed.success).toBe(true);
    });

    it("allows null for costDifferenceYen and valueOfTimeSavedYenPerMinute in comparison", () => {
      const parsed = routeComparisonSchema.safeParse({
        timeDifferenceMinutes: 10,
        costDifferenceYen: null,
        valueOfTimeSavedYenPerMinute: null,
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("comparisonHistoryItemSchema", () => {
    it("validates valid history item", () => {
      const item = {
        id: "hist-123",
        origin: "用賀IC",
        destination: "御殿場IC",
        vehicleType: "普通車",
        date: "9/12",
        timestamp: 1726100000000,
      };
      const parsed = comparisonHistoryItemSchema.safeParse(item);
      expect(parsed.success).toBe(true);
    });

    it("rejects missing required properties", () => {
      const invalid = {
        id: "hist-123",
        origin: "用賀IC",
        // missing destination
        vehicleType: "普通車",
      };
      expect(comparisonHistoryItemSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("fuelPriceAveragesResponseSchema", () => {
    it("validates fuel price average response with strict unit constraint", () => {
      const valid = {
        prices: [
          {
            label: "レギュラー",
            value: 174.5,
            unit: "円/L" as const,
            surveyedAt: "2026年9月8日",
            sourceUrl: "https://www.enecho.meti.go.jp",
          },
        ],
        sourceLabel: "資源エネルギー庁",
        fetchedAt: "2026-09-12T00:00:00Z",
      };
      const parsed = fuelPriceAveragesResponseSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid unit strings", () => {
      const invalid = {
        prices: [
          {
            label: "レギュラー",
            value: 174.5,
            unit: "JPY/L", // unit must be '円/L'
            surveyedAt: "2026年9月8日",
            sourceUrl: "https://www.enecho.meti.go.jp",
          },
        ],
        sourceLabel: "資源エネルギー庁",
        fetchedAt: "2026-09-12T00:00:00Z",
      };
      expect(fuelPriceAveragesResponseSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("clientConfigResponseSchema", () => {
    it("validates client configuration schema", () => {
      const parsed = clientConfigResponseSchema.safeParse({
        googleMapsBrowserApiKey: "AIzaTestKey",
        googleMapsEmbedApiKey: null,
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts null for googleMapsBrowserApiKey", () => {
      const parsed = clientConfigResponseSchema.safeParse({
        googleMapsBrowserApiKey: null,
      });
      expect(parsed.success).toBe(true);
    });
  });
});
