# Contract: Invoice Payments

**Status**: ✅ Spec-aligned per session-3 clarification (FR-004b). The endpoint records a
single, full-amount payment per invoice — an atomic audit record. Partial payments remain
out of scope (consistent with Q8).

---

## `POST /api/invoices/:id/payments`

Record the one and only payment against an invoice; transitions the invoice to `paid`.

### Authentication

Required.

### Request Body

```json
{
  "amountPaise": 1888000,
  "paidAt":      "2026-04-22T14:30:00Z",
  "method":      "upi",                      // optional: upi | bank_transfer | cash | cheque | other
  "reference":   "UPI REF 4421XXXX"          // optional: free text
}
```

### Server-Side Validation (FR-004b)

| Check | Error |
|-------|-------|
| Invoice exists | `404 Not Found` |
| Status is `pending` or `overdue` | `409 Conflict` – "Invoice is not in a payable state" |
| `amountPaise === invoice.grandTotalPaise` (exact match) | `400 Bad Request` – "Payment must equal grand total (partial payments out of scope)" |
| `invoice.payment === null` (no prior payment) | `409 Conflict` – "Invoice is already paid" |
| `paidAt` parseable ISO-8601 | `400` |
| `method`, when set, ∈ enum | `400` |

### Effects on Success

Single atomic update of the invoice document:

```js
{ $set: {
    status: "paid",
    paidAt: request.paidAt,
    payment: {
      amountPaise: request.amountPaise,
      paidAt:      request.paidAt,
      method:      request.method ?? null,
      reference:   request.reference ?? null
    },
    updatedAt: now()
} }
```

### Response `201 Created`

```json
{
  "invoice": { /* full updated invoice, status "paid" */ },
  "payment": {
    "amountPaise": 1888000,
    "paidAt":      "2026-04-22T14:30:00Z",
    "method":      "upi",
    "reference":   "UPI REF 4421XXXX"
  }
}
```

### Equivalence With `PATCH /status`

`POST /payments` with a full-amount body is functionally equivalent to
`PATCH /api/invoices/:id/status { status:"paid" }`. Frontend picks one — we recommend
`POST /payments` because the payment method/reference audit fields are useful.

### Contract Tests

| Test | Expected |
|------|----------|
| Pending invoice, `amountPaise === grandTotalPaise` | `201`, status becomes `paid`, `payment` sub-doc populated |
| Overdue invoice, matching amount | `201`, status becomes `paid` |
| Draft invoice | `409` |
| Already paid invoice | `409` |
| `amountPaise` less than grand total | `400` (partial rejected) |
| `amountPaise` greater than grand total | `400` (overpay rejected) |
| Missing `amountPaise` | `400` |
| `method: "bitcoin"` (not in enum) | `400` |
| Invalid ISO timestamp | `400` |
| No auth cookie | `401` |
