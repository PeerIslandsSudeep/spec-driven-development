const { MongoMemoryServer } = require("mongodb-memory-server");
const { connect, close } = require("../../src/config/db");
const { applySchema } = require("../../src/config/schema");
const { buildApp } = require("../../server");

let mongod = null;
let app = null;

async function setupTestApp() {
  if (!process.env.COLL_INVOICES) {
    process.env.COLL_INVOICES = "invoices";
    process.env.COLL_CLIENTS  = "clients";
    process.env.COLL_COUNTERS = "counters";
    process.env.COLL_USERS    = "users";
    process.env.COLL_SESSIONS = "sessions";
  }
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await connect(uri, "smartinvoice_test");
  await applySchema();
  app = await buildApp();
  return app;
}

async function teardownTestApp() {
  await close();
  if (mongod) await mongod.stop();
  mongod = null;
  app = null;
}

function getApp() { return app; }

module.exports = { setupTestApp, teardownTestApp, getApp };
