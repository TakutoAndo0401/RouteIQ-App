import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatGeocodedAddress,
  formatFallbackCoordinates,
  getCurrentLocationAddress,
  geocodeAddress,
  reverseGeocodeCoordinates,
  KNOWN_LOCATIONS,
} from "../src/domain/location";

describe("location domain", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("formatGeocodedAddress", () => {
    it("formats standard Japanese address correctly", () => {
      const address = {
        region: "東京都",
        city: "世田谷区",
        street: "用賀",
        streetNumber: "4丁目",
      };
      expect(formatGeocodedAddress(address)).toBe("東京都世田谷区用賀4丁目");
    });

    it("handles subregion and avoids duplicate city names", () => {
      const address = {
        region: "神奈川県",
        city: "横浜市",
        subregion: "横浜市西区",
        street: "みなとみらい",
        name: "2-2-1",
      };
      expect(formatGeocodedAddress(address)).toBe("神奈川県横浜市西区みなとみらい2-2-1");
    });

    it("avoids duplicate region if already in locality", () => {
      const address = {
        region: "東京都",
        city: "東京都千代田区",
        street: "丸の内1丁目",
      };
      expect(formatGeocodedAddress(address)).toBe("東京都千代田区丸の内1丁目");
    });

    it("handles minimal address info gracefully", () => {
      const address = {
        region: "静岡県",
        city: "御殿場市",
      };
      expect(formatGeocodedAddress(address)).toBe("静岡県御殿場市");
    });

    it("returns empty string if address is completely empty", () => {
      expect(formatGeocodedAddress({})).toBe("");
    });
  });

  describe("formatFallbackCoordinates", () => {
    it("formats northern and eastern coordinates correctly", () => {
      const coords = { latitude: 35.6264, longitude: 139.6358 };
      expect(formatFallbackCoordinates(coords)).toBe("現在地 (北緯35.626°, 東経139.636°)");
    });

    it("formats southern and western coordinates correctly", () => {
      const coords = { latitude: -33.8688, longitude: -151.2093 };
      expect(formatFallbackCoordinates(coords)).toBe("現在地 (南緯33.869°, 西経151.209°)");
    });
  });

  describe("geocodeAddress", () => {
    it("resolves known locations instantly without API", async () => {
      const yogaCoords = await geocodeAddress("用賀IC (東京)");
      expect(yogaCoords).toEqual(KNOWN_LOCATIONS["用賀IC"]);

      const gotembaCoords = await geocodeAddress("御殿場IC");
      expect(gotembaCoords).toEqual(KNOWN_LOCATIONS["御殿場IC"]);
    });

    it("falls back to Tokyo center on empty address", async () => {
      const coords = await geocodeAddress("");
      expect(coords).toEqual({ latitude: 35.6812, longitude: 139.7671 });
    });
  });

  describe("reverseGeocodeCoordinates", () => {
    it("resolves address using expo-location when available", async () => {
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

  describe("getCurrentLocationAddress", () => {
    it("throws error when permission is denied", async () => {
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

    it("returns formatted address when permission is granted and reverse geocode succeeds", async () => {
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

    it("falls back to coordinate string when reverse geocode returns empty", async () => {
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
});
