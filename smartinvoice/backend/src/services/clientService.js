const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");
const { HttpError } = require("../middleware/error");

function validatePayload(p) {
  if (!p) throw new HttpError(400, "Missing body");
  if (!p.name || typeof p.name !== "string") throw new HttpError(400, "name required");
  if (!p.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) throw new HttpError(400, "Valid email required");
  const a = p.address || {};
  if (!a.line1 || !a.city || !a.state || !a.pincode) throw new HttpError(400, "address line1/city/state/pincode required");
  if (!/^[0-9]{6}$/.test(a.pincode)) throw new HttpError(400, "pincode must be 6 digits");
  if (p.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(p.gstin)) {
    throw new HttpError(400, "Invalid GSTIN format");
  }
}

async function createClient(payload) {
  validatePayload(payload);
  const { clients } = collections();
  const doc = {
    name: payload.name,
    email: payload.email.toLowerCase(),
    phone: payload.phone || null,
    address: {
      line1: payload.address.line1,
      line2: payload.address.line2 || null,
      city: payload.address.city,
      state: payload.address.state,
      pincode: payload.address.pincode,
    },
    gstin: payload.gstin || null,
    createdAt: new Date(),
  };
  try {
    const r = await clients.insertOne(doc);
    return { ...doc, _id: r.insertedId };
  } catch (e) {
    if (e.code === 11000) throw new HttpError(409, "Client with this email already exists");
    throw e;
  }
}

async function listClients() {
  const { clients } = collections();
  return clients.find({}).sort({ name: 1 }).toArray();
}

async function getClient(id) {
  const { clients } = collections();
  let oid;
  try { oid = new ObjectId(id); } catch { throw new HttpError(400, "Invalid client id"); }
  const doc = await clients.findOne({ _id: oid });
  if (!doc) throw new HttpError(404, "Client not found");
  return doc;
}

module.exports = { createClient, listClients, getClient };
