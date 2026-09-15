import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatGeocodedAddress,
  formatFallbackCoordinates,
  getCurrentLocationAddress,
  geocodeAddress,
  reverseGeocodeCoordinates,
  KNOWN_LOCATIONS,
} from "../src/domain/location";

describe("位置情報・住所逆引き処理 (location domain)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("formatGeocodedAddress（逆引きした住所情報の文字列整形）", () => {
    describe("正常系テスト", () => {
      it("都道府県・市区町村・町名・番地を自然な日本の住所文字列に結合できる", () => {
        const address = {
          region: "東京都",
          city: "世田谷区",
          street: "用賀",
          streetNumber: "4丁目",
        };
        expect(formatGeocodedAddress(address)).toBe("東京都世田谷区用賀4丁目");
      });

      it("政令指定都市などの重複（横浜市・横浜市西区など）を適切に排除して整形できる", () => {
        const address = {
          region: "神奈川県",
          city: "横浜市",
          subregion: "横浜市西区",
          street: "みなとみらい",
          name: "2-2-1",
        };
        expect(formatGeocodedAddress(address)).toBe("神奈川県横浜市西区みなとみらい2-2-1");
      });

      it("市区町村名に都道府県名が既に含まれている場合は重複を排除して整形できる", () => {
        const address = {
          region: "東京都",
          city: "東京都千代田区",
          street: "丸の内1丁目",
        };
        expect(formatGeocodedAddress(address)).toBe("東京都千代田区丸の内1丁目");
      });

      it("都道府県と市町村のみの最小限の住所情報でも適切に整形できる", () => {
        const address = {
          region: "静岡県",
          city: "御殿場市",
        };
        expect(formatGeocodedAddress(address)).toBe("静岡県御殿場市");
      });
    });

    describe("境界値テスト", () => {
      it("住所情報が完全に空のオブジェクトの場合は空文字を返す", () => {
        expect(formatGeocodedAddress({})).toBe("");
      });
    });
  });

  describe("formatFallbackCoordinates（住所逆引き失敗時の経緯度文字列整形）", () => {
    describe("正常系テスト", () => {
      it("北緯・東経の座標をユーザーに分かりやすい現在地表記に整形できる", () => {
        const coords = { latitude: 35.6264, longitude: 139.6358 };
        expect(formatFallbackCoordinates(coords)).toBe("現在地 (北緯35.626°, 東経139.636°)");
      });

      it("南緯・西経の座標を正しく「南緯」「西経」表記に変換して整形できる", () => {
        const coords = { latitude: -33.8688, longitude: -151.2093 };
        expect(formatFallbackCoordinates(coords)).toBe("現在地 (南緯33.869°, 西経151.209°)");
      });
    });
  });

  describe("geocodeAddress（地名・住所から座標への変換）", () => {
    describe("正常系テスト", () => {
      it("用賀ICや御殿場ICなどの既知の主要地点はAPI通信なしで即座に座標を取得できる", async () => {
        const yogaCoords = await geocodeAddress("用賀IC (東京)");
        expect(yogaCoords).toEqual(KNOWN_LOCATIONS["用賀IC"]);

        const gotembaCoords = await geocodeAddress("御殿場IC");
        expect(gotembaCoords).toEqual(KNOWN_LOCATIONS["御殿場IC"]);
      });
    });

    describe("境界値テスト", () => {
      it("住所が空文字の場合は既定の東京中心部（東京駅周辺）の座標を返す", async () => {
        const coords = await geocodeAddress("");
        expect(coords).toEqual({ latitude: 35.6812, longitude: 139.7671 });
      });
    });
  });

  describe("reverseGeocodeCoordinates（座標から住所文字列への逆引き）", () => {
    describe("正常系テスト", () => {
      it("端末の位置情報機能を利用して座標から該当の住所を取得できる", async () => {
        vi.doMock("expo-location", () => ({
          reverseGeocodeAsync: vi.fn().mockResolvedValue([
            {
              region: "東京都",
              city: "世田谷区",
              street: "玉川台",
              streetNumber: "2丁目",
            },
          ]),
        }));

        const addr = await reverseGeocodeCoordinates({ latitude: 35.6266, longitude: 139.63 });
        expect(addr).toBe("東京都世田谷区玉川台2丁目");
      });
    });
  });

  describe("getCurrentLocationAddress（現在地取得および住所変換）", () => {
    describe("正常系テスト", () => {
      it("位置情報の利用が許可されており住所逆引きが成功した場合、整った住所文字列を取得できる", async () => {
        vi.doMock("expo-location", () => ({
          requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
          getCurrentPositionAsync: vi.fn().mockResolvedValue({
            coords: { latitude: 35.6264, longitude: 139.6358 },
          }),
          reverseGeocodeAsync: vi.fn().mockResolvedValue([
            {
              region: "東京都",
              city: "世田谷区",
              street: "用賀",
              streetNumber: "4丁目",
            },
          ]),
          Accuracy: { Balanced: 3 },
        }));

        const address = await getCurrentLocationAddress();
        expect(address).toBe("東京都世田谷区用賀4丁目");
      });
    });

    describe("境界値テスト（住所逆引き不能時のフォールバック）", () => {
      it("住所逆引き結果が空配列の場合は、座標文字列の形式（北緯・東経）に切り替えて返す", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({})));
        vi.doMock("expo-location", () => ({
          requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
          getCurrentPositionAsync: vi.fn().mockResolvedValue({
            coords: { latitude: 35.6264, longitude: 139.6358 },
          }),
          reverseGeocodeAsync: vi.fn().mockResolvedValue([]),
          Accuracy: { Balanced: 3 },
        }));

        const address = await getCurrentLocationAddress();
        expect(address).toBe("現在地 (北緯35.626°, 東経139.636°)");
      });
    });

    describe("異常系テスト", () => {
      it("位置情報の利用権限が拒否された場合はエラーメッセージを発生させる", async () => {
        vi.doMock("expo-location", () => ({
          requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "denied" }),
          getCurrentPositionAsync: vi.fn(),
          reverseGeocodeAsync: vi.fn(),
          Accuracy: { Balanced: 3 },
        }));

        await expect(getCurrentLocationAddress()).rejects.toThrow(
          "位置情報の利用が許可されていません",
        );
      });
    });
  });
});
