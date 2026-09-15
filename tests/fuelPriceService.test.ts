import { describe, expect, it } from "vitest";
import { fetchFuelPriceAverages } from "../src/domain/services/fuelPriceService";

describe("ガソリン平均価格取得サービス (fuelPriceService)", () => {
  describe("正常系テスト", () => {
    it("資源エネルギー庁のデータから、レギュラー・ハイオク・軽油の最新平均価格を取得できる", async () => {
      const averages = await fetchFuelPriceAverages();
      expect(averages.prices).toHaveLength(3);

      const labels = averages.prices.map((p) => p.label);
      expect(labels).toContain("レギュラー");
      expect(labels).toContain("ハイオク");
      expect(labels).toContain("軽油");

      averages.prices.forEach((item) => {
        expect(item.value).toBeGreaterThan(100);
        expect(item.unit).toBe("円/L");
        expect(item.surveyedAt).toBeTruthy();
      });

      expect(averages.sourceLabel).toContain("資源エネルギー庁");
    });
  });
});
