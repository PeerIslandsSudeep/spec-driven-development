/**
 * Aggregation pipeline for client payment scoring.
 * Score = on-time rate × 50 + max(0, 30 - avgDaysLate) + min(20, invoiceCount).
 * Bands: >=70 low, 40-69 medium, <40 high.
 */
const pipeline = [
  { $match: { status: { $in: ["paid","overdue"] } } },
  { $group: {
      _id: "$clientRef.email",
      clientName:  { $first: "$clientRef.name" },
      clientId:    { $first: "$clientRef.clientId" },
      invoiceCount: { $sum: 1 },
      paidDaysToPaySum: {
        $sum: {
          $cond: [
            { $eq: ["$status","paid"] },
            { $divide: [{ $subtract: ["$paidAt", "$issueDate"] }, 1000 * 60 * 60 * 24] },
            0
          ]
        }
      },
      onTimeCount: {
        $sum: { $cond: [ { $and: [ { $eq: ["$status","paid"] }, { $lte: ["$paidAt", "$dueDate"] } ] }, 1, 0 ] }
      },
      paidCount: { $sum: { $cond: [{ $eq: ["$status","paid"] }, 1, 0] } }
  } },
  { $project: {
      clientName: 1, clientId: 1, invoiceCount: 1, onTimeCount: 1, paidCount: 1,
      avgDaysToPay: { $cond: [{ $gt: ["$paidCount", 0] }, { $divide: ["$paidDaysToPaySum", "$paidCount"] }, null] },
      onTimeRate:   { $cond: [{ $gt: ["$paidCount", 0] }, { $divide: ["$onTimeCount", "$paidCount"] }, 0] }
  } },
  { $project: {
      clientName: 1, clientId: 1, invoiceCount: 1, avgDaysToPay: 1, onTimeRate: 1,
      score_ontime:  { $multiply: ["$onTimeRate", 50] },
      score_days:    {
        $max: [ 0, { $min: [30, { $subtract: [30, { $ifNull: ["$avgDaysToPay", 0] }] } ] } ]
      },
      score_volume:  { $min: [20, "$invoiceCount"] }
  } },
  { $project: {
      clientName: 1, clientId: 1, invoiceCount: 1, avgDaysToPay: 1, onTimeRate: 1,
      paymentScore: { $round: [ { $add: ["$score_ontime","$score_days","$score_volume"] }, 0 ] }
  } },
  { $project: {
      clientName: 1, clientId: 1, invoiceCount: 1, avgDaysToPay: 1, onTimeRate: 1, paymentScore: 1,
      riskLevel: {
        $switch: {
          branches: [
            { case: { $gte: ["$paymentScore", 70] }, then: "low" },
            { case: { $gte: ["$paymentScore", 40] }, then: "medium" }
          ],
          default: "high"
        }
      }
  } }
];

module.exports = { pipeline };
