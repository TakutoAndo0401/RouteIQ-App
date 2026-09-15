import type { FuelPriceAverage, FuelPriceAveragesResponse } from "../../contracts";

const CACHE_TTL_MS = 60 * 60 * 1000;

// 資源エネルギー庁による直近の全国平均価格（フォールバック用）
const DEFAULT_PRICES: FuelPriceAverage[] = [
  {
    label: "レギュラー",
    value: 175.2,
    unit: "円/L",
    surveyedAt: "2025年02月17日",
    sourceUrl: "https://oil-stat.com/reg/.html",
  },
  {
    label: "ハイオク",
    value: 186.1,
    unit: "円/L",
    surveyedAt: "2025年02月17日",
    sourceUrl: "https://oil-stat.com/high.html",
  },
  {
    label: "軽油",
    value: 154.5,
    unit: "円/L",
    surveyedAt: "2025年02月17日",
    sourceUrl: "https://oil-stat.com/light.html",
  },
];

let cached:
  | {
      expiresAt: number;
      value: FuelPriceAveragesResponse;
    }
  | undefined;

const SOURCES = [
  { label: "レギュラー", url: "https://oil-stat.com/reg/.html" },
  { label: "ハイオク", url: "https://oil-stat.com/high.html" },
  { label: "軽油", url: "https://oil-stat.com/light.html" },
];

function parseLatestPrice(html: string, label: string, sourceUrl: string): FuelPriceAverage {
  const normalized = html.replace(/\s+/g, " ");
  const match = normalized.match(
    /最新価格.*?([0-9]+(?:\.[0-9]+)?)\s*円（([0-9]{4}年[0-9]{2}月[0-9]{2}日)）/,
  );
  if (!match) {
    throw new Error(`${label} の最新価格を読み取れませんでした。`);
  }
  const [, priceText, surveyedAt] = match;
  if (!priceText || !surveyedAt) {
    throw new Error(`${label} の最新価格を読み取れませんでした。`);
  }

  return {
    label,
    value: Number(priceText),
    unit: "円/L",
    surveyedAt,
    sourceUrl,
  };
}

export async function fetchFuelPriceAverages(): Promise<FuelPriceAveragesResponse> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const prices = await Promise.all(
      SOURCES.map(async (source) => {
        const response = await fetch(source.url);
        if (!response.ok) {
          throw new Error(`${source.label} price request failed: ${response.status}`);
        }
        return parseLatestPrice(await response.text(), source.label, source.url);
      }),
    );

    const value: FuelPriceAveragesResponse = {
      prices,
      sourceLabel: "経済産業省 資源エネルギー庁 石油製品価格調査に基づく全国平均",
      fetchedAt: new Date(now).toISOString(),
    };
    cached = { expiresAt: now + CACHE_TTL_MS, value };
    return value;
  } catch {
    // ネットワーク制限や CORS ブロック時は安全に全国公表平均値を使用
    const fallbackValue: FuelPriceAveragesResponse = {
      prices: DEFAULT_PRICES,
      sourceLabel: "経済産業省 資源エネルギー庁 石油製品価格調査に基づく全国平均",
      fetchedAt: new Date(now).toISOString(),
    };
    cached = { expiresAt: now + CACHE_TTL_MS, value: fallbackValue };
    return fallbackValue;
  }
}
