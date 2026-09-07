import { describe, expect, it } from "vitest";
import { calculateCurrentStreak, calculateDiaryStats, calculateLongestStreak } from "../../diary-stats.js";

describe("diary statistics", () => {
  it("counts unique writing days but includes every entry in mood distribution", () => {
    const stats = calculateDiaryStats([
      { dateKey: "2026-09-07", mood: "평온", createdAt: "2026-09-07T09:00:00+09:00" },
      { dateKey: "2026-09-07", mood: "행복", createdAt: "2026-09-07T20:00:00+09:00" },
      { dateKey: "2026-09-08", mood: "평온", createdAt: "2026-09-08T20:00:00+09:00" },
    ]);

    expect(stats.daysWritten).toBe(2);
    expect(stats.recordCount).toBe(3);
    expect(stats.distribution.map(({ mood, count }) => [mood, count])).toEqual([["평온", 2], ["행복", 1]]);
  });

  it("breaks a dominant-mood tie with the most recently recorded mood", () => {
    const stats = calculateDiaryStats([
      { dateKey: "2026-09-05", mood: "평온", createdAt: "2026-09-05T20:00:00+09:00" },
      { dateKey: "2026-09-07", mood: "행복", createdAt: "2026-09-07T20:00:00+09:00" },
    ]);

    expect(stats.dominantMood).toBe("행복");
  });

  it("handles empty data, gaps, duplicate dates, and a year boundary", () => {
    expect(calculateDiaryStats([])).toMatchObject({ daysWritten: 0, longestStreak: 0, dominantMood: "" });
    expect(calculateLongestStreak(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-01", "2027-01-03"])).toBe(3);
    expect(calculateCurrentStreak(["2026-09-05", "2026-09-06", "2026-09-07"], "2026-09-07")).toBe(3);
    expect(calculateCurrentStreak(["2026-09-06"], "2026-09-07")).toBe(0);
  });
});
