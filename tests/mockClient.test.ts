import { describe, expect, it } from "vitest";
import { RouteIqMockClient } from "../src/harness/mockClient";
import { defaultRouteInput } from "../src/harness/fixtures";

describe("開発・検証用モッククライアント (RouteIqMockClient)", () => {
  describe("正常系テスト", () => {
    it("初期設定では高速道路を推奨するシナリオ結果を返す", async () => {
      const client = new RouteIqMockClient({ latencyMs: 0 });
      const result = await client.analyzeRoute(defaultRouteInput);

      expect(result.routeComparison).toBeDefined();
      expect(result.routeComparison?.recommendedRoute).toBe("expressway");
      expect(result.input.origin).toBe(defaultRouteInput.origin);
    });

    it("シナリオを切り替えた場合、一般道を推奨するシナリオ結果を返す", async () => {
      const client = new RouteIqMockClient({ latencyMs: 0 });
      client.setScenario("local_recommended");
      const result = await client.analyzeRoute(defaultRouteInput);

      expect(result.routeComparison?.recommendedRoute).toBe("local");
    });
  });

  describe("境界値テスト（データ欠落・未確定シナリオ）", () => {
    it("高速料金が未確定のシナリオでは、有料道路の料金信頼度がunavailableとなり総費用がnullで返る", async () => {
      const client = new RouteIqMockClient({ latencyMs: 0 });
      client.setScenario("toll_unavailable");
      const result = await client.analyzeRoute(defaultRouteInput);

      expect(result.routeComparison?.expresswayRoute.tollConfidence).toBe("unavailable");
      expect(result.routeComparison?.expresswayRoute.totalCostYen).toBeNull();
    });
  });

  describe("異常系テスト", () => {
    it("通信エラー発生シナリオを設定した場合、ネットワークエラーの例外が発生する", async () => {
      const client = new RouteIqMockClient({ latencyMs: 0 });
      client.setScenario("network_error");

      await expect(client.analyzeRoute(defaultRouteInput)).rejects.toThrow("ネットワークエラー");
    });
  });
});
