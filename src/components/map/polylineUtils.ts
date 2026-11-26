import type { Coordinates } from "../../domain/location";

/**
 * 地図描画向けポリライン軽量化ユーティリティ (Iterative Douglas-Peucker + WeakMapキャッシュ)
 * 長距離ルート（2,000〜5,000点）の視覚的形状を維持しつつ、
 * Web(Leaflet) の HTML/JSON ペイロードサイズと Native(react-native-maps) のブリッジ転送量を大幅削減する。
 * また WeakMap キャッシュにより、高速/一般道切替や全画面モーダル開閉時の再計算を O(1) 化する。
 */

export type PolylineInputPoint = { lat: number; lng: number } | Coordinates;

const DEFAULT_SIMPLIFY_THRESHOLD = 300;
const DEFAULT_EPSILON_DEG = 0.00008; // 約 8m 相当（ルート全体表示では視認差ゼロ）

const tupleCache = new WeakMap<readonly PolylineInputPoint[], number[][]>();
const nativeCache = new WeakMap<readonly PolylineInputPoint[], Coordinates[]>();

function readLat(pt: PolylineInputPoint): number {
  return "lat" in pt ? pt.lat : pt.latitude;
}

function readLng(pt: PolylineInputPoint): number {
  return "lng" in pt ? pt.lng : pt.longitude;
}

function squaredPerpendicularDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  let dx = x2 - x1;
  let dy = y2 - y1;

  if (dx !== 0 || dy !== 0) {
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x1 = x2;
      y1 = y2;
    } else if (t > 0) {
      x1 += dx * t;
      y1 += dy * t;
    }
  }

  dx = px - x1;
  dy = py - y1;
  return dx * dx + dy * dy;
}

/**
 * 座標配列から保持すべきインデックスのビットマスクを計算する（中間配列の生成なし）
 */
function computeKeepMask(coords: readonly PolylineInputPoint[], epsilon: number): Uint8Array {
  const len = coords.length;
  const sqEpsilon = epsilon * epsilon;
  const keep = new Uint8Array(len);
  keep[0] = 1;
  keep[len - 1] = 1;

  // 再帰ではなく明示的スタックで実行（極端に長いポリラインでもスタックオーバーフロー防止）
  const stack: number[] = [0, len - 1];

  while (stack.length > 0) {
    const end = stack.pop()!;
    const start = stack.pop()!;

    let maxSqDist = 0;
    let index = -1;
    const x1 = readLat(coords[start]);
    const y1 = readLng(coords[start]);
    const x2 = readLat(coords[end]);
    const y2 = readLng(coords[end]);

    for (let i = start + 1; i < end; i++) {
      const sqDist = squaredPerpendicularDistance(
        readLat(coords[i]),
        readLng(coords[i]),
        x1,
        y1,
        x2,
        y2,
      );
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqEpsilon && index !== -1) {
      keep[index] = 1;
      stack.push(start, index, index, end);
    }
  }

  return keep;
}

/**
 * Web(Leaflet) 向けに [lat, lng][] タプルへ変換しつつ、長距離ポリラインを自動軽量化する。
 * 同一配列参照に対しては WeakMap キャッシュから O(1) で返す。
 */
export function toSimplifiedLatLngTuples(
  coords: readonly PolylineInputPoint[],
  epsilon: number = DEFAULT_EPSILON_DEG,
  threshold: number = DEFAULT_SIMPLIFY_THRESHOLD,
): number[][] {
  const isDefaultParams =
    epsilon === DEFAULT_EPSILON_DEG && threshold === DEFAULT_SIMPLIFY_THRESHOLD;
  if (isDefaultParams) {
    const cached = tupleCache.get(coords);
    if (cached) return cached;
  }

  const len = coords.length;
  let result: number[][];

  if (len <= threshold) {
    result = new Array<number[]>(len);
    for (let i = 0; i < len; i++) {
      result[i] = [readLat(coords[i]), readLng(coords[i])];
    }
  } else {
    const keep = computeKeepMask(coords, epsilon);
    result = [];
    for (let i = 0; i < len; i++) {
      if (keep[i]) {
        // 小数点第5位（約1.1m精度）に丸めて JSON ペイロードをさらに削減
        result.push([
          Math.round(readLat(coords[i]) * 1e5) / 1e5,
          Math.round(readLng(coords[i]) * 1e5) / 1e5,
        ]);
      }
    }
  }

  if (isDefaultParams) {
    tupleCache.set(coords, result);
  }
  return result;
}

/**
 * Native(react-native-maps) 向けに Coordinates[] へ変換しつつ、長距離ポリラインを自動軽量化する。
 * 同一配列参照に対しては WeakMap キャッシュから O(1) で返す。
 */
export function toSimplifiedNativeCoordinates(
  coords: readonly PolylineInputPoint[],
  epsilon: number = DEFAULT_EPSILON_DEG,
  threshold: number = DEFAULT_SIMPLIFY_THRESHOLD,
): Coordinates[] {
  const isDefaultParams =
    epsilon === DEFAULT_EPSILON_DEG && threshold === DEFAULT_SIMPLIFY_THRESHOLD;
  if (isDefaultParams) {
    const cached = nativeCache.get(coords);
    if (cached) return cached;
  }

  const len = coords.length;
  let result: Coordinates[];

  if (len <= threshold) {
    result = new Array<Coordinates>(len);
    for (let i = 0; i < len; i++) {
      result[i] = { latitude: readLat(coords[i]), longitude: readLng(coords[i]) };
    }
  } else {
    const keep = computeKeepMask(coords, epsilon);
    result = [];
    for (let i = 0; i < len; i++) {
      if (keep[i]) {
        result.push({ latitude: readLat(coords[i]), longitude: readLng(coords[i]) });
      }
    }
  }

  if (isDefaultParams) {
    nativeCache.set(coords, result);
  }
  return result;
}
