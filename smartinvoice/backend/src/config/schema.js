const { collections, getDb } = require("./db");

const validators = {
  invoices: {
    bsonType: "object",
    required: ["invoiceNumber","status","clientRef","lineItems","subtotalPaise","taxPaise","grandTotalPaise","issueDate","dueDate","createdAt"],
    properties: {
      invoiceNumber: { bsonType: "string", pattern: "^INV-[0-9]{4,}$" },
      status: { enum: ["draft","pending","paid","overdue"] },
      clientRef: {
        bsonType: "object",
        required: ["clientId","name","email"],
        properties: {
          clientId: { bsonType: "objectId" },
          name:     { bsonType: "string", minLength: 1 },
          email:    { bsonType: "string" },
          gstin:    { bsonType: ["string","null"] }
        }
      },
      lineItems: {
        bsonType: "array",
        minItems: 1,
        items: {
          bsonType: "object",
          required: ["description","qty","unitPricePaise","lineTotalPaise"],
          properties: {
            description:    { bsonType: "string", minLength: 1 },
            qty:            { bsonType: ["int","long"], minimum: 1 },
            unitPricePaise: { bsonType: ["int","long","double"], minimum: 0 },
            lineTotalPaise: { bsonType: ["int","long","double"], minimum: 0 },
            hsnSac:         { bsonType: ["string","null"] }
          }
        }
      },
      subtotalPaise:   { bsonType: ["int","long","double"], minimum: 0 },
      taxPaise:        { bsonType: ["int","long","double"], minimum: 0 },
      grandTotalPaise: { bsonType: ["int","long","double"], minimum: 0 },
      issueDate: { bsonType: "date" },
      dueDate:   { bsonType: "date" },
      sentAt:    { bsonType: ["date","null"] },
      paidAt:    { bsonType: ["date","null"] },
      payment:   { bsonType: ["object","null"] },
      notes:     { bsonType: ["string","null"] },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    }
  },
  clients: {
    bsonType: "object",
    required: ["name","email","address","createdAt"],
    properties: {
      name:  { bsonType: "string", minLength: 1 },
      email: { bsonType: "string" },
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
      gstin: { bsonType: ["string","null"] },
      createdAt: { bsonType: "date" }
    }
  },
  counters: {
    bsonType: "object",
    required: ["_id","seq"],
    properties: {
      _id: { bsonType: "string" },
      seq: { bsonType: ["int","long"], minimum: 0 }
    }
  },
  users: {
    bsonType: "object",
    required: ["username","passwordHash","createdAt"],
    properties: {
      username:       { bsonType: "string", minLength: 1 },
      passwordHash:   { bsonType: "string" },
      createdAt:      { bsonType: "date" },
      failedAttempts: { bsonType: "array", items: { bsonType: "date" } },
      lockedUntil:    { bsonType: ["date","null"] }
    }
  },
  sessions: {
    bsonType: "object",
    required: ["_id","userId","createdAt","lastSeenAt","expiresAt"],
    properties: {
      _id:        { bsonType: "string" },
      userId:     { bsonType: "objectId" },
      createdAt:  { bsonType: "date" },
      lastSeenAt: { bsonType: "date" },
      expiresAt:  { bsonType: "date" }
    }
  }
};

async function ensureCollection(db, name, validator) {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name, { validator: { $jsonSchema: validator } });
  }
}

async function applySchema() {
  const db = getDb();
  const c = {
    invoices: process.env.COLL_INVOICES || "invoices",
    clients:  process.env.COLL_CLIENTS  || "clients",
    counters: process.env.COLL_COUNTERS || "counters",
    users:    process.env.COLL_USERS    || "users",
    sessions: process.env.COLL_SESSIONS || "sessions"
  };

  await ensureCollection(db, c.invoices, validators.invoices);
  await ensureCollection(db, c.clients,  validators.clients);
  await ensureCollection(db, c.counters, validators.counters);
  await ensureCollection(db, c.users,    validators.users);
  await ensureCollection(db, c.sessions, validators.sessions);

  const col = collections();
  await col.invoices.createIndex({ invoiceNumber: 1 }, { unique: true });
  await col.invoices.createIndex({ status: 1, createdAt: -1 });
  await col.invoices.createIndex({ "clientRef.email": 1 });
  await col.invoices.createIndex({ dueDate: 1, status: 1 });
  await col.invoices.createIndex({ paidAt: 1 }, { sparse: true });

  await col.clients.createIndex({ email: 1 }, { unique: true });
  await col.clients.createIndex({ name: 1 });

  await col.users.createIndex({ username: 1 }, { unique: true });

  try {
    await col.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  } catch (_) { /* index already exists with different options — ignore in dev */ }
}

module.exports = { applySchema, validators };
