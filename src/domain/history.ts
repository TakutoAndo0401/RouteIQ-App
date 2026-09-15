import AsyncStorage from "@react-native-async-storage/async-storage";
import { comparisonHistoryListSchema, type ComparisonHistoryItem } from "../contracts";

export const COMPARISON_HISTORY_STORAGE_KEY = "@routeiq/comparison_history";
export const MAX_HISTORY_ITEMS = 10;

/**
 * 表示用の月日フォーマット (例: "9/11", "8/9")
 */
export function formatHistoryDate(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * 出発地・目的地の同一性判定（前後の空白トリム）
 */
export function isSameRoute(
  a: { origin: string; destination: string },
  b: { origin: string; destination: string },
): boolean {
  return (
    a.origin.trim().toLowerCase() === b.origin.trim().toLowerCase() &&
    a.destination.trim().toLowerCase() === b.destination.trim().toLowerCase()
  );
}

/**
 * 履歴一覧へ新しい履歴を追加または更新する（純粋関数）。
 * - 同一ルート（origin & destination）が既に存在する場合は古い項目を除去し、最新の条件で先頭に追加。
 * - 最大保持件数 (デフォルト10件) を超える場合は古い末尾を切り捨てる。
 */
export function addOrUpdateHistoryItem(
  currentList: ComparisonHistoryItem[],
  newItem: ComparisonHistoryItem,
  maxItems: number = MAX_HISTORY_ITEMS,
): ComparisonHistoryItem[] {
  // 重複を除外
  const filtered = currentList.filter((item) => !isSameRoute(item, newItem));
  // 先頭に追加して件数制限
  return [newItem, ...filtered].slice(0, maxItems);
}

/**
 * 指定IDの履歴項目を一覧から削除する（純粋関数）。
 */
export function removeHistoryItem(
  currentList: ComparisonHistoryItem[],
  id: string,
): ComparisonHistoryItem[] {
  return currentList.filter((item) => item.id !== id);
}

/**
 * AsyncStorage から保存済みの履歴一覧を読み出す。
 * 形式不整合やエラーの場合は空配列を安全に返す。
 */
export async function loadStoredHistory(): Promise<ComparisonHistoryItem[]> {
  try {
    const json = await AsyncStorage.getItem(COMPARISON_HISTORY_STORAGE_KEY);
    if (!json) {
      return [];
    }
    const parsed = JSON.parse(json);
    const result = comparisonHistoryListSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * 履歴一覧を AsyncStorage に永続化保存する。
 */
export async function saveStoredHistory(list: ComparisonHistoryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(COMPARISON_HISTORY_STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn("Failed to persist comparison history:", error);
  }
}

/**
 * AsyncStorage の履歴を全件クリアする。
 */
export async function clearStoredHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(COMPARISON_HISTORY_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear comparison history:", error);
  }
}
