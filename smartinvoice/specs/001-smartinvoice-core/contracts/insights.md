# Contract: AI Insights

## `GET /api/insights`

Return client payment scoring (per client) + 3-month revenue forecast, both computed via
MongoDB aggregation pipelines (Constitution VII; FR-010 through FR-014).

### Authentication

Required.

### Response `200 OK`

```json
{
  "generatedAt": "2026-04-22T10:42:00Z",
  "clients": [
    {
      "clientId": "...",
      "clientName": "Singh & Sons",
      "clientEmail": "singh@singhandsons.com",
      "paymentScore": 88,
      "riskLevel": "low",
      "invoiceCount": 14,
      "avgDaysToPay": 18,
      "onTimeRate": 0.93
    },
    {
      "clientId": "...",
      "clientName": "Reddy Exports",
      "clientEmail": "reddy@exports.co.in",
      "paymentScore": 28,
      "riskLevel": "high",
      "invoiceCount": 7,
      "avgDaysToPay": 52,
      "onTimeRate": 0.29
    },
    {
      "clientId": "...",
      "clientName": "Sharma Distributors",
      "clientEmail": "sharma@dist.co.in",
      "paymentScore": null,
      "riskLevel": "no_data",
      "invoiceCount": 0,
      "avgDaysToPay": null,
      "onTimeRate": null
    }
  ],
  "forecast": {
    "available": true,
    "months": [
      { "month": "2026-05", "projectedPaise": 6420000 },
      { "month": "2026-06", "projectedPaise": 6890000 },
      { "month": "2026-07", "projectedPaise": 7150000 }
    ],
    "basis": "weighted_sma_6m"
  }
}
```

### Insufficient-History Response

When fewer than 3 distinct calendar months of paid invoices exist (FR-013):

```json
{
  "generatedAt": "...",
  "clients": [ /* as above */ ],
  "forecast": {
    "available": false,
    "months": [],
    "reason": "insufficient_history",
    "message": "At least 3 months of paid invoice history are needed to generate a forecast."
  }
}
```

### Pipeline 1 — Client Payment Score

```js
const scorePipeline = [
  { $match: { status: { $in: ["paid", "overdue"] } } },
  { $group: {
      _id: "$clientRef.email",
      clientName: { $first: "$clientRef.name" },
      clientId:   { $first: "$clientRef.clientId" },
      invoiceCount: { $sum: 1 },
      avgDaysToPay: {
        $avg: {
          $cond: [
            { $eq: ["$status", "paid"] },
            { $dateDiff: { startDate: "$issueDate", endDate: "$paidAt", unit: "day" } },
            null
          ]
        }
      },
      onTimeCount: {
        $sum: {
          $cond: [
            { $and: [
                { $eq: ["$status", "paid"] },
                { $lte: ["$paidAt", "$dueDate"] }
            ] }, 1, 0
          ]
        }
      },
      paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } }
  } },
  { $project: {
      clientName: 1, clientId: 1, invoiceCount: 1, avgDaysToPay: 1,
      onTimeRate: { $cond: [{ $gt: ["$paidCount", 0] }, { $divide: ["$onTimeCount", "$paidCount"] }, 0] },
      score_ontime:  { $multiply: [ { $cond: [{ $gt: ["$paidCount",0] }, { $divide: ["$onTimeCount","$paidCount"] }, 0] }, 50 ] },
      score_days:    { $max: [0, { $min: [30, { $subtract: [30, { $ifNull: ["$avgDaysToPay", 0] }] } ] } ] },
      score_volume:  { $min: [20, "$invoiceCount"] }
  } },
  { $project: {
      clientName: 1, clientId: 1, invoiceCount: 1, avgDaysToPay: 1, onTimeRate: 1,
      paymentScore: {
        $round: [ { $add: ["$score_ontime","$score_days","$score_volume"] }, 0 ]
      }
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
```

After running the pipeline, the handler left-joins `clients` to include clients with **zero**
invoices (they return as `{ paymentScore: null, riskLevel: "no_data" }` per FR-014).

### Pipeline 2 — 3-Month Revenue Forecast

```js
const forecastPipeline = [
  { $match: { status: "paid", paidAt: { $ne: null } } },
  { $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
      revenuePaise: { $sum: "$grandTotalPaise" }
  } },
  { $sort: { _id: -1 } },
  { $limit: 6 }
];
```

Route handler computes the projection in JS (simpler than expressing weighted-SMA in aggregation):

```js
const monthsSorted = historicalMonths.reverse();            // oldest → newest
const weights = [1, 1, 1, 1, 1.2, 1.5].slice(-monthsSorted.length);
const weightedAvg = monthsSorted.reduce((sum, m, i) => sum + m.revenuePaise * weights[i], 0)
                  / weights.reduce((a, b) => a + b, 0);

const forecast = [];
for (let i = 1; i <= 3; i++) {
  forecast.push({
    month: addMonths(today, i).toISOString().slice(0, 7),
    projectedPaise: Math.round(weightedAvg)
  });
}
```

(A more elaborate projection can be added later without breaking the contract.)

### Performance Target

Per SC-006: `GET /api/insights` must return within **3 seconds** for datasets up to 10,000
invoices. Contract test seeds 10k invoices and measures `p95 < 3000 ms`.

### Error Handling (FR-013 + Edge Case)

If either pipeline throws, the endpoint returns `200` with per-section error flags rather
than a 5xx:

```json
{
  "clients": [],
  "forecast": { "available": false, "reason": "pipeline_error", "message": "Insights temporarily unavailable. Try refreshing." }
}
```

Frontend renders the degraded-mode banner per the Edge Case.

### Contract Tests

| Test | Expected |
|------|----------|
| No invoices | `200`, clients `[]`, `forecast.available: false, reason: "insufficient_history"` |
| 2 months of paid data | `forecast.available: false, reason: "insufficient_history"` |
| 6+ months of paid data | `forecast.available: true`, 3 months returned |
| Client with all on-time paid | `paymentScore >= 70`, `riskLevel: "low"` |
| Client with 0% on-time rate | `paymentScore < 40`, `riskLevel: "high"` |
| Client with no invoices (seeded) | `paymentScore: null, riskLevel: "no_data"` |
| 10,000 invoices seeded | `p95 latency < 3000 ms` |
| Pipeline forced to error | `200`, degraded-mode payload |
