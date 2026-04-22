---
description: "Task list for SmartInvoice Core — generated from spec + plan + 15 clarifications"
---

# Tasks: SmartInvoice Core

**Input**: Design documents from `/specs/001-smartinvoice-core/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: MANDATORY — user requested Jest coverage ≥ 90% in CI covering every calculation,
every validation, every endpoint. Test tasks are therefore included throughout.

**Organization**: Tasks are grouped by user story so each can be implemented and tested
independently. US1 (P1) is the MVP; US2 and US3 layer on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]`, `[US2]`, `[US3]` — maps to spec.md user stories
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/...`, `frontend/src/...` at repo root
- All paths below are relative to the repo root `/Users/sudeepmasare/Projects/iPeerislands/MongoDB-MUG-MeetUp/SpecDrivenDevelopment/smartinvoice/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — directory structure, dependency manifests, tool configuration.

- [X] T001 Create the web-app skeleton: `backend/` and `frontend/` directories per plan.md Project Structure
- [X] T002 [P] Create `backend/package.json` with scripts `start`, `test`, `test:coverage`; declare dependencies (`express@4`, `mongodb@6`, `cors`, `dotenv`, `pdfkit@0.14`, `argon2`, `cookie-parser`) and devDependencies (`jest`, `supertest`, `mongodb-memory-server`); configure `jest.coverageThreshold.global.lines: 90`
- [X] T003 [P] Create `backend/.env.example` with placeholders for `MONGODB_URI`, `DB_NAME`, `COLL_INVOICES`, `COLL_CLIENTS`, `COLL_COUNTERS`, `COLL_USERS`, `COLL_SESSIONS`, `PORT=4000`, `SESSION_SECRET`, `CORS_ORIGIN=http://localhost:3000`
- [X] T004 [P] Create root `.gitignore` listing `node_modules/`, `.env`, `coverage/`, `*.log`, `build/`, `dist/`
- [X] T005 Bootstrap `frontend/` using Create React App 5 (`npx create-react-app frontend`) then add deps `react-router-dom@6` and `recharts`
- [X] T006 [P] Add `"proxy": "http://localhost:4000"` to `frontend/package.json` so CRA dev server forwards `/api/*` to the backend
- [X] T007 [P] Configure `backend/jest.config.js` with `testEnvironment: "node"`, `setupFilesAfterEach` for in-memory Mongo tear-down, and coverage paths
- [X] T008 [P] Create `frontend/src/index.css` with dark theme CSS variables (`--bg`, `--surface`, `--text`) and MongoDB green accent `#00684A`

**Checkpoint**: Both projects build with `npm install`; empty Jest run passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure every user story depends on — DB connection, schema enforcement, auth, routing plumbing, seed, and theme/router scaffolding. **⚠️ No user-story work can start until this phase completes.**

### Backend: Database Layer

- [X] T009 Implement `backend/src/config/db.js` — MongoClient singleton, reads all collection names from `.env` (never hard-coded); exports `getDb()` and typed collection accessors (`invoices`, `clients`, `counters`, `users`, `sessions`)
- [X] T010 Implement `backend/src/config/schema.js` — apply `$jsonSchema` validators and indexes for all 5 collections per `data-model.md` on startup; idempotent (skip if collection exists with validator)
- [X] T011 [P] Implement `backend/src/services/seedService.js` — idempotent seeder inserting 4 clients + 8 invoices only when `invoices.countDocuments() === 0`; updates `counters.invoiceSeq` to 8

### Backend: Express Bootstrapping

- [X] T012 Implement `backend/server.js` — `dotenv.config()`; connect DB; apply schemas; run seed; mount middleware (`cors({origin: CORS_ORIGIN, credentials: true})`, `express.json`, `cookie-parser`); mount routers; listen on `process.env.PORT`
- [X] T013 [P] Implement `backend/src/middleware/error.js` — central error handler converting service errors to 4xx/5xx JSON responses
- [X] T014 [P] Implement `backend/src/middleware/throttle.js` — helper to read/update per-user `failedAttempts[]` rolling window and `lockedUntil` per FR-000d

### Backend: Auth (FR-000, FR-000a, FR-000b, FR-000c, FR-000d)

- [X] T015 [P] Implement `backend/src/services/authService.js` — argon2id hashing, password policy validation (≥8 chars, letter+digit), verify helper
- [X] T016 Implement `backend/src/middleware/auth.js` — `requireAuth` middleware: reads `sid` cookie, loads session, enforces 30-min idle timeout + 24h absolute expiry (FR-000b), refreshes `lastSeenAt`, attaches `req.user`
- [X] T017 Implement `backend/src/routes/auth.js` — `POST /api/setup`, `POST /api/login` (with throttle per FR-000d), `POST /api/logout`, `GET /api/session`; wires into `authService` and session collection per `contracts/auth.md`
- [X] T018 [P] `backend/tests/unit/authService.test.js` — argon2 hash/verify; password policy accepts 8+ with letter+digit, rejects shorter, letter-only, digit-only; lockout math (5 attempts in 10 min → locked 15 min)
- [X] T019 [P] `backend/tests/contract/auth.test.js` — every row in `contracts/auth.md` test tables: first-run setup, 409 after owner exists, login success/fail, 429 after 5 failures, user enumeration immunity, logout, `GET /session` three states

### Backend: Shared Business-Logic Services

- [X] T020 [P] Implement `backend/src/services/calcService.js` — pure functions: `calcLineTotal(qty, unitPricePaise)`, `calcSubtotal(lineItems)`, `calcTax(subtotalPaise)` using `Math.floor(× 18 / 100)`, `calcGrandTotal(subtotal, tax)`
- [X] T021 [P] `backend/tests/unit/calcService.test.js` — every formula: zero qty, large qty, one-paisa subtotal → 0 tax (floor), 11-paise subtotal → 1 paisa tax (not 1.98), 100-paise → 18, 10000-paise → 1800, grand total additivity

### Frontend: Scaffolding

- [X] T022 Implement `frontend/src/api/client.js` — `fetch` wrapper with `credentials: "include"`, JSON body helpers, 401/429 handling
- [X] T023 [P] Implement `frontend/src/utils/format.js` — `formatINR(paise)` → `₹1,23,456.78` Indian lakh/crore grouping (FR-015); `formatDate(date)` → `DD/MM/YYYY`; `toPaise(rupees)` parser
- [X] T024 [P] `frontend/src/utils/format.test.js` — lakh/crore grouping boundary cases (1 paisa, ₹1,00,000.00, ₹1,23,45,678.90); DD/MM/YYYY formatting; round-trip paise
- [X] T025 [P] Implement `frontend/src/hooks/useSession.js` — calls `GET /api/session`; returns `{ authenticated, ownerExists, username, loading }`
- [X] T026 Implement `frontend/src/App.jsx` — React Router with branching based on `useSession`: `ownerExists=false` → SetupWizard, authenticated=false → Login, otherwise main app routes (`/`, `/invoices`, `/invoices/new`, `/invoices/:id`, `/insights`)
- [X] T027 [P] Implement `frontend/src/screens/SetupWizard.jsx` — one-time form calling `POST /api/setup`; shows password policy inline; redirects to dashboard on success
- [X] T028 [P] Implement `frontend/src/screens/Login.jsx` — form calling `POST /api/login`; shows `LockoutNotice` with Retry-After countdown on 429
- [X] T029 [P] Implement `frontend/src/components/LockoutNotice.jsx` — displays the locked-out message with minutes remaining

### Frontend: Shared Layout

- [X] T030 [P] Implement `frontend/src/components/Sidebar.jsx` — nav links (Dashboard, Invoices, New Invoice, AI Insights, Logout)
- [X] T031 [P] Implement `frontend/src/components/Topbar.jsx` — page title slot; user avatar; logout handler calling `POST /api/logout`
- [X] T032 [P] Implement `frontend/src/components/StatusBadge.jsx` — renders `draft` / `pending` / `paid` / `overdue` with dark-theme colour tokens

**Checkpoint**: Owner can be provisioned via first-run wizard; authenticated user reaches an empty app shell. All foundational tests pass.

---

## Phase 3: User Story 1 — Invoice Management (Priority: P1) 🎯 MVP

**Goal**: Owner can create invoices, auto-calc 18% GST, receive sequential INV-XXXX numbers, advance through the full lifecycle (draft → pending → paid/overdue), download PDFs, export CSV, and delete drafts. Fully standalone — delivers the core transactional workflow with no dashboard or AI dependency.

**Independent Test**: Seed fresh DB → setup owner → create invoice with 2 line items → verify totals → mark sent → advance date past due → verify overdue → mark paid → download PDF and verify Rule 46 fields → export CSV and verify Indian formatting. Delete an unrelated draft and verify INV gap.

### Backend — Models & Services

- [X] T033 [US1] Implement `backend/src/services/invoiceService.js` — `createInvoice(payload)` using `counters.findOneAndUpdate({_id:"invoiceSeq"}, {$inc:{seq:1}}, {upsert:true, returnDocument:"after"})`; recomputes subtotal/tax/grandTotal server-side; validates `lineItems.length >= 1`, `qty>=1`, `unitPricePaise>=0`, `dueDate>=issueDate`; enforces client existence
- [X] T034 [P] [US1] Extend `invoiceService.js` — `listInvoices({status, page, pageSize, q, sort})` with pagination, `$regex` on invoiceNumber/clientName, atomic overdue auto-transition via `updateMany({status:"pending", dueDate:{$lt:now}}, {$set:{status:"overdue"}})` before query
- [X] T035 [P] [US1] Extend `invoiceService.js` — `getInvoice(id)` with same overdue auto-transition; 404 on missing
- [X] T036 [P] [US1] Extend `invoiceService.js` — `updateDraft(id, payload)` rejecting when status !== "draft" (FR-004a)
- [X] T037 [P] [US1] Extend `invoiceService.js` — `transitionStatus(id, newStatus)` enforcing allowed transitions (draft→pending, pending/overdue→paid); sets `sentAt` or `paidAt`
- [X] T038 [P] [US1] Extend `invoiceService.js` — `deleteDraft(id)` — hard delete only when status === "draft"; 403 otherwise (FR-005b)
- [X] T039 [P] [US1] Implement `backend/src/services/clientService.js` — `createClient(payload)` with email-uniqueness via unique index catch → 409 (FR-005a); `listClients()`; `getClient(id)`
- [X] T040 [P] [US1] Implement `backend/src/services/numberToWords.js` — converts paise integer to Indian words ("One lakh twenty-three thousand four hundred fifty-six rupees and seventy-eight paise only"); supports up to 999 crore
- [X] T041 [P] [US1] `backend/tests/unit/numberToWords.test.js` — boundary cases: 0, 1, 99, 100, 999, 1000, 99999, 100000 (lakh boundary), 9999999, 10000000 (crore boundary), paise component
- [X] T042 [P] [US1] Implement `backend/src/services/pdfService.js` — PDFKit renderer producing GST Rule 46 layout per `contracts/invoice-pdf.md`: supplier/recipient/GSTIN, invoice #, DD/MM/YYYY dates, line items with HSN/SAC column, CGST 9% + SGST 9% split, totals in `₹1,23,456.78`, amount in words, authorized signatory footer; streams to response
- [X] T043 [P] [US1] Implement `backend/src/services/csvExportService.js` — streams CSV with header row per `contracts/invoices.md`; amounts formatted via Indian lakh/crore; dates DD/MM/YYYY; honours status filter

### Backend — Routes

- [X] T044 [US1] Implement `backend/src/routes/invoices.js` — mount `GET /api/invoices`, `POST /api/invoices`, `GET /api/invoices/:id`, `PATCH /api/invoices/:id`, `PATCH /api/invoices/:id/status`, `DELETE /api/invoices/:id`, `GET /api/invoices/export.csv` per `contracts/invoices.md`; all behind `requireAuth`
- [X] T045 [P] [US1] Implement `backend/src/routes/clients.js` — `GET /api/clients`, `POST /api/clients`, `GET /api/clients/:id` (simple CRUD for client picker)
- [X] T046 [P] [US1] Implement `backend/src/routes/payments.js` — `POST /api/invoices/:id/payments` per `contracts/invoice-payments.md`; enforces `amountPaise === invoice.grandTotalPaise`; atomic update setting status=paid, paidAt, payment sub-doc
- [X] T047 [P] [US1] Implement `backend/src/routes/pdf.js` — `GET /api/invoices/:id/pdf`; delegates to `pdfService`; sets `Content-Type: application/pdf` and `Content-Disposition` with filename `INV-XXXX.pdf`

### Backend — Tests

- [X] T048 [P] [US1] `backend/tests/unit/invoiceService.test.js` — INV-XXXX counter is atomic (two concurrent `createInvoice` calls produce distinct sequential numbers); lock-rule rejects updates on non-draft; overdue transition logic; delete rejection on non-draft
- [X] T049 [P] [US1] `backend/tests/contract/invoices.test.js` — every row in `contracts/invoices.md` test tables: GST floor cases (11 paise → 1), concurrent uniqueness, status filter, search, pagination, overdue auto-transition, CSV export with Indian formatting
- [X] T050 [P] [US1] `backend/tests/contract/payments.test.js` — every row in `contracts/invoice-payments.md`: exact grand-total match, partial rejection, overpay rejection, already-paid 409, draft 409, method enum validation
- [X] T051 [P] [US1] `backend/tests/contract/pdf.test.js` — 200 + `application/pdf`; parse PDF text via `pdf-parse`; assert INV-XXXX, DD/MM/YYYY date, grand total with ₹ lakh grouping, CGST+SGST sum equals taxPaise, amount in words, HSN column blank when null and populated when set
- [X] T052 [P] [US1] `backend/tests/contract/clients.test.js` — create rejects duplicate email with 409; list returns all; GSTIN pattern enforcement

### Frontend — Hooks & Components

- [X] T053 [P] [US1] Implement `frontend/src/hooks/useInvoices.js` — `list({status,page,q,sort})`, `create(payload)`, `get(id)`, `update(id,payload)`, `patchStatus(id,status)`, `del(id)`, `recordPayment(id,payload)`
- [X] T054 [P] [US1] Implement `frontend/src/hooks/useClients.js` — `list()`, `create(payload)`, `get(id)`
- [X] T055 [P] [US1] Implement `frontend/src/components/LineItemsEditor.jsx` — add/remove rows; columns: Description, Qty, Unit Price (rupees), HSN/SAC (optional), Line Total (computed from paise); emits `onChange(lineItems)` with paise-integer amounts
- [X] T056 [P] [US1] Implement `frontend/src/components/ClientPicker.jsx` — searchable dropdown populated from `useClients().list()`; "+ Add new client" opens inline sub-form; uniqueness checked on blur via optimistic POST then handle 409
- [X] T057 [P] [US1] Implement `frontend/src/components/InvoiceForm.jsx` — integrates ClientPicker + LineItemsEditor; displays computed subtotal/GST/grand total via `calcService` mirror (use same formulas on FE for live feedback; server remains authoritative); Save Draft / Save & Mark Sent / Cancel actions
- [X] T058 [P] [US1] Implement `frontend/src/components/InvoiceTable.jsx` — paginated table with filter tabs (All / Draft / Pending / Paid / Overdue with counts); search box; sort dropdown; row click → detail; inline Send / Mark Paid / Edit actions per status
- [X] T059 [P] [US1] Implement `frontend/src/components/Timeline.jsx` — renders 4-step lifecycle timeline (Draft → Sent → Overdue → Paid) with done/current/locked states
- [X] T060 [P] [US1] Implement `frontend/src/components/DownloadPdfButton.jsx` — issues `GET /api/invoices/:id/pdf` and triggers browser download

### Frontend — Screens

- [X] T061 [US1] Implement `frontend/src/screens/InvoiceList.jsx` — uses `useInvoices.list`; mounts `InvoiceTable`; "New Invoice" → `/invoices/new`; "Export CSV" button hitting `GET /api/invoices/export.csv` with active status filter
- [X] T062 [US1] Implement `frontend/src/screens/CreateInvoice.jsx` — shows `InvoiceForm`; wires to `useInvoices.create` / `update`; supports edit mode via `/invoices/:id/edit` for draft invoices only
- [X] T063 [US1] Implement `frontend/src/screens/InvoiceDetail.jsx` — shows Timeline + client block + invoice info block + line items (read-only) + totals + DownloadPdfButton; action bar with status-appropriate buttons (Edit, Send, Mark Paid, Delete); lock banner for non-draft
- [X] T064 [P] [US1] Frontend smoke tests for `InvoiceForm.jsx` and `InvoiceTable.jsx` — verify GST auto-calculation and filter tab switching (CRA default Jest + React Testing Library)

**Checkpoint (US1 — MVP)**: Owner can complete the full invoice lifecycle end-to-end. All spec US1 acceptance scenarios 1–8 pass. `npm test -- --coverage` for this phase passes the ≥ 90% threshold on invoice-related files.

---

## Phase 4: User Story 2 — Dashboard (Priority: P2)

**Goal**: Dashboard shows real-time stats, 12-month revenue chart, and 5 recent invoices — all in one `$facet` aggregation pipeline round-trip.

**Independent Test**: Load dashboard against a seeded DB; verify 4 stat values match manual SUM over `invoices`; verify chart has exactly 12 entries (zeros for future months); verify 5 recent invoices sorted by `updatedAt` desc.

### Backend

- [X] T065 [P] [US2] Implement `backend/src/pipelines/dashboardFacet.js` — exports the `$facet` pipeline from `contracts/dashboard.md` (stats sub-pipeline with conditional `$sum`, chart sub-pipeline grouping by `%Y-%m` of paidAt, recent sub-pipeline sorted by updatedAt desc limit 5)
- [X] T066 [US2] Implement `backend/src/routes/dashboard.js` — `GET /api/dashboard` running the facet pipeline; normalizes chart to all 12 months of current year (fills missing months with 0); handles empty DB returning all-zero response
- [X] T067 [P] [US2] `backend/tests/contract/dashboard.test.js` — every row in `contracts/dashboard.md`: auth gate, empty-DB all-zero, single paid invoice stats match, overdue count correct, 5 recent sorted, chart always 12 entries, 401 without session

### Frontend

- [X] T068 [P] [US2] Implement `frontend/src/hooks/useDashboard.js` — fetches `/api/dashboard`; returns `{stats, chart, recent, loading, error}`
- [X] T069 [P] [US2] Implement `frontend/src/components/StatCard.jsx` — reusable stat card (label, value, sub-label, colour variant); clickable to filter Invoice List
- [X] T070 [P] [US2] Implement `frontend/src/components/MonthlyRevenueChart.jsx` — Recharts BarChart over the 12-month data; dark theme tint; highlight current month; tooltip showing `formatINR(revenuePaise)`
- [X] T071 [US2] Implement `frontend/src/screens/Dashboard.jsx` — 4 StatCards + MonthlyRevenueChart + Recent table; empty-state CTA "Create your first invoice" when `stats.totalInvoiceCount === 0`; explicit manual-refresh behaviour per FR-000b / SC-003
- [X] T072 [P] [US2] Frontend smoke test for `Dashboard.jsx` — renders stat cards with mocked data; verifies click on stat navigates with correct filter query

**Checkpoint (US2)**: Dashboard renders correctly for both populated and empty DB. US2 acceptance scenarios 1–4 pass.

---

## Phase 5: User Story 3 — AI Insights (Priority: P3)

**Goal**: Per-client payment scoring with risk bands, plus 3-month revenue forecast via weighted SMA, all computed in MongoDB aggregation pipelines.

**Independent Test**: Seed dataset with known payment patterns → call `/api/insights` → verify scores match the weighted formula (on-time × 50 + days × 30 + volume × 20); verify risk bands (≥70 low, 40-69 medium, <40 high); verify 3-month forecast present with ≥ 6 months history; verify insufficient-history response when < 3 paid months; verify "No data" row for zero-invoice clients.

### Backend

- [X] T073 [P] [US3] Implement `backend/src/pipelines/paymentScore.js` — exports the aggregation pipeline from `contracts/insights.md`: `$group` by `clientRef.email`, compute `onTimeCount`, `avgDaysToPay`, `invoiceCount`; `$project` with composite score breakdown and risk `$switch`
- [X] T074 [P] [US3] Implement `backend/src/pipelines/revenueForecast.js` — exports the historical-months pipeline (group by `%Y-%m` of paidAt, sort desc, limit 6); JS projection step computing weighted SMA with weights `[1, 1, 1, 1, 1.2, 1.5]` (most-recent last) and emitting 3 future months
- [X] T075 [US3] Implement `backend/src/services/insightsService.js` — orchestrates both pipelines; left-joins `clients` to include zero-invoice clients as `{paymentScore:null, riskLevel:"no_data"}` (FR-014); returns `{generatedAt, clients[], forecast}` shape per `contracts/insights.md`; handles < 3 months history with `{available:false, reason:"insufficient_history"}` (FR-013); catches pipeline errors returning degraded-mode payload
- [X] T076 [US3] Implement `backend/src/routes/insights.js` — `GET /api/insights` delegating to `insightsService`
- [X] T077 [P] [US3] `backend/tests/contract/insights.test.js` — every row in `contracts/insights.md`: empty DB returns insufficient_history; 2 months paid returns insufficient_history; 6+ months returns forecast; all-on-time client scores ≥ 70; all-late client scores < 40; zero-invoice client returns no_data; 10k invoices p95 < 3000 ms; forced pipeline error returns degraded-mode payload

### Frontend

- [X] T078 [P] [US3] Implement `frontend/src/hooks/useInsights.js` — fetches `/api/insights`; returns `{clients, forecast, generatedAt, loading, error}`
- [X] T079 [P] [US3] Implement `frontend/src/components/ScoreBar.jsx` — horizontal bar with fill colour based on risk band (green/amber/red); numeric score label; handles `null` score showing "No data"
- [X] T080 [US3] Implement `frontend/src/screens/AIInsights.jsx` — three sections: 3 forecast cards (or insufficient-history message), risk distribution (counts of low/med/high), client scoring table using `ScoreBar`; row click navigates to invoice list filtered by client; risk filter dropdown; degraded-mode banner when pipeline errors
- [X] T081 [P] [US3] Frontend smoke test for `AIInsights.jsx` — renders forecast cards with mocked data; verifies "No data" row for zero-invoice client; verifies insufficient-history fallback

**Checkpoint (US3)**: AI Insights screen renders all three sections correctly. US3 acceptance scenarios 1–5 pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Integration testing, performance validation, documentation, and finally start the running application as the user explicitly requested.

- [X] T082 [P] `backend/tests/integration/fullFlow.test.js` — end-to-end: setup owner → create client → create invoice → edit draft → mark sent → advance clock past due → list shows overdue → mark paid with method=upi → dashboard stats reflect paid amount → insights includes client scored above 70
- [X] T083 [P] Performance test for SC-006: seed 10,000 invoices, measure `GET /api/insights` p95 < 3000 ms; add assertion in `backend/tests/contract/insights.test.js`
- [X] T084 [P] Update root `README.md` with pointer to `specs/001-smartinvoice-core/quickstart.md`; list the 5 collections and 9 endpoints
- [X] T085 Verify `npm test -- --coverage` in `backend/` reports `lines >= 90%`; if below, add targeted tests until threshold passes
- [X] T086 Run `cd backend && npm install && npm start` as a **background process** (bound to port 4000); confirm logs show `[db] Connected`, `[seed] ✓ Seed complete`, `[server] listening on http://localhost:4000`
- [X] T087 Run `cd frontend && npm install && npm start` as a **background process** (bound to port 3000); confirm CRA dev server opens `http://localhost:3000` and proxies `/api/*` to the backend
- [X] T088 Manual smoke test against `quickstart.md` §7 (US1/US2/US3 verification steps) and §8 (login hardening); all acceptance scenarios pass; application is live at `http://localhost:3000`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational (not on US1 data — can use seed)
- **US3 (Phase 5)**: Depends on Foundational (not on US1/US2 — uses seed data)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)** — Can start after Foundational. Delivers the MVP; no dependency on US2 or US3.
- **US2 (P2)** — Can start after Foundational. Reads invoices via aggregation; works against seed data. Does NOT require US1 endpoints.
- **US3 (P3)** — Can start after Foundational. Reads invoices via aggregation; works against seed data. Does NOT require US1 endpoints.

### Within Each User Story

- Services → Routes → Contract tests (can run [P] across services)
- Frontend hooks → Components → Screens
- Unit tests colocated with service implementations ([P] with them)

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T006, T007, T008 all [P] (different files).
- **Phase 2**: T013, T014, T015, T018, T019, T020, T021, T023, T024, T025, T027, T028, T029, T030, T031, T032 all [P].
- **Phase 3 (US1)**: T034–T038 extend the same service file (sequential); T039–T043 and T045–T047 are [P] (different files); T048–T052 all [P] (different test files); T053–T060 frontend components all [P].
- **Phase 4 (US2)**: T065, T067, T068, T069, T070, T072 all [P].
- **Phase 5 (US3)**: T073, T074, T077, T078, T079, T081 all [P].
- **Phase 6**: T082, T083, T084 all [P]; T085 → T086 → T087 → T088 sequential.

---

## Parallel Example: US1 Contract Tests

After US1 services + routes (T033–T047) land, launch all contract tests together:

```bash
# All [P] — different test files, no dependency on each other:
Task: "Run T048 backend/tests/unit/invoiceService.test.js"
Task: "Run T049 backend/tests/contract/invoices.test.js"
Task: "Run T050 backend/tests/contract/payments.test.js"
Task: "Run T051 backend/tests/contract/pdf.test.js"
Task: "Run T052 backend/tests/contract/clients.test.js"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Invoice Management
4. Run T086 + T087 (background processes) + T088 (manual smoke) restricted to US1 routes only
5. Stop & validate MVP; merge to `main` if the P1 slice is acceptable

### Incremental Delivery

1. Setup + Foundational → owner provisioned, app shell visible
2. + US1 → full invoice lifecycle (MVP — deliverable)
3. + US2 → dashboard layered on existing invoices
4. + US3 → AI insights layered on existing invoices
5. Polish → coverage gate, performance test, start the app

### Parallel Team Strategy (optional)

After Foundational (Phase 2) completes, three developers could work in parallel:
- Dev A: US1 backend (T033–T052)
- Dev B: US1 frontend (T053–T064)
- Dev C: US2 + US3 backend pipelines (T065–T077) — no invoice-service dependency

---

## Notes

- `[P]` = different files, no dependency on incomplete tasks.
- `[Story]` labels map tasks to their spec user story for traceability.
- Tests are mandatory (user explicit); not optional.
- Every calculation formula has a unit test (T021, T041).
- Every endpoint has a contract test (T019, T049, T050, T051, T052, T067, T077).
- Integration test (T082) covers the full flow end-to-end.
- Coverage gate (T085) enforces the ≥ 90% line threshold.
- Final tasks (T086, T087, T088) leave the app running at `http://localhost:3000`.
- Commit after each task or each logical group.
- Do NOT skip the Foundational phase — first-run wizard (FR-000c), schema enforcement, and auth middleware are load-bearing for every user story.
