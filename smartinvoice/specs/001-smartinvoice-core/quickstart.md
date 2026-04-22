# Quickstart: SmartInvoice Core

**Feature**: 001-smartinvoice-core
**Target**: Running app at `http://localhost:3000` with a provisioned owner and seed data.

---

## Prerequisites

- **Node.js 20.x** (`node --version` → `v20.x.x`)
- **npm 10+** (bundled with Node 20)
- **MongoDB Atlas** cluster (free M0 is fine) or local MongoDB 7.x
- A terminal with zsh / bash

---

## 1. Environment Configuration

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set:

```dotenv
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority
DB_NAME=smartinvoice

# Collections (do NOT rename in production without a migration)
COLL_INVOICES=invoices
COLL_CLIENTS=clients
COLL_COUNTERS=counters
COLL_USERS=users
COLL_SESSIONS=sessions

# Server
PORT=4000
SESSION_SECRET=<generate-via: openssl rand -base64 32>

# CORS
CORS_ORIGIN=http://localhost:3000
```

**⚠** `backend/.env` is gitignored. `backend/.env.example` is committed.
No owner credentials needed here — the first-run wizard (FR-000c) handles that.

---

## 2. Install Dependencies

```bash
cd backend  && npm install
cd ../frontend && npm install
```

---

## 3. Seed Data (Automatic)

On first startup the backend runs `seedService.js` which inserts 4 clients + 8 invoices
**only if** `invoices.countDocuments({}) === 0`. Subsequent restarts are no-ops.

| # | Client | Status | Grand Total |
|---|--------|--------|-------------|
| 1 | Mehta Traders | Paid | ₹23,600 |
| 2 | Reddy Exports | Overdue | ₹11,800 |
| 3 | Singh & Sons | Paid | ₹47,200 |
| 4 | Nair Tech | Paid | ₹61,800 |
| 5 | Mehta Traders | Pending | ₹8,260 |
| 6 | Singh & Sons | Paid | ₹15,340 |
| 7 | Reddy Exports | Pending | ₹9,440 |
| 8 | Nair Tech | Draft | ₹4,720 |

The owner account is NOT seeded — you create it via the first-run wizard below.

---

## 4. Start the Backend

```bash
cd backend
npm start
```

Expected output:

```
[config] Loaded .env
[db]     Connected to MongoDB · DB: smartinvoice
[seed]   Database empty — inserting 4 clients + 8 invoices
[seed]   ✓ Seed complete · counters.invoiceSeq = 8
[server] SmartInvoice API listening on http://localhost:4000
```

---

## 5. Start the Frontend

In a **second** terminal:

```bash
cd frontend
npm start
```

CRA opens `http://localhost:3000`. The dev-server proxies `/api/*` → `http://localhost:4000`
via `package.json → proxy`.

---

## 6. First-Run Setup Wizard (FR-000c)

On first visit, the app calls `GET /api/session` and sees `{ ownerExists: false }`, so the
login screen renders the **Setup** form instead.

1. Enter a username (e.g., `owner`)
2. Enter a password that satisfies FR-000a: **≥ 8 chars with at least one letter and one
   digit** (e.g., `hunter2025`). Shorter/weaker passwords are rejected with a 400 error.
3. Submit. You are logged in (session cookie set, 24h absolute + 30-min idle expiry).
4. The setup endpoint is now permanently disabled — subsequent visits see the normal login
   form.

---

## 7. Verify Every Use Case

### US1 — Invoice Management

1. Click **New Invoice**. Pick Mehta Traders, add a line item (qty 5, price ₹200). Verify
   subtotal ₹1,000, GST ₹180, grand total ₹1,180. Optionally add an HSN code (e.g., `6306`).
2. **Save as Draft** or **Save & Mark as Sent**.
3. On the draft's detail, click **Edit**, change the qty to 10, save — totals recompute.
4. Click **Delete** on a draft. Gap left in INV-XXXX sequence (expected per FR-005b edge case).
5. Wait for an invoice to pass its due date (or seed one with a past due date). Reload the
   list — auto-transitions to Overdue.
6. Click **Mark as Paid** on an overdue invoice. Optionally record method "upi" + reference.
7. Click **Download PDF** on any invoice. Confirm the PDF shows GSTIN, DD/MM/YYYY date,
   `₹1,23,456.78` amount formatting, CGST 9% + SGST 9% split, HSN when set, amount in words.

### US2 — Dashboard

1. Navigate to Dashboard.
2. Confirm 4 stat cards (totals + overdue count + total invoices) show non-zero values.
3. Confirm the chart shows all 12 months; zero bars for future months.
4. Confirm "Recent" shows 5 newest invoices.
5. Mark an invoice paid via US1 flow, **manually refresh** the dashboard. Revenue increases.

### US3 — AI Insights

1. Navigate to AI Insights.
2. Confirm client scoring table: each seeded client has a score (0–100), risk badge,
   invoice count, avg days-to-pay.
3. Confirm risk distribution cards sum to the total scored clients.
4. Confirm 3-month forecast cards are populated (seed provides enough history).
5. Manually add a client via Create Invoice's "Add new client". Without any invoices for them,
   their row shows "No data" — not score 0 (FR-014).

---

## 8. Verify Login Hardening

### Session expiry (FR-000b)

- Leave the app idle for 31 minutes → next request → redirected to login (idle timeout).
- Log in, then in 24h+ → absolute session expiry kicks in → redirected to login.

### Lockout (FR-000d)

1. From the login form, enter the correct username + a wrong password. Repeat 5 times.
2. On the 6th attempt (still wrong), the server responds `429 Locked` with `Retry-After: 900`
   (15 minutes). UI shows the lockout notice.
3. Correct password entered *during* lockout window → still `429`.
4. After 15 minutes, the lock expires; correct password now succeeds and the failure counter resets.

---

## 9. Run the Test Suite

```bash
cd backend
npm test -- --coverage
```

Expected:
- All suites pass.
- Coverage report: `lines >= 90%`.
- CI enforces the same threshold via `package.json → jest.coverageThreshold`.

Includes:
- Every formula in `calcService` (line total, subtotal, tax floor, grand total).
- Counter-based INV-XXXX concurrency tests.
- Lock rule enforcement on pending / paid / overdue invoices.
- Every endpoint contract in `contracts/*.md`.
- Lockout timing math.
- PDF parsed-text assertions (Rule 46 fields present).

---

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ECONNREFUSED 127.0.0.1:4000` | Backend not running or `PORT` misconfigured. |
| CORS error in browser console | `CORS_ORIGIN` must be `http://localhost:3000` exactly. |
| `MongoNetworkError` | Atlas IP allowlist / `MONGODB_URI` wrong. |
| Setup form never appears | You already created an owner. Drop the `users` collection to re-provision. |
| `429 Locked` and can't log in | Wait 15 min. Lockout auto-expires. |
| Dashboard all zeros | Mark some seed invoices paid. |
| Coverage check fails | Inspect `coverage/lcov-report/index.html`; add missing tests. |

---

## 11. Constitution Gate Reminder

Before merging to `main`:

- ✅ Every spec acceptance scenario passes (use this quickstart as the manual test script).
- ✅ Jest coverage ≥ 90% on CI.
- ✅ Constitution Check in plan.md shows all seven principles PASS.
- ✅ No items in plan.md Complexity Tracking.
