import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsDirectionsUrl,
  resolveCoordinatesFromText,
  KNOWN_LOCATIONS,
} from "../src/domain/location";

describe("MapView & Navigation Domain Utilities", () => {
  const fallbackCoords = { latitude: 35.6266, longitude: 139.63 };

  describe("buildGoogleMapsDirectionsUrl", () => {
    it("generates valid Google Maps driving navigation URL with encoded coordinates and names", () => {
      const origin = "用賀IC (東京)";
      const destination = "御殿場IC (静岡)";
      const url = buildGoogleMapsDirectionsUrl(origin, destination);

      expect(url).toContain("https://www.google.com/maps/dir/?api=1");
      expect(url).toContain(`origin=${encodeURIComponent(origin)}`);
      expect(url).toContain(`destination=${encodeURIComponent(destination)}`);
      expect(url).toContain("travelmode=driving");
    });

    it("handles simple ASCII and Japanese origin/destination strings properly", () => {
      const url = buildGoogleMapsDirectionsUrl("Tokyo Station", "Hakone-Yumoto");
      expect(url).toBe(
        "https://www.google.com/maps/dir/?api=1&origin=Tokyo%20Station&destination=Hakone-Yumoto&travelmode=driving",
      );
    });
  });

  describe("resolveCoordinatesFromText", () => {
    it("matches known locations stripping parentheses and annotations", () => {
      const yogaCoords = resolveCoordinatesFromText("用賀IC (東京)", fallbackCoords);
      expect(yogaCoords).toEqual(KNOWN_LOCATIONS["用賀IC"]);

      const gotembaCoords = resolveCoordinatesFromText("御殿場IC (静岡)", fallbackCoords);
      expect(gotembaCoords).toEqual(KNOWN_LOCATIONS["御殿場IC"]);

      const tokyoCoords = resolveCoordinatesFromText("東京駅", fallbackCoords);
      expect(tokyoCoords).toEqual(KNOWN_LOCATIONS["東京駅"]);
    });

    it("resolves specific landmarks like Otemachi and Eitai-dori in Chiyoda-ku", () => {
      const otemachiCoords = resolveCoordinatesFromText("千代田区大手町永代通り", fallbackCoords);
      // 「永代通り」(4文字) が 「大手町」(3文字) より長いキーのため優先一致
      expect(otemachiCoords).toEqual(KNOWN_LOCATIONS["永代通り"]);
    });

    it("resolves Tokyo Station when formatted with Japanese address and extra notes", () => {
      const tokyoCoords = resolveCoordinatesFromText(
        "千代田区丸の内東京駅(改札外)",
        fallbackCoords,
      );
      expect(tokyoCoords).toEqual(KNOWN_LOCATIONS["東京駅"]);
    });

    it("parses explicit latitude and longitude string directly", () => {
      const explicitCoords = resolveCoordinatesFromText("北緯35.6812 東経139.7671", fallbackCoords);
      expect(explicitCoords.latitude).toBeCloseTo(35.6812);
      expect(explicitCoords.longitude).toBeCloseTo(139.7671);
    });

    it("returns defaultCoords when text is undefined or empty", () => {
      expect(resolveCoordinatesFromText(undefined, fallbackCoords)).toEqual(fallbackCoords);
      expect(resolveCoordinatesFromText("", fallbackCoords)).toEqual(fallbackCoords);
    });

    it("returns defaultCoords when text is an unknown location", () => {
      const unknownCoords = resolveCoordinatesFromText("未知の山頂 999地点", fallbackCoords);
      expect(unknownCoords).toEqual(fallbackCoords);
    });
  });
});
