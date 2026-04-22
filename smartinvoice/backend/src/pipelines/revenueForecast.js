const historyPipeline = [
  { $match: { status: "paid", paidAt: { $ne: null } } },
  { $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
      revenuePaise: { $sum: "$grandTotalPaise" }
  } },
  { $sort: { _id: -1 } },
  { $limit: 6 }
];

function addMonths(date, n) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + n);
  return d;
}

function computeForecast(historicalMonths, now = new Date()) {
  const sorted = [...historicalMonths].sort((a, b) => a._id.localeCompare(b._id));
  if (sorted.length < 3) return { available: false, months: [], reason: "insufficient_history", message: "At least 3 months of paid invoice history are needed to generate a forecast." };

  const weightsFull = [1, 1, 1, 1, 1.2, 1.5];
  const weights = weightsFull.slice(-sorted.length);
  const weightedSum = sorted.reduce((sum, m, i) => sum + m.revenuePaise * weights[i], 0);
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  const avg = weightedSum / weightTotal;

  const months = [];
  for (let i = 1; i <= 3; i++) {
    const d = addMonths(now, i);
    months.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      projectedPaise: Math.round(avg),
    });
  }
  return { available: true, months, basis: "weighted_sma_6m" };
}

module.exports = { historyPipeline, computeForecast };
