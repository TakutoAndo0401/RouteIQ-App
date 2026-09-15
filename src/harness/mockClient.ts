import type {
  FuelPriceAveragesResponse,
  RouteAnalysisRequest,
  RouteAnalysisResult,
} from "../contracts";
import {
  defaultFuelPriceAverages,
  scenarioExpresswayRecommended,
  scenarioHeavyTraffic,
  scenarioLocalRecommended,
  scenarioTollUnavailable,
} from "./fixtures";

export type HarnessScenario =
  | "expressway_recommended"
  | "local_recommended"
  | "toll_unavailable"
  | "heavy_traffic"
  | "network_error"
  | "server_error";

export interface MockClientConfig {
  latencyMs?: number;
  scenario?: HarnessScenario;
}

export class RouteIqMockClient {
  private currentScenario: HarnessScenario = "expressway_recommended";
  private latencyMs: number = 400;

  constructor(config?: MockClientConfig) {
    if (config?.scenario) this.currentScenario = config.scenario;
    if (typeof config?.latencyMs === "number") this.latencyMs = config.latencyMs;
  }

  setScenario(scenario: HarnessScenario) {
    this.currentScenario = scenario;
  }

  getScenario(): HarnessScenario {
    return this.currentScenario;
  }

  setLatency(ms: number) {
    this.latencyMs = ms;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getFuelPriceAverages(): Promise<FuelPriceAveragesResponse> {
    await this.sleep(this.latencyMs / 2);
    return defaultFuelPriceAverages;
  }

  async analyzeRoute(request: RouteAnalysisRequest): Promise<RouteAnalysisResult> {
    await this.sleep(this.latencyMs);

    if (this.currentScenario === "network_error") {
      throw new Error(
        "ネットワークエラー: サーバーに接続できませんでした。通信環境をご確認ください。",
      );
    }

    if (this.currentScenario === "server_error") {
      throw new Error("HTTP 500: 経路比較サーバーで一時的な障害が発生しました。");
    }

    let baseResult: RouteAnalysisResult;
    switch (this.currentScenario) {
      case "local_recommended":
        baseResult = scenarioLocalRecommended;
        break;
      case "toll_unavailable":
        baseResult = scenarioTollUnavailable;
        break;
      case "heavy_traffic":
        baseResult = scenarioHeavyTraffic;
        break;
      case "expressway_recommended":
      default:
        baseResult = scenarioExpresswayRecommended;
        break;
    }

    // ユーザーのリクエスト情報を反映して返す
    return {
      ...baseResult,
      input: {
        ...baseResult.input,
        origin: request.origin,
        destination: request.destination,
        fuelEfficiencyKmPerLiter: request.fuelEfficiencyKmPerLiter,
        fuelPriceYenPerLiter: request.fuelPriceYenPerLiter ?? baseResult.input.fuelPriceYenPerLiter,
        prioritize: request.prioritize ?? baseResult.input.prioritize,
        departureTime: request.departureTime,
      },
    };
  }
}

export const defaultMockClient = new RouteIqMockClient();
