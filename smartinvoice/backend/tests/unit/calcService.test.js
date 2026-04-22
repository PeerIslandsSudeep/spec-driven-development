const { calcLineTotal, calcSubtotal, calcTax, calcGrandTotal, computeTotals } = require("../../src/services/calcService");

describe("calcLineTotal", () => {
  test("multiplies qty by unit price", () => {
    expect(calcLineTotal(5, 200)).toBe(1000);
    expect(calcLineTotal(10, 120000)).toBe(1200000);
  });
  test("qty must be integer >= 1", () => {
    expect(() => calcLineTotal(0, 100)).toThrow();
    expect(() => calcLineTotal(-1, 100)).toThrow();
    expect(() => calcLineTotal(1.5, 100)).toThrow();
  });
  test("unitPricePaise must be non-negative integer", () => {
    expect(() => calcLineTotal(1, -1)).toThrow();
    expect(() => calcLineTotal(1, 0.5)).toThrow();
    expect(calcLineTotal(1, 0)).toBe(0);
  });
});

describe("calcSubtotal", () => {
  test("sums line totals", () => {
    expect(calcSubtotal([{ qty: 5, unitPricePaise: 200 }, { qty: 2, unitPricePaise: 500 }])).toBe(2000);
  });
  test("requires at least one line item", () => {
    expect(() => calcSubtotal([])).toThrow();
    expect(() => calcSubtotal(null)).toThrow();
  });
});

describe("calcTax (GST 18% floor)", () => {
  test("floors to prevent overcharging", () => {
    expect(calcTax(11)).toBe(1);      // 1.98 → 1
    expect(calcTax(100)).toBe(18);
    expect(calcTax(10000)).toBe(1800);
    expect(calcTax(1000000)).toBe(180000);
  });
  test("zero subtotal yields zero tax", () => {
    expect(calcTax(0)).toBe(0);
  });
  test("rejects negative or non-integer subtotal", () => {
    expect(() => calcTax(-1)).toThrow();
    expect(() => calcTax(1.5)).toThrow();
  });
});

describe("calcGrandTotal", () => {
  test("adds subtotal and tax", () => {
    expect(calcGrandTotal(10000, 1800)).toBe(11800);
    expect(calcGrandTotal(0, 0)).toBe(0);
  });
});

describe("computeTotals (end-to-end)", () => {
  test("produces correct totals for a two-line invoice", () => {
    const r = computeTotals([
      { description: "A", qty: 10, unitPricePaise: 120000 },
      { description: "B", qty: 5,  unitPricePaise: 80000 },
    ]);
    expect(r.subtotalPaise).toBe(1600000);
    expect(r.taxPaise).toBe(288000);
    expect(r.grandTotalPaise).toBe(1888000);
    expect(r.lineItems[0].lineTotalPaise).toBe(1200000);
    expect(r.lineItems[1].lineTotalPaise).toBe(400000);
  });
  test("hsnSac is preserved or null", () => {
    const r = computeTotals([
      { description: "A", qty: 1, unitPricePaise: 100, hsnSac: "6306" },
      { description: "B", qty: 1, unitPricePaise: 100 },
    ]);
    expect(r.lineItems[0].hsnSac).toBe("6306");
    expect(r.lineItems[1].hsnSac).toBeNull();
  });
});
