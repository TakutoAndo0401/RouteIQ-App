import { Platform } from "react-native";
import {
  type ClientConfigResponse,
  type FuelPriceAveragesResponse,
  type RouteAnalysisRequest,
  type RouteAnalysisResult,
  clientConfigResponseSchema,
  fuelPriceAveragesResponseSchema,
  routeAnalysisResultSchema,
} from "../../contracts";
import { analyzeRouteInProcess } from "../../domain/services/routeAnalysisService";
import { fetchFuelPriceAverages } from "../../domain/services/fuelPriceService";

/**
 * 呼び出し側が復旧手段を選ぶための失敗分類。
 * TakutoAndo0401/RouteIQ (web/src/shared/lib/routeIqApi.ts) に準拠
 */
export type RouteIqApiErrorKind =
  | "network"
  | "rate-limit"
  | "invalid-request"
  | "server"
  | "unknown";

const MAX_DETAIL_LENGTH = 400;

/**
 * HTTP ステータスと元の応答本文を保持する RouteIQ API の失敗。
 */
export class RouteIqApiError extends Error {
  readonly kind: RouteIqApiErrorKind;
  readonly status: number | null;

  constructor(kind: RouteIqApiErrorKind, status: number | null, detail: string) {
    super(detail);
    this.name = "RouteIqApiError";
    this.kind = kind;
    this.status = status;
  }
}

/**
 * API サーバーのベース URL を解決します。
 * 環境変数 EXPO_PUBLIC_API_URL が最優先されます。
 * 未設定時:
 * - Android エミュレータ環境: http://10.0.2.2:8787
 * - それ以外 (Web / iOS シミュレータ / Node): http://localhost:8787
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8787";
  }

  return "http://localhost:8787";
}

function classifyStatus(status: number): RouteIqApiErrorKind {
  if (status === 429) return "rate-limit";
  if (status === 400 || status === 422) return "invalid-request";
  if (status >= 500) return "server";
  return "unknown";
}

function readServerErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { error } = payload as { error?: unknown };
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

/**
 * 応答本文を読み、JSON として解釈できたときだけ値を返します。
 * プロキシやエラーページが HTML を返した際に SyntaxError でステータスが失われるのを防ぎます。
 */
async function readResponseBody(response: Response): Promise<{ payload: unknown; raw: string }> {
  let raw: string;
  try {
    raw = await response.text();
  } catch {
    return { payload: null, raw: "" };
  }

  if (!raw.trim()) return { payload: null, raw };

  try {
    return { payload: JSON.parse(raw) as unknown, raw };
  } catch {
    return { payload: null, raw };
  }
}

export interface RequestOptions {
  baseUrl?: string;
  apiKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  mode?: "auto" | "in-process" | "remote";
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> {
  const baseUrl = options?.baseUrl ?? getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let signal = options?.signal;

  if (options?.timeoutMs && !signal) {
    const controller = new AbortController();
    signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  }

  const headers = new Headers(init?.headers);
  const apiKey =
    options?.apiKey ?? process.env.EXPO_PUBLIC_ROUTEIQ_API_KEY ?? process.env.EXPO_PUBLIC_API_KEY;
  if (apiKey && !headers.has("x-api-key")) {
    headers.set("x-api-key", apiKey);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal,
    });
  } catch (caught) {
    throw new RouteIqApiError(
      "network",
      null,
      caught instanceof Error ? caught.message : String(caught),
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  const { payload, raw } = await readResponseBody(response);

  if (!response.ok) {
    const detail = readServerErrorMessage(payload) ?? raw.trim().slice(0, MAX_DETAIL_LENGTH);
    throw new RouteIqApiError(
      classifyStatus(response.status),
      response.status,
      detail || `HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }

  if (payload === null) {
    throw new RouteIqApiError(
      "server",
      response.status,
      raw.trim().slice(0, MAX_DETAIL_LENGTH) || "Response body was not valid JSON.",
    );
  }

  return payload as T;
}

/**
 * 経路比較・分析 API (POST /api/route-analysis またはアプリ内直接実行)
 * 外部サーバー不要のスタンドアロン（in-process）実行をデフォルトとし、
 * 明示的に baseUrl が渡された場合や mode="remote" の場合はリモート HTTP を呼び出します。
 */
export async function analyzeRouteApi(
  input: RouteAnalysisRequest,
  options?: RequestOptions,
): Promise<RouteAnalysisResult> {
  const shouldUseRemote =
    options?.mode === "remote" || (options?.mode !== "in-process" && Boolean(options?.baseUrl));

  if (!shouldUseRemote) {
    try {
      return await analyzeRouteInProcess(input, { apiKey: options?.apiKey });
    } catch (caught) {
      if (caught instanceof RouteIqApiError) {
        throw caught;
      }
      const message = caught instanceof Error ? caught.message : String(caught);
      if (message.includes("Google Maps API キーが設定されていません")) {
        throw new RouteIqApiError("server", 400, message);
      }
      if (message.includes("ルート情報が含まれていません") || message.includes("見つかりません")) {
        throw new RouteIqApiError("invalid-request", 404, message);
      }
      throw new RouteIqApiError("server", 500, message);
    }
  }

  const payload = await requestJson<unknown>(
    "/api/route-analysis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    options,
  );

  const parsed = routeAnalysisResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new RouteIqApiError(
      "server",
      200,
      `APIレスポンスの形式が不正です: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}

/**
 * ガソリン全国平均価格取得 API (GET /api/fuel-prices またはアプリ内直接取得)
 */
export async function getFuelPriceAveragesApi(
  options?: RequestOptions,
): Promise<FuelPriceAveragesResponse> {
  const shouldUseRemote =
    options?.mode === "remote" || (options?.mode !== "in-process" && Boolean(options?.baseUrl));

  if (!shouldUseRemote) {
    return fetchFuelPriceAverages();
  }

  const payload = await requestJson<unknown>("/api/fuel-prices", undefined, options);
  const parsed = fuelPriceAveragesResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new RouteIqApiError(
      "server",
      200,
      `ガソリン価格レスポンスの形式が不正です: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/**
 * クライアント設定取得 API (GET /api/client-config)
 */
export async function getClientConfigApi(options?: RequestOptions): Promise<ClientConfigResponse> {
  const payload = await requestJson<unknown>("/api/client-config", undefined, options);
  const parsed = clientConfigResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new RouteIqApiError(
      "server",
      200,
      `設定レスポンスの形式が不正です: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export interface DescribedRouteError {
  type: "network" | "rate_limit" | "not_found" | "server" | "unknown";
  title: string;
  message: string;
  recovery: string;
  detail: string;
  retryable: boolean;
}

/**
 * エラー内容をユーザー向けの説明と復旧手順に変換します。
 * TakutoAndo0401/RouteIQ (web/src/pages/route-comparison/model/useRouteAnalysis.ts) に準拠
 */
export function describeRouteError(caught: unknown): DescribedRouteError {
  const detail = caught instanceof Error ? caught.message : String(caught);

  if (detail.includes("Google Maps API キー")) {
    return {
      type: "server",
      title: "Google Maps API キー未設定",
      message: "Google Maps Routes API のキーが設定されていません。",
      recovery:
        "RouteIQ-App の .env ファイルに EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。",
      detail,
      retryable: true,
    };
  }

  if (caught instanceof RouteIqApiError) {
    switch (caught.kind) {
      case "network":
        return {
          type: "network",
          title: "接続できませんでした",
          message: "サーバーに接続できませんでした。",
          recovery: "ネットワーク接続を確認してから、もう一度お試しください。",
          detail,
          retryable: true,
        };
      case "rate-limit":
        return {
          type: "rate_limit",
          title: "リクエスト集中",
          message: "リクエストが集中しています。",
          recovery: "1分ほど待ってから再試行してください。",
          detail,
          retryable: true,
        };
      case "invalid-request":
        return {
          type: "not_found",
          title: "ルートが見つかりませんでした",
          message: "この条件では経路を判定できませんでした。",
          recovery: "出発地・目的地をより具体的な住所に変えるか、地図から選び直してください。",
          detail,
          retryable: false,
        };
      case "server":
        return {
          type: "server",
          title: "サーバーエラー",
          message: "サーバー側で処理を完了できませんでした。",
          recovery: "時間をおいて再試行してください。続く場合は管理者に連絡してください。",
          detail,
          retryable: true,
        };
      default:
        break;
    }
  }

  return {
    type: "unknown",
    title: "道路状況の確認に失敗",
    message: "道路状況の確認に失敗しました。",
    recovery: "入力内容を確認して、もう一度お試しください。",
    detail,
    retryable: true,
  };
}
