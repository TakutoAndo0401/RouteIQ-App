import { describe, expect, it } from "vitest";
import { summarizeSpeedIntervals, type SpeedReadingInterval } from "../src/domain/traffic";

describe("summarizeSpeedIntervals (Traffic Domain)", () => {
  describe("empty or invalid input handling", () => {
    it("returns unknown when interval array is empty", () => {
      const result = summarizeSpeedIntervals([]);
      expect(result.congestionLevel).toBe("unknown");
      expect(result.trafficSummary).toBe("交通速度区間データは取得できませんでした。");
    });

    it("returns unknown when intervals contain only unrecognized speeds without polyline ranges", () => {
      const intervals: SpeedReadingInterval[] = [
        { speed: "UNSPECIFIED" },
        { speed: "UNKNOWN_SPEED" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("unknown");
      expect(result.trafficSummary).toContain("交通速度区間の一部または全部が不明です");
    });
  });

  describe("smooth traffic (low congestion)", () => {
    it("identifies low congestion when all intervals are normal with polyline ranges", () => {
      const intervals: SpeedReadingInterval[] = [
        { startPolylinePointIndex: 0, endPolylinePointIndex: 50, speed: "NORMAL" },
        { startPolylinePointIndex: 50, endPolylinePointIndex: 100, speed: "NORMAL" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("low");
      expect(result.trafficSummary).toContain("大きな渋滞は検出されていません");
      expect(result.trafficSummary).toContain("通常 100%");
      expect(result.trafficSummary).toContain("低速 0%");
      expect(result.trafficSummary).toContain("渋滞 0%");
    });

    it("identifies low congestion without polyline indices using count-based summary", () => {
      const intervals: SpeedReadingInterval[] = [{ speed: "NORMAL" }, { speed: "NORMAL" }];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("low");
      expect(result.trafficSummary).toContain(
        "速度区間の内訳は NORMAL: 2, SLOW: 0, TRAFFIC_JAM: 0",
      );
    });
  });

  describe("moderate congestion (slow intervals)", () => {
    it("detects moderate congestion in the first half of the route", () => {
      // 0〜20 が SLOW, 20〜100 が NORMAL (全体100点中、前半に低速)
      const intervals: SpeedReadingInterval[] = [
        { startPolylinePointIndex: 0, endPolylinePointIndex: 20, speed: "SLOW" },
        { startPolylinePointIndex: 20, endPolylinePointIndex: 100, speed: "NORMAL" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("moderate");
      expect(result.trafficSummary).toContain("一部で低速区間があります");
      expect(result.trafficSummary).toContain("前半に遅れが出ています");
      expect(result.trafficSummary).toContain("通常 80%");
      expect(result.trafficSummary).toContain("低速 20%");
    });

    it("detects moderate congestion in the middle of the route", () => {
      // 40〜60 が SLOW, その他 NORMAL (全体100点中、中盤に低速)
      const intervals: SpeedReadingInterval[] = [
        { startPolylinePointIndex: 0, endPolylinePointIndex: 40, speed: "NORMAL" },
        { startPolylinePointIndex: 40, endPolylinePointIndex: 60, speed: "SLOW" },
        { startPolylinePointIndex: 60, endPolylinePointIndex: 100, speed: "NORMAL" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("moderate");
      expect(result.trafficSummary).toContain("中盤に遅れが出ています");
    });

    it("detects moderate congestion in the second half of the route", () => {
      // 80〜100 が SLOW, その他 NORMAL (全体100点中、後半に低速)
      const intervals: SpeedReadingInterval[] = [
        { startPolylinePointIndex: 0, endPolylinePointIndex: 80, speed: "NORMAL" },
        { startPolylinePointIndex: 80, endPolylinePointIndex: 100, speed: "SLOW" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("moderate");
      expect(result.trafficSummary).toContain("後半に遅れが出ています");
    });
  });

  describe("heavy congestion (traffic jam intervals)", () => {
    it("detects high congestion and gives heavier weight to traffic jam positions", () => {
      // 0〜70 が NORMAL, 70〜100 が TRAFFIC_JAM
      const intervals: SpeedReadingInterval[] = [
        { startPolylinePointIndex: 0, endPolylinePointIndex: 70, speed: "NORMAL" },
        { startPolylinePointIndex: 70, endPolylinePointIndex: 100, speed: "TRAFFIC_JAM" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("high");
      expect(result.trafficSummary).toContain("渋滞区間が含まれます");
      expect(result.trafficSummary).toContain("後半に遅れが集中しています");
      expect(result.trafficSummary).toContain("渋滞 30%");
    });

    it("handles traffic jam without polyline indices gracefully", () => {
      const intervals: SpeedReadingInterval[] = [{ speed: "NORMAL" }, { speed: "TRAFFIC_JAM" }];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("high");
      expect(result.trafficSummary).toContain("渋滞区間が含まれます");
      expect(result.trafficSummary).toContain("TRAFFIC_JAM: 1");
    });
  });

  describe("edge cases with malformed ranges", () => {
    it("ignores intervals where end <= start or end is missing for weighted positioning", () => {
      const intervals: SpeedReadingInterval[] = [
        { startPolylinePointIndex: 10, endPolylinePointIndex: 10, speed: "SLOW" }, // invalid: end == start
        { startPolylinePointIndex: 20, endPolylinePointIndex: 15, speed: "SLOW" }, // invalid: end < start
        { startPolylinePointIndex: 0, speed: "SLOW" }, // missing end
        { startPolylinePointIndex: 0, endPolylinePointIndex: 100, speed: "NORMAL" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      // 有効な範囲は 0-100 NORMAL のみ
      expect(result.congestionLevel).toBe("low");
      expect(result.trafficSummary).toContain("大きな渋滞は検出されていません");
    });

    it("defaults missing startPolylinePointIndex to 0", () => {
      const intervals: SpeedReadingInterval[] = [
        { endPolylinePointIndex: 10, speed: "SLOW" }, // start undefined は 0 扱い (長10)
        { startPolylinePointIndex: 10, endPolylinePointIndex: 100, speed: "NORMAL" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("moderate");
      expect(result.trafficSummary).toContain("前半に遅れが出ています");
    });
  });
});
