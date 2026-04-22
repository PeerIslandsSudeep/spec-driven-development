const { MongoClient } = require("mongodb");

let client = null;
let db = null;

async function connect(uri, dbName) {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

function getDb() {
  if (!db) throw new Error("DB not initialised — call connect() first");
  return db;
}

function collections() {
  const d = getDb();
  return {
    invoices: d.collection(process.env.COLL_INVOICES || "invoices"),
    clients:  d.collection(process.env.COLL_CLIENTS  || "clients"),
    counters: d.collection(process.env.COLL_COUNTERS || "counters"),
    users:    d.collection(process.env.COLL_USERS    || "users"),
    sessions: d.collection(process.env.COLL_SESSIONS || "sessions"),
  };
}

async function close() {
  if (client) { await client.close(); client = null; db = null; }
}

module.exports = { connect, getDb, collections, close };
