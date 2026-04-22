/**
 * Pure calculation helpers. All monetary values are integer paise.
 * GST fixed at 18% (CGST 9% + SGST 9%) per spec FR-001.
 */

function calcLineTotal(qty, unitPricePaise) {
  if (!Number.isInteger(qty) || qty < 1) throw new Error("qty must be integer >= 1");
  if (!Number.isInteger(unitPricePaise) || unitPricePaise < 0) throw new Error("unitPricePaise must be non-negative integer");
  return qty * unitPricePaise;
}

function calcSubtotal(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length < 1) throw new Error("at least one line item required");
  return lineItems.reduce((sum, li) => sum + calcLineTotal(li.qty, li.unitPricePaise), 0);
}

function calcTax(subtotalPaise) {
  if (!Number.isInteger(subtotalPaise) || subtotalPaise < 0) throw new Error("subtotalPaise must be non-negative integer");
  return Math.floor((subtotalPaise * 18) / 100);
}

function calcGrandTotal(subtotalPaise, taxPaise) {
  return subtotalPaise + taxPaise;
}

function computeTotals(lineItems) {
  const enriched = lineItems.map((li) => ({
    description: li.description,
    qty: li.qty,
    unitPricePaise: li.unitPricePaise,
    lineTotalPaise: calcLineTotal(li.qty, li.unitPricePaise),
    hsnSac: li.hsnSac || null,
  }));
  const subtotalPaise = enriched.reduce((s, li) => s + li.lineTotalPaise, 0);
  const taxPaise = calcTax(subtotalPaise);
  const grandTotalPaise = calcGrandTotal(subtotalPaise, taxPaise);
  return { lineItems: enriched, subtotalPaise, taxPaise, grandTotalPaise };
}

module.exports = { calcLineTotal, calcSubtotal, calcTax, calcGrandTotal, computeTotals };
