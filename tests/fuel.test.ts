import { describe, expect, it } from "vitest";
import { estimateFuelCostYen, resolveFuelPrice } from "../src/domain/fuel";

describe("ガソリン代の計算と価格決定ロジック", () => {
  describe("estimateFuelCostYen（ガソリン代の概算計算）", () => {
    describe("正常系テスト", () => {
      it("走行距離・燃費・ガソリン単価から、正確にガソリン代を四捨五入して計算できる", () => {
        // 例: 120km ÷ 15km/L × 175円/L = 1,400円
        expect(estimateFuelCostYen(120, 15, 175)).toBe(1400);
      });
    });

    describe("境界値テスト", () => {
      it("走行距離が0km（移動なし）の場合はガソリン代が0円になる", () => {
        expect(estimateFuelCostYen(0, 15, 175)).toBe(0);
      });

      it("ガソリン単価が0円/L（無料）の場合はガソリン代が0円になる", () => {
        expect(estimateFuelCostYen(100, 15, 0)).toBe(0);
      });

      it("端数計算において0.4円以下は切り捨て、0.5円以上は切り上げられる（四捨五入の検証）", () => {
        // 10km ÷ 3km/L × 100円 = 333.333...円 → 333円（切り捨て）
        expect(estimateFuelCostYen(10, 3, 100)).toBe(333);

        // 10km ÷ 3km/L × 200円 = 666.666...円 → 667円（切り上げ）
        expect(estimateFuelCostYen(10, 3, 200)).toBe(667);

        // 1km ÷ 2km/L × 1円 = 0.5円 → 1円（境界値の切り上げ）
        expect(estimateFuelCostYen(1, 2, 1)).toBe(1);
      });
    });

    describe("異常系テスト", () => {
      it("走行距離にマイナスの値が指定された場合はエラーを発生させる", () => {
        expect(() => estimateFuelCostYen(-10, 15, 175)).toThrow(
          "distanceKm must be greater than or equal to 0.",
        );
      });

      it("燃費に0またはマイナスの値が指定された場合はエラーを発生させる", () => {
        expect(() => estimateFuelCostYen(120, 0, 175)).toThrow(
          "fuelEfficiencyKmPerLiter must be greater than 0.",
        );
        expect(() => estimateFuelCostYen(120, -5, 175)).toThrow(
          "fuelEfficiencyKmPerLiter must be greater than 0.",
        );
      });

      it("ガソリン単価にマイナスの値が指定された場合はエラーを発生させる", () => {
        expect(() => estimateFuelCostYen(120, 15, -10)).toThrow(
          "fuelPriceYenPerLiter must be greater than or equal to 0.",
        );
      });
    });
  });

  describe("resolveFuelPrice（適用するガソリン単価の優先度決定）", () => {
    describe("正常系テスト", () => {
      it("ユーザーが手動入力したガソリン価格を最優先で採用する", () => {
        const res = resolveFuelPrice(180, 170, 165);
        expect(res.fuelPriceYenPerLiter).toBe(180);
        expect(res.warning).toBeUndefined();
      });

      it("ユーザー入力がない場合は、直近に取得した全国平均価格を採用する", () => {
        const res = resolveFuelPrice(undefined, 170, 169.7);
        expect(res.fuelPriceYenPerLiter).toBe(169.7);
        expect(res.warning).toBeUndefined();
      });

      it("ユーザー入力も平均価格もない場合は、環境設定の既定価格を採用する", () => {
        const res = resolveFuelPrice(undefined, 168, undefined);
        expect(res.fuelPriceYenPerLiter).toBe(168);
        expect(res.warning).toBeUndefined();
      });
    });

    describe("境界値テスト", () => {
      it("ユーザーが0円/Lと入力した場合、未入力扱いとせず0円を有効な値として採用する", () => {
        const res = resolveFuelPrice(0, 170, 165);
        expect(res.fuelPriceYenPerLiter).toBe(0);
        expect(res.warning).toBeUndefined();
      });
    });

    describe("異常系テスト（フォールバック処理）", () => {
      it("すべての価格情報が未設定の場合は、標準既定値（175円/L）で補正して注意文を付与する", () => {
        const res = resolveFuelPrice(undefined, undefined, undefined);
        expect(res.fuelPriceYenPerLiter).toBe(175);
        expect(res.warning).toContain(
          "ガソリン価格が未入力で DEFAULT_FUEL_PRICE_YEN_PER_LITER も未設定のため、175円/Lで概算しました。",
        );
      });
    });
  });
});
