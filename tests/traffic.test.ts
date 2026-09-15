import { describe, expect, it } from "vitest";
import { summarizeSpeedIntervals, type SpeedReadingInterval } from "../src/domain/traffic";

describe("渋滞状況の集計・判定ロジック (summarizeSpeedIntervals)", () => {
  describe("正常系テスト", () => {
    it("全区間が通常速度（NORMAL）の場合は混雑度「低（low）」と判定し、渋滞なしのサマリーを生成する", () => {
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

    it("座標インデックスのない区間データでも、件数ベースで混雑度「低（low）」と判定できる", () => {
      const intervals: SpeedReadingInterval[] = [{ speed: "NORMAL" }, { speed: "NORMAL" }];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("low");
      expect(result.trafficSummary).toContain(
        "速度区間の内訳は NORMAL: 2, SLOW: 0, TRAFFIC_JAM: 0",
      );
    });

    it("前半に低速区間（SLOW）がある場合、混雑度「中（moderate）」と判定し「前半に遅れ」と通知する", () => {
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

    it("中盤に低速区間（SLOW）がある場合、混雑度「中（moderate）」と判定し「中盤に遅れ」と通知する", () => {
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

    it("後半に低速区間（SLOW）がある場合、混雑度「中（moderate）」と判定し「後半に遅れ」と通知する", () => {
      // 80〜100 が SLOW, その他 NORMAL (全体100点中、後半に低速)
      const intervals: SpeedReadingInterval[] = [
        { startPolylinePointIndex: 0, endPolylinePointIndex: 80, speed: "NORMAL" },
        { startPolylinePointIndex: 80, endPolylinePointIndex: 100, speed: "SLOW" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("moderate");
      expect(result.trafficSummary).toContain("後半に遅れが出ています");
    });

    it("激しい渋滞（TRAFFIC_JAM）がある場合、混雑度「高（high）」と判定し重点的に渋滞位置を通知する", () => {
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

    it("座標インデックスのない渋滞（TRAFFIC_JAM）データでも、混雑度「高（high）」を正しく判定できる", () => {
      const intervals: SpeedReadingInterval[] = [{ speed: "NORMAL" }, { speed: "TRAFFIC_JAM" }];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("high");
      expect(result.trafficSummary).toContain("渋滞区間が含まれます");
      expect(result.trafficSummary).toContain("TRAFFIC_JAM: 1");
    });
  });

  describe("境界値テスト", () => {
    it("開始インデックス（startPolylinePointIndex）が未設定の場合は0から開始したものとして計算する", () => {
      const intervals: SpeedReadingInterval[] = [
        { endPolylinePointIndex: 10, speed: "SLOW" }, // start undefined は 0 扱い (長10)
        { startPolylinePointIndex: 10, endPolylinePointIndex: 100, speed: "NORMAL" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("moderate");
      expect(result.trafficSummary).toContain("前半に遅れが出ています");
    });

    it("終了位置が開始位置以下または終了位置が欠落している不正な区間は無視して計算する", () => {
      const intervals: SpeedReadingInterval[] = [
        { startPolylinePointIndex: 10, endPolylinePointIndex: 10, speed: "SLOW" }, // 不正: end == start
        { startPolylinePointIndex: 20, endPolylinePointIndex: 15, speed: "SLOW" }, // 不正: end < start
        { startPolylinePointIndex: 0, speed: "SLOW" }, // 不正: end 欠落
        { startPolylinePointIndex: 0, endPolylinePointIndex: 100, speed: "NORMAL" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      // 有効な範囲は 0-100 NORMAL のみ
      expect(result.congestionLevel).toBe("low");
      expect(result.trafficSummary).toContain("大きな渋滞は検出されていません");
    });
  });

  describe("異常系テスト", () => {
    it("速度区間データが空配列の場合は、混雑度「unknown」と判定し取得不可メッセージを返す", () => {
      const result = summarizeSpeedIntervals([]);
      expect(result.congestionLevel).toBe("unknown");
      expect(result.trafficSummary).toBe("交通速度区間データは取得できませんでした。");
    });

    it("座標範囲のない不明な速度種別のみが含まれる場合は、混雑度「unknown」と判定する", () => {
      const intervals: SpeedReadingInterval[] = [
        { speed: "UNSPECIFIED" },
        { speed: "UNKNOWN_SPEED" },
      ];
      const result = summarizeSpeedIntervals(intervals);
      expect(result.congestionLevel).toBe("unknown");
      expect(result.trafficSummary).toContain("交通速度区間の一部または全部が不明です");
    });
  });
});
