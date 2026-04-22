function buildDashboardPipeline(year) {
  const start = new Date(`${year}-01-01T00:00:00Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00Z`);
  return [
    { $facet: {
      stats: [
        { $group: {
            _id: null,
            totalRevenuePaise:     { $sum: { $cond: [{ $eq: ["$status","paid"] }, "$grandTotalPaise", 0] } },
            totalOutstandingPaise: { $sum: { $cond: [{ $in: ["$status", ["pending","overdue"]] }, "$grandTotalPaise", 0] } },
            overdueCount:          { $sum: { $cond: [{ $eq: ["$status","overdue"] }, 1, 0] } },
            totalInvoiceCount:     { $sum: 1 }
        } }
      ],
      chart: [
        { $match: { status: "paid", paidAt: { $gte: start, $lt: end } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } }, revenuePaise: { $sum: "$grandTotalPaise" } } },
        { $sort: { _id: 1 } }
      ],
      recent: [
        { $sort: { updatedAt: -1 } },
        { $limit: 5 },
        { $project: {
            invoiceNumber: 1, status: 1, grandTotalPaise: 1, issueDate: 1,
            clientName: "$clientRef.name"
        } }
      ]
    } }
  ];
}

function normalizeChart(chartAgg, year) {
  const byMonth = new Map();
  for (const entry of chartAgg) byMonth.set(entry._id, entry.revenuePaise);
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    out.push({ month: key, revenuePaise: byMonth.get(key) || 0 });
  }
  return out;
}

module.exports = { buildDashboardPipeline, normalizeChart };
