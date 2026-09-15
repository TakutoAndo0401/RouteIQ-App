import { describe, expect, it } from "vitest";
import { estimateFuelCostYen, resolveFuelPrice } from "../src/domain/fuel";

describe("fuel domain logic", () => {
  describe("estimateFuelCostYen", () => {
    it("calculates rounded fuel cost from distance, efficiency, and price", () => {
      expect(estimateFuelCostYen(120, 15, 175)).toBe(1400);
    });

    it("returns 0 yen when distance is 0 km", () => {
      expect(estimateFuelCostYen(0, 15, 175)).toBe(0);
    });

    it("returns 0 yen when fuel price is 0 yen/L", () => {
      expect(estimateFuelCostYen(100, 15, 0)).toBe(0);
    });

    it("correctly rounds fractional yen using Math.round (.4 down, .5 up)", () => {
      // 10km / 3km/L * 100 = 333.333... -> 333
      expect(estimateFuelCostYen(10, 3, 100)).toBe(333);

      // 10km / 3km/L * 200 = 666.666... -> 667
      expect(estimateFuelCostYen(10, 3, 200)).toBe(667);

      // 1km / 2km/L * 1 = 0.5 -> 1
      expect(estimateFuelCostYen(1, 2, 1)).toBe(1);
    });

    it("rejects negative distance", () => {
      expect(() => estimateFuelCostYen(-10, 15, 175)).toThrow(
        "distanceKm must be greater than or equal to 0.",
      );
    });

    it("rejects zero or negative fuel efficiency", () => {
      expect(() => estimateFuelCostYen(120, 0, 175)).toThrow(
        "fuelEfficiencyKmPerLiter must be greater than 0.",
      );
      expect(() => estimateFuelCostYen(120, -5, 175)).toThrow(
        "fuelEfficiencyKmPerLiter must be greater than 0.",
      );
    });

    it("rejects negative fuel price", () => {
      expect(() => estimateFuelCostYen(120, 15, -10)).toThrow(
        "fuelPriceYenPerLiter must be greater than or equal to 0.",
      );
    });
  });

  describe("resolveFuelPrice", () => {
    it("uses user input before anything else and gives no warning", () => {
      const res = resolveFuelPrice(180, 170, 165);
      expect(res.fuelPriceYenPerLiter).toBe(180);
      expect(res.warning).toBeUndefined();
    });

    it("accepts user input of 0 yen/L as a valid number", () => {
      const res = resolveFuelPrice(0, 170, 165);
      expect(res.fuelPriceYenPerLiter).toBe(0);
      expect(res.warning).toBeUndefined();
    });

    it("uses the latest fetched average before environment default", () => {
      const res = resolveFuelPrice(undefined, 170, 169.7);
      expect(res.fuelPriceYenPerLiter).toBe(169.7);
      expect(res.warning).toBeUndefined();
    });

    it("uses environment default when user input and latest average are undefined", () => {
      const res = resolveFuelPrice(undefined, 168, undefined);
      expect(res.fuelPriceYenPerLiter).toBe(168);
      expect(res.warning).toBeUndefined();
    });

    it("falls back to built-in 175 yen/L with warning when all inputs are missing", () => {
      const res = resolveFuelPrice(undefined, undefined, undefined);
      expect(res.fuelPriceYenPerLiter).toBe(175);
      expect(res.warning).toContain(
        "ガソリン価格が未入力で DEFAULT_FUEL_PRICE_YEN_PER_LITER も未設定のため、175円/Lで概算しました。",
      );
    });
  });
});
