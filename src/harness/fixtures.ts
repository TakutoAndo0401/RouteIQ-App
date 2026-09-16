import type {
  FuelPriceAveragesResponse,
  RouteAnalysisRequest,
  RouteAnalysisResult,
  RouteCostSummary,
} from "../contracts";

export const defaultRouteInput: RouteAnalysisRequest = {
  origin: "東京都世田谷区用賀1丁目",
  destination: "静岡県御殿場市新橋",
  fuelEfficiencyKmPerLiter: 14.5,
  fuelPriceYenPerLiter: 175,
  vehicleType: "普通車",
  prioritize: "balanced",
  question: "現在の道路状況を確認して",
};

export const defaultFuelPriceAverages: FuelPriceAveragesResponse = {
  prices: [
    {
      label: "レギュラー",
      value: 175.2,
      unit: "円/L",
      surveyedAt: "2026-09-08",
      sourceUrl: "https://www.enecho.meti.go.jp",
    },
    {
      label: "ハイオク",
      value: 186.4,
      unit: "円/L",
      surveyedAt: "2026-09-08",
      sourceUrl: "https://www.enecho.meti.go.jp",
    },
    {
      label: "軽油",
      value: 154.8,
      unit: "円/L",
      surveyedAt: "2026-09-08",
      sourceUrl: "https://www.enecho.meti.go.jp",
    },
  ],
  sourceLabel: "資源エネルギー庁 石油製品価格調査",
  fetchedAt: new Date().toISOString(),
};

export const expresswayRouteFixture: RouteCostSummary = {
  distanceKm: 103.2,
  durationMinutes: 75,
  tollYen: 1800,
  tollConfidence: "api",
  fuelCostYen: 1246,
  totalCostYen: 3046,
  trafficSummary: "東名高速道路の一部区間で通常通りの流れです。",
  highwayNames: ["東名高速道路"],
  majorHighway: "東名高速道路",
};

export const localRouteFixture: RouteCostSummary = {
  distanceKm: 91.4,
  durationMinutes: 112,
  tollYen: 0,
  tollConfidence: "api",
  fuelCostYen: 1103,
  totalCostYen: 1103,
  trafficSummary: "国道246号線で通常の速度で走行可能です。",
};

export const tollUnavailableRouteFixture: RouteCostSummary = {
  ...expresswayRouteFixture,
  tollYen: null,
  tollConfidence: "unavailable",
  tollFallbackMessage: "有料道路料金を取得できなかったため、総額は未確認です。",
  totalCostYen: null,
};

/** シナリオ 1: 高速道路おすすめ (バランス型 / 時間短縮と費用のバランス良好) */
export const scenarioExpresswayRecommended: RouteAnalysisResult = {
  contextId: "harness-expressway-recommended",
  input: defaultRouteInput,
  answer:
    "一般道ルートに比べて37分の時間短縮が見込めます。追加費用は1,943円（1分短縮あたり約53円）であり、判断基準（80円/分以下）を満たすため、高速道路ルートをおすすめします。",
  routeComparison: {
    input: defaultRouteInput,
    recommendedRoute: "expressway",
    recommendationReason: "37分の短縮に対する追加費用が、判断基準の範囲内です。",
    expresswayRoute: expresswayRouteFixture,
    localRoute: localRouteFixture,
    comparison: {
      timeDifferenceMinutes: 37,
      costDifferenceYen: 1943,
      valueOfTimeSavedYenPerMinute: 53,
    },
    trafficIncidents: [],
    warnings: [],
    dataSources: ["Google Routes API（RouteIQ Harness）"],
    apiFailures: [],
  },
  dataSources: ["Google Routes API（RouteIQ Harness）"],
  warnings: [],
  apiFailures: [],
};

/** シナリオ 2: 一般道おすすめ (追加費用に対して時間短縮効果が小さい) */
export const scenarioLocalRecommended: RouteAnalysisResult = {
  contextId: "harness-local-recommended",
  input: {
    ...defaultRouteInput,
    origin: "東京都品川区大崎",
    destination: "神奈川県川崎市中原区",
  },
  answer:
    "高速道路を利用しても短縮時間は8分程度にとどまりますが、料金が1,320円追加で発生します（1分短縮あたり165円）。追加費用が大きいため、一般道ルートをおすすめします。",
  routeComparison: {
    input: defaultRouteInput,
    recommendedRoute: "local",
    recommendationReason: "時間短縮に対する追加費用が大きいため、一般道をおすすめします。",
    expresswayRoute: {
      distanceKm: 18.2,
      durationMinutes: 28,
      tollYen: 1320,
      tollConfidence: "api",
      fuelCostYen: 220,
      totalCostYen: 1540,
      trafficSummary: "首都高速2号目黒線で順調に流れています。",
    },
    localRoute: {
      distanceKm: 15.6,
      durationMinutes: 36,
      tollYen: 0,
      tollConfidence: "api",
      fuelCostYen: 188,
      totalCostYen: 188,
      trafficSummary: "中原街道・第二京浜ともに標準的な交通状況です。",
    },
    comparison: {
      timeDifferenceMinutes: 8,
      costDifferenceYen: 1352,
      valueOfTimeSavedYenPerMinute: 169,
    },
    trafficIncidents: [],
    warnings: [],
    dataSources: ["Google Routes API（RouteIQ Harness）"],
    apiFailures: [],
  },
  dataSources: ["Google Routes API（RouteIQ Harness）"],
  warnings: [],
  apiFailures: [],
};

/** シナリオ 3: 有料道路料金取得不可 (料金未確定) */
export const scenarioTollUnavailable: RouteAnalysisResult = {
  contextId: "harness-toll-unavailable",
  input: defaultRouteInput,
  answer:
    "高速優先ルートの有料道路料金が取得できなかったため、総額の確定比較ができません。確認できる所要時間（37分短縮）をもとに、時間短縮を考慮して高速道路ルートをおすすめしています。",
  routeComparison: {
    input: defaultRouteInput,
    recommendedRoute: "expressway",
    recommendationReason:
      "料金未確定のため費用だけでは判断できません。確認できる所要時間を優先しておすすめしています。",
    expresswayRoute: tollUnavailableRouteFixture,
    localRoute: localRouteFixture,
    comparison: {
      timeDifferenceMinutes: 37,
      costDifferenceYen: null,
      valueOfTimeSavedYenPerMinute: null,
    },
    trafficIncidents: [],
    warnings: ["高速道路の有料道路料金を取得できませんでした。総額は概算できません。"],
    dataSources: ["Google Routes API（RouteIQ Harness）"],
    apiFailures: ["高速優先ルートの料金取得APIが未提供"],
  },
  dataSources: ["Google Routes API（RouteIQ Harness）"],
  warnings: ["高速道路の有料道路料金を取得できませんでした。総額は概算できません。"],
  apiFailures: ["高速優先ルートの料金取得APIが未提供"],
};

/** シナリオ 4: 渋滞発生時のケース */
export const scenarioHeavyTraffic: RouteAnalysisResult = {
  contextId: "harness-heavy-traffic",
  input: defaultRouteInput,
  answer:
    "東名高速道路上で事故による激しい渋滞（約15km）が発生しており、通常より大幅に時間がかかっています。一般道ルートの方が所要時間が短いため、一般道をおすすめします。",
  routeComparison: {
    input: defaultRouteInput,
    recommendedRoute: "local",
    recommendationReason:
      "高速道路で大幅な渋滞が発生しており、一般道ルートの方が所要時間が短いためおすすめします。",
    expresswayRoute: {
      ...expresswayRouteFixture,
      durationMinutes: 135,
      trafficSummary: "東名高速道路（大和トンネル付近）で事故渋滞が発生しています。",
    },
    localRoute: localRouteFixture,
    comparison: {
      timeDifferenceMinutes: -23,
      costDifferenceYen: 1943,
      valueOfTimeSavedYenPerMinute: null,
    },
    trafficIncidents: ["東名高速道路下り 事故による車線規制（15km渋滞）"],
    warnings: ["高速道路で事故渋滞が発生しています。"],
    dataSources: ["Google Routes API（RouteIQ Harness）"],
    apiFailures: [],
  },
  dataSources: ["Google Routes API（RouteIQ Harness）"],
  warnings: ["高速道路で事故渋滞が発生しています。"],
  apiFailures: [],
};
