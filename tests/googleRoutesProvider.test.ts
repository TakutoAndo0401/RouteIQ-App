import { describe, expect, it, vi } from "vitest";
import {
  GoogleRoutesProvider,
  decodePolyline,
  parseDurationMinutes,
  parseToll,
  resolveGoogleDepartureTime,
  yenFromMoney,
} from "../src/domain/providers/googleRoutesProvider";

describe("GoogleRoutesProvider", () => {
  describe("parseDurationMinutes", () => {
    it("parses seconds format like 3600s to 60 minutes", () => {
      expect(parseDurationMinutes("3600s")).toBe(60);
      expect(parseDurationMinutes("4500s")).toBe(75);
    });

    it("throws when duration format is invalid", () => {
      expect(() => parseDurationMinutes("invalid")).toThrow();
      expect(() => parseDurationMinutes(undefined)).toThrow();
    });
  });

  describe("decodePolyline", () => {
    it("decodes encoded polyline correctly", () => {
      // "_p~iF~ps|U_ulLnnqC_mqNvxq`@" is a valid encoded polyline string
      const polyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
      const coords = decodePolyline(polyline);
      expect(coords.length).toBeGreaterThan(0);
      expect(coords[0]).toHaveProperty("lat");
      expect(coords[0]).toHaveProperty("lng");
    });

    it("returns empty array for undefined or empty string", () => {
      expect(decodePolyline(undefined)).toEqual([]);
      expect(decodePolyline("")).toEqual([]);
    });
  });

  describe("resolveGoogleDepartureTime", () => {
    it("returns empty object if departureTime is not provided", () => {
      expect(resolveGoogleDepartureTime(undefined)).toEqual({});
    });

    it("keeps future departure time untouched", () => {
      const now = new Date("2026-09-12T12:00:00Z");
      const future = new Date("2026-09-12T13:00:00Z").toISOString();
      const res = resolveGoogleDepartureTime(future, now);
      expect(res.departureTime).toBe(future);
      expect(res.warning).toBeUndefined();
    });

    it("adjusts past or immediate departure time to 5 minutes into the future", () => {
      const now = new Date("2026-09-12T12:00:00Z");
      const past = new Date("2026-09-12T11:00:00Z").toISOString();
      const res = resolveGoogleDepartureTime(past, now);
      expect(res.departureTime).toBe("2026-09-12T12:05:00.000Z");
      expect(res.warning).toContain("5分後に補正");
    });
  });

  describe("yenFromMoney", () => {
    it("parses JPY units and nanos into yen number", () => {
      expect(yenFromMoney({ currencyCode: "JPY", units: "2850" })).toBe(2850);
      expect(yenFromMoney({ currencyCode: "USD", units: "20" })).toBeNull();
    });
  });

  describe("parseToll", () => {
    it("returns 0 for local route when tollInfo is absent", () => {
      const res = parseToll({}, "local");
      expect(res.tollYen).toBe(0);
      expect(res.confidence).toBe("api");
    });

    it("returns unavailable for expressway route when tollInfo is absent", () => {
      const res = parseToll({}, "expressway");
      expect(res.tollYen).toBeNull();
      expect(res.confidence).toBe("unavailable");
    });

    it("parses valid JPY toll from travelAdvisory", () => {
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

    it("returns unavailable when toll contains only non-JPY currencies", () => {
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

  describe("computeRoute", () => {
    it("throws error when apiKey is empty", async () => {
      const provider = new GoogleRoutesProvider({ apiKey: "" });
      await expect(
        provider.computeRoute({
          origin: "東京",
          destination: "横浜",
          routeType: "expressway",
        }),
      ).rejects.toThrow("Google Maps API キーが設定されていません");
    });

    it("successfully calls computeRoutes and returns ProviderRouteResult", async () => {
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

    it("throws error when Google API responds with HTTP error", async () => {
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

    it("throws error when routes array is empty or lacks distanceMeters", async () => {
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

    it("handles local route with avoidTolls warning and toll 0 yen", async () => {
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

    it("attaches fallbackInfo warning when Google API indicates fallback conditions", async () => {
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
});
