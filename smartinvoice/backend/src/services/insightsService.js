const { collections } = require("../config/db");
const { pipeline: scorePipeline } = require("../pipelines/paymentScore");
const { historyPipeline, computeForecast } = require("../pipelines/revenueForecast");

async function computeInsights() {
  const generatedAt = new Date();
  let clientsOut = [];
  let forecastOut = { available: false, months: [], reason: "insufficient_history" };

  try {
    const { invoices, clients } = collections();

    const scored = await invoices.aggregate(scorePipeline).toArray();
    const scoredMap = new Map(scored.map((r) => [String(r._id), r]));

    const allClients = await clients.find({}).toArray();
    clientsOut = allClients.map((c) => {
      const s = scoredMap.get(c.email);
      if (!s) {
        return {
          clientId: c._id, clientName: c.name, clientEmail: c.email,
          paymentScore: null, riskLevel: "no_data",
          invoiceCount: 0, avgDaysToPay: null, onTimeRate: null,
        };
      }
      return {
        clientId: s.clientId, clientName: s.clientName, clientEmail: c.email,
        paymentScore: s.paymentScore,
        riskLevel: s.riskLevel,
        invoiceCount: s.invoiceCount,
        avgDaysToPay: s.avgDaysToPay ? Math.round(s.avgDaysToPay) : null,
        onTimeRate: s.onTimeRate != null ? Math.round(s.onTimeRate * 100) / 100 : null,
      };
    });

    const history = await invoices.aggregate(historyPipeline).toArray();
    forecastOut = computeForecast(history, generatedAt);
  } catch (err) {
    console.error("[insights] pipeline error:", err);
    forecastOut = { available: false, months: [], reason: "pipeline_error", message: "Insights temporarily unavailable. Try refreshing." };
  }

  return { generatedAt, clients: clientsOut, forecast: forecastOut };
}

module.exports = { computeInsights };
