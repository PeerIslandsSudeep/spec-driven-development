const express = require("express");
const { collections } = require("../config/db");
const { autoTransitionOverdue } = require("../services/invoiceService");
const { buildDashboardPipeline, normalizeChart } = require("../pipelines/dashboardFacet");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    await autoTransitionOverdue();
    const { invoices } = collections();
    const year = new Date().getFullYear();
    const [raw] = await invoices.aggregate(buildDashboardPipeline(year)).toArray();
    const statsDoc = (raw && raw.stats && raw.stats[0]) || {};
    const stats = {
      totalRevenuePaise:     statsDoc.totalRevenuePaise || 0,
      totalOutstandingPaise: statsDoc.totalOutstandingPaise || 0,
      overdueCount:          statsDoc.overdueCount || 0,
      totalInvoiceCount:     statsDoc.totalInvoiceCount || 0,
    };
    const chart = normalizeChart(raw.chart || [], year);
    const recent = (raw.recent || []).map((r) => ({
      id: r._id,
      invoiceNumber: r.invoiceNumber,
      clientName: r.clientName,
      grandTotalPaise: r.grandTotalPaise,
      status: r.status,
      issueDate: r.issueDate,
    }));
    res.json({ stats, chart, recent });
  } catch (e) { next(e); }
});

module.exports = router;
