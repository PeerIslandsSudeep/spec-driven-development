# Phase 0 Research: SmartInvoice Core

**Feature**: 001-smartinvoice-core
**Date**: 2026-04-22 (refreshed post session-3 clarifications)

---

## 1. MongoDB Driver

**Decision**: Official `mongodb@6` Node.js driver. No ODM (no Mongoose).

**Rationale**: Constitution VII favours modeling *for* MongoDB; aggregation-first design (dashboard
`$facet`, insights pipelines) is clearer with the native driver. Schema validation lives in
collection-level `$jsonSchema`, not an application ORM.

**Alternatives rejected**: Mongoose (ODM overhead, obscures aggregations); Typegoose (TypeScript-only);
Prisma (limited MongoDB support).

---

## 2. Monetary Precision — Integer Paise

**Decision**: 64-bit integers, all amounts stored as paise (1 INR = 100 paise).

**GST Formula**: `taxPaise = Math.floor(subtotalPaise * 18 / 100)` — floor (not round) prevents
overcharging by a fraction of a paisa and matches conservative Indian accounting.

**Rationale**: Floating-point rounding on 18% GST produces 0.01 paise drift — not acceptable for
GST compliance. Edge case in spec: *"All monetary amounts MUST be rounded to two decimal places
using standard commercial rounding."*

**Alternatives rejected**: `number` (IEEE-754 drift); `Decimal128` (heavier, adds no value over
integer paise for a single currency); `decimal.js` (unneeded runtime dep).

---

## 3. Atomic INV-XXXX Numbering

**Decision**: Single-document `counters` collection; increment via `findOneAndUpdate` with upsert.

```js
const { value } = await counters.findOneAndUpdate(
  { _id: "invoiceSeq" },
  { $inc: { seq: 1 } },
  { upsert: true, returnDocument: "after" }
);
const invoiceNumber = `INV-${String(value.seq).padStart(4, "0")}`;
```

Document-level atomicity guarantees FR-003 (collision-free) and SC-002 (zero duplicates)
under concurrent writes. Gaps from draft deletion are acceptable (Edge Cases).

**Alternatives rejected**: ObjectId (violates FR-002 format); distributed lock (unnecessary);
timestamp IDs (not strictly sequential).

---

## 4. Dashboard `$facet` Aggregation

**Decision**: One aggregation request with `$facet` producing stats + 12-month chart + 5
recent invoices in a single MongoDB round-trip.

**Rationale**: Four separate queries would triple latency. `$facet` runs parallel sub-pipelines
on the same input. Matches SC-003 (page-load accuracy, no polling).

**Alternatives rejected**: Per-widget endpoints (4× network); materialised views (overkill);
client-side aggregation (violates Principle VII).

---

## 5. Revenue Forecast — Weighted SMA

**Decision**: Weighted Simple Moving Average over the most recent 6 months of paid revenue,
projected 3 months forward. Weights: most-recent 1.5×, next 1.2×, then 1.0× for the rest.

**Rationale**: Spec assumption explicitly: *"simple trend-based projection; advanced ML
models out of scope."* Expressible in aggregation + JS projection step. Sub-3-months data
returns empty forecast → FR-013 message.

**Alternatives rejected**: Linear regression (more complex); ARIMA/Prophet (external ML,
violates assumption); flat average (ignores trend).

---

## 6. Client Payment Score (0–100)

**Decision**: Composite, transparent, aggregation-expressible:

| Signal | Max | Formula |
|--------|-----|---------|
| On-time payment rate | 50 | `(onTimeCount / paidCount) × 50` |
| Days-to-pay | 30 | `max(0, min(30, 30 − avgDaysLate))` |
| Invoice volume | 20 | `min(invoiceCount, 20)` |

Risk bands (FR-011): Low ≥ 70; Medium 40–69; High < 40. Zero-invoice clients → `no_data`
(FR-014), not score 0.

**Alternatives rejected**: Logistic regression (no labelled training data in v1);
single-metric score (doesn't reward volume/reliability).

---

## 7. PDF Rendering — PDFKit

**Decision**: `pdfkit@0.14` streaming directly to the HTTP response. GST Rule 46 layout.

**Scope (per FR-006b, session 3)**: Per-invoice download only, owner-initiated. No auto-email,
no bulk export, no watermarking decisions in v1.

**Rule 46 fields rendered**:

- Supplier name, address, GSTIN (from owner profile / backend config)
- Invoice number (INV-XXXX)
- Invoice date (DD/MM/YYYY, FR-015)
- Recipient name, address, GSTIN (from `invoice.clientRef`)
- HSN/SAC per line item (from `LineItem.hsnSac`, blank when omitted — FR key entity)
- Description, qty, unit, rate, taxable value per line
- CGST 9% + SGST 9% split (from `invoice.taxPaise / 2` each)
- Total taxable value, grand total
- Place of supply (from `clientRef.address.state`)
- Amount in words (custom Indian number-to-words helper)

**Alternatives rejected**: Puppeteer/Playwright HTML-to-PDF (heavy browser dep); jsPDF on
frontend (compliance authority belongs on server).

---

## 8. Testing Strategy

**Decision**: Jest + Supertest + `mongodb-memory-server`.

- **Unit** (`tests/unit/`): every formula in `calcService`, every lock rule in `invoiceService`,
  `argon2` verify in `authService`, Indian number-to-words in `numberToWords`.
- **Contract** (`tests/contract/`): one file per endpoint, Supertest hitting the Express app
  against in-memory MongoDB. Every status code, every validation.
- **Integration** (`tests/integration/`): full flow — setup owner → create client → create
  invoice → mark sent → mark paid → verify dashboard numbers.
- **Coverage**: `jest --coverage`, `coverageThreshold.global.lines: 90`, CI enforces.

**Alternatives rejected**: Mocha/Chai (Jest simpler for CRA-adjacent projects); Atlas in CI
(cost, speed, state flakiness).

---

## 9. Frontend Charting — Recharts

**Decision**: `recharts` for the 12-bar monthly revenue chart.

**Rationale**: Declarative React-native API; dark-theme friendly; ~180 KB gzipped — acceptable
for one chart. No imperative canvas code.

**Alternatives rejected**: Chart.js (Canvas-based, harder to theme); D3 directly (imperative
overkill); Nivo (heavier graph).

---

## 10. Auth Hardening — argon2id + DB-backed Sessions + Lockout

**Decision**:
- **Hashing**: `argon2id` (OWASP-recommended; stronger than bcrypt per equal compute).
- **Sessions**: opaque 256-bit token in HTTP-only `SameSite=Strict` cookie. Session documents
  in `sessions` collection with TTL index on `expiresAt`. `lastSeenAt` refreshed per request;
  idle-timeout enforced at read by comparing `now - lastSeenAt > 30 min`.
- **Lockout (FR-000d)**: embedded on the owner `users` document:
  ```js
  {
    failedAttempts: [ISODate, ISODate, ...],   // rolling 10-min window
    lockedUntil:    ISODate | null
  }
  ```
  On login:
  1. If `now < lockedUntil` → `429 Too Many Requests`.
  2. Prune `failedAttempts` older than 10 min.
  3. If password verify fails: push `now` to `failedAttempts`. If length ≥ 5: set
     `lockedUntil = now + 15 min`, clear the array.
  4. If verify succeeds: clear `failedAttempts`, null `lockedUntil`, issue session.
- **First-run setup (FR-000c)**: `POST /api/setup` permitted *only* when `users.countDocuments() === 0`.
  Creates the one owner, sets a session cookie, and the route thereafter returns `409 Conflict`.

**Rationale**: HTTP-only cookies prevent XSS token theft. TTL index auto-purges sessions
without cron. DB-backed lockout avoids a separate cache layer and survives restarts.
First-run wizard (session-3 decision) avoids env-var secrets and makes setup self-service.

**Alternatives rejected**: JWT (harder to revoke); in-memory session store (lost on restart);
Redis for lockout (unnecessary infra for single-tenant); env-var password provisioning (poor UX,
contradicts FR-000c).

---

## All NEEDS CLARIFICATION Resolved ✅

No technical unknowns block Phase 1. Constitution Check passes all seven gates.
