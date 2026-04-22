# Contract: Dashboard

## `GET /api/dashboard`

Returns all dashboard data (4 stats + 12-month chart + 5 recent invoices) in a single
response, produced by one MongoDB `$facet` pipeline.

### Authentication

Required. Reject with `401` if no valid session cookie.

### Request

- No query parameters in v1.
- Method: `GET`
- Content-Type: n/a

### Response `200 OK`

```json
{
  "stats": {
    "totalRevenuePaise": 47230000,
    "totalOutstandingPaise": 11800000,
    "overdueCount": 4,
    "totalInvoiceCount": 54
  },
  "chart": [
    { "month": "2026-01", "revenuePaise": 2850000 },
    { "month": "2026-02", "revenuePaise": 3920000 },
    { "month": "2026-03", "revenuePaise": 5060000 },
    { "month": "2026-04", "revenuePaise": 6000000 },
    { "month": "2026-05", "revenuePaise": 0 },
    { "month": "2026-06", "revenuePaise": 0 },
    { "month": "2026-07", "revenuePaise": 0 },
    { "month": "2026-08", "revenuePaise": 0 },
    { "month": "2026-09", "revenuePaise": 0 },
    { "month": "2026-10", "revenuePaise": 0 },
    { "month": "2026-11", "revenuePaise": 0 },
    { "month": "2026-12", "revenuePaise": 0 }
  ],
  "recent": [
    {
      "id": "...",
      "invoiceNumber": "INV-0054",
      "clientName": "Mehta Traders",
      "grandTotalPaise": 2360000,
      "status": "pending",
      "issueDate": "2026-04-15"
    }
    // … up to 5 items
  ]
}
```

### Backing Pipeline (shape)

```js
[
  { $facet: {
      stats: [
        { $group: {
            _id: null,
            totalRevenuePaise:      { $sum: { $cond: [{ $eq: ["$status","paid"] }, "$grandTotalPaise", 0] } },
            totalOutstandingPaise:  { $sum: { $cond: [{ $in: ["$status",["pending","overdue"]] }, "$grandTotalPaise", 0] } },
            overdueCount:           { $sum: { $cond: [{ $eq: ["$status","overdue"] }, 1, 0] } },
            totalInvoiceCount:      { $sum: 1 }
        } }
      ],
      chart: [
        { $match: { status: "paid", paidAt: { $gte: ISODate("2026-01-01"), $lt: ISODate("2027-01-01") } } },
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
]
```

### Chart Normalization

The raw aggregation returns only months with paid revenue. The route handler fills the 12-month
array with zero entries for missing months so the frontend receives a stable-length series
(SC-004: "covers all 12 months, showing zero for months with no revenue, with no missing months").

### Response `401 Unauthorized`

```json
{ "error": "Authentication required" }
```

### Empty State

When `invoices.countDocuments() === 0`, the `stats` object returns all zeros, `chart` returns
12 zero entries, and `recent` returns `[]`. Frontend displays the "Create your first invoice"
empty state (per Edge Cases).

### Contract Tests (required, per Constitution VI)

| Test | Expected |
|------|----------|
| Auth: no cookie → 401 | `401`, error body |
| Empty DB → all-zero dashboard | `200`, stats all 0, chart 12×0, recent `[]` |
| One paid invoice in current month | `totalRevenuePaise` equals that invoice's grand total |
| One overdue invoice | `overdueCount: 1`, contributes to `totalOutstandingPaise` |
| 6 invoices created, different dates | `recent` has 5 sorted by `updatedAt` desc |
| 12-month chart completeness | Always returns exactly 12 entries regardless of data |
