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

describe("データ定義と入力検証（Contracts & Zod Schema Validation）", () => {
  describe("routeRequestSchema（ルート検索リクエストの検証）", () => {
    const validRequest = {
      origin: "東京駅",
      destination: "横浜駅",
      fuelEfficiencyKmPerLiter: 15.0,
      fuelPriceYenPerLiter: 175,
      prioritize: "balanced" as const,
    };

    describe("正常系テスト", () => {
      it("正しいルート検索条件（出発地・目的地・燃費など）が設定されている場合は受け付ける", () => {
        const parsed = routeRequestSchema.safeParse(validRequest);
        expect(parsed.success).toBe(true);
      });

      it("出発日時に正しいISO日時形式が指定された場合は受け付ける", () => {
        const parsed = routeRequestSchema.safeParse({
          ...validRequest,
          departureTime: "2026-09-15T08:30:00Z",
        });
        expect(parsed.success).toBe(true);
      });
    });

    describe("境界値テスト", () => {
      it("ガソリン単価が0円（下限値）の場合は受け付ける", () => {
        expect(
          routeRequestSchema.safeParse({ ...validRequest, fuelPriceYenPerLiter: 0 }).success,
        ).toBe(true);
      });

      it("ガソリン単価が-1円（下限値未満）の場合はエラーになる", () => {
        expect(
          routeRequestSchema.safeParse({ ...validRequest, fuelPriceYenPerLiter: -1 }).success,
        ).toBe(false);
      });
    });

    describe("異常系テスト", () => {
      it("出発日時の形式が不正な場合はエラーになる", () => {
        const parsed = routeRequestSchema.safeParse({
          ...validRequest,
          departureTime: "invalid-date-string",
        });
        expect(parsed.success).toBe(false);
      });

      it("出発地または目的地が空文字の場合はエラーになる", () => {
        expect(routeRequestSchema.safeParse({ ...validRequest, origin: "" }).success).toBe(false);
        expect(routeRequestSchema.safeParse({ ...validRequest, destination: "" }).success).toBe(
          false,
        );
      });

      it("燃費が0以下の数値の場合はエラーになる", () => {
        expect(
          routeRequestSchema.safeParse({ ...validRequest, fuelEfficiencyKmPerLiter: 0 }).success,
        ).toBe(false);
        expect(
          routeRequestSchema.safeParse({ ...validRequest, fuelEfficiencyKmPerLiter: -5 }).success,
        ).toBe(false);
      });

      it("想定外の優先指定（fastestなど）が設定された場合はエラーになる", () => {
        expect(
          routeRequestSchema.safeParse({ ...validRequest, prioritize: "fastest" }).success,
        ).toBe(false);
      });
    });
  });

  describe("routeAnalysisRequestSchema（ルート分析リクエストの検証）", () => {
    describe("正常系テスト", () => {
      it("質問テキスト（任意項目）を含めたルート分析条件を受け付ける", () => {
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
    });

    describe("異常系テスト", () => {
      it("質問テキストに空文字が指定された場合はエラーになる", () => {
        const parsed = routeAnalysisRequestSchema.safeParse({
          origin: "東京駅",
          destination: "横浜駅",
          fuelEfficiencyKmPerLiter: 15.0,
          question: "",
        });
        expect(parsed.success).toBe(false);
      });
    });
  });

  describe("routeProviderRequestSchema（外部ルート取得リクエストの検証）", () => {
    describe("正常系テスト", () => {
      it("高速道路（expressway）などの正しいルート種別を受け付ける", () => {
        const parsed = routeProviderRequestSchema.safeParse({
          origin: "東京駅",
          destination: "名古屋駅",
          routeType: "expressway",
        });
        expect(parsed.success).toBe(true);
      });
    });

    describe("異常系テスト", () => {
      it("想定されていないルート種別（airwayなど）が指定された場合はエラーになる", () => {
        const parsed = routeProviderRequestSchema.safeParse({
          origin: "東京駅",
          destination: "名古屋駅",
          routeType: "airway",
        });
        expect(parsed.success).toBe(false);
      });
    });
  });

  describe("routeCostSummarySchema（ルート費用集計結果の検証）", () => {
    describe("正常系テスト", () => {
      it("高速料金や燃料費を含むルート費用の集計結果を受け付ける", () => {
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

      it("ルートの描画座標データ（経緯度の配列）を受け付ける", () => {
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

    describe("境界値テスト", () => {
      it("料金や総費用が未定（null）の場合でも受け付ける", () => {
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
    });
  });

  describe("providerRouteResultSchema（外部プロバイダ応答結果の検証）", () => {
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

    describe("正常系テスト", () => {
      it("ルート探索サービスからの正常な応答結果を受け付ける", () => {
        const parsed = providerRouteResultSchema.safeParse(validProviderResult);
        expect(parsed.success).toBe(true);
      });
    });

    describe("境界値テスト", () => {
      it("有料道路料金が取得できない（null）場合でも受け付ける", () => {
        const parsed = providerRouteResultSchema.safeParse({
          ...validProviderResult,
          tollYen: null,
          tollConfidence: "unavailable",
        });
        expect(parsed.success).toBe(true);
      });
    });

    describe("異常系テスト", () => {
      it("料金信頼度や渋滞レベルに不正な値が設定されている場合はエラーになる", () => {
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
  });

  describe("compareRoutesResultSchema（ルート比較結果全体の検証）", () => {
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

    describe("正常系テスト", () => {
      it("高速道路と一般道のルート比較結果全体を正しく受け付ける", () => {
        const parsed = compareRoutesResultSchema.safeParse(validComparisonResult);
        expect(parsed.success).toBe(true);
      });
    });

    describe("境界値テスト", () => {
      it("金額差や時間価値が計算不能（null）の場合でも受け付ける", () => {
        const parsed = routeComparisonSchema.safeParse({
          timeDifferenceMinutes: 10,
          costDifferenceYen: null,
          valueOfTimeSavedYenPerMinute: null,
        });
        expect(parsed.success).toBe(true);
      });
    });
  });

  describe("comparisonHistoryItemSchema（検索履歴アイテムの検証）", () => {
    describe("正常系テスト", () => {
      it("過去の検索履歴データ（出発地・目的地・車種・日時など）を正しく受け付ける", () => {
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
    });

    describe("異常系テスト", () => {
      it("目的地など必須項目が欠けているデータはエラーになる", () => {
        const invalid = {
          id: "hist-123",
          origin: "用賀IC",
          // missing destination
          vehicleType: "普通車",
        };
        expect(comparisonHistoryItemSchema.safeParse(invalid).success).toBe(false);
      });
    });
  });

  describe("fuelPriceAveragesResponseSchema（ガソリン平均価格レスポンスの検証）", () => {
    describe("正常系テスト", () => {
      it("レギュラー等のガソリン平均価格情報（単位: 円/L）を正しく受け付ける", () => {
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
    });

    describe("異常系テスト", () => {
      it("価格の単位が「円/L」以外の場合はエラーになる", () => {
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
  });

  describe("clientConfigResponseSchema（クライアント設定レスポンスの検証）", () => {
    describe("正常系テスト", () => {
      it("Google Maps APIキーを含むクライアント設定を受け付ける", () => {
        const parsed = clientConfigResponseSchema.safeParse({
          googleMapsBrowserApiKey: "AIzaTestKey",
          googleMapsEmbedApiKey: null,
        });
        expect(parsed.success).toBe(true);
      });
    });

    describe("境界値テスト", () => {
      it("APIキーが未設定（null）の場合でも受け付ける", () => {
        const parsed = clientConfigResponseSchema.safeParse({
          googleMapsBrowserApiKey: null,
        });
        expect(parsed.success).toBe(true);
      });
    });
  });
});
