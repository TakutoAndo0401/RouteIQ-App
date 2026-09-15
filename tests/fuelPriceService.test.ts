import { describe, expect, it } from "vitest";
import { fetchFuelPriceAverages } from "../src/domain/services/fuelPriceService";

describe("fuelPriceService", () => {
  it("fetches fuel price averages and includes regular, premium, and diesel prices", async () => {
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
