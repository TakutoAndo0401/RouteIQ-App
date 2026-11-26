import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GEMINI_DECISION_MODEL,
  GEMINI_DECISIONS_ENDPOINT,
  GeminiDecisionProvider,
  buildRouteDecisionInput,
  buildRouteDecisionQuestions,
  formatDecisionReason,
  type RouteDecisionContext,
} from "../src/domain/providers/geminiDecisionProvider";

function createContext(overrides?: Partial<RouteDecisionContext>): RouteDecisionContext {
  return {
    origin: "東京都世田谷区用賀1丁目",
    destination: "静岡県御殿場市新橋",
    vehicleType: "普通車",
    fuelEfficiencyKmPerLiter: 15,
    fuelPriceYenPerLiter: 175,
    prioritize: "balanced",
    expresswayRoute: {
      distanceKm: 85.0,
      durationMinutes: 72,
      tollYen: 2850,
      tollConfidence: "api",
      fuelCostYen: 992,
      totalCostYen: 3842,
      trafficSummary: "大きな渋滞は検出されていません。主な経路: 東名高速道路",
      majorHighway: "東名高速道路",
    },
    expresswayCongestionLevel: "low",
    expresswayWarnings: [],
    localRoute: {
      distanceKm: 92.5,
      durationMinutes: 145,
      tollYen: 0,
      tollConfidence: "api",
      fuelCostYen: 1079,
      totalCostYen: 1079,
      trafficSummary: "一部で低速区間があります。主な経路: 国道246号",
    },
    localCongestionLevel: "moderate",
    localWarnings: [],
    comparison: {
      timeDifferenceMinutes: 73,
      costDifferenceYen: 2763,
      valueOfTimeSavedYenPerMinute: 38,
    },
    trafficIncidents: [],
    ...overrides,
  };
}

describe("Gemini Decisions API プロバイダー (GeminiDecisionProvider)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("buildRouteDecisionInput（構造化入力コンテキスト生成）", () => {
    it("出発地・目的地・優先方針・両ルート比較メトリクスを漏れなく構造化テキスト化する", () => {
      const text = buildRouteDecisionInput(createContext({ prioritize: "time" }));
      expect(text).toContain("東京都世田谷区用賀1丁目");
      expect(text).toContain("静岡県御殿場市新橋");
      expect(text).toContain("優先方針: time");
      expect(text).toContain("車種: 普通車");
      expect(text).toContain("高速道路の方が 73分 早い");
      expect(text).toContain("38円/分");
      expect(text).toContain("東名高速道路");
    });

    it("高速料金が未確定（null）のケースでは未確定であることを明示する", () => {
      const text = buildRouteDecisionInput(
        createContext({
          expresswayRoute: {
            ...createContext().expresswayRoute,
            tollYen: null,
            tollConfidence: "unavailable",
            totalCostYen: null,
          },
          comparison: {
            timeDifferenceMinutes: 40,
            costDifferenceYen: null,
            valueOfTimeSavedYenPerMinute: null,
          },
        }),
      );
      expect(text).toContain("高速料金: 未確定");
      expect(text).toContain("総額差: 未確定");
    });
  });

  describe("buildRouteDecisionQuestions（質問セット構築）", () => {
    it("recommended_route (choice), primary_reason (choice), worth_paying_toll (noul) の3問を構築する", () => {
      const questions = buildRouteDecisionQuestions("cost");
      expect(questions.recommended_route.type).toBe("choice");
      expect(Object.keys(questions.recommended_route.criteria)).toEqual(["expressway", "local"]);
      expect(questions.recommended_route.instructions).toContain("費用優先");
      expect(questions.primary_reason.type).toBe("choice");
      expect(questions.worth_paying_toll.type).toBe("noul");
    });
  });

  describe("formatDecisionReason（日本語推奨理由の生成）", () => {
    it("高速推奨・strong_time_value の場合、短縮時間と追加費用を含む理由を返す", () => {
      const reason = formatDecisionReason({
        recommendedRoute: "expressway",
        primaryReasonCode: "strong_time_value",
        context: createContext(),
        confidence: 0.92,
      });
      expect(reason).toContain("1時間13分短縮");
      expect(reason).toContain("2,763円");
      expect(reason).toContain("高速道路ルートをおすすめします");
    });

    it("確信度が 60% 未満の僅差判定では補足文を付与する", () => {
      const reason = formatDecisionReason({
        recommendedRoute: "local",
        primaryReasonCode: "cost_too_high_for_time_saved",
        context: createContext({
          comparison: {
            timeDifferenceMinutes: 10,
            costDifferenceYen: 1200,
            valueOfTimeSavedYenPerMinute: 120,
          },
        }),
        confidence: 0.54,
      });
      expect(reason).toContain("一般道ルートをおすすめします");
      expect(reason).toContain("僅差のため");
    });
  });

  describe("decideRoute（Decisions API 呼び出しとレスポンス解析）", () => {
    describe("正常系テスト", () => {
      it("v1beta/decisions へ正しいペイロードを送信し、高速道路推奨の判定と確率・確信度を取得できる", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              answers: {
                recommended_route: {
                  type: "choice",
                  choice: "expressway",
                  probabilities: { expressway: 0.91, local: 0.09 },
                  confidence: 0.91,
                },
                primary_reason: {
                  type: "choice",
                  choice: "strong_time_value",
                  probabilities: { strong_time_value: 0.88 },
                  confidence: 0.88,
                },
                worth_paying_toll: {
                  type: "noul",
                  noul: 0.89,
                  confidence: 0.89,
                },
              },
              usage: {
                total_input_tokens: 320,
                total_output_tokens: 0,
              },
            }),
        });
        globalThis.fetch = mockFetch;

        const provider = new GeminiDecisionProvider({ apiKey: "test-gemini-key" });
        const result = await provider.decideRoute(createContext());

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toBe(GEMINI_DECISIONS_ENDPOINT);
        expect(init.method).toBe("POST");
        expect(init.headers["x-goog-api-key"]).toBe("test-gemini-key");

        const sentBody = JSON.parse(init.body as string);
        expect(sentBody.model).toBe(DEFAULT_GEMINI_DECISION_MODEL);
        expect(typeof sentBody.input).toBe("string");
        expect(sentBody.questions.recommended_route.type).toBe("choice");
        expect(sentBody.questions.worth_paying_toll.type).toBe("noul");

        expect(result.recommendedRoute).toBe("expressway");
        expect(result.decision.source).toBe("gemini-decisions-api");
        expect(result.decision.model).toBe("gemini-decision-1");
        expect(result.decision.confidence).toBe(0.91);
        expect(result.decision.probabilities).toEqual({ expressway: 0.91, local: 0.09 });
        expect(result.decision.primaryReasonCode).toBe("strong_time_value");
        expect(result.decision.worthPayingTollProbability).toBe(0.89);
        expect(result.dataSources).toContain("Gemini Decisions API (gemini-decision-1)");
      });

      it("一般道推奨のレスポンスを正しく解析できる", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              answers: {
                recommended_route: {
                  type: "choice",
                  choice: "local",
                  probabilities: { expressway: 0.12, local: 0.88 },
                  confidence: 0.88,
                },
                primary_reason: {
                  type: "choice",
                  choice: "cost_too_high_for_time_saved",
                  probabilities: { cost_too_high_for_time_saved: 0.82 },
                  confidence: 0.82,
                },
                worth_paying_toll: {
                  type: "noul",
                  noul: 0.15,
                  confidence: 0.85,
                },
              },
            }),
        });

        const provider = new GeminiDecisionProvider({ apiKey: "test-gemini-key" });
        const result = await provider.decideRoute(
          createContext({
            comparison: {
              timeDifferenceMinutes: 8,
              costDifferenceYen: 1350,
              valueOfTimeSavedYenPerMinute: 169,
            },
          }),
        );

        expect(result.recommendedRoute).toBe("local");
        expect(result.recommendationReason).toContain("一般道ルートをおすすめします");
        expect(result.decision.probabilities?.local).toBe(0.88);
      });
    });

    describe("異常系テスト", () => {
      it("APIキーが空の場合は設定エラーを投げる", async () => {
        const provider = new GeminiDecisionProvider({ apiKey: "" });
        await expect(provider.decideRoute(createContext())).rejects.toThrow(
          "Gemini API キーが設定されていません",
        );
      });

      it("HTTP 400（安全ブロック等）が返された場合はエラー詳細を含めて例外を投げる", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({
              error: {
                code: "safety",
                message: "Request blocked due to safety violations.",
              },
            }),
        });

        const provider = new GeminiDecisionProvider({ apiKey: "test-gemini-key" });
        await expect(provider.decideRoute(createContext())).rejects.toThrow(
          "Gemini Decisions API request failed with 400: [safety] Request blocked due to safety violations.",
        );
      });

      it("prompt_feedback に block_reason が含まれる場合は例外を投げる", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              prompt_feedback: { block_reason: "SAFETY" },
            }),
        });

        const provider = new GeminiDecisionProvider({ apiKey: "test-gemini-key" });
        await expect(provider.decideRoute(createContext())).rejects.toThrow("安全フィルタ");
      });

      it("recommended_route に想定外の choice が返された場合は例外を投げる", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              answers: {
                recommended_route: {
                  type: "choice",
                  choice: "ferry",
                  probabilities: { ferry: 1.0 },
                  confidence: 1.0,
                },
              },
            }),
        });

        const provider = new GeminiDecisionProvider({ apiKey: "test-gemini-key" });
        await expect(provider.decideRoute(createContext())).rejects.toThrow("想定外の推奨ルート");
      });

      it("AbortError が発生した場合はタイムアウトエラーを投げる", async () => {
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        globalThis.fetch = vi.fn().mockRejectedValue(abortError);

        const provider = new GeminiDecisionProvider({ apiKey: "test-gemini-key", timeoutMs: 100 });
        await expect(provider.decideRoute(createContext())).rejects.toThrow("タイムアウト");
      });
    });
  });
});
