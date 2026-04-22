const { computeForecast } = require("../../src/pipelines/revenueForecast");

function mkMonth(key, paise) { return { _id: key, revenuePaise: paise }; }

describe("computeForecast", () => {
  test("insufficient history (< 3 months)", () => {
    const r = computeForecast([]);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("insufficient_history");
    const r2 = computeForecast([mkMonth("2026-01", 10000), mkMonth("2026-02", 10000)]);
    expect(r2.available).toBe(false);
  });

  test("3-month forecast with 6 months of history", () => {
    const now = new Date("2026-04-22T00:00:00Z");
    const history = [
      mkMonth("2025-11", 1000000),
      mkMonth("2025-12", 1100000),
      mkMonth("2026-01", 1200000),
      mkMonth("2026-02", 1300000),
      mkMonth("2026-03", 1400000),
      mkMonth("2026-04", 1500000),
    ];
    const r = computeForecast(history, now);
    expect(r.available).toBe(true);
    expect(r.months).toHaveLength(3);
    expect(r.months[0].month).toBe("2026-05");
    expect(r.months[1].month).toBe("2026-06");
    expect(r.months[2].month).toBe("2026-07");
    expect(r.months[0].projectedPaise).toBeGreaterThan(0);
    expect(r.basis).toBe("weighted_sma_6m");
  });

  test("forecast uses only recent months with fewer than 6", () => {
    const now = new Date("2026-04-22T00:00:00Z");
    const history = [
      mkMonth("2026-02", 1000000),
      mkMonth("2026-03", 1200000),
      mkMonth("2026-04", 1500000),
    ];
    const r = computeForecast(history, now);
    expect(r.available).toBe(true);
    expect(r.months).toHaveLength(3);
  });
});
