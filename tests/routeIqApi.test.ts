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

describe("RouteIQ APIクライアント (routeIqApi)", () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  describe("getApiBaseUrl（APIベースURLの取得）", () => {
    describe("正常系テスト", () => {
      it("環境変数が未設定の場合はデフォルトのローカルURL（http://localhost:8787）を返す", () => {
        delete process.env.EXPO_PUBLIC_API_URL;
        expect(getApiBaseUrl()).toBe("http://localhost:8787");
      });
    });

    describe("境界値テスト", () => {
      it("末尾にスラッシュが連続して含まれるURLでも末尾スラッシュを除去して整形する", () => {
        process.env.EXPO_PUBLIC_API_URL = "https://api.routeiq.example.com///";
        expect(getApiBaseUrl()).toBe("https://api.routeiq.example.com");
      });
    });
  });

  describe("describeRouteError（エラー表示情報の生成）", () => {
    describe("正常系テスト", () => {
      it("ネットワーク接続エラーを検知し、再試行可能な接続エラー情報を返す", () => {
        const err = new RouteIqApiError("network", null, "Failed to connect");
        const described = describeRouteError(err);
        expect(described.type).toBe("network");
        expect(described.title).toBe("接続できませんでした");
        expect(described.retryable).toBe(true);
      });

      it("レート制限（429）エラーを検知し、再試行可能なリクエスト集中情報を返す", () => {
        const err = new RouteIqApiError("rate-limit", 429, "Too many requests");
        const described = describeRouteError(err);
        expect(described.type).toBe("rate_limit");
        expect(described.title).toBe("リクエスト集中");
        expect(described.retryable).toBe(true);
      });

      it("リクエスト不正（400等）エラーを検知し、再試行不可なルート未発見情報を返す", () => {
        const err = new RouteIqApiError("invalid-request", 400, "Route not found");
        const described = describeRouteError(err);
        expect(described.type).toBe("not_found");
        expect(described.title).toBe("ルートが見つかりませんでした");
        expect(described.retryable).toBe(false);
      });

      it("サーバーエラー（500）を検知し、再試行可能なサーバー障害情報を返す", () => {
        const err = new RouteIqApiError("server", 500, "Internal error");
        const described = describeRouteError(err);
        expect(described.type).toBe("server");
        expect(described.title).toBe("サーバーエラー");
        expect(described.retryable).toBe(true);
      });

      it("未分類の予期せぬエラーを検知し、一般的なエラー情報を返す", () => {
        const err = new Error("Something broke");
        const described = describeRouteError(err);
        expect(described.type).toBe("unknown");
        expect(described.title).toBe("道路状況の確認に失敗");
        expect(described.retryable).toBe(true);
      });

      it("APIキー未設定エラーの場合は、環境変数の設定手順を案内するエラー情報を返す", () => {
        const error = new Error(
          "Google Maps API キーが設定されていません。.env ファイルに EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。",
        );
        const described = describeRouteError(error);
        expect(described.title).toBe("Google Maps API キー未設定");
        expect(described.recovery).toContain("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
        expect(described.retryable).toBe(true);
      });
    });
  });

  describe("analyzeRouteApi（ルート比較APIの呼び出し）", () => {
    describe("正常系テスト", () => {
      it("POSTリクエストを送信し、比較結果（高速優先シナリオ）を正常にパースできる", async () => {
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

      it("APIキーがオプション指定された場合はヘッダー（x-api-key）に付与して送信する", async () => {
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
    });

    describe("異常系テスト", () => {
      it("ステータスコード429を受信した場合はレート制限エラー（rate-limit）を発生させる", async () => {
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

      it("ネットワーク通信に失敗した場合はネットワークエラー（network）を発生させる", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Network request failed"));

        try {
          await analyzeRouteApi(defaultRouteInput, { baseUrl: "http://test-server:8787" });
        } catch (e) {
          const err = e as RouteIqApiError;
          expect(err.kind).toBe("network");
          expect(err.status).toBeNull();
        }
      });

      it("レスポンスデータの形式が不正な場合はサーバーエラー（server）を発生させる", async () => {
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
  });

  describe("getFuelPriceAveragesApi（ガソリン平均価格取得API）", () => {
    describe("正常系テスト", () => {
      it("サーバーから全国平均ガソリン価格データを正常に取得・パースできる", async () => {
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
  });

  describe("getClientConfigApi（クライアント設定取得API）", () => {
    describe("正常系テスト", () => {
      it("サーバーからGoogle Mapsブラウザ用APIキーなどのクライアント設定を取得できる", async () => {
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
  });

  describe("スタンドアロン・インプロセス動作モード", () => {
    describe("正常系テスト", () => {
      it("外部サーバー未指定時でも全国平均ガソリン価格をローカルロジックから直接取得できる", async () => {
        const res = await getFuelPriceAveragesApi();
        expect(res.prices).toBeDefined();
        expect(res.prices.length).toBeGreaterThanOrEqual(1);
        expect(res.sourceLabel).toContain("資源エネルギー庁");
      });
    });

    describe("異常系テスト", () => {
      it("Google Maps APIキーが未設定の場合はサーバーエラー種別のエラーを発生させる", async () => {
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
    });
  });
});
