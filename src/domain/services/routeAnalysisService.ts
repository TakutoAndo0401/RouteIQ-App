import {
  routeAnalysisRequestSchema,
  routeAnalysisResultSchema,
  type RouteAnalysisRequest,
  type RouteAnalysisResult,
} from "../../contracts";
import { buildCompareRoutesResult } from "../recommendation";
import type { CompareRoutesResult } from "../types";
import { GoogleRoutesProvider } from "../providers/googleRoutesProvider";
import { fetchFuelPriceAverages } from "./fuelPriceService";

export interface RouteAnalysisServiceOptions {
  apiKey?: string;
  provider?: GoogleRoutesProvider;
}

function makeContextId(): string {
  return `routeiq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function routeLabel(route: "expressway" | "local"): string {
  return route === "expressway" ? "高速優先" : "一般道";
}

function buildRouteSummary(comparison: CompareRoutesResult | undefined): string[] {
  if (!comparison) return [];
  return [
    `経路比較では ${routeLabel(comparison.recommendedRoute)} を推奨します。${comparison.recommendationReason}`,
    `高速優先: ${comparison.expresswayRoute.durationMinutes}分 / ${comparison.expresswayRoute.distanceKm}km / 総額 ${
      comparison.expresswayRoute.totalCostYen === null
        ? "未確定"
        : `${comparison.expresswayRoute.totalCostYen}円`
    }`,
    `一般道: ${comparison.localRoute.durationMinutes}分 / ${comparison.localRoute.distanceKm}km / 総額 ${
      comparison.localRoute.totalCostYen === null
        ? "未確定"
        : `${comparison.localRoute.totalCostYen}円`
    }`,
  ];
}

export function buildInitialAnswer(params: {
  input: RouteAnalysisRequest;
  routeComparison?: CompareRoutesResult;
  apiFailures: string[];
}): string {
  const lines = [
    `${params.input.origin} から ${params.input.destination} までの条件で確認しました。`,
  ];
  lines.push(...buildRouteSummary(params.routeComparison));

  if (params.apiFailures.length > 0) {
    lines.push(`取得できなかった情報: ${params.apiFailures.join(" / ")}`);
  }

  if (params.routeComparison) {
    lines.push(
      "Google Routes API の速度区間をもとに道路状況を確認しています。事故・工事などの原因は断定しません。",
    );
  }
  return lines.join("\n");
}

export function getGoogleMapsApiKey(options?: RouteAnalysisServiceOptions): string | undefined {
  return (
    options?.apiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.EXPO_PUBLIC_API_KEY
  );
}

export async function analyzeRouteInProcess(
  rawInput: RouteAnalysisRequest,
  options?: RouteAnalysisServiceOptions,
): Promise<RouteAnalysisResult> {
  const input = routeAnalysisRequestSchema.parse(rawInput);

  const apiKey = getGoogleMapsApiKey(options);
  if (!options?.provider && (!apiKey || apiKey.trim() === "")) {
    throw new Error(
      "Google Maps API キーが設定されていません。.env ファイルに EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。",
    );
  }

  const provider =
    options?.provider ??
    new GoogleRoutesProvider({
      apiKey: apiKey as string,
      languageCode: "ja",
      regionCode: "jp",
    });

  let resolvedFuelPrice = input.fuelPriceYenPerLiter;
  let fuelPriceWarning: string | undefined;

  if (typeof resolvedFuelPrice !== "number") {
    try {
      const averages = await fetchFuelPriceAverages();
      const regular = averages.prices.find((p) => p.label === "レギュラー");
      if (regular && Number.isFinite(regular.value)) {
        resolvedFuelPrice = regular.value;
      } else {
        resolvedFuelPrice = 175;
      }
    } catch {
      resolvedFuelPrice = 175;
      fuelPriceWarning =
        "全国平均ガソリン価格の取得に失敗したため、暫定値 175円/L で計算しました。";
    }
  }

  // 高速道路ルートと一般道ルートを並行取得
  const [expresswayRoute, localRoute] = await Promise.all([
    provider.computeRoute({
      origin: input.origin,
      destination: input.destination,
      departureTime: input.departureTime,
      routeType: "expressway",
    }),
    provider.computeRoute({
      origin: input.origin,
      destination: input.destination,
      departureTime: input.departureTime,
      routeType: "local",
    }),
  ]);

  const warnings: string[] = [];
  if (fuelPriceWarning) warnings.push(fuelPriceWarning);

  const routeComparison = buildCompareRoutesResult({
    origin: input.origin,
    destination: input.destination,
    departureTime: input.departureTime,
    fuelEfficiencyKmPerLiter: input.fuelEfficiencyKmPerLiter,
    fuelPriceYenPerLiter: resolvedFuelPrice,
    vehicleType: input.vehicleType,
    prioritize: input.prioritize ?? "balanced",
    expresswayRoute,
    localRoute,
    warnings,
  });

  const answer = buildInitialAnswer({
    input: {
      ...input,
      fuelPriceYenPerLiter: resolvedFuelPrice,
    },
    routeComparison,
    apiFailures: routeComparison.apiFailures,
  });

  const result: RouteAnalysisResult = {
    contextId: makeContextId(),
    input: {
      origin: input.origin,
      destination: input.destination,
      fuelEfficiencyKmPerLiter: input.fuelEfficiencyKmPerLiter,
      fuelPriceYenPerLiter: resolvedFuelPrice,
      vehicleType: input.vehicleType,
      prioritize: input.prioritize ?? "balanced",
      departureTime: input.departureTime,
      question: input.question,
    },
    answer,
    routeComparison,
    dataSources: routeComparison.dataSources,
    warnings: routeComparison.warnings,
    apiFailures: routeComparison.apiFailures,
  };

  return routeAnalysisResultSchema.parse(result);
}
