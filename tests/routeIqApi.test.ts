import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RouteIqApiError,
  analyzeRouteApi,
  describeRouteError,
  getApiBaseUrl,
  getClientConfigApi,
  getFuelPriceAveragesApi,
} from "../src/shared/api";
import { defaultRouteInput, scenarioExpresswayRecommended } from "../src/harness/fixtures";

describe("routeIqApi Client", () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  describe("getApiBaseUrl", () => {
    it("returns default http://localhost:8787 when env is not set", () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      expect(getApiBaseUrl()).toBe("http://localhost:8787");
    });

    it("returns trimmed EXPO_PUBLIC_API_URL without trailing slashes", () => {
      process.env.EXPO_PUBLIC_API_URL = "https://api.routeiq.example.com///";
      expect(getApiBaseUrl()).toBe("https://api.routeiq.example.com");
    });
  });

  describe("describeRouteError", () => {
    it("describes network errors", () => {
      const err = new RouteIqApiError("network", null, "Failed to connect");
      const described = describeRouteError(err);
      expect(described.type).toBe("network");
      expect(described.title).toBe("接続できませんでした");
      expect(described.retryable).toBe(true);
    });

    it("describes rate limit errors", () => {
      const err = new RouteIqApiError("rate-limit", 429, "Too many requests");
      const described = describeRouteError(err);
      expect(described.type).toBe("rate_limit");
      expect(described.title).toBe("リクエスト集中");
      expect(described.retryable).toBe(true);
    });

    it("describes invalid request (not found) errors", () => {
      const err = new RouteIqApiError("invalid-request", 400, "Route not found");
      const described = describeRouteError(err);
      expect(described.type).toBe("not_found");
      expect(described.title).toBe("ルートが見つかりませんでした");
      expect(described.retryable).toBe(false);
    });

    it("describes server errors", () => {
      const err = new RouteIqApiError("server", 500, "Internal error");
      const described = describeRouteError(err);
      expect(described.type).toBe("server");
      expect(described.title).toBe("サーバーエラー");
      expect(described.retryable).toBe(true);
    });

    it("describes unexpected errors", () => {
      const err = new Error("Something broke");
      const described = describeRouteError(err);
      expect(described.type).toBe("unknown");
      expect(described.title).toBe("道路状況の確認に失敗");
      expect(described.retryable).toBe(true);
    });
  });

  describe("analyzeRouteApi", () => {
    it("successfully sends POST request and parses valid RouteAnalysisResult", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(scenarioExpresswayRecommended),
      });
      globalThis.fetch = mockFetch;

      const result = await analyzeRouteApi(defaultRouteInput, {
        baseUrl: "http://test-server:8787",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://test-server:8787/api/route-analysis",
        expect.objectContaining({
          method: "POST",
          headers: expect.any(Headers),
          body: JSON.stringify(defaultRouteInput),
        }),
      );
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(result.input.origin).toBe(defaultRouteInput.origin);
      expect(result.routeComparison?.recommendedRoute).toBe("expressway");
    });

    it("attaches x-api-key header when apiKey option is provided", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(scenarioExpresswayRecommended),
      });
      globalThis.fetch = mockFetch;

      await analyzeRouteApi(defaultRouteInput, {
        baseUrl: "http://test-server:8787",
        apiKey: "custom-secret-key",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://test-server:8787/api/route-analysis",
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get("x-api-key")).toBe("custom-secret-key");
    });

    it("throws RouteIqApiError with rate-limit on 429", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => JSON.stringify({ error: "リクエストが集中しています" }),
      });

      await expect(
        analyzeRouteApi(defaultRouteInput, { baseUrl: "http://test-server:8787" }),
      ).rejects.toThrowError(RouteIqApiError);

      try {
        await analyzeRouteApi(defaultRouteInput, { baseUrl: "http://test-server:8787" });
      } catch (e) {
        const err = e as RouteIqApiError;
        expect(err.kind).toBe("rate-limit");
        expect(err.status).toBe(429);
        expect(err.message).toBe("リクエストが集中しています");
      }
    });

    it("throws RouteIqApiError with network kind when fetch rejects", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Network request failed"));

      try {
        await analyzeRouteApi(defaultRouteInput, { baseUrl: "http://test-server:8787" });
      } catch (e) {
        const err = e as RouteIqApiError;
        expect(err.kind).toBe("network");
        expect(err.status).toBeNull();
      }
    });

    it("throws RouteIqApiError with server kind when payload schema is invalid", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ invalid: "data" }),
      });

      await expect(
        analyzeRouteApi(defaultRouteInput, { baseUrl: "http://test-server:8787" }),
      ).rejects.toThrowError(/APIレスポンスの形式が不正です/);
    });
  });

  describe("getFuelPriceAveragesApi", () => {
    it("successfully fetches and parses fuel prices", async () => {
      const mockPayload = {
        prices: [
          {
            label: "レギュラー",
            value: 175,
            unit: "円/L",
            surveyedAt: "2026年3月9日",
            sourceUrl: "https://www.enecho.meti.go.jp",
          },
          {
            label: "ハイオク",
            value: 186,
            unit: "円/L",
            surveyedAt: "2026年3月9日",
            sourceUrl: "https://www.enecho.meti.go.jp",
          },
        ],
        sourceLabel: "資源エネルギー庁 石油製品価格調査",
        fetchedAt: "2026-03-09T14:00:00.000Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(mockPayload),
      });

      const res = await getFuelPriceAveragesApi({ baseUrl: "http://test-server:8787" });
      expect(res.prices).toHaveLength(2);
      expect(res.prices[0].value).toBe(175);
      expect(res.sourceLabel).toBe("資源エネルギー庁 石油製品価格調査");
    });
  });

  describe("getClientConfigApi", () => {
    it("successfully fetches client config", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ googleMapsBrowserApiKey: "AIzaTestKey" }),
      });

      const config = await getClientConfigApi({ baseUrl: "http://test-server:8787" });
      expect(config.googleMapsBrowserApiKey).toBe("AIzaTestKey");
    });
  });

  describe("In-Process Standalone Mode", () => {
    it("analyzeRouteApi throws RouteIqApiError with server kind when Google Maps API key is missing", async () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.EXPO_PUBLIC_API_KEY;

      try {
        await analyzeRouteApi(defaultRouteInput);
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as RouteIqApiError;
        expect(err.kind).toBe("server");
        expect(err.message).toContain("Google Maps API キーが設定されていません");
      }
    });

    it("describeRouteError provides clear setup instructions when Google Maps API key is missing", () => {
      const error = new Error(
        "Google Maps API キーが設定されていません。.env ファイルに EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。",
      );
      const described = describeRouteError(error);
      expect(described.title).toBe("Google Maps API キー未設定");
      expect(described.recovery).toContain("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
      expect(described.retryable).toBe(true);
    });

    it("getFuelPriceAveragesApi returns nationwide averages without requiring external baseUrl", async () => {
      const res = await getFuelPriceAveragesApi();
      expect(res.prices).toBeDefined();
      expect(res.prices.length).toBeGreaterThanOrEqual(1);
      expect(res.sourceLabel).toContain("資源エネルギー庁");
    });
  });
});
