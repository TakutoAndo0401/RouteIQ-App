import {
  decisionReasonCodeSchema,
  geminiDecisionResponseSchema,
  type CongestionLevel,
  type DecisionReasonCode,
  type PrioritizeMode,
  type RouteComparison,
  type RouteCostSummary,
  type RouteDecisionMetadata,
  type RouteType,
} from "../../contracts";

export const DEFAULT_GEMINI_DECISION_MODEL = "gemini-decision-1";
export const GEMINI_DECISIONS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/decisions";
export const DEFAULT_DECISION_TIMEOUT_MS = 8000;
export const GEMINI_DECISIONS_DATA_SOURCE = "Gemini Decisions API (gemini-decision-1)";

export interface GeminiDecisionProviderOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  timeoutMs?: number;
}

export interface RouteDecisionContext {
  origin: string;
  destination: string;
  departureTime?: string;
  vehicleType?: string;
  fuelEfficiencyKmPerLiter: number;
  fuelPriceYenPerLiter: number;
  prioritize: PrioritizeMode;
  expresswayRoute: RouteCostSummary;
  expresswayCongestionLevel: CongestionLevel;
  expresswayWarnings: string[];
  localRoute: RouteCostSummary;
  localCongestionLevel: CongestionLevel;
  localWarnings: string[];
  comparison: RouteComparison;
  trafficIncidents: string[];
}

export interface RouteDecisionEvaluation {
  recommendedRoute: RouteType;
  recommendationReason: string;
  decision: RouteDecisionMetadata;
  dataSources: string[];
}

export interface RouteDecisionEvaluator {
  decideRoute(context: RouteDecisionContext): Promise<RouteDecisionEvaluation>;
}

const PRIORITIZE_LABELS: Record<PrioritizeMode, string> = {
  balanced: "バランス重視（時間短縮効果・費用・渋滞リスクを総合判断）",
  time: "時間優先（到着の早さ・渋滞回避を最優先）",
  cost: "費用優先（高速料金と燃料費の総額を抑えることを最優先）",
};

const CONGESTION_LABELS: Record<CongestionLevel, string> = {
  low: "順調（低混雑）",
  moderate: "一部混雑（中混雑）",
  high: "渋滞あり（高混雑）",
  unknown: "不明",
};

function formatYen(value: number | null): string {
  return value === null ? "未確定" : `${value.toLocaleString("ja-JP")}円`;
}

function formatDurationJapanese(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

/**
 * Decisions API へ渡す構造化コンテキスト文字列を構築します。
 */
export function buildRouteDecisionInput(context: RouteDecisionContext): string {
  const {
    origin,
    destination,
    departureTime,
    vehicleType,
    fuelEfficiencyKmPerLiter,
    fuelPriceYenPerLiter,
    prioritize,
    expresswayRoute,
    expresswayCongestionLevel,
    expresswayWarnings,
    localRoute,
    localCongestionLevel,
    localWarnings,
    comparison,
    trafficIncidents,
  } = context;

  const timeDiffLabel =
    comparison.timeDifferenceMinutes > 0
      ? `高速道路の方が ${comparison.timeDifferenceMinutes}分 早い`
      : comparison.timeDifferenceMinutes < 0
        ? `一般道の方が ${Math.abs(comparison.timeDifferenceMinutes)}分 早い`
        : "所要時間は同じ";

  const costDiffLabel =
    comparison.costDifferenceYen === null
      ? "未確定（高速料金が取得できなかったため総額比較不可）"
      : comparison.costDifferenceYen > 0
        ? `高速道路の方が ${formatYen(comparison.costDifferenceYen)} 高い`
        : comparison.costDifferenceYen < 0
          ? `高速道路の方が ${formatYen(Math.abs(comparison.costDifferenceYen))} 安い`
          : "総額は同じ";

  const valuePerMinuteLabel =
    comparison.valueOfTimeSavedYenPerMinute === null
      ? "算出不可"
      : `${comparison.valueOfTimeSavedYenPerMinute}円/分（一般的な目安: 80円/分以下ならコスパ良好）`;

  const lines: string[] = [
    "【走行条件】",
    `- 出発地: ${origin}`,
    `- 目的地: ${destination}`,
    `- 優先方針: ${prioritize} (${PRIORITIZE_LABELS[prioritize]})`,
    `- 車種: ${vehicleType ?? "普通車"}`,
    `- 燃費: ${fuelEfficiencyKmPerLiter} km/L`,
    `- ガソリン単価: ${fuelPriceYenPerLiter} 円/L`,
  ];

  if (departureTime) {
    lines.push(`- 出発時刻: ${departureTime}`);
  }

  lines.push(
    "",
    "【高速優先ルート】",
    `- 距離: ${expresswayRoute.distanceKm} km`,
    `- 所要時間: ${expresswayRoute.durationMinutes} 分`,
    `- 高速料金: ${formatYen(expresswayRoute.tollYen)} (信頼度: ${expresswayRoute.tollConfidence})`,
    `- 燃料費: ${formatYen(expresswayRoute.fuelCostYen)}`,
    `- 総額: ${formatYen(expresswayRoute.totalCostYen)}`,
    `- 渋滞度: ${CONGESTION_LABELS[expresswayCongestionLevel]}`,
    `- 交通状況: ${expresswayRoute.trafficSummary}`,
  );

  if (expresswayRoute.majorHighway) {
    lines.push(`- 主な高速道路: ${expresswayRoute.majorHighway}`);
  }
  if (expresswayWarnings.length > 0) {
    lines.push(`- 注意事項: ${expresswayWarnings.join(" / ")}`);
  }

  lines.push(
    "",
    "【一般道ルート】",
    `- 距離: ${localRoute.distanceKm} km`,
    `- 所要時間: ${localRoute.durationMinutes} 分`,
    `- 高速料金: ${formatYen(localRoute.tollYen)}`,
    `- 燃料費: ${formatYen(localRoute.fuelCostYen)}`,
    `- 総額: ${formatYen(localRoute.totalCostYen)}`,
    `- 渋滞度: ${CONGESTION_LABELS[localCongestionLevel]}`,
    `- 交通状況: ${localRoute.trafficSummary}`,
  );

  if (localWarnings.length > 0) {
    lines.push(`- 注意事項: ${localWarnings.join(" / ")}`);
  }

  lines.push(
    "",
    "【比較メトリクス】",
    `- 所要時間差: ${timeDiffLabel}`,
    `- 総額差: ${costDiffLabel}`,
    `- 1分短縮あたりの追加費用: ${valuePerMinuteLabel}`,
  );

  if (trafficIncidents.length > 0) {
    lines.push(`- 交通インシデント: ${trafficIncidents.join(" / ")}`);
  }

  return lines.join("\n");
}

/**
 * 1回の Decisions API リクエストで並列評価する質問セットを構築します。
 */
export function buildRouteDecisionQuestions(prioritize: PrioritizeMode) {
  const priorityGuide =
    prioritize === "time"
      ? "ユーザーは「時間優先」を指定しています。原則として所要時間が短いルートを選び、僅差の場合は渋滞リスクが低いルートを選んでください。"
      : prioritize === "cost"
        ? "ユーザーは「費用優先」を指定しています。総額が確定している場合は原則として総額が安いルートを選んでください。高速料金が未確定の場合は所要時間と渋滞リスクから合理的なルートを選んでください。"
        : "ユーザーは「バランス重視」を指定しています。時間短縮の大きさ、総額差、1分短縮あたりの追加費用（80円/分程度がひとつの目安）、渋滞リスク、および料金未確定の不確実性を総合的に判断してください。";

  return {
    recommended_route: {
      type: "choice" as const,
      instructions: `以下の走行条件・両ルートの比較データをもとに、高速道路ルートと一般道ルートのどちらを推奨すべきか選択してください。${priorityGuide}`,
      criteria: {
        expressway:
          "高速道路ルートを推奨する。時間短縮メリットが追加費用に見合う、総額が同等以下、時間優先で高速の方が早い、または一般道の混雑回避効果が高い場合。",
        local:
          "一般道ルートを推奨する。高速利用による時間短縮が小さく追加費用が高すぎる、高速道路の渋滞等で一般道の方が早い、または費用優先で一般道の方が安い場合。",
      },
    },
    primary_reason: {
      type: "choice" as const,
      instructions: "上記のルート推奨判断において最も決定的な理由カテゴリを1つ選択してください。",
      criteria: {
        strong_time_value:
          "高速道路による時間短縮が大きく、追加費用に対するコストパフォーマンスが良い。",
        expressway_cheaper_or_equal:
          "距離短縮による燃料費節約などを含めると、高速道路ルートの方が総額が安いまたは同等である。",
        local_faster_or_expressway_congested:
          "高速道路の渋滞や迂回により、一般道の方が所要時間が短いか差がごくわずかである。",
        cost_too_high_for_time_saved:
          "高速道路を利用しても時間短縮が小さく、高速料金などの追加費用が見合わない。",
        toll_uncertain_time_advantage:
          "高速料金が未確定のため費用比較はできないが、確認できる所要時間の短縮メリットが大きい。",
        user_priority_time: "時間優先の方針に基づき、所要時間がより短いルートを選択した。",
        user_priority_cost: "費用優先の方針に基づき、総額がより安いルートを選択した。",
      },
    },
    worth_paying_toll: {
      type: "noul" as const,
      instructions:
        "このルート条件において、有料道路料金を支払って高速道路を利用する価値が十分にあるかどうか判定してください。",
      criteria: {
        true_description:
          "時間短縮・渋滞回避・運転負担軽減のメリットが高速料金を上回り、有料道路を使う価値が高い。",
        false_description:
          "時間短縮が小さい、高速道路が渋滞している、または費用優先の方針に合致せず、有料道路を使う価値が低い。",
      },
    },
  };
}

/**
 * Decisions API の構造化判定結果と実測メトリクスから、数値矛盾のない日本語の推奨理由を生成します。
 */
export function formatDecisionReason(params: {
  recommendedRoute: RouteType;
  primaryReasonCode?: DecisionReasonCode;
  context: RouteDecisionContext;
  confidence: number;
}): string {
  const { recommendedRoute, primaryReasonCode, context, confidence } = params;
  const { comparison, prioritize } = context;
  const savedMinutes = comparison.timeDifferenceMinutes;
  const costDiff = comparison.costDifferenceYen;
  const yenPerMin = comparison.valueOfTimeSavedYenPerMinute;

  const isCloseCall = confidence < 0.6;
  const closeCallSuffix = isCloseCall ? "（僅差のため、お好みで選択しても大差ありません）" : "";

  if (recommendedRoute === "expressway") {
    switch (primaryReasonCode) {
      case "user_priority_time":
        if (savedMinutes > 0) {
          return `時間優先の方針により、${formatDurationJapanese(savedMinutes)}短縮できる高速道路ルートをおすすめします。${closeCallSuffix}`;
        }
        return `時間優先の方針と交通状況を考慮し、高速道路ルートをおすすめします。${closeCallSuffix}`;
      case "expressway_cheaper_or_equal":
      case "user_priority_cost":
        if (costDiff !== null && costDiff <= 0) {
          return `燃料費を含めた総額でも高速道路ルートが有利なため、高速道路ルートをおすすめします。${closeCallSuffix}`;
        }
        break;
      case "toll_uncertain_time_advantage":
        if (savedMinutes > 0) {
          return `高速料金は未確定ですが、${formatDurationJapanese(savedMinutes)}の時間短縮が見込めるため高速道路ルートをおすすめします。${closeCallSuffix}`;
        }
        return `高速料金が未確定のため、確認できる所要時間と交通状況から高速道路ルートをおすすめします。${closeCallSuffix}`;
      case "strong_time_value":
      default:
        break;
    }

    if (savedMinutes > 0 && costDiff !== null && yenPerMin !== null) {
      return `${formatDurationJapanese(savedMinutes)}短縮でき、追加費用 ${formatYen(costDiff)}（1分あたり約${yenPerMin}円）のバランスが良いため高速道路ルートをおすすめします。${closeCallSuffix}`;
    }
    if (savedMinutes > 0) {
      return `${formatDurationJapanese(savedMinutes)}の時間短縮が見込めるため、高速道路ルートをおすすめします。${closeCallSuffix}`;
    }
    return `交通状況と優先方針（${prioritize === "time" ? "時間優先" : prioritize === "cost" ? "費用優先" : "バランス重視"}）を総合判断し、高速道路ルートをおすすめします。${closeCallSuffix}`;
  }

  // recommendedRoute === "local"
  switch (primaryReasonCode) {
    case "user_priority_cost":
      if (costDiff !== null && costDiff > 0) {
        return `費用優先の方針により、総額を ${formatYen(costDiff)} 抑えられる一般道ルートをおすすめします。${closeCallSuffix}`;
      }
      return `費用優先の方針に基づき、一般道ルートをおすすめします。${closeCallSuffix}`;
    case "user_priority_time":
      if (savedMinutes < 0) {
        return `時間優先でも一般道ルートの方が ${formatDurationJapanese(savedMinutes)} 短時間のため、一般道ルートをおすすめします。${closeCallSuffix}`;
      }
      return `交通状況と時間優先の方針を総合判断し、一般道ルートをおすすめします。${closeCallSuffix}`;
    case "local_faster_or_expressway_congested":
      if (savedMinutes < 0) {
        return `高速道路の混雑等の影響で一般道の方が ${formatDurationJapanese(savedMinutes)} 早く到着できるため、一般道ルートをおすすめします。${closeCallSuffix}`;
      }
      return `高速道路との所要時間差が小さく、混雑リスクや費用を踏まえて一般道ルートをおすすめします。${closeCallSuffix}`;
    case "cost_too_high_for_time_saved":
    default:
      break;
  }

  if (savedMinutes > 0 && costDiff !== null && costDiff > 0) {
    const ratePart = yenPerMin !== null ? `（1分あたり約${yenPerMin}円）` : "";
    return `短縮時間は${formatDurationJapanese(savedMinutes)}にとどまり、追加費用 ${formatYen(costDiff)}${ratePart}が大きいため一般道ルートをおすすめします。${closeCallSuffix}`;
  }
  if (savedMinutes <= 0) {
    return `一般道ルートの方が所要時間・費用の両面で有利なため、一般道ルートをおすすめします。${closeCallSuffix}`;
  }
  return `時間短縮効果と費用のバランスを総合判断し、一般道ルートをおすすめします。${closeCallSuffix}`;
}

function readGeminiApiErrorMessage(payload: unknown, raw: string, status: number): string {
  if (typeof payload === "object" && payload !== null) {
    const errorObj = (payload as { error?: unknown }).error;
    if (typeof errorObj === "object" && errorObj !== null) {
      const code = (errorObj as { code?: unknown }).code;
      const message = (errorObj as { message?: unknown }).message;
      const codeStr = typeof code === "string" || typeof code === "number" ? String(code) : "";
      const msgStr = typeof message === "string" ? message.trim() : "";
      if (codeStr && msgStr) return `[${codeStr}] ${msgStr}`;
      if (msgStr) return msgStr;
    }
  }
  const trimmed = raw.trim().slice(0, 300);
  return trimmed || `HTTP ${status}`;
}

export class GeminiDecisionProvider implements RouteDecisionEvaluator {
  readonly name = "gemini-decisions";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(options: GeminiDecisionProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_GEMINI_DECISION_MODEL;
    this.endpoint = options.endpoint ?? GEMINI_DECISIONS_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_DECISION_TIMEOUT_MS;
  }

  async decideRoute(context: RouteDecisionContext): Promise<RouteDecisionEvaluation> {
    if (!this.apiKey || this.apiKey.trim() === "") {
      throw new Error(
        "Gemini API キーが設定されていません。.env に EXPO_PUBLIC_GEMINI_API_KEY を設定してください。",
      );
    }

    const requestBody = {
      model: this.model,
      input: buildRouteDecisionInput(context),
      questions: buildRouteDecisionQuestions(context.prioritize),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey.trim(),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") {
        throw new Error(`Gemini Decisions API がタイムアウトしました (${this.timeoutMs}ms)。`);
      }
      throw new Error(
        `Gemini Decisions API への通信に失敗しました: ${
          caught instanceof Error ? caught.message : String(caught)
        }`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const raw = await response.text();
    let rawJson: unknown = null;
    if (raw.trim()) {
      try {
        rawJson = JSON.parse(raw) as unknown;
      } catch {
        rawJson = null;
      }
    }

    if (!response.ok) {
      const detail = readGeminiApiErrorMessage(rawJson, raw, response.status);
      throw new Error(`Gemini Decisions API request failed with ${response.status}: ${detail}`);
    }

    const parsed = geminiDecisionResponseSchema.safeParse(rawJson);
    if (!parsed.success) {
      throw new Error(`Gemini Decisions API のレスポンス形式が不正です: ${parsed.error.message}`);
    }

    const blockReason =
      parsed.data.prompt_feedback?.block_reason ?? parsed.data.prompt_feedback?.blockReason;
    if (blockReason) {
      throw new Error(
        `Gemini Decisions API の安全フィルタによりブロックされました (${blockReason})。`,
      );
    }

    const answers = parsed.data.answers;
    const routeAnswer = answers?.recommended_route;
    if (!routeAnswer || routeAnswer.type !== "choice") {
      throw new Error(
        "Gemini Decisions API の応答に recommended_route の choice 結果が含まれていません。",
      );
    }

    if (routeAnswer.choice !== "expressway" && routeAnswer.choice !== "local") {
      throw new Error(
        `Gemini Decisions API から想定外の推奨ルートが返されました: ${routeAnswer.choice}`,
      );
    }

    const recommendedRoute: RouteType = routeAnswer.choice;
    const expProb = routeAnswer.probabilities.expressway;
    const localProb = routeAnswer.probabilities.local;
    const hasProbabilities =
      typeof expProb === "number" &&
      Number.isFinite(expProb) &&
      typeof localProb === "number" &&
      Number.isFinite(localProb);

    const reasonAnswer = answers?.primary_reason;
    let primaryReasonCode: DecisionReasonCode | undefined;
    if (reasonAnswer && reasonAnswer.type === "choice") {
      const reasonParsed = decisionReasonCodeSchema.safeParse(reasonAnswer.choice);
      if (reasonParsed.success) {
        primaryReasonCode = reasonParsed.data;
      }
    }

    const worthTollAnswer = answers?.worth_paying_toll;
    const worthPayingTollProbability =
      worthTollAnswer && worthTollAnswer.type === "noul" ? worthTollAnswer.noul : undefined;

    const recommendationReason = formatDecisionReason({
      recommendedRoute,
      primaryReasonCode,
      context,
      confidence: routeAnswer.confidence,
    });

    const decision: RouteDecisionMetadata = {
      source: "gemini-decisions-api",
      model: this.model,
      confidence: routeAnswer.confidence,
      ...(hasProbabilities
        ? {
            probabilities: {
              expressway: expProb,
              local: localProb,
            },
          }
        : {}),
      ...(primaryReasonCode ? { primaryReasonCode } : {}),
      ...(worthPayingTollProbability !== undefined ? { worthPayingTollProbability } : {}),
    };

    return {
      recommendedRoute,
      recommendationReason,
      decision,
      dataSources: [`Gemini Decisions API (${this.model})`],
    };
  }
}
