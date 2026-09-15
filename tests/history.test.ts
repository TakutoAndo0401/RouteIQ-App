import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  formatHistoryDate,
  isSameRoute,
  addOrUpdateHistoryItem,
  removeHistoryItem,
  loadStoredHistory,
  saveStoredHistory,
  clearStoredHistory,
  MAX_HISTORY_ITEMS,
  COMPARISON_HISTORY_STORAGE_KEY,
} from "../src/domain/history";
import type { ComparisonHistoryItem } from "../src/contracts";

// AsyncStorage のインメモリモック
const storageMock: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageMock[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storageMock[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete storageMock[key];
    }),
    clear: vi.fn(async () => {
      Object.keys(storageMock).forEach((k) => delete storageMock[k]);
    }),
  },
}));

describe("検索履歴の管理ロジック (history domain logic)", () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
    vi.clearAllMocks();
  });

  describe("formatHistoryDate（履歴表示用の日付整形）", () => {
    describe("正常系テスト", () => {
      it("日付を「月/日（例: 9/11）」の簡潔なフォーマットに整形できる", () => {
        const date = new Date(2026, 8, 11); // 2026-09-11 (Month is 0-indexed: 8 = September)
        expect(formatHistoryDate(date)).toBe("9/11");
      });
    });
  });

  describe("isSameRoute（同一ルート判定）", () => {
    describe("正常系テスト", () => {
      it("出発地と目的地が完全一致する場合は同一ルートと判定する", () => {
        expect(
          isSameRoute(
            { origin: "東京駅", destination: "横浜駅" },
            { origin: "東京駅", destination: "横浜駅" },
          ),
        ).toBe(true);
      });

      it("前後の余白や空白の違いを無視して同一ルートと判定できる", () => {
        expect(
          isSameRoute(
            { origin: "  東京駅  ", destination: "横浜駅" },
            { origin: "東京駅", destination: "  横浜駅 " },
          ),
        ).toBe(true);
      });

      it("出発地または目的地が異なる場合は別ルートと判定する", () => {
        expect(
          isSameRoute(
            { origin: "東京駅", destination: "横浜駅" },
            { origin: "新宿駅", destination: "横浜駅" },
          ),
        ).toBe(false);
        expect(
          isSameRoute(
            { origin: "東京駅", destination: "横浜駅" },
            { origin: "東京駅", destination: "品川駅" },
          ),
        ).toBe(false);
      });
    });
  });

  describe("addOrUpdateHistoryItem（履歴アイテムの追加と更新）", () => {
    const item1: ComparisonHistoryItem = {
      id: "1",
      origin: "用賀IC",
      destination: "御殿場IC",
      vehicleType: "普通車",
      date: "9/1",
      timestamp: 1000,
    };
    const item2: ComparisonHistoryItem = {
      id: "2",
      origin: "東京駅",
      destination: "成田空港",
      vehicleType: "中型車",
      date: "9/2",
      timestamp: 2000,
    };

    describe("正常系テスト", () => {
      it("新しいルートの検索履歴をリストの先頭に追加できる", () => {
        const result = addOrUpdateHistoryItem([item1], item2);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(item2);
        expect(result[1]).toEqual(item1);
      });

      it("過去と同一のルートを再検索した場合、古い履歴を削除して最新の履歴を先頭に更新配置する（重複排除）", () => {
        const updatedItem1: ComparisonHistoryItem = {
          id: "1-updated",
          origin: "  用賀IC  ",
          destination: "御殿場IC",
          vehicleType: "大型車",
          date: "9/11",
          timestamp: 3000,
        };

        const initial = [item2, item1];
        const result = addOrUpdateHistoryItem(initial, updatedItem1);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(updatedItem1);
        expect(result[1]).toEqual(item2);
        expect(result.some((i) => i.id === item1.id)).toBe(false);
      });
    });

    describe("境界値テスト", () => {
      it("履歴件数が上限（10件）を超える場合、最も古い履歴から順に削除されて10件に維持される", () => {
        const list: ComparisonHistoryItem[] = [];
        for (let i = 0; i < 12; i++) {
          const item: ComparisonHistoryItem = {
            id: `id-${i}`,
            origin: `出発地-${i}`,
            destination: `目的地-${i}`,
            vehicleType: "普通車",
            date: "9/11",
            timestamp: 1000 + i,
          };
          list.push(item);
        }

        // 10 items limit
        let current: ComparisonHistoryItem[] = [];
        for (const item of list) {
          current = addOrUpdateHistoryItem(current, item, MAX_HISTORY_ITEMS);
        }

        expect(current).toHaveLength(10);
        // Latest item (index 11) should be at the front
        expect(current[0].id).toBe("id-11");
        // Oldest items (0 and 1) should be evicted
        expect(current.some((i) => i.id === "id-0")).toBe(false);
        expect(current.some((i) => i.id === "id-1")).toBe(false);
        // id-2 should be at the tail
        expect(current[current.length - 1].id).toBe("id-2");
      });
    });
  });

  describe("removeHistoryItem（指定履歴の削除）", () => {
    describe("正常系テスト", () => {
      it("指定したIDの履歴アイテムをリストから正確に削除できる", () => {
        const item1: ComparisonHistoryItem = {
          id: "1",
          origin: "用賀IC",
          destination: "御殿場IC",
          vehicleType: "普通車",
          date: "9/1",
          timestamp: 1000,
        };
        const item2: ComparisonHistoryItem = {
          id: "2",
          origin: "東京駅",
          destination: "成田空港",
          vehicleType: "中型車",
          date: "9/2",
          timestamp: 2000,
        };

        const result = removeHistoryItem([item1, item2], "1");
        expect(result).toEqual([item2]);
      });
    });
  });

  describe("AsyncStorage永続化連携", () => {
    describe("正常系テスト", () => {
      it("検索履歴リストを端末ストレージに保存し、正しく読み出すことができる", async () => {
        const items: ComparisonHistoryItem[] = [
          {
            id: "hist-1",
            origin: "東京駅",
            destination: "横浜駅",
            vehicleType: "普通車",
            date: "9/11",
            timestamp: 1000,
          },
        ];

        await saveStoredHistory(items);
        expect(storageMock[COMPARISON_HISTORY_STORAGE_KEY]).toBeDefined();

        const loaded = await loadStoredHistory();
        expect(loaded).toEqual(items);
      });

      it("保存されている全検索履歴を一括で消去できる", async () => {
        storageMock[COMPARISON_HISTORY_STORAGE_KEY] = JSON.stringify([]);
        await clearStoredHistory();
        expect(storageMock[COMPARISON_HISTORY_STORAGE_KEY]).toBeUndefined();
      });
    });

    describe("境界値テスト", () => {
      it("保存されている履歴が1件もない場合は空配列を返す", async () => {
        const loaded = await loadStoredHistory();
        expect(loaded).toEqual([]);
      });
    });

    describe("異常系テスト", () => {
      it("保存されているデータが壊れたJSON文字列の場合は、エラーにせず安全に空配列を返す", async () => {
        storageMock[COMPARISON_HISTORY_STORAGE_KEY] = "invalid json{{{";
        const loaded = await loadStoredHistory();
        expect(loaded).toEqual([]);
      });

      it("保存されているデータがスキーマ不適合（不正な形式）の場合は、エラーにせず安全に空配列を返す", async () => {
        storageMock[COMPARISON_HISTORY_STORAGE_KEY] = JSON.stringify([{ invalid: "data" }]);
        const loaded = await loadStoredHistory();
        expect(loaded).toEqual([]);
      });
    });
  });
});
