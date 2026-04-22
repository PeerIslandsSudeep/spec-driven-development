# Contract: Invoices

All routes require authentication. Reject with `401` if no valid session cookie.

---

## `GET /api/invoices`

List invoices with pagination and optional status filter.

### Query Parameters

| Name | Type | Default | Notes |
|------|------|---------|-------|
| `status` | string | (all) | One of `draft \| pending \| paid \| overdue`; omit for all |
| `page` | int | 1 | 1-indexed |
| `pageSize` | int | 10 | Max 100 |
| `q` | string | — | Search by client name substring or INV-XXXX number |
| `sort` | string | `createdAt:-1` | `createdAt`, `grandTotalPaise`, `dueDate`; suffix `:1` asc, `:-1` desc |

### Overdue Auto-Transition

Before responding, the handler runs an atomic update to transition eligible pending invoices
to overdue (per spec Assumption: on-demand check):

```js
await invoices.updateMany(
  { status: "pending", dueDate: { $lt: now } },
  { $set: { status: "overdue", updatedAt: now } }
);
```

### Response `200 OK`

```json
{
  "invoices": [ /* array of invoice objects, same shape as GET /api/invoices/:id */ ],
  "page": 1,
  "pageSize": 10,
  "total": 54,
  "totalPages": 6
}
```

### Contract Tests

| Test | Expected |
|------|----------|
| No filter, seed data present | 200, `total >= 8` |
| `?status=draft` | All returned items have `status: "draft"` |
| `?status=foo` | `400 Bad Request` |
| `?pageSize=200` | Clamped or rejected; documented behaviour: reject with `400` |
| Overdue auto-transition | Pending invoice past due date returned as `overdue` |
| `?q=INV-0001` | Returns exactly that invoice |
| `?q=Mehta` | Returns all invoices with client name containing "Mehta" |

---

## `POST /api/invoices`

Create a new invoice (starts in `draft` status).

### Request Body

```json
{
  "clientId": "...",
  "lineItems": [
    { "description": "Tarpaulin 20x30 ft", "qty": 10, "unitPricePaise": 120000 }
  ],
  "issueDate": "2026-04-22",
  "dueDate": "2026-05-22",
  "notes": ""
}
```

### Server-Side Computed Fields

The server **ignores** any `lineTotalPaise`, `subtotalPaise`, `taxPaise`, `grandTotalPaise`,
`invoiceNumber`, `status`, `sentAt`, `paidAt` in the request — they are derived:

- `lineTotalPaise = qty × unitPricePaise` (for each line)
- `subtotalPaise = Σ lineTotalPaise`
- `taxPaise = Math.floor(subtotalPaise × 18 / 100)`
- `grandTotalPaise = subtotalPaise + taxPaise`
- `invoiceNumber = INV-{nextSeq}` from `counters` collection (atomic)
- `status = "draft"`, `sentAt = null`, `paidAt = null`
- `createdAt = updatedAt = now()`

### Response `201 Created`

```json
{
  "id": "...",
  "invoiceNumber": "INV-0055",
  "status": "draft",
  "grandTotalPaise": 1888000,
  /* full invoice object */
}
```

### Validation Errors `400 Bad Request`

- `lineItems` empty or missing → `{ error: "At least one line item required" }`
- `clientId` not found → `{ error: "Client not found" }`
- `qty < 1` or `unitPricePaise < 0` → `{ error: "Invalid line item" }`
- `dueDate < issueDate` → `{ error: "Due date must be on or after issue date" }`

### Contract Tests

| Test | Expected |
|------|----------|
| Valid request, known client | `201`, `invoiceNumber` matches `INV-\d{4,}`, totals correct |
| Empty `lineItems` | `400` |
| `qty: 0` | `400` |
| Unknown `clientId` | `400` |
| GST calc: subtotal 100 paise, 18% → tax 18 | `taxPaise === 18` |
| GST floor: subtotal 11 paise, 18% → tax 1 (not 1.98) | `taxPaise === 1` |
| Two concurrent creates | Two distinct, strictly sequential INV-XXXX values |

---

## `GET /api/invoices/:id`

Return a single invoice by its `_id`.

### Response `200 OK`

Full invoice document (see `data-model.md` → `invoices` collection).

### `404 Not Found`

```json
{ "error": "Invoice not found" }
```

### Contract Tests

| Test | Expected |
|------|----------|
| Known id | `200`, full shape |
| Unknown id | `404` |
| Invalid ObjectId format | `400` |
| Overdue auto-transition on read | Pending past-due invoice returned as `overdue` |

---

## `PATCH /api/invoices/:id/status`

Transition an invoice's status. Replaces the older "Mark as Sent" / "Mark as Paid" buttons
with a single RESTful endpoint.

### Request Body

```json
{ "status": "pending" }     // or "paid"
```

### Allowed Transitions

| From | To | Side Effects |
|------|----|---------------|
| `draft` | `pending` | Set `sentAt = now()` |
| `pending` | `paid` | Set `paidAt = now()` |
| `overdue` | `paid` | Set `paidAt = now()` |

### Forbidden Transitions → `400 Bad Request`

- Any transition not in the table above (e.g., `paid → draft`, `pending → draft`).
- Any attempt to modify a locked invoice's *other* fields via this endpoint.

### `PATCH /api/invoices/:id` (full update of draft fields)

Only permitted when the current status is `draft`. Accepts same body shape as POST. Rejects
with `403 Forbidden` if status is `pending`, `paid`, or `overdue` (FR-004a).

### Contract Tests

| Test | Expected |
|------|----------|
| Draft → pending | `200`, `sentAt` set |
| Pending → paid | `200`, `paidAt` set |
| Overdue → paid | `200`, `paidAt` set |
| Paid → draft | `400`, unchanged |
| Pending → draft | `400`, unchanged |
| PATCH body on locked invoice | `403` |

---

## `DELETE /api/invoices/:id`

Hard-delete a draft invoice. FR-005b.

### Allowed Only When `status === "draft"`

### Response `204 No Content` on success.

### `403 Forbidden` when status is not `draft`:

```json
{ "error": "Sent invoices cannot be deleted (audit/compliance)" }
```

### Contract Tests

| Test | Expected |
|------|----------|
| Draft → delete | `204`; subsequent GET returns `404` |
| Pending → delete | `403`, invoice still exists |
| Paid → delete | `403`, invoice still exists |
| Overdue → delete | `403`, invoice still exists |
| Sequence gap | Next POST assigns next counter value; deleted number not reused |

---

## `GET /api/invoices/export.csv`

Download the current invoice list (honouring active `?status` filter) as CSV for import into
Tally / Excel (FR-006a).

### Response `200 OK`

- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="invoices-YYYYMMDD.csv"`
- Body: CSV with header row:
  `Invoice Number, Client Name, Client Email, Client GSTIN, Subtotal (INR), GST (INR), Grand Total (INR), Status, Issue Date, Due Date, Payment Date`
- Amounts rendered in INR with lakh/crore grouping (FR-015).
- Dates rendered as `DD/MM/YYYY` (FR-015).

### Contract Tests

| Test | Expected |
|------|----------|
| With no filter | All invoices present in CSV |
| With `?status=paid` | Only paid invoices present |
| Amounts formatted with lakh/crore grouping | `1,23,456.78` not `123,456.78` |
| Empty result set | Only header row, body blank |
