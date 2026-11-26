import { z } from "zod";

export const routeTypeSchema = z.enum(["expressway", "local"]);
export const prioritizeSchema = z.enum(["time", "cost", "balanced"]);
export const congestionLevelSchema = z.enum(["unknown", "low", "moderate", "high"]);
export const tollConfidenceSchema = z.enum(["api", "unavailable"]);
export const decisionSourceSchema = z.enum([
  "gemini-decisions-api",
  "rule-based-fallback",
  "rule-based",
]);
export const decisionReasonCodeSchema = z.enum([
  "strong_time_value",
  "expressway_cheaper_or_equal",
  "local_faster_or_expressway_congested",
  "cost_too_high_for_time_saved",
  "toll_uncertain_time_advantage",
  "user_priority_time",
  "user_priority_cost",
]);

export const routeDecisionProbabilitiesSchema = z.object({
  expressway: z.number().min(0).max(1),
  local: z.number().min(0).max(1),
});

export const routeDecisionMetadataSchema = z.object({
  source: decisionSourceSchema,
  model: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  probabilities: routeDecisionProbabilitiesSchema.optional(),
  primaryReasonCode: decisionReasonCodeSchema.optional(),
  worthPayingTollProbability: z.number().min(0).max(1).optional(),
  fallbackReason: z.string().optional(),
});

export const geminiNoulAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export const geminiChoiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
  confidence: z.number().min(0).max(1),
});

export const geminiScoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z.number(),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
  legend: z.record(z.string(), z.string()).optional(),
  confidence: z.number().min(0).max(1),
});

export const geminiDecisionAnswerSchema = z.discriminatedUnion("type", [
  geminiNoulAnswerSchema,
  geminiChoiceAnswerSchema,
  geminiScoreAnswerSchema,
]);

export const geminiDecisionPromptFeedbackSchema = z
  .object({
    block_reason: z.string().optional(),
    blockReason: z.string().optional(),
  })
  .passthrough();

export const geminiDecisionResponseSchema = z.object({
  answers: z.record(z.string(), geminiDecisionAnswerSchema).optional(),
  prompt_feedback: geminiDecisionPromptFeedbackSchema.optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
});

export const departureTimeSchema = z.string().datetime();

export const routeRequestSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  departureTime: departureTimeSchema.optional(),
  fuelEfficiencyKmPerLiter: z.number().positive(),
  fuelPriceYenPerLiter: z.number().nonnegative().optional(),
  vehicleType: z.string().min(1).optional(),
  prioritize: prioritizeSchema.optional(),
});

export const routeAnalysisRequestSchema = routeRequestSchema.extend({
  question: z.string().min(1).optional(),
});

export const routeProviderRequestSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  departureTime: departureTimeSchema.optional(),
  routeType: routeTypeSchema,
});

export const routeCoordinateSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const providerRouteResultSchema = z.object({
  routeType: routeTypeSchema,
  distanceKm: z.number(),
  durationMinutes: z.number(),
  tollYen: z.number().nullable(),
  tollConfidence: tollConfidenceSchema,
  tollFallbackMessage: z.string().optional(),
  trafficSummary: z.string(),
  congestionLevel: congestionLevelSchema,
  trafficIncidents: z.array(z.string()),
  roadClosures: z.array(z.string()),
  warnings: z.array(z.string()),
  dataSources: z.array(z.string()),
  apiFailures: z.array(z.string()),
  routePolyline: z.array(routeCoordinateSchema).optional(),
  highwayNames: z.array(z.string()).optional(),
  majorHighway: z.string().optional(),
});

export const routeCostSummarySchema = z.object({
  distanceKm: z.number(),
  durationMinutes: z.number(),
  tollYen: z.number().nullable(),
  tollConfidence: tollConfidenceSchema,
  tollFallbackMessage: z.string().optional(),
  fuelCostYen: z.number(),
  totalCostYen: z.number().nullable(),
  trafficSummary: z.string(),
  routePolyline: z.array(routeCoordinateSchema).optional(),
  highwayNames: z.array(z.string()).optional(),
  majorHighway: z.string().optional(),
});

export const routeComparisonSchema = z.object({
  timeDifferenceMinutes: z.number(),
  costDifferenceYen: z.number().nullable(),
  valueOfTimeSavedYenPerMinute: z.number().nullable(),
});

export const compareRoutesResultSchema = z.object({
  input: routeRequestSchema,
  recommendedRoute: routeTypeSchema,
  recommendationReason: z.string(),
  decision: routeDecisionMetadataSchema.optional(),
  expresswayRoute: routeCostSummarySchema,
  localRoute: routeCostSummarySchema,
  comparison: routeComparisonSchema,
  trafficIncidents: z.array(z.string()),
  warnings: z.array(z.string()),
  dataSources: z.array(z.string()),
  apiFailures: z.array(z.string()),
});

export const trafficResultSchema = z.object({
  congestionLevel: congestionLevelSchema,
  incidents: z.array(z.string()),
  roadClosures: z.array(z.string()),
  trafficSummary: z.string(),
  dataSources: z.array(z.string()),
  warnings: z.array(z.string()),
  apiFailures: z.array(z.string()),
});

export const tollEstimateSchema = z.object({
  tollYen: z.number().nullable(),
  confidence: tollConfidenceSchema,
  fallbackMessage: z.string().optional(),
  dataSources: z.array(z.string()),
});

export const routeAnalysisResultSchema = z.object({
  contextId: z.string(),
  input: routeAnalysisRequestSchema,
  answer: z.string(),
  routeComparison: compareRoutesResultSchema.optional(),
  dataSources: z.array(z.string()),
  warnings: z.array(z.string()),
  apiFailures: z.array(z.string()),
});

export const toolResultMessageSchema = z.object({
  structuredContent: compareRoutesResultSchema.optional(),
});

export const fuelPriceAverageSchema = z.object({
  label: z.string(),
  value: z.number(),
  unit: z.literal("円/L"),
  surveyedAt: z.string(),
  sourceUrl: z.string(),
});

export const fuelPriceAveragesResponseSchema = z.object({
  prices: z.array(fuelPriceAverageSchema),
  sourceLabel: z.string(),
  fetchedAt: z.string(),
});

export const clientConfigResponseSchema = z.object({
  googleMapsBrowserApiKey: z.string().nullable(),
  googleMapsEmbedApiKey: z.string().nullable().optional(),
});

export type FuelPriceAverage = z.infer<typeof fuelPriceAverageSchema>;
export type FuelPriceAveragesResponse = z.infer<typeof fuelPriceAveragesResponseSchema>;
export type ClientConfigResponse = z.infer<typeof clientConfigResponseSchema>;

export type RouteType = z.infer<typeof routeTypeSchema>;
export type PrioritizeMode = z.infer<typeof prioritizeSchema>;
export type CongestionLevel = z.infer<typeof congestionLevelSchema>;
export type TollConfidence = z.infer<typeof tollConfidenceSchema>;
export type DecisionSource = z.infer<typeof decisionSourceSchema>;
export type DecisionReasonCode = z.infer<typeof decisionReasonCodeSchema>;
export type RouteDecisionProbabilities = z.infer<typeof routeDecisionProbabilitiesSchema>;
export type RouteDecisionMetadata = z.infer<typeof routeDecisionMetadataSchema>;
export type GeminiNoulAnswer = z.infer<typeof geminiNoulAnswerSchema>;
export type GeminiChoiceAnswer = z.infer<typeof geminiChoiceAnswerSchema>;
export type GeminiScoreAnswer = z.infer<typeof geminiScoreAnswerSchema>;
export type GeminiDecisionAnswer = z.infer<typeof geminiDecisionAnswerSchema>;
export type GeminiDecisionResponse = z.infer<typeof geminiDecisionResponseSchema>;
export type RouteRequest = z.infer<typeof routeRequestSchema>;
export type RouteInput = RouteRequest;
export type RouteAnalysisRequest = z.infer<typeof routeAnalysisRequestSchema>;
export type RouteProviderRequest = z.infer<typeof routeProviderRequestSchema>;
export type ProviderRouteResult = z.infer<typeof providerRouteResultSchema>;
export type RouteCoordinate = z.infer<typeof routeCoordinateSchema>;
export type RouteCostSummary = z.infer<typeof routeCostSummarySchema>;
export type RouteComparison = z.infer<typeof routeComparisonSchema>;
export type CompareRoutesResult = z.infer<typeof compareRoutesResultSchema> &
  Record<string, unknown>;
export type TrafficResult = z.infer<typeof trafficResultSchema> & Record<string, unknown>;
export type TollEstimate = z.infer<typeof tollEstimateSchema> & Record<string, unknown>;
export type RouteAnalysisResult = z.infer<typeof routeAnalysisResultSchema>;
export type ToolResultMessage = z.infer<typeof toolResultMessageSchema>;

export const comparisonHistoryItemSchema = z.object({
  id: z.string(),
  origin: z.string().min(1),
  destination: z.string().min(1),
  vehicleType: z.string(),
  date: z.string(),
  timestamp: z.number(),
});

export const comparisonHistoryListSchema = z.array(comparisonHistoryItemSchema);
export type ComparisonHistoryItem = z.infer<typeof comparisonHistoryItemSchema>;
export type ComparisonHistoryList = z.infer<typeof comparisonHistoryListSchema>;
