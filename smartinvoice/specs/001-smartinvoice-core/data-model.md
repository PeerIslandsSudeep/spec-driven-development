# Data Model: SmartInvoice Core

**Storage**: MongoDB Atlas (system of record — Constitution VII)
**Driver**: `mongodb@6` (official Node.js driver, no Mongoose)
**Monetary unit**: All amount fields are 64-bit integers representing **paise** (1 INR = 100 paise)

---

## Access Patterns → Collection Map

| Use Case | Query | Collection(s) |
|----------|-------|----------------|
| First-run setup (create owner) | `users.countDocuments() === 0` gate + `users.insertOne` | `users` |
| Login + throttle check | `users.findOne({ username })` then embedded-array update | `users` |
| Session auth | `sessions.findOne({ _id })` | `sessions` |
| List invoices (paginated, filtered, search) | `find({ status })` + pagination + `$regex` on invoiceNumber/clientName | `invoices` |
| Create invoice (atomic INV-XXXX) | `counters.findOneAndUpdate` + `invoices.insertOne` | `counters`, `invoices` |
| Invoice detail | `findOne({ _id })` | `invoices` |
| Dashboard (stats + chart + recent) | Single `$facet` pipeline | `invoices` |
| Insights — payment score | `$group` by `clientRef.email`, left-join zero-invoice clients | `invoices`, `clients` |
| Insights — 3-month forecast | `$group` by month of `paidAt` + JS projection | `invoices` |
| CSV export | Same as list invoices | `invoices` |
| PDF export | `invoices.findOne({ _id })` + render via PDFKit | `invoices` |

---

## Collection: `invoices`

`lineItems` is embedded (Constitution VII: embedding by default). `clientRef` denormalises
client name/email/GSTIN to eliminate `$lookup` on every list + dashboard read; authoritative
copy remains in `clients`.

### Document Shape (example)

```json
{
  "_id": ObjectId("..."),
  "invoiceNumber": "INV-0055",
  "status": "pending",
  "clientRef": {
    "clientId": ObjectId("..."),
    "name":  "Mehta Traders",
    "email": "mehta@tarpaulinco.in",
    "gstin": "29AADCE3455F1Z5"
  },
  "lineItems": [
    { "description": "Tarpaulin 20x30 ft", "qty": 10, "unitPricePaise": 120000, "lineTotalPaise": 1200000, "hsnSac": "6306" },
    { "description": "HDPE Rope",          "qty": 5,  "unitPricePaise":  80000, "lineTotalPaise":  400000, "hsnSac": null }
  ],
  "subtotalPaise":    1600000,
  "taxPaise":          288000,
  "grandTotalPaise":  1888000,
  "issueDate": ISODate("2026-04-21"),
  "dueDate":   ISODate("2026-05-21"),
  "sentAt":    ISODate("2026-04-21T10:42:00Z"),
  "paidAt":    null,
  "payment":   null,                       // populated on atomic "Mark as Paid" (FR-004b)
  "notes":     "",
  "createdAt": ISODate("2026-04-21T10:41:22Z"),
  "updatedAt": ISODate("2026-04-21T10:42:00Z")
}
```

### `$jsonSchema` Validator

```js
{
  $jsonSchema: {
    bsonType: "object",
    required: ["invoiceNumber","status","clientRef","lineItems",
               "subtotalPaise","taxPaise","grandTotalPaise",
               "issueDate","dueDate","createdAt"],
    properties: {
      invoiceNumber: { bsonType: "string", pattern: "^INV-[0-9]{4,}$" },
      status:        { enum: ["draft","pending","paid","overdue"] },
      clientRef: {
        bsonType: "object",
        required: ["clientId","name","email"],
        properties: {
          clientId: { bsonType: "objectId" },
          name:     { bsonType: "string", minLength: 1 },
          email:    { bsonType: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
          gstin:    { bsonType: ["string","null"] }
        }
      },
      lineItems: {
        bsonType: "array", minItems: 1,
        items: {
          bsonType: "object",
          required: ["description","qty","unitPricePaise","lineTotalPaise"],
          properties: {
            description:    { bsonType: "string", minLength: 1 },
            qty:            { bsonType: "int", minimum: 1 },
            unitPricePaise: { bsonType: "long", minimum: 0 },
            lineTotalPaise: { bsonType: "long", minimum: 0 },
            hsnSac:         { bsonType: ["string","null"], pattern: "^[0-9A-Z]{4,8}$" }
          }
        }
      },
      subtotalPaise:   { bsonType: "long", minimum: 0 },
      taxPaise:        { bsonType: "long", minimum: 0 },
      grandTotalPaise: { bsonType: "long", minimum: 0 },
      issueDate: { bsonType: "date" },
      dueDate:   { bsonType: "date" },
      sentAt:    { bsonType: ["date","null"] },
      paidAt:    { bsonType: ["date","null"] },
      payment: {
        bsonType: ["object","null"],
        required: ["amountPaise","paidAt"],
        properties: {
          amountPaise: { bsonType: "long", minimum: 1 },
          paidAt:      { bsonType: "date" },
          method:      { enum: ["upi","bank_transfer","cash","cheque","other", null] },
          reference:   { bsonType: ["string","null"] }
        }
      },
      notes:     { bsonType: ["string","null"] },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    }
  }
}
```

### Indexes

| Index | Purpose |
|-------|---------|
| `{ invoiceNumber: 1 }` unique | FR-002 / FR-003 uniqueness |
| `{ status: 1, createdAt: -1 }` | Invoice list filter + sort |
| `{ "clientRef.email": 1 }` | Insights grouping by client |
| `{ dueDate: 1, status: 1 }` | Overdue auto-transition sweep |
| `{ paidAt: 1 }` sparse | Chart + forecast pipelines |

### State Transitions (FR-004)

```
draft ──(Mark as Sent)──▶ pending ──(due date passed)──▶ overdue
                             │                               │
                             └──────(Mark as Paid)──────────┤
                                                             ▼
                                                           paid
```

- `draft → pending`: sets `sentAt = now()`; line items / amounts locked thereafter.
- `pending → overdue`: computed on-demand at read time (spec Assumption).
- `pending/overdue → paid`: sets `paidAt = now()`; records `payment` sub-document (FR-004b).
- Reverse transitions forbidden.
- `draft` hard-delete permitted (FR-005b); INV-XXXX gaps acceptable.
- Non-draft invoices cannot be deleted (FR-005b).

### Validation Rules

| Rule | Source | Enforcement |
|------|--------|-------------|
| ≥ 1 line item | FR-001 implied | `$jsonSchema.lineItems.minItems: 1` + service layer |
| `lineTotalPaise = qty × unitPricePaise` | plan formula | Server recomputes; client-provided values ignored |
| `subtotalPaise = Σ lineTotalPaise` | plan formula | Server recomputes |
| `taxPaise = Math.floor(subtotalPaise × 18 / 100)` | plan formula | Server recomputes |
| `grandTotalPaise = subtotalPaise + taxPaise` | plan formula | Server recomputes |
| No edits once non-draft | FR-004a | Service layer rejects |
| Payment amount must equal `grandTotalPaise` | FR-004b | POST /payments contract |
| INV-XXXX unique & monotonic | FR-002 / FR-003 | Unique index + atomic counter |
| HSN/SAC optional, 4–8 alphanumeric | FR key entity | `$jsonSchema` pattern when present |

---

## Collection: `clients`

### Document Shape

```json
{
  "_id": ObjectId("..."),
  "name":  "Mehta Traders",
  "email": "mehta@tarpaulinco.in",
  "phone": "+91 98765 43210",
  "address": {
    "line1":   "14 Industrial Estate",
    "line2":   "Phase II",
    "city":    "Bengaluru",
    "state":   "Karnataka",
    "pincode": "560058"
  },
  "gstin":     "29AADCE3455F1Z5",
  "createdAt": ISODate("2026-01-15T09:00:00Z")
}
```

### `$jsonSchema` Validator

```js
{
  $jsonSchema: {
    bsonType: "object",
    required: ["name","email","address","createdAt"],
    properties: {
      name:  { bsonType: "string", minLength: 1 },
      email: { bsonType: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
      phone: { bsonType: ["string","null"] },
      address: {
        bsonType: "object",
        required: ["line1","city","state","pincode"],
        properties: {
          line1:   { bsonType: "string" },
          line2:   { bsonType: ["string","null"] },
          city:    { bsonType: "string" },
          state:   { bsonType: "string" },
          pincode: { bsonType: "string", pattern: "^[0-9]{6}$" }
        }
      },
      gstin: {
        bsonType: ["string","null"],
        pattern: "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
      },
      createdAt: { bsonType: "date" }
    }
  }
}
```

### Indexes

| Index | Purpose |
|-------|---------|
| `{ email: 1 }` unique | FR-005a email uniqueness |
| `{ name: 1 }` | Client picker autocomplete |

---

## Collection: `counters`

```json
{ "_id": "invoiceSeq", "seq": 55 }
```

```js
{ $jsonSchema: {
    bsonType: "object",
    required: ["_id","seq"],
    properties: { _id: { bsonType: "string" }, seq: { bsonType: "int", minimum: 0 } }
} }
```

Access pattern (always):
```js
await counters.findOneAndUpdate(
  { _id: "invoiceSeq" },
  { $inc: { seq: 1 } },
  { upsert: true, returnDocument: "after" }
);
```

---

## Collection: `users`

Holds the single owner account (single-tenant). Records authentication state and failed-login
tracking (FR-000c, FR-000d).

### Document Shape

```json
{
  "_id": ObjectId("..."),
  "username": "owner",
  "passwordHash": "$argon2id$v=19$...",
  "createdAt": ISODate("2026-04-22T09:00:00Z"),
  "failedAttempts": [
    ISODate("2026-04-22T09:15:00Z"),
    ISODate("2026-04-22T09:15:30Z")
  ],
  "lockedUntil": null
}
```

### `$jsonSchema` Validator

```js
{ $jsonSchema: {
    bsonType: "object",
    required: ["username","passwordHash","createdAt"],
    properties: {
      username:       { bsonType: "string", minLength: 1 },
      passwordHash:   { bsonType: "string", pattern: "^\\$argon2" },
      createdAt:      { bsonType: "date" },
      failedAttempts: { bsonType: "array", items: { bsonType: "date" } },
      lockedUntil:    { bsonType: ["date","null"] }
    }
} }
```

### Indexes

| Index | Purpose |
|-------|---------|
| `{ username: 1 }` unique | Login lookup |

### Security Invariants

- `passwordHash` stored via `argon2id`; SC-008 prohibits plaintext at any layer.
- `failedAttempts` pruned to the rolling 10-minute window on every login attempt.
- `lockedUntil` expires naturally; no permanent lockout (FR-000d).

---

## Collection: `sessions`

### Document Shape

```json
{
  "_id":        "a1b2c3d4...",       // opaque 256-bit session token
  "userId":     ObjectId("..."),
  "createdAt":  ISODate("2026-04-22T09:00:00Z"),
  "lastSeenAt": ISODate("2026-04-22T09:30:00Z"),
  "expiresAt":  ISODate("2026-04-23T09:00:00Z")
}
```

### `$jsonSchema` Validator

```js
{ $jsonSchema: {
    bsonType: "object",
    required: ["_id","userId","createdAt","lastSeenAt","expiresAt"],
    properties: {
      _id:        { bsonType: "string" },
      userId:     { bsonType: "objectId" },
      createdAt:  { bsonType: "date" },
      lastSeenAt: { bsonType: "date" },
      expiresAt:  { bsonType: "date" }
    }
} }
```

### Indexes

| Index | Purpose |
|-------|---------|
| `{ expiresAt: 1 }` TTL `expireAfterSeconds: 0` | Auto-purge on absolute expiry (FR-000b) |

### Lifecycle

- `createdAt` + 24 h = `expiresAt` (absolute TTL — FR-000b).
- `lastSeenAt` refreshed every authenticated request; middleware rejects when
  `now − lastSeenAt > 30 min` (idle timeout — FR-000b).
- Logout = `deleteOne({ _id })`.

---

## Derived (Not Persisted) Entities

### `PaymentInsight` — produced by `/api/insights`

```json
{
  "clientId":    "...",
  "clientName":  "Mehta Traders",
  "clientEmail": "mehta@tarpaulinco.in",
  "paymentScore": 61,
  "riskLevel":   "medium",
  "invoiceCount": 9,
  "avgDaysToPay": 34,
  "onTimeRate":   0.67
}
```

Zero-invoice clients → `{ paymentScore: null, riskLevel: "no_data" }` (FR-014).

### `RevenueForecast` — produced by `/api/insights`

```json
{ "month": "2026-05", "projectedPaise": 6420000, "basis": "weighted_sma_6m" }
```

When < 3 months of paid history → `{ forecast: [], reason: "insufficient_history" }` (FR-013).

---

## Seed Data (idempotent on backend startup)

- Inserts only when `invoices.countDocuments({}) === 0`.
- 4 clients + 8 invoices spanning Jan–Apr 2026; mix of statuses (2 draft, 2 pending, 1 overdue,
  3 paid) designed to produce meaningful AI insights on first run.
- `counters` set to `{_id: "invoiceSeq", seq: 8}` after seeding.
- `users` / `sessions` are NOT seeded — owner is created by the first-run wizard (FR-000c).
