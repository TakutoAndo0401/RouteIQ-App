import type {
  ProviderRouteResult,
  RouteCoordinate,
  RouteProviderRequest,
  RouteType,
  TollConfidence,
} from "../types";
import { summarizeSpeedIntervals } from "../traffic";

export interface GoogleRoutesProviderOptions {
  apiKey: string;
  languageCode?: string;
  regionCode?: string;
}

export interface GoogleMoney {
  currencyCode?: string;
  units?: string;
  nanos?: number;
}

export interface GoogleTollInfo {
  estimatedPrice?: GoogleMoney[];
}

export interface GoogleTravelAdvisory {
  tollInfo?: GoogleTollInfo;
  speedReadingIntervals?: Array<{
    speed?: string;
    startPolylinePointIndex?: number;
    endPolylinePointIndex?: number;
  }>;
}

export interface GoogleRouteLegStep {
  navigationInstruction?: {
    instructions?: string;
    maneuver?: string;
  };
}

export interface GoogleRouteLeg {
  travelAdvisory?: GoogleTravelAdvisory;
  steps?: GoogleRouteLegStep[];
}

export interface GoogleRoute {
  distanceMeters?: number;
  duration?: string;
  description?: string;
  warnings?: string[];
  polyline?: {
    encodedPolyline?: string;
  };
  travelAdvisory?: GoogleTravelAdvisory;
  legs?: GoogleRouteLeg[];
}

export interface GoogleComputeRoutesResponse {
  routes?: GoogleRoute[];
  fallbackInfo?: unknown;
}

const HIGHWAY_PATTERNS = [
  /首都高速/,
  /阪神高速/,
  /名古屋高速/,
  /福岡高速/,
  /北九州高速/,
  /広島高速/,
  /[^\s/、。]+高速道路/,
  /[^\s/、。]+高速/,
  /[^\s/、。]+自動車道/,
  /[^\s/、。]+有料道路/,
  /東京湾アクアライン/,
  /アクアライン/,
  /第三京浜/,
  /横浜新道/,
  /小田原厚木道路/,
  /西湘バイパス/,
  /京葉道路/,
  /東京外環/,
  /外環道/,
  /圏央道/,
];

export function isHighwayName(name: string): boolean {
  return HIGHWAY_PATTERNS.some((pattern) => pattern.test(name));
}

export function cleanHighwayName(raw: string): string {
  // スラッシュがある場合は最初の部分（日本語道路名）を優先
  const firstToken = raw.split("/")[0].trim();
  return firstToken
    .replace(/^(?:右|左)車線を使用して\s*/, "")
    .replace(/^分岐を\s*/, "")
    .replace(/(?:に(?:入る|進む|向かう)|を(?:進む|直進する|出る|経由する)|の標識に従う).*$/, "")
    .replace(/[、。・]$/, "")
    .replace(/^(?:で|に|を)\s*/, "")
    .trim();
}

export function extractHighwayNames(route: GoogleRoute): {
  highwayNames: string[];
  majorHighway?: string;
} {
  const detected: string[] = [];
  const seen = new Set<string>();

  const tryAdd = (rawCandidate: string) => {
    const cleaned = cleanHighwayName(rawCandidate);
    if (!cleaned) return;
    if (isHighwayName(cleaned) && !seen.has(cleaned)) {
      // 既存の名称との包含関係チェック（例: "東名高速道路" が既にあれば "東名高速" は追加しない）
      const existingSuper = detected.find((d) => d.includes(cleaned));
      if (existingSuper) return;

      const existingSubIndex = detected.findIndex((d) => cleaned.includes(d));
      if (existingSubIndex !== -1) {
        // より詳細な名称（例: "東名高速道路"）で置換
        const old = detected[existingSubIndex];
        seen.delete(old);
        detected[existingSubIndex] = cleaned;
        seen.add(cleaned);
        return;
      }

      seen.add(cleaned);
      detected.push(cleaned);
    }
  };

  // 1. route.description を検証
  if (route.description) {
    const descParts = route.description.split(/[,、/]/);
    for (const part of descParts) {
      tryAdd(part);
    }
  }

  // 2. steps の navigationInstruction.instructions を走査
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const instruction = step.navigationInstruction?.instructions;
      if (!instruction) continue;

      const tokens = instruction.split(/[\s,、]+/);
      for (const token of tokens) {
        tryAdd(token);
      }
    }
  }

  const majorHighway = detected.length > 0 ? detected[0] : undefined;

  return {
    highwayNames: detected,
    majorHighway,
  };
}

export function parseDurationMinutes(duration: string | undefined): number {
  const match = duration?.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) {
    throw new Error("Google Routes API のレスポンスに有効な所要時間(duration)が含まれていません。");
  }
  return Math.round(Number(match[1]) / 60);
}

export function decodePolyline(encoded: string | undefined): RouteCoordinate[] {
  if (!encoded) return [];

  const coordinates: RouteCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const readValue = () => {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);

    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += readValue();
    lng += readValue();
    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}

export function resolveGoogleDepartureTime(
  departureTime: string | undefined,
  now = new Date(),
): { departureTime?: string; warning?: string } {
  if (!departureTime) return {};

  const parsed = new Date(departureTime);
  if (!Number.isFinite(parsed.getTime())) return {};

  const minimumFuture = new Date(now.getTime() + 5 * 60 * 1000);
  if (parsed.getTime() > minimumFuture.getTime()) {
    return { departureTime };
  }

  return {
    departureTime: minimumFuture.toISOString(),
    warning:
      "Google Routes API は過去または直近すぎる departureTime を受け付けないため、経路比較では現在から5分後に補正しました。",
  };
}

export function yenFromMoney(money: GoogleMoney): number | null {
  if (money.currencyCode !== "JPY") return null;
  const units = Number(money.units ?? "0");
  const nanos = Math.round((money.nanos ?? 0) / 1_000_000_000);
  if (!Number.isFinite(units)) return null;
  return units + nanos;
}

export function parseToll(
  route: GoogleRoute,
  routeType: RouteType,
): {
  tollYen: number | null;
  confidence: TollConfidence;
  fallbackMessage?: string;
  warning?: string;
} {
  const tollInfo = route.travelAdvisory?.tollInfo;
  if (!tollInfo) {
    if (routeType === "expressway") {
      return {
        tollYen: null,
        confidence: "unavailable",
        fallbackMessage:
          "高速優先ルートの有料道路料金を取得できなかったため、0円とせず未確認としています。",
      };
    }
    return { tollYen: 0, confidence: "api" };
  }

  const prices = tollInfo.estimatedPrice ?? [];
  if (prices.length === 0) {
    return {
      tollYen: null,
      confidence: "unavailable",
      fallbackMessage: "有料道路の推定料金を取得できなかったため、未確認としています。",
    };
  }

  const yenPrice = prices.map(yenFromMoney).find((price) => price !== null);
  if (typeof yenPrice === "number") {
    return { tollYen: yenPrice, confidence: "api" };
  }

  return {
    tollYen: null,
    confidence: "unavailable",
    fallbackMessage: "円建ての有料道路料金を取得できなかったため、未確認としています。",
    warning: "JPY 以外の toll estimate は RouteIQ の円建て比較に含めていません。",
  };
}

export class GoogleRoutesProvider {
  readonly name = "google";
  private readonly options: GoogleRoutesProviderOptions;

  constructor(options: GoogleRoutesProviderOptions) {
    this.options = {
      languageCode: "ja",
      regionCode: "jp",
      ...options,
    };
  }

  async computeRoute(request: RouteProviderRequest): Promise<ProviderRouteResult> {
    if (!this.options.apiKey || this.options.apiKey.trim() === "") {
      throw new Error(
        "Google Maps API キーが設定されていません。.env に EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。",
      );
    }

    const resolvedDepartureTime = resolveGoogleDepartureTime(request.departureTime);
    const body = {
      origin: { address: request.origin },
      destination: { address: request.destination },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      computeAlternativeRoutes: false,
      languageCode: this.options.languageCode ?? "ja",
      regionCode: this.options.regionCode ?? "jp",
      extraComputations: ["TOLLS", "TRAFFIC_ON_POLYLINE"],
      ...(resolvedDepartureTime.departureTime
        ? { departureTime: resolvedDepartureTime.departureTime }
        : {}),
      routeModifiers:
        request.routeType === "local"
          ? { avoidTolls: true, avoidHighways: true, avoidFerries: true }
          : { vehicleInfo: { emissionType: "GASOLINE" }, avoidFerries: true },
    };

    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.options.apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline,routes.warnings,routes.travelAdvisory.tollInfo,routes.travelAdvisory.speedReadingIntervals,routes.legs.travelAdvisory.tollInfo,routes.legs.travelAdvisory.speedReadingIntervals,routes.legs.steps.navigationInstruction,fallbackInfo",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Google Routes API request failed with ${response.status}: ${text.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as GoogleComputeRoutesResponse;
    const route = payload.routes?.[0];
    if (!route?.distanceMeters) {
      throw new Error(
        "Google Routes API のレスポンスにルート情報が含まれていませんでした。出発地と目的地を確認してください。",
      );
    }

    const toll = parseToll(route, request.routeType);
    const intervals = route.travelAdvisory?.speedReadingIntervals ?? [];
    const traffic = summarizeSpeedIntervals(intervals);
    const highwayInfo =
      request.routeType === "expressway"
        ? extractHighwayNames(route)
        : { highwayNames: [], majorHighway: undefined };

    const warnings = [
      ...(route.warnings ?? []),
      ...(resolvedDepartureTime.warning ? [resolvedDepartureTime.warning] : []),
      ...(toll.warning ? [toll.warning] : []),
      ...(request.routeType === "local"
        ? [
            "Google Routes API の avoidTolls / avoidHighways は完全除外ではなく、合理的な範囲での回避指定です。",
          ]
        : []),
      ...(payload.fallbackInfo
        ? [
            "Google Routes API が fallbackInfo を返しました。条件の一部が緩和された可能性があります。",
          ]
        : []),
    ];
    const apiFailures = [...(toll.fallbackMessage ? [toll.fallbackMessage] : [])];

    return {
      routeType: request.routeType,
      distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
      durationMinutes: parseDurationMinutes(route.duration),
      tollYen: toll.tollYen,
      tollConfidence: toll.confidence,
      tollFallbackMessage: toll.fallbackMessage,
      trafficSummary: `${traffic.trafficSummary}${route.description ? ` 主な経路: ${route.description}` : ""}`,
      congestionLevel: traffic.congestionLevel,
      trafficIncidents: [],
      roadClosures: [],
      warnings,
      dataSources: ["Google Maps Routes API"],
      apiFailures,
      routePolyline: decodePolyline(route.polyline?.encodedPolyline),
      ...(highwayInfo.highwayNames.length > 0 ? { highwayNames: highwayInfo.highwayNames } : {}),
      ...(highwayInfo.majorHighway ? { majorHighway: highwayInfo.majorHighway } : {}),
    };
  }
}
