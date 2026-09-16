import { describe, expect, it, vi } from "vitest";
import {
  GoogleRoutesProvider,
  decodePolyline,
  extractHighwayNames,
  isHighwayName,
  parseDurationMinutes,
  parseToll,
  resolveGoogleDepartureTime,
  yenFromMoney,
} from "../src/domain/providers/googleRoutesProvider";

describe("Google Routes APIプロバイダー (GoogleRoutesProvider)", () => {
  describe("parseDurationMinutes（所要時間文字列の分単位数値への変換）", () => {
    describe("正常系テスト", () => {
      it("「3600s」のような秒数表現文字列を正しく分単位の数値（60分）に変換できる", () => {
        expect(parseDurationMinutes("3600s")).toBe(60);
        expect(parseDurationMinutes("4500s")).toBe(75);
      });
    });

    describe("異常系テスト", () => {
      it("無効な文字列や未定義値（undefined）が渡された場合はエラーを発生させる", () => {
        expect(() => parseDurationMinutes("invalid")).toThrow();
        expect(() => parseDurationMinutes(undefined)).toThrow();
      });
    });
  });

  describe("decodePolyline（圧縮されたルート座標ポリラインのデコード）", () => {
    describe("正常系テスト", () => {
      it("Google形式のエンコード済みポリライン文字列を緯度経度オブジェクトの配列に復元できる", () => {
        // "_p~iF~ps|U_ulLnnqC_mqNvxq`@" is a valid encoded polyline string
        const polyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
        const coords = decodePolyline(polyline);
        expect(coords.length).toBeGreaterThan(0);
        expect(coords[0]).toHaveProperty("lat");
        expect(coords[0]).toHaveProperty("lng");
      });
    });

    describe("境界値テスト", () => {
      it("ポリラインが空文字または未定義の場合は空配列を返す", () => {
        expect(decodePolyline(undefined)).toEqual([]);
        expect(decodePolyline("")).toEqual([]);
      });
    });
  });

  describe("resolveGoogleDepartureTime（API送信用出発日時の調整）", () => {
    describe("正常系テスト", () => {
      it("未来の出発時刻が指定された場合はそのままの値を保持する", () => {
        const now = new Date("2026-09-12T12:00:00Z");
        const future = new Date("2026-09-12T13:00:00Z").toISOString();
        const res = resolveGoogleDepartureTime(future, now);
        expect(res.departureTime).toBe(future);
        expect(res.warning).toBeUndefined();
      });
    });

    describe("境界値テスト", () => {
      it("出発日時が未指定の場合は空オブジェクトを返す", () => {
        expect(resolveGoogleDepartureTime(undefined)).toEqual({});
      });

      it("過去または現在直前の出発日時が指定された場合は、現在から5分後に自動補正して警告を付与する", () => {
        const now = new Date("2026-09-12T12:00:00Z");
        const past = new Date("2026-09-12T11:00:00Z").toISOString();
        const res = resolveGoogleDepartureTime(past, now);
        expect(res.departureTime).toBe("2026-09-12T12:05:00.000Z");
        expect(res.warning).toContain("5分後に補正");
      });
    });
  });

  describe("yenFromMoney（Google通貨オブジェクトから日本円数値への抽出）", () => {
    describe("正常系テスト", () => {
      it("日本円（JPY）の金額オブジェクトから円単位の数値を抽出できる", () => {
        expect(yenFromMoney({ currencyCode: "JPY", units: "2850" })).toBe(2850);
      });
    });

    describe("境界値テスト", () => {
      it("日本円以外の通貨コード（例: USD）の場合はnullを返す", () => {
        expect(yenFromMoney({ currencyCode: "USD", units: "20" })).toBeNull();
      });
    });
  });

  describe("parseToll（高速料金情報の抽出）", () => {
    describe("正常系テスト", () => {
      it("APIレスポンスの有料道路料金（JPY）を正確に読み取り、信頼度apiとして返す", () => {
        const res = parseToll(
          {
            travelAdvisory: {
              tollInfo: {
                estimatedPrice: [{ currencyCode: "JPY", units: "2450" }],
              },
            },
          },
          "expressway",
        );
        expect(res.tollYen).toBe(2450);
        expect(res.confidence).toBe("api");
      });

      it("一般道ルートで料金情報がない場合は料金0円かつ信頼度apiとして扱う", () => {
        const res = parseToll({}, "local");
        expect(res.tollYen).toBe(0);
        expect(res.confidence).toBe("api");
      });
    });

    describe("境界値テスト", () => {
      it("高速道路ルートで料金情報が含まれていない場合は料金nullかつ信頼度unavailableとして扱う", () => {
        const res = parseToll({}, "expressway");
        expect(res.tollYen).toBeNull();
        expect(res.confidence).toBe("unavailable");
      });

      it("料金が日本円（JPY）以外のみの場合は料金nullかつ信頼度unavailableとし、警告を付与する", () => {
        const res = parseToll(
          {
            travelAdvisory: {
              tollInfo: {
                estimatedPrice: [{ currencyCode: "USD", units: "25" }],
              },
            },
          },
          "expressway",
        );
        expect(res.tollYen).toBeNull();
        expect(res.confidence).toBe("unavailable");
        expect(res.warning).toContain("JPY 以外の toll estimate");
      });
    });
  });

  describe("computeRoute（Google Routes API経由でのルート探索）", () => {
    describe("正常系テスト", () => {
      it("高速道路ルートの計算リクエストを送信し、距離・時間・料金・渋滞情報を含む結果を取得できる", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            routes: [
              {
                distanceMeters: 45000,
                duration: "2700s",
                description: "東名高速道路",
                travelAdvisory: {
                  tollInfo: {
                    estimatedPrice: [{ currencyCode: "JPY", units: "1850" }],
                  },
                  speedReadingIntervals: [{ speed: "NORMAL" }],
                },
              },
            ],
          }),
        });
        globalThis.fetch = mockFetch;

        const provider = new GoogleRoutesProvider({ apiKey: "test-api-key" });
        const result = await provider.computeRoute({
          origin: "東京都世田谷区用賀",
          destination: "静岡県御殿場市",
          routeType: "expressway",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "X-Goog-Api-Key": "test-api-key",
            }),
          }),
        );

        expect(result.routeType).toBe("expressway");
        expect(result.distanceKm).toBe(45);
        expect(result.durationMinutes).toBe(45);
        expect(result.tollYen).toBe(1850);
        expect(result.tollConfidence).toBe("api");
        expect(result.dataSources).toContain("Google Maps Routes API");
      });

      it("一般道ルート探索時に有料道路回避オプションが機能し、料金0円として処理される", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            routes: [
              {
                distanceMeters: 50000,
                duration: "5400s",
                description: "国道246号",
              },
            ],
          }),
        });

        const provider = new GoogleRoutesProvider({ apiKey: "test-api-key" });
        const result = await provider.computeRoute({
          origin: "用賀",
          destination: "御殿場",
          routeType: "local",
        });

        expect(result.routeType).toBe("local");
        expect(result.tollYen).toBe(0);
        expect(result.warnings.some((w) => w.includes("avoidTolls / avoidHighways"))).toBe(true);
      });
    });

    describe("境界値テスト", () => {
      it("Google APIからフォールバック情報（fallbackInfo）が返された場合は警告リストに記録する", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            routes: [
              {
                distanceMeters: 30000,
                duration: "2000s",
              },
            ],
            fallbackInfo: {
              routingModeFallbackReason: "TRAFFIC_AWARE_UNAVAILABLE",
            },
          }),
        });

        const provider = new GoogleRoutesProvider({ apiKey: "test-api-key" });
        const result = await provider.computeRoute({
          origin: "東京",
          destination: "千葉",
          routeType: "expressway",
        });

        expect(result.warnings.some((w) => w.includes("fallbackInfo"))).toBe(true);
      });
    });

    describe("異常系テスト", () => {
      it("APIキーが未設定の場合は即座に設定エラーを発生させる", async () => {
        const provider = new GoogleRoutesProvider({ apiKey: "" });
        await expect(
          provider.computeRoute({
            origin: "東京",
            destination: "横浜",
            routeType: "expressway",
          }),
        ).rejects.toThrow("Google Maps API キーが設定されていません");
      });

      it("Google APIからHTTPエラー（例: 400）が返された場合はリクエスト失敗エラーを発生させる", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => "Invalid location coordinates",
        });

        const provider = new GoogleRoutesProvider({ apiKey: "test-api-key" });
        await expect(
          provider.computeRoute({
            origin: "不正な場所",
            destination: "横浜",
            routeType: "expressway",
          }),
        ).rejects.toThrow("Google Routes API request failed with 400");
      });

      it("レスポンスのルート一覧が空配列の場合は、ルート情報なしエラーを発生させる", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ routes: [] }),
        });

        const provider = new GoogleRoutesProvider({ apiKey: "test-api-key" });
        await expect(
          provider.computeRoute({
            origin: "東京",
            destination: "横浜",
            routeType: "expressway",
          }),
        ).rejects.toThrow("Google Routes API のレスポンスにルート情報が含まれていませんでした");
      });

      it("expresswayルートの場合、descriptionやstepsから高速道路名が抽出されて結果に含まれる", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            routes: [
              {
                distanceMeters: 33500,
                duration: "2700s",
                description: "首都高速神奈川1号横羽線",
                legs: [
                  {
                    steps: [
                      {
                        navigationInstruction: {
                          instructions: "首都高速都心環状線/C1 に入る",
                        },
                      },
                      {
                        navigationInstruction: {
                          instructions: "首都高速神奈川1号横羽線/K1 を進む",
                        },
                      },
                    ],
                  },
                ],
                travelAdvisory: {
                  tollInfo: {
                    estimatedPrice: [{ currencyCode: "JPY", units: "1950" }],
                  },
                },
              },
            ],
          }),
        });

        const provider = new GoogleRoutesProvider({ apiKey: "test-api-key" });
        const res = await provider.computeRoute({
          origin: "千代田区",
          destination: "横浜市",
          routeType: "expressway",
        });

        expect(res.majorHighway).toBe("首都高速神奈川1号横羽線");
        expect(res.highwayNames).toEqual(["首都高速神奈川1号横羽線", "首都高速都心環状線"]);
        expect(res.highwayNames).not.toContain("東名高速");
      });
    });
  });

  describe("extractHighwayNames（高速道路名・路線の抽出と正規化）", () => {
    describe("正常系テスト", () => {
      it("route.description から主要な高速道路名を正しく抽出できる", () => {
        const result = extractHighwayNames({
          description: "首都高速神奈川1号横羽線",
        });
        expect(result.majorHighway).toBe("首都高速神奈川1号横羽線");
        expect(result.highwayNames).toEqual(["首都高速神奈川1号横羽線"]);
      });

      it("ステップ案内文（instructions）から路線記号を除去し高速道路名を重複なく抽出できる", () => {
        const result = extractHighwayNames({
          legs: [
            {
              steps: [
                { navigationInstruction: { instructions: "首都高速都心環状線/C1 に入る" } },
                { navigationInstruction: { instructions: "首都高速神奈川1号横羽線/K1 を進む" } },
                { navigationInstruction: { instructions: "首都高速神奈川1号横羽線 を直進する" } },
              ],
            },
          ],
        });
        expect(result.majorHighway).toBe("首都高速都心環状線");
        expect(result.highwayNames).toEqual(["首都高速都心環状線", "首都高速神奈川1号横羽線"]);
        expect(result.highwayNames).not.toContain("東名高速");
      });

      it("東名高速道路のルートの場合は東名高速道路を抽出し首都高は含まない", () => {
        const result = extractHighwayNames({
          description: "東名高速道路",
          legs: [
            {
              steps: [
                { navigationInstruction: { instructions: "東名高速道路/第一東海自動車道 に入る" } },
                { navigationInstruction: { instructions: "東名高速道路 を進む" } },
              ],
            },
          ],
        });
        expect(result.majorHighway).toBe("東名高速道路");
        expect(result.highwayNames).toEqual(["東名高速道路"]);
        expect(result.highwayNames).not.toContain("首都高速");
      });
    });

    describe("境界値テスト", () => {
      it("一般道など高速道路が含まれないルートの場合は空配列とundefinedを返す", () => {
        const result = extractHighwayNames({
          description: "国道246号",
          legs: [
            {
              steps: [
                { navigationInstruction: { instructions: "国道246号 を進む" } },
                { navigationInstruction: { instructions: "左折する" } },
              ],
            },
          ],
        });
        expect(result.majorHighway).toBeUndefined();
        expect(result.highwayNames).toEqual([]);
      });
    });
  });
});
