require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { connect } = require("./src/config/db");
const { applySchema } = require("./src/config/schema");
const { seedIfEmpty } = require("./src/services/seedService");
const { errorHandler } = require("./src/middleware/error");
const { requireAuth } = require("./src/middleware/auth");

const authRoutes = require("./src/routes/auth");
const invoiceRoutes = require("./src/routes/invoices");
const clientRoutes = require("./src/routes/clients");
const dashboardRoutes = require("./src/routes/dashboard");
const insightsRoutes = require("./src/routes/insights");

async function buildApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000", credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", authRoutes); // setup/login/logout/session are unauthenticated

  app.use("/api/invoices", requireAuth, invoiceRoutes);
  app.use("/api/clients",  requireAuth, clientRoutes);
  app.use("/api/dashboard",requireAuth, dashboardRoutes);
  app.use("/api/insights", requireAuth, insightsRoutes);

  app.use(errorHandler);
  return app;
}

async function start() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.DB_NAME || "smartinvoice";
  console.log("[config] Loaded .env");
  await connect(uri, dbName);
  console.log(`[db]     Connected to MongoDB · DB: ${dbName}`);
  await applySchema();
  const seeded = await seedIfEmpty();
  if (seeded) console.log("[seed]   Database empty — inserted 4 clients + 8 invoices");
  else        console.log("[seed]   Skipped — data already present");
  const app = await buildApp();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`[server] SmartInvoice API listening on http://localhost:${port}`));
}

if (require.main === module) {
  start().catch((err) => { console.error("[fatal]", err); process.exit(1); });
}

module.exports = { buildApp, start };
