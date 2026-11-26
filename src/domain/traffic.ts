import type { CongestionLevel } from "./types";

export interface SpeedReadingInterval {
  startPolylinePointIndex?: number;
  endPolylinePointIndex?: number;
  speed?: "NORMAL" | "SLOW" | "TRAFFIC_JAM" | string;
}

function formatPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function resolveDelayPosition(
  weightedMidpoint: number,
  totalWeight: number,
  maxEnd: number,
): string | null {
  if (totalWeight <= 0 || maxEnd <= 0) return null;
  const ratio = weightedMidpoint / totalWeight / maxEnd;
  if (ratio < 0.34) return "前半";
  if (ratio < 0.67) return "中盤";
  return "後半";
}

export function summarizeSpeedIntervals(intervals: SpeedReadingInterval[]): {
  congestionLevel: CongestionLevel;
  trafficSummary: string;
} {
  const len = intervals.length;
  if (len === 0) {
    return {
      congestionLevel: "unknown",
      trafficSummary: "交通速度区間データは取得できませんでした。",
    };
  }

  // スカラー変数で集計し、ホットループ内の動的プロパティアクセスとオブジェクト割当を排除
  let wNormal = 0;
  let wSlow = 0;
  let wTrafficJam = 0;
  let wUnknown = 0;

  let iNormal = 0;
  let iSlow = 0;
  let iTrafficJam = 0;
  let iUnknown = 0;

  let hasPolylineIndexes = false;
  let weightedMidpoint = 0;
  let totalWeight = 0;
  let maxEnd = 0;

  for (let i = 0; i < len; i++) {
    const interval = intervals[i];
    const speed = interval.speed;
    const end = interval.endPolylinePointIndex;

    let length = 0;
    let start = 0;
    if (typeof end === "number") {
      if (end > maxEnd) maxEnd = end;
      start = interval.startPolylinePointIndex ?? 0;
      length = end - start;
    }

    if (speed === "NORMAL") {
      iNormal += 1;
      if (length > 0) {
        hasPolylineIndexes = true;
        wNormal += length;
      }
    } else if (speed === "SLOW") {
      iSlow += 1;
      if (length > 0) {
        hasPolylineIndexes = true;
        wSlow += length;
        weightedMidpoint += (start + end!) * 0.5 * length;
        totalWeight += length;
      }
    } else if (speed === "TRAFFIC_JAM") {
      iTrafficJam += 1;
      if (length > 0) {
        hasPolylineIndexes = true;
        wTrafficJam += length;
        const weight = length * 2;
        weightedMidpoint += (start + end!) * 0.5 * weight;
        totalWeight += weight;
      }
    } else {
      iUnknown += 1;
      if (length > 0) {
        hasPolylineIndexes = true;
        wUnknown += length;
      }
    }
  }

  const normal = hasPolylineIndexes ? wNormal : iNormal;
  const slow = hasPolylineIndexes ? wSlow : iSlow;
  const trafficJam = hasPolylineIndexes ? wTrafficJam : iTrafficJam;
  const unknown = hasPolylineIndexes ? wUnknown : iUnknown;
  const total = normal + slow + trafficJam + unknown;

  const detail = hasPolylineIndexes
    ? `速度区間の割合は通常 ${formatPercent(normal, total)}%、低速 ${formatPercent(slow, total)}%、渋滞 ${formatPercent(trafficJam, total)}%です。`
    : `速度区間の内訳は NORMAL: ${normal}, SLOW: ${slow}, TRAFFIC_JAM: ${trafficJam} です。`;

  if (trafficJam > 0) {
    const position = resolveDelayPosition(weightedMidpoint, totalWeight, maxEnd);
    return {
      congestionLevel: "high",
      trafficSummary: `渋滞区間が含まれます。${position ? `ルートの${position}に遅れが集中しています。` : ""}${detail}`,
    };
  }
  if (slow > 0) {
    const position = resolveDelayPosition(weightedMidpoint, totalWeight, maxEnd);
    return {
      congestionLevel: "moderate",
      trafficSummary: `一部で低速区間があります。${position ? `ルートの${position}に遅れが出ています。` : ""}${detail}`,
    };
  }
  if (normal > 0 && unknown === 0) {
    return {
      congestionLevel: "low",
      trafficSummary: `大きな渋滞は検出されていません。${detail}`,
    };
  }

  return {
    congestionLevel: "unknown",
    trafficSummary: "交通速度区間の一部または全部が不明です。",
  };
}
