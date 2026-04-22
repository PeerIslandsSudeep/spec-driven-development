# Implementation Plan: SmartInvoice Core

**Branch**: `001-smartinvoice-core` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-smartinvoice-core/spec.md`

## Summary

Single-tenant invoice manager for Indian SMBs implementing three use cases — Invoice Management
(US1), Dashboard (US2), AI Insights (US3) — on a Node.js + Express backend and a Create React
App frontend, backed by MongoDB Atlas with the official driver (no Mongoose). All monetary
amounts are stored as integer paise to eliminate floating-point rounding. INV-XXXX numbers
are generated atomically via a dedicated `counters` collection. AI insights and dashboard
aggregations run entirely inside MongoDB pipelines. First-run setup wizard provisions the
owner account (FR-000c); login throttling, password hashing, and session TTL are all enforced
server-side (FR-000a/b/d). Per-invoice PDF download is GST-Rule-46-compliant (FR-006b).

## Technical Context

**Language/Version**: Node.js 20.x (backend), React 18 via Create React App 5.x (frontend)
**Primary Dependencies**:
  - Backend: `express@4`, `mongodb@6`, `cors`, `dotenv`, `pdfkit@0.14`, `argon2`, `jest`, `supertest`, `mongodb-memory-server`
  - Frontend: `react@18`, `react-router-dom@6`, `recharts`
**Storage**: MongoDB Atlas. Collections: `invoices`, `clients`, `counters`, `users`, `sessions`. All amounts stored as 64-bit integer paise.
**Testing**: Jest (unit + integration) + Supertest (HTTP) + `mongodb-memory-server` (isolated CI runs). Coverage threshold ≥ 90% enforced.
**Target Platform**: Local development on Node 20 (macOS / Linux / Windows). Backend `:4000`, frontend `:3000`. CRA dev-server proxies `/api/*` to backend.
**Project Type**: Web application (split `backend/` + `frontend/`).
**Performance Goals**: Dashboard load < 1 s p95; Invoice List < 1 s for 10k invoices; AI Insights < 3 s p95 (SC-006); Invoice create round-trip < 500 ms; PDF download < 1.5 s.
**Constraints**: Indian locale throughout (DD/MM/YYYY + lakh/crore per FR-015). CORS strictly `http://localhost:3000` in dev. No hard-coded URIs / DB names / collection names — all via `.env`.
**Scale/Scope**: Single-tenant; 10k invoices × 500 clients target; 1 concurrent user. 9 REST endpoints (auth: setup/login/logout + invoices CRUD/status/export/PDF + payments + dashboard + insights). 5 collections. 5 frontend screens + login/setup.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Compliance | Evidence |
|---|-----------|------------|----------|
| I | Spec is source of truth | ✅ PASS | All plan elements map to FR-000…FR-015 (15 clarifications resolved) |
| II | Spec before code | ✅ PASS | 15 clarifications across 3 sessions before any code |
| III | Human-reviewable specs | ✅ PASS | Contracts quote spec Given/When/Then scenarios verbatim |
| IV | Layered spec hierarchy | ✅ PASS | Prior divergences (PDF, `/payments`) resolved via spec amendment in session 3 |
| V | Minimal specification | ✅ PASS | Minimum deps: no ORM, no state library, single chart lib |
| VI | Continuous validation | ✅ PASS | Jest ≥ 90% coverage in CI; every calc + validation + endpoint tested |
| VII | MongoDB-first data modeling | ✅ PASS | `$jsonSchema` on all 5 collections; embedding for LineItems; `$facet` dashboard; aggregation-pipeline insights |

**Overall**: ✅ **PASS** — all gates clear. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-smartinvoice-core/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (MongoDB schemas + $jsonSchema)
├── quickstart.md        # Phase 1 output (run the app end-to-end)
├── contracts/           # Phase 1 output
│   ├── auth.md          # Setup + login + logout + throttling
│   ├── dashboard.md
│   ├── invoices.md
│   ├── invoice-payments.md
│   ├── invoice-pdf.md
│   └── insights.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks — not yet created)
```

### Source Code (repository root)

```text
backend/
├── server.js                    # Express entry; binds PORT (default 4000)
├── package.json                 # scripts: start, test, test:coverage, jest.coverageThreshold.lines=90
├── .env.example                 # Committed template
├── src/
│   ├── config/
│   │   └── db.js                # MongoClient + collection accessors (all names from .env)
│   ├── middleware/
│   │   ├── auth.js              # Session-cookie verification + idle-timeout refresh (FR-000b)
│   │   ├── throttle.js          # Login throttle / lockout (FR-000d)
│   │   └── error.js             # Central error handler
│   ├── routes/
│   │   ├── auth.js              # POST /api/setup, POST /api/login, POST /api/logout, GET /api/session
│   │   ├── dashboard.js         # GET /api/dashboard ($facet aggregation)
│   │   ├── invoices.js          # CRUD + status transitions + CSV export
│   │   ├── payments.js          # POST /api/invoices/:id/payments
│   │   ├── pdf.js               # GET /api/invoices/:id/pdf (PDFKit streaming)
│   │   └── insights.js          # GET /api/insights
│   ├── services/
│   │   ├── calcService.js       # Pure functions: calcLineTotal, calcSubtotal, calcTax, calcGrandTotal
│   │   ├── invoiceService.js    # Business logic + counter-based INV-XXXX generation + lock rules
│   │   ├── insightsService.js   # Payment scoring + revenue forecast pipelines
│   │   ├── pdfService.js        # GST Rule 46 renderer (PDFKit)
│   │   ├── numberToWords.js     # Indian number-to-words (for PDF "Amount in words")
│   │   ├── authService.js       # argon2id hashing, setup, login, lockout state
│   │   └── seedService.js       # Idempotent seed (4 clients + 8 invoices)
│   └── pipelines/
│       ├── dashboardFacet.js
│       ├── paymentScore.js
│       └── revenueForecast.js
└── tests/
    ├── unit/
    │   ├── calcService.test.js       # Every formula (line total, subtotal, tax floor, grand total)
    │   ├── invoiceService.test.js    # INV-XXXX counter, lock rules, validations
    │   ├── numberToWords.test.js     # PDF amount-in-words
    │   └── authService.test.js       # argon2 verify, lockout window math
    ├── contract/
    │   ├── auth.test.js              # setup, login, logout, throttling
    │   ├── dashboard.test.js
    │   ├── invoices.test.js
    │   ├── payments.test.js
    │   ├── pdf.test.js               # Assert Rule 46 fields present in PDF
    │   └── insights.test.js
    └── integration/
        └── fullFlow.test.js          # Setup owner → create client → create invoice → send → pay → dashboard updated

frontend/
├── package.json                 # "proxy": "http://localhost:4000"
├── public/
├── src/
│   ├── App.jsx                  # Router + dark theme provider
│   ├── index.css                # Theme tokens (dark bg + MongoDB green #00684A accent)
│   ├── api/client.js            # fetch wrapper for /api/*
│   ├── hooks/
│   │   ├── useSession.js
│   │   ├── useDashboard.js
│   │   ├── useInvoices.js
│   │   └── useInsights.js
│   ├── utils/format.js          # formatINR (paise → ₹ lakh/crore), formatDate (DD/MM/YYYY)
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── Topbar.jsx
│   │   ├── StatCard.jsx
│   │   ├── MonthlyRevenueChart.jsx
│   │   ├── InvoiceTable.jsx
│   │   ├── InvoiceForm.jsx
│   │   ├── LineItemsEditor.jsx   # Includes optional HSN/SAC field
│   │   ├── ClientPicker.jsx
│   │   ├── StatusBadge.jsx
│   │   ├── Timeline.jsx
│   │   ├── ScoreBar.jsx
│   │   ├── LockoutNotice.jsx     # "Locked for 15 minutes" message
│   │   └── DownloadPdfButton.jsx
│   └── screens/
│       ├── SetupWizard.jsx       # First-run: creates owner
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── InvoiceList.jsx
│       ├── CreateInvoice.jsx
│       ├── InvoiceDetail.jsx
│       └── AIInsights.jsx
└── tests/ (CRA default — *.test.jsx colocated)

.env.example                     # Committed
.gitignore                       # .env, node_modules, coverage/, *.log
```

**Structure Decision**: Option 2 (Web application — `backend/` + `frontend/`). Matches the
user's explicit layout direction. Frontend renders the 5 spec screens (plus Login and Setup);
backend serves 9 REST endpoints; MongoDB holds the system of record.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none — all previously flagged divergences resolved via spec amendment in session 3)* | — | — |

## Phase 0 · Outline & Research

Output file: [`research.md`](./research.md)

Resolved technical decisions (10 total):
1. MongoDB driver (`mongodb@6`, no Mongoose)
2. Integer-paise monetary storage + `Math.floor` GST
3. Atomic INV-XXXX via `counters.findOneAndUpdate`
4. `$facet` pipeline for dashboard
5. Weighted-SMA forecast (6 historical months → 3 projected)
6. Composite payment score (on-time 50 + days-to-pay 30 + volume 20)
7. `pdfkit` streaming for GST Rule 46 PDFs
8. `jest` + `supertest` + `mongodb-memory-server` for tests
9. `recharts` for monthly revenue chart
10. `argon2id` hashing + signed HTTP-only session cookie + `sessions` TTL index + in-DB lockout counter

## Phase 1 · Design & Contracts

Output files:
- [`data-model.md`](./data-model.md) — 5 collections (`invoices`, `clients`, `counters`, `users`, `sessions`) with `$jsonSchema` and indexes
- [`contracts/auth.md`](./contracts/auth.md) — `POST /api/setup`, `POST /api/login` (with throttle), `POST /api/logout`, `GET /api/session`
- [`contracts/dashboard.md`](./contracts/dashboard.md) — `GET /api/dashboard`
- [`contracts/invoices.md`](./contracts/invoices.md) — list / create / get / status / delete / CSV export
- [`contracts/invoice-payments.md`](./contracts/invoice-payments.md) — atomic payment record
- [`contracts/invoice-pdf.md`](./contracts/invoice-pdf.md) — GST Rule 46 PDF
- [`contracts/insights.md`](./contracts/insights.md) — scoring + forecast pipelines
- [`quickstart.md`](./quickstart.md) — end-to-end run (setup wizard → seed → smoke test all 5 screens)

## Post-Design Constitution Re-check

| # | Principle | Re-check Result |
|---|-----------|-----------------|
| I | Spec is source of truth | ✅ All design derives from FR-000…FR-015 |
| II | Spec before code | ✅ Design follows spec + 15 clarifications |
| III | Human-reviewable specs | ✅ Contracts express acceptance criteria in plain English |
| IV | Layered spec hierarchy | ✅ Session-3 amendment removed prior divergences |
| V | Minimal specification | ✅ No speculative features; `argon2id` chosen over Bcrypt for OWASP alignment |
| VI | Continuous validation | ✅ Contract tests for every endpoint + unit tests for every formula |
| VII | MongoDB-first data modeling | ✅ 5 collections with `$jsonSchema`; aggregation-first everywhere |

**Progress**: `/speckit.plan` complete. All Constitution gates ✅. Ready for `/speckit.tasks`.
