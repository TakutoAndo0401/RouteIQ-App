import {
  routeAnalysisRequestSchema,
  routeAnalysisResultSchema,
  type RouteAnalysisRequest,
  type RouteAnalysisResult,
} from "../../contracts";
import { buildCompareRoutesResult, buildComparison, toRouteCostSummary } from "../recommendation";
import type { CompareRoutesResult } from "../types";
import { GoogleRoutesProvider } from "../providers/googleRoutesProvider";
import {
  GeminiDecisionProvider,
  type RouteDecisionEvaluation,
  type RouteDecisionEvaluator,
} from "../providers/geminiDecisionProvider";
import { fetchFuelPriceAverages } from "./fuelPriceService";

export interface RouteAnalysisServiceOptions {
  apiKey?: string;
  geminiApiKey?: string;
  provider?: GoogleRoutesProvider;
  decisionProvider?: RouteDecisionEvaluator;
}

function makeContextId(): string {
  return `routeiq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function routeLabel(route: "expressway" | "local"): string {
  return route === "expressway" ? "高速優先" : "一般道";
}

function buildRouteSummary(comparison: CompareRoutesResult | undefined): string[] {
  if (!comparison) return [];
  const lines = [
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
  if (
    comparison.decision?.source === "gemini-decisions-api" &&
    typeof comparison.decision.confidence === "number"
  ) {
    const pct = Math.round(comparison.decision.confidence * 100);
    lines.push(`AI判定 (${comparison.decision.model ?? "gemini-decision-1"}): 確信度 ${pct}%`);
  }
  return lines;
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

export function getGeminiApiKey(options?: RouteAnalysisServiceOptions): string | undefined {
  return (
    options?.geminiApiKey ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY
  );
}

const providerCache = new Map<string, GoogleRoutesProvider>();
const decisionProviderCache = new Map<string, GeminiDecisionProvider>();

function getOrCreateProvider(apiKey: string): GoogleRoutesProvider {
  let cached = providerCache.get(apiKey);
  if (!cached) {
    cached = new GoogleRoutesProvider({
      apiKey,
      languageCode: "ja",
      regionCode: "jp",
    });
    providerCache.set(apiKey, cached);
  }
  return cached;
}

function getOrCreateDecisionProvider(apiKey: string): GeminiDecisionProvider {
  let cached = decisionProviderCache.get(apiKey);
  if (!cached) {
    cached = new GeminiDecisionProvider({ apiKey });
    decisionProviderCache.set(apiKey, cached);
  }
  return cached;
}

function isValidRoutePolyline(polyline: Array<{ lat: number; lng: number }> | undefined): boolean {
  if (!polyline) return true;
  for (let i = 0; i < polyline.length; i++) {
    const pt = polyline[i];
    if (
      typeof pt !== "object" ||
      pt === null ||
      typeof pt.lat !== "number" ||
      typeof pt.lng !== "number" ||
      !Number.isFinite(pt.lat) ||
      !Number.isFinite(pt.lng)
    ) {
      return false;
    }
  }
  return true;
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

  const provider = options?.provider ?? getOrCreateProvider(apiKey as string);

  // ガソリン平均価格取得と高速・一般道ルート取得を完全並行実行（直列ウォーターフォールを排除）
  const fuelPricePromise: Promise<{ value: number; warning?: string }> =
    typeof input.fuelPriceYenPerLiter === "number"
      ? Promise.resolve({ value: input.fuelPriceYenPerLiter })
      : fetchFuelPriceAverages()
          .then((averages) => {
            const regular = averages.prices.find((p) => p.label === "レギュラー");
            if (regular && Number.isFinite(regular.value)) {
              return { value: regular.value };
            }
            return { value: 175 };
          })
          .catch(() => ({
            value: 175,
            warning: "全国平均ガソリン価格の取得に失敗したため、暫定値 175円/L で計算しました。",
          }));

  const [fuelResolution, expresswayRoute, localRoute] = await Promise.all([
    fuelPricePromise,
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

  const resolvedFuelPrice = fuelResolution.value;
  const resolvedPrioritize = input.prioritize ?? "balanced";
  const warnings: string[] = [];
  const decisionApiFailures: string[] = [];
  if (fuelResolution.warning) warnings.push(fuelResolution.warning);

  // Decisions API による高速 / 一般道判定（キー未設定時・障害時は既存ルールベースへ自動フォールバック）
  let decisionOverride: RouteDecisionEvaluation | undefined;
  let decisionFallbackReason: string | undefined;

  const geminiApiKey = getGeminiApiKey(options);
  const decisionEvaluator: RouteDecisionEvaluator | undefined =
    options?.decisionProvider ??
    (geminiApiKey && geminiApiKey.trim() !== ""
      ? getOrCreateDecisionProvider(geminiApiKey.trim())
      : undefined);

  if (decisionEvaluator) {
    const expSummary = toRouteCostSummary(
      expresswayRoute,
      input.fuelEfficiencyKmPerLiter,
      resolvedFuelPrice,
    );
    const localSummary = toRouteCostSummary(
      localRoute,
      input.fuelEfficiencyKmPerLiter,
      resolvedFuelPrice,
    );
    const previewComparison = buildComparison(expSummary, localSummary);

    try {
      decisionOverride = await decisionEvaluator.decideRoute({
        origin: input.origin,
        destination: input.destination,
        departureTime: input.departureTime,
        vehicleType: input.vehicleType,
        fuelEfficiencyKmPerLiter: input.fuelEfficiencyKmPerLiter,
        fuelPriceYenPerLiter: resolvedFuelPrice,
        prioritize: resolvedPrioritize,
        expresswayRoute: expSummary,
        expresswayCongestionLevel: expresswayRoute.congestionLevel,
        expresswayWarnings: expresswayRoute.warnings,
        localRoute: localSummary,
        localCongestionLevel: localRoute.congestionLevel,
        localWarnings: localRoute.warnings,
        comparison: previewComparison,
        trafficIncidents: [...expresswayRoute.trafficIncidents, ...localRoute.trafficIncidents],
      });
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      decisionFallbackReason = reason;
      warnings.push(
        "Gemini Decisions API での判定に失敗したため、標準ルールで推奨ルートを判定しました。",
      );
      decisionApiFailures.push(`Gemini Decisions API: ${reason}`);
    }
  }

  const routeComparison = buildCompareRoutesResult({
    origin: input.origin,
    destination: input.destination,
    departureTime: input.departureTime,
    fuelEfficiencyKmPerLiter: input.fuelEfficiencyKmPerLiter,
    fuelPriceYenPerLiter: resolvedFuelPrice,
    vehicleType: input.vehicleType,
    prioritize: resolvedPrioritize,
    expresswayRoute,
    localRoute,
    warnings,
    apiFailures: decisionApiFailures,
    decisionOverride,
    decisionFallbackReason,
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

  // 大規模ポリライン配列の Zod 全件複製・再検証コストを回避しつつ、コントラクト検証を維持
  const expPoly = routeComparison.expresswayRoute.routePolyline;
  const localPoly = routeComparison.localRoute.routePolyline;
  if (!isValidRoutePolyline(expPoly) || !isValidRoutePolyline(localPoly)) {
    return routeAnalysisResultSchema.parse(result);
  }

  const parsed = routeAnalysisResultSchema.parse({
    ...result,
    routeComparison: {
      ...routeComparison,
      expresswayRoute: { ...routeComparison.expresswayRoute, routePolyline: undefined },
      localRoute: { ...routeComparison.localRoute, routePolyline: undefined },
    },
  });

  if (parsed.routeComparison) {
    if (expPoly) parsed.routeComparison.expresswayRoute.routePolyline = expPoly;
    if (localPoly) parsed.routeComparison.localRoute.routePolyline = localPoly;
  }

  return parsed;
}
