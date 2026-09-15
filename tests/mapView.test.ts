import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsDirectionsUrl,
  resolveCoordinatesFromText,
  KNOWN_LOCATIONS,
} from "../src/domain/location";

describe("地図連携およびテキスト座標解決ユーティリティ", () => {
  const fallbackCoords = { latitude: 35.6266, longitude: 139.63 };

  describe("buildGoogleMapsDirectionsUrl（Googleマップナビ用URL生成）", () => {
    describe("正常系テスト", () => {
      it("出発地と目的地をエンコードしたGoogleマップ運転ナビゲーションURLを生成できる", () => {
        const origin = "用賀IC (東京)";
        const destination = "御殿場IC (静岡)";
        const url = buildGoogleMapsDirectionsUrl(origin, destination);

        expect(url).toContain("https://www.google.com/maps/dir/?api=1");
        expect(url).toContain(`origin=${encodeURIComponent(origin)}`);
        expect(url).toContain(`destination=${encodeURIComponent(destination)}`);
        expect(url).toContain("travelmode=driving");
      });

      it("英数字や日本語を含む地点名の組み合わせでも正しくURLを生成できる", () => {
        const url = buildGoogleMapsDirectionsUrl("Tokyo Station", "Hakone-Yumoto");
        expect(url).toBe(
          "https://www.google.com/maps/dir/?api=1&origin=Tokyo%20Station&destination=Hakone-Yumoto&travelmode=driving",
        );
      });
    });
  });

  describe("resolveCoordinatesFromText（テキストからの経緯度抽出・特定）", () => {
    describe("正常系テスト", () => {
      it("カッコや補足説明を含む地点名から、登録済み地点の座標を正しく照合できる", () => {
        const yogaCoords = resolveCoordinatesFromText("用賀IC (東京)", fallbackCoords);
        expect(yogaCoords).toEqual(KNOWN_LOCATIONS["用賀IC"]);

        const gotembaCoords = resolveCoordinatesFromText("御殿場IC (静岡)", fallbackCoords);
        expect(gotembaCoords).toEqual(KNOWN_LOCATIONS["御殿場IC"]);

        const tokyoCoords = resolveCoordinatesFromText("東京駅", fallbackCoords);
        expect(tokyoCoords).toEqual(KNOWN_LOCATIONS["東京駅"]);
      });

      it("住所の中に複数のキーワードが含まれる場合、より長く一致する名称を優先して座標を特定できる", () => {
        const otemachiCoords = resolveCoordinatesFromText("千代田区大手町永代通り", fallbackCoords);
        // 「永代通り」(4文字) が 「大手町」(3文字) より長いため優先一致
        expect(otemachiCoords).toEqual(KNOWN_LOCATIONS["永代通り"]);
      });

      it("改札表記や住所表記が付いた東京駅の表記から、正確に東京駅の座標を特定できる", () => {
        const tokyoCoords = resolveCoordinatesFromText(
          "千代田区丸の内東京駅(改札外)",
          fallbackCoords,
        );
        expect(tokyoCoords).toEqual(KNOWN_LOCATIONS["東京駅"]);
      });

      it("「北緯35.6812 東経139.7671」のような直接的な経緯度文字列を直接数値として解釈できる", () => {
        const explicitCoords = resolveCoordinatesFromText(
          "北緯35.6812 東経139.7671",
          fallbackCoords,
        );
        expect(explicitCoords.latitude).toBeCloseTo(35.6812);
        expect(explicitCoords.longitude).toBeCloseTo(139.7671);
      });
    });

    describe("境界値テスト", () => {
      it("テキストが未指定または空文字の場合は、既定のフォールバック座標を返す", () => {
        expect(resolveCoordinatesFromText(undefined, fallbackCoords)).toEqual(fallbackCoords);
        expect(resolveCoordinatesFromText("", fallbackCoords)).toEqual(fallbackCoords);
      });
    });

    describe("異常系テスト", () => {
      it("登録されていない未知の地点名の場合は、エラーとせず既定のフォールバック座標を返す", () => {
        const unknownCoords = resolveCoordinatesFromText("未知の山頂 999地点", fallbackCoords);
        expect(unknownCoords).toEqual(fallbackCoords);
      });
    });
  });
});
