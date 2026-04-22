# MUG Peerislands Mumbai Conference 2026

**A 45-minute live keynote that takes a vague business idea to a running, MongoDB-backed application — using GitHub's spec-kit and Claude Code, with zero code written by the presenter.**

Presented at the **MUG Peerislands Mumbai Conference 2026** by PeerIslands.

---

## 📖 A Journey

A complete, self-contained demonstration of **Spec-Driven Development (SDD)** — the discipline where a human-reviewable specification is the single source of truth and code is generated *against* it, not the other way around. The deck walks an audience through the entire SDD lifecycle end-to-end:

> Business idea → Constitution → Spec → Clarification → Prototype → Plan → Tasks → Implementation → Running MongoDB app → Validation

By the end of the session, a working single-tenant invoice manager for Indian SMBs (**SmartInvoice**) is live at `http://localhost:3000`, every line of code traceable to a numbered requirement, and a ≥90% Jest coverage gate enforced in CI.

---

## 🗂 Contents

| File / Directory | Purpose |
|------------------|---------|
| `index.html` | **Executable guide** — open in a browser to see the seven Acts with click-to-copy commands, animated demo-flow diagram, MongoDB document shapes, `$facet` aggregation snippets, and inline narration notes. This is the presenter's teleprompter. |
| `peerislands-speckit-command-reference.pdf` | Printed cheat sheet of the nine `/speckit.*` slash commands. |
| `SetupSpeckit.file` | Minimal pre-flight instructions — install `uv`, `specify-cli`, bootstrap a fresh project. |
| `preflight.sh` | Pre-demo environment validation (Node 20, npm, MongoDB, Claude Code CLI, ports 3000/4000). |
| `start-demo.sh` | Boots backend (`:4000`) + frontend (`:3000`) after `/speckit.implement` finishes. |
| `stop-demo.sh` | Gracefully stops both servers; force-kills stragglers. |
| `reset-demo.sh` | Wipes `smartinvoice/` for a fresh rehearsal; `--bootstrap` flag re-runs `specify init`. |
| `smartinvoice/` | The spec-driven application generated during the demo. Includes `.specify/` (constitution, templates), `specs/001-smartinvoice-core/` (spec, plan, tasks, contracts), `backend/` (Express + MongoDB), `frontend/` (React + Recharts), and `prototype/` (HTML wireframes). |

---

## 🎬 The 7 Acts

| # | Act | Time | Deliverable |
|---|-----|------|-------------|
| 1 | **Constitution** | 0–5 min | `constitution.md` — 7 non-negotiable principles (Spec Is Source of Truth, Spec Before Code, Human-Reviewable Specs, Layered Hierarchy, Minimal Specification, Continuous Validation, MongoDB-First Data Modeling). |
| 2 | **Specify & Clarify** | 5–10 min | `spec.md` with numbered requirements (FR-000…FR-015) + acceptance scenarios. `/speckit.clarify` resolves 15 ambiguities across three sessions. |
| 3 | **Iterative Prototype** | 10–17 min | `prototype/index.html` — five wireframed screens (Dashboard, Invoice List, Create Invoice, Invoice Detail, AI Insights) with interaction tables. |
| 4 | **Plan** | 17–22 min | `plan.md` + `data-model.md` (5 MongoDB collections with `$jsonSchema` validators) + `contracts/` (6 REST endpoint specs) + `research.md`. |
| 5 | **Tasks & Analyze** | 22–27 min | `tasks.md` (88 dependency-ordered, parallelizable tasks) + cross-artifact consistency report. |
| 6 | **Implement & Run** | 27–35 min | Running SmartInvoice at `http://localhost:3000` — data in MongoDB Atlas, 74 Jest tests green at 94.9% line coverage. |
| 7 | **Validate** | 35–45 min | Compliance report: acceptance criteria pass/fail traced to FR-X.X ids; drift (if any) is surfaced, not buried. |

---

## 🚀 Let's Run It

### Prerequisites

- **Node.js 20 LTS** (`node --version` → `v20.x.x`)
- **npm 10+** (bundled with Node 20)
- **MongoDB** — either local (`mongodb://localhost:27017`) or an Atlas M0 SRV URI
- **uv** — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **spec-kit CLI** (v0.7.0) — `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.7.0`
- **Claude Code CLI** — [claude.com/code](https://claude.com/code)

### Typical Flow

```
./preflight.sh          →  run the 9 SDD commands inside Claude Code  →  ./start-demo.sh
                                                                              │
  ./stop-demo.sh  ←  live walkthrough at http://localhost:3000  ←─────────────┘
```

Use `./reset-demo.sh` only when you want a fresh run between rehearsals.

### Step-by-step

```bash
# 1. Validate the machine
./preflight.sh

# 2. Bootstrap a fresh spec-kit project (if you don't already have smartinvoice/)
specify init smartinvoice --ai claude
cd smartinvoice
claude                     # launch Claude Code

# 3. Inside Claude Code, run the 9 SDD commands (see execution guide)
#    /speckit.constitution
#    /speckit.specify  ...
#    /speckit.clarify
#    /speckit.plan     ...
#    /speckit.tasks
#    /speckit.analyze
#    /speckit.implement
#    /speckit.checklist

# 4. After /speckit.implement finishes, bring the app online
cd ..
./start-demo.sh            # boots backend :4000 + frontend :3000

# 5. Open http://localhost:3000 in your browser
#    First-run setup wizard → create owner account → explore all 5 screens

# 6. When done
./stop-demo.sh
```

---

## 🔑 The 9 SDD Commands (via Coding Agent)

| # | Command | What it does |
|---|---------|---------------|
| 1 | `specify init smartinvoice --ai claude` | Bootstrap project with Claude Code |
| 2 | `/speckit.constitution` | Encode governing principles |
| 3 | `/speckit.specify` | Generate structured spec from requirements |
| 4 | `/speckit.clarify` | Ask targeted questions, resolve ambiguities |
| 5 | `/speckit.plan` | Create technical implementation plan |
| 6 | `/speckit.tasks` | Break plan into ordered tasks |
| 7 | `/speckit.implement` | Execute all tasks, build the app |
| 8 | `/speckit.analyze` | Cross-artifact consistency check |
| 9 | `/speckit.checklist` | Acceptance criteria validation |

For the full command text (including the verbose `/speckit.plan` prompt that specifies the Node 20 + Express 4 + React + MongoDB stack, integer-paise arithmetic, 8 REST endpoints, Jest ≥ 90% coverage gate, and the dark/light theme toggle), open **`index.html`** in a browser — every command block is click-to-copy.

---

## 🏗 What Gets Built (The SmartInvoice App)

### Three user stories, delivered in priority order

| Story | Priority | What it delivers |
|-------|----------|-------------------|
| **US1 · Invoice Management** (MVP) | P1 | Create / list / edit drafts, auto-calc 18% GST, sequential `INV-XXXX` numbering via atomic `counters.findOneAndUpdate`, full lifecycle (draft → pending → paid/overdue), per-invoice GST-Rule-46 PDF, CSV export. |
| **US2 · Dashboard** | P2 | 4 real-time stat cards + 12-month revenue chart + 5 recent invoices — all from one MongoDB `$facet` aggregation pipeline (single round-trip). |
| **US3 · AI Insights** | P3 | Per-client payment score (0–100) with Low/Medium/High risk bands + 3-month weighted-SMA revenue forecast. Pure MongoDB aggregation pipelines — no external ML API. |

### Tech Stack

- **Backend**: Node.js 20 + Express 4 · official `mongodb@6` driver (no Mongoose) · `argon2id` password hashing · `pdfkit` for GST-Rule-46 PDFs · Jest + Supertest + `mongodb-memory-server`
- **Frontend**: React 18 (Create React App 5) · React Router 6 · Recharts · dark + light theme with top-right toggle persisted to `localStorage`
- **Database**: MongoDB (Atlas or local). Five collections: `invoices`, `clients`, `counters`, `users`, `sessions` — each with `$jsonSchema` validators and the indexes needed to serve every query without `$lookup`.

### Design Principles

- **Integer paise everywhere** — monetary amounts stored as 64-bit integers (`₹ × 100`). Zero floating-point rounding. GST is `Math.floor(subtotal × 18 / 100)` to guarantee no overcharge.
- **MongoDB-first data modeling** — document shapes mirror query patterns; embedding is the default; aggregation pipelines for dashboard and AI insights.
- **Indian locale end-to-end** — `DD/MM/YYYY` dates, lakh/crore grouping (`₹1,23,456.78`), GSTIN format validation.
- **Test coverage gate** — `jest --coverage` with `coverageThreshold.global.lines: 90` enforced in CI.

---

## 📐 Constitution & Traceability

The entire build is governed by **`smartinvoice/.specify/memory/constitution.md` v1.0.0** — seven principles that the plan, tasks, and implementation all cite. Every functional requirement (FR-000 … FR-015) maps to at least one task, and every task maps back to a requirement. `/speckit.analyze` produces a coverage report that fails the build if any drift is detected.

The clarification sessions in `smartinvoice/specs/001-smartinvoice-core/spec.md` record 15 explicit Q&A decisions across three dated sessions (authentication, submission mechanism, editability, dashboard freshness, client uniqueness, CSV export, deletion policy, partial payments, password policy, locale, PDF scope, payment semantics, owner provisioning, HSN/SAC, login throttle) — so downstream ambiguity is visible rather than silently invented.

---

## 🧯 Fallback & Troubleshooting

| Symptom | Fix |
|---------|-----|
| `./preflight.sh` reports a missing tool | Install the flagged prerequisite; re-run preflight until all checks pass. |
| Port 3000 or 4000 already in use | `./stop-demo.sh` frees both; or `BACKEND_PORT=... FRONTEND_PORT=... ./start-demo.sh` to use different ports. |
| `/speckit.implement` stalls past 6 minutes | Cut over to the pre-recorded build capture at `./fallback/build.mp4` and narrate live. A pre-warmed branch `main-demo-ready` is seeded with the full SmartInvoice build for immediate cut-over. |
| MongoDB connection error | Confirm `brew services list | grep mongo` shows "started", OR set `MONGODB_URI` in `smartinvoice/backend/.env` to a reachable Atlas SRV URI. |
| Locked out after 5 wrong passwords | Wait 15 minutes (lockout auto-expires) or drop the `users` collection: `mongosh smartinvoice --eval 'db.users.drop(); db.sessions.drop()'`. |
| Need a completely fresh run | `./reset-demo.sh --bootstrap` — wipes `smartinvoice/` and re-scaffolds a new spec-kit project. |

---

## 📚 Further Reading

- **Spec-Driven Development** — GitHub spec-kit: <https://github.com/github/spec-kit>
- **Claude Code** — Anthropic's terminal-native coding agent: <https://claude.com/code>
- **MongoDB data modeling patterns** — <https://www.mongodb.com/docs/manual/applications/data-models/>

---

## 🎯 Remember : Spec Driven Development

> *"The spec was the contract. Claude Code was the contractor. spec-kit was the process. The validation report is the certificate of compliance. And when a criterion fails, SDD tells us exactly WHERE the drift is. That's Spec-Driven Development."*

The keynote answers four questions head-on:

1. **Can AI be trusted to build business-critical software?** — Yes, if the AI executes a reviewed, signed spec rather than a vague prompt.
2. **Does SDD slow teams down?** — No. Iteration happens at the spec and wireframe layer, where change is seconds. Code stays stable.
3. **What about the MongoDB data model?** — Declared in the plan before any line of code. Document shapes, indexes, and validators are signed off upfront.
4. **What happens when the AI drifts from the spec?** — `/speckit.analyze` surfaces the drift, `/speckit.checklist` produces the compliance certificate, and the presenter honours the one that fails on stage. The failure is the feature.

---

**Presented by PeerIslands · MUG Peerislands Mumbai Conference 2026**
