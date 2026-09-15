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

describe("history domain logic", () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
    vi.clearAllMocks();
  });

  describe("formatHistoryDate", () => {
    it("formats date as M/D", () => {
      const date = new Date(2026, 8, 11); // 2026-09-11 (Month is 0-indexed: 8 = September)
      expect(formatHistoryDate(date)).toBe("9/11");
    });
  });

  describe("isSameRoute", () => {
    it("returns true for identical routes", () => {
      expect(
        isSameRoute(
          { origin: "東京駅", destination: "横浜駅" },
          { origin: "東京駅", destination: "横浜駅" },
        ),
      ).toBe(true);
    });

    it("ignores whitespace and case differences", () => {
      expect(
        isSameRoute(
          { origin: "  東京駅  ", destination: "横浜駅" },
          { origin: "東京駅", destination: "  横浜駅 " },
        ),
      ).toBe(true);
    });

    it("returns false for different origins or destinations", () => {
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

  describe("addOrUpdateHistoryItem", () => {
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

    it("adds a new item to the front of the list", () => {
      const result = addOrUpdateHistoryItem([item1], item2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(item2);
      expect(result[1]).toEqual(item1);
    });

    it("deduplicates identical route by removing older entry and placing updated item at the front", () => {
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

    it("limits list to maxItems (default 10) by discarding oldest items", () => {
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

  describe("removeHistoryItem", () => {
    it("removes the item with specified id", () => {
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

  describe("AsyncStorage persistence", () => {
    it("saves and loads history list accurately", async () => {
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

    it("returns empty array when nothing is stored", async () => {
      const loaded = await loadStoredHistory();
      expect(loaded).toEqual([]);
    });

    it("returns empty array safely when stored JSON is invalid", async () => {
      storageMock[COMPARISON_HISTORY_STORAGE_KEY] = "invalid json{{{";
      const loaded = await loadStoredHistory();
      expect(loaded).toEqual([]);
    });

    it("returns empty array safely when stored schema does not match", async () => {
      storageMock[COMPARISON_HISTORY_STORAGE_KEY] = JSON.stringify([{ invalid: "data" }]);
      const loaded = await loadStoredHistory();
      expect(loaded).toEqual([]);
    });

    it("clears stored history", async () => {
      storageMock[COMPARISON_HISTORY_STORAGE_KEY] = JSON.stringify([]);
      await clearStoredHistory();
      expect(storageMock[COMPARISON_HISTORY_STORAGE_KEY]).toBeUndefined();
    });
  });
});
