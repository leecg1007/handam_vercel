import { describe, expect, it } from "vitest";
import { getWeekStripDates } from "../../week-calendar.js";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("home week diary calendar", () => {
  it("shows only the current Monday-to-Sunday week on Monday", () => {
    const dates = getWeekStripDates(new Date(2026, 8, 7, 12));

    expect(dates.map(dateKey)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
    expect(dates.map(dateKey)).not.toContain("2026-09-04");
  });

  it("keeps the same calendar week through Sunday", () => {
    const dates = getWeekStripDates(new Date(2026, 8, 13, 23, 59));

    expect(dates.map(dateKey)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("handles a week that crosses a year boundary", () => {
    const dates = getWeekStripDates(new Date(2027, 0, 1, 12));

    expect(dates.map(dateKey)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});
