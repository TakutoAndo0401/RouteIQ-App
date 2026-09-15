import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type {
  FuelPriceAveragesResponse,
  RouteAnalysisRequest,
  RouteAnalysisResult,
} from "../contracts";
import { defaultMockClient, type HarnessScenario } from "./mockClient";
import { analyzeRouteApi, getApiBaseUrl, getFuelPriceAveragesApi } from "../shared/api";

export interface HarnessContextType {
  isMockMode: boolean;
  setIsMockMode: (val: boolean) => void;
  scenario: HarnessScenario;
  setScenario: (sc: HarnessScenario) => void;
  analyzeRoute: (request: RouteAnalysisRequest) => Promise<RouteAnalysisResult>;
  getFuelPrices: () => Promise<FuelPriceAveragesResponse>;
  apiUrl: string;
}

const HarnessContext = createContext<HarnessContextType | null>(null);

export function HarnessProvider({ children }: { children: ReactNode }) {
  const [isMockMode, setIsMockMode] = useState<boolean>(() => {
    return process.env.EXPO_PUBLIC_USE_MOCK_HARNESS === "true";
  });
  const [scenario, setScenarioState] = useState<HarnessScenario>("expressway_recommended");

  const setScenario = useCallback((newScenario: HarnessScenario) => {
    setScenarioState(newScenario);
    defaultMockClient.setScenario(newScenario);
  }, []);

  const analyzeRoute = useCallback(
    async (request: RouteAnalysisRequest): Promise<RouteAnalysisResult> => {
      if (isMockMode) {
        return defaultMockClient.analyzeRoute(request);
      }
      return analyzeRouteApi(request);
    },
    [isMockMode],
  );

  const getFuelPrices = useCallback(async (): Promise<FuelPriceAveragesResponse> => {
    if (isMockMode) {
      return defaultMockClient.getFuelPriceAverages();
    }
    return getFuelPriceAveragesApi();
  }, [isMockMode]);

  const apiUrl = useMemo(() => getApiBaseUrl(), []);

  const contextValue = useMemo<HarnessContextType>(
    () => ({
      isMockMode,
      setIsMockMode,
      scenario,
      setScenario,
      analyzeRoute,
      getFuelPrices,
      apiUrl,
    }),
    [isMockMode, scenario, setScenario, analyzeRoute, getFuelPrices, apiUrl],
  );

  return <HarnessContext.Provider value={contextValue}>{children}</HarnessContext.Provider>;
}

export function useHarness() {
  const context = useContext(HarnessContext);
  if (!context) {
    throw new Error("useHarness must be used within a HarnessProvider");
  }
  return context;
}

export const useRouteIqApi = useHarness;
