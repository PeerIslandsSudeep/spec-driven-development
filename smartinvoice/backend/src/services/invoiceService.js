const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");
const { computeTotals } = require("./calcService");
const { HttpError } = require("../middleware/error");

async function nextInvoiceNumber() {
  const { counters } = collections();
  const r = await counters.findOneAndUpdate(
    { _id: "invoiceSeq" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const doc = r.value || r;
  return `INV-${String(doc.seq).padStart(4, "0")}`;
}

function validateInvoicePayload(p) {
  if (!p) throw new HttpError(400, "Missing body");
  if (!p.clientId) throw new HttpError(400, "clientId required");
  if (!Array.isArray(p.lineItems) || p.lineItems.length < 1) throw new HttpError(400, "At least one line item required");
  for (const li of p.lineItems) {
    if (!li.description || typeof li.description !== "string") throw new HttpError(400, "Line item description required");
    if (!Number.isInteger(li.qty) || li.qty < 1) throw new HttpError(400, "Invalid line item qty");
    if (!Number.isInteger(li.unitPricePaise) || li.unitPricePaise < 0) throw new HttpError(400, "Invalid line item unitPricePaise");
  }
  if (!p.issueDate || !p.dueDate) throw new HttpError(400, "issueDate and dueDate required");
  const issue = new Date(p.issueDate);
  const due = new Date(p.dueDate);
  if (isNaN(issue) || isNaN(due)) throw new HttpError(400, "Invalid issueDate or dueDate");
  if (due < issue) throw new HttpError(400, "Due date must be on or after issue date");
  return { issueDate: issue, dueDate: due };
}

async function autoTransitionOverdue() {
  const { invoices } = collections();
  const now = new Date();
  await invoices.updateMany(
    { status: "pending", dueDate: { $lt: now } },
    { $set: { status: "overdue", updatedAt: now } }
  );
}

async function createInvoice(payload) {
  const { invoices, clients } = collections();
  const { issueDate, dueDate } = validateInvoicePayload(payload);

  let clientId;
  try { clientId = new ObjectId(payload.clientId); }
  catch { throw new HttpError(400, "Invalid clientId"); }

  const client = await clients.findOne({ _id: clientId });
  if (!client) throw new HttpError(400, "Client not found");

  const totals = computeTotals(payload.lineItems);
  const invoiceNumber = await nextInvoiceNumber();
  const now = new Date();
  const doc = {
    invoiceNumber,
    status: "draft",
    clientRef: {
      clientId: client._id,
      name: client.name,
      email: client.email,
      gstin: client.gstin || null,
    },
    lineItems: totals.lineItems,
    subtotalPaise: totals.subtotalPaise,
    taxPaise: totals.taxPaise,
    grandTotalPaise: totals.grandTotalPaise,
    issueDate,
    dueDate,
    sentAt: null,
    paidAt: null,
    payment: null,
    notes: payload.notes || "",
    createdAt: now,
    updatedAt: now,
  };
  const r = await invoices.insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

async function listInvoices({ status, page = 1, pageSize = 10, q, sort = "createdAt:-1" } = {}) {
  await autoTransitionOverdue();
  const { invoices } = collections();
  pageSize = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 100);
  page = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (status) {
    if (!["draft","pending","paid","overdue"].includes(status)) throw new HttpError(400, "Invalid status filter");
    filter.status = status;
  }
  if (q && typeof q === "string" && q.length >= 2) {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { invoiceNumber: { $regex: esc, $options: "i" } },
      { "clientRef.name": { $regex: esc, $options: "i" } }
    ];
  }

  const [field, dir] = sort.split(":");
  const sortSpec = { [field || "createdAt"]: dir === "1" ? 1 : -1 };

  const total = await invoices.countDocuments(filter);
  const docs = await invoices.find(filter).sort(sortSpec).skip((page - 1) * pageSize).limit(pageSize).toArray();
  return { invoices: docs, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

async function getInvoice(id) {
  await autoTransitionOverdue();
  const { invoices } = collections();
  let oid;
  try { oid = new ObjectId(id); } catch { throw new HttpError(400, "Invalid invoice id"); }
  const doc = await invoices.findOne({ _id: oid });
  if (!doc) throw new HttpError(404, "Invoice not found");
  return doc;
}

async function updateDraft(id, payload) {
  const existing = await getInvoice(id);
  if (existing.status !== "draft") throw new HttpError(403, "Only draft invoices can be edited");
  const { invoices, clients } = collections();
  const { issueDate, dueDate } = validateInvoicePayload(payload);

  let clientId;
  try { clientId = new ObjectId(payload.clientId); } catch { throw new HttpError(400, "Invalid clientId"); }
  const client = await clients.findOne({ _id: clientId });
  if (!client) throw new HttpError(400, "Client not found");

  const totals = computeTotals(payload.lineItems);
  const now = new Date();
  const update = {
    clientRef: { clientId: client._id, name: client.name, email: client.email, gstin: client.gstin || null },
    lineItems: totals.lineItems,
    subtotalPaise: totals.subtotalPaise,
    taxPaise: totals.taxPaise,
    grandTotalPaise: totals.grandTotalPaise,
    issueDate, dueDate,
    notes: payload.notes || "",
    updatedAt: now,
  };
  await invoices.updateOne({ _id: existing._id }, { $set: update });
  return await invoices.findOne({ _id: existing._id });
}

async function transitionStatus(id, newStatus) {
  const existing = await getInvoice(id);
  const allowed = {
    draft:   ["pending"],
    pending: ["paid"],
    overdue: ["paid"]
  };
  if (!allowed[existing.status] || !allowed[existing.status].includes(newStatus)) {
    throw new HttpError(400, `Cannot transition from ${existing.status} to ${newStatus}`);
  }
  const { invoices } = collections();
  const now = new Date();
  const set = { status: newStatus, updatedAt: now };
  if (newStatus === "pending") set.sentAt = now;
  if (newStatus === "paid")    set.paidAt = now;
  await invoices.updateOne({ _id: existing._id }, { $set: set });
  return await invoices.findOne({ _id: existing._id });
}

async function recordPayment(id, { amountPaise, paidAt, method, reference }) {
  const existing = await getInvoice(id);
  if (!["pending","overdue"].includes(existing.status)) {
    throw new HttpError(409, "Invoice is not in a payable state");
  }
  if (existing.payment) throw new HttpError(409, "Invoice is already paid");
  if (!Number.isInteger(amountPaise)) throw new HttpError(400, "amountPaise must be an integer");
  if (amountPaise !== existing.grandTotalPaise) {
    throw new HttpError(400, "Payment must equal grand total (partial payments out of scope)");
  }
  const paid = paidAt ? new Date(paidAt) : new Date();
  if (isNaN(paid)) throw new HttpError(400, "Invalid paidAt timestamp");
  const allowedMethods = ["upi","bank_transfer","cash","cheque","other"];
  if (method != null && !allowedMethods.includes(method)) throw new HttpError(400, "Invalid payment method");
  const { invoices } = collections();
  const now = new Date();
  await invoices.updateOne(
    { _id: existing._id },
    { $set: {
        status: "paid",
        paidAt: paid,
        payment: {
          amountPaise,
          paidAt: paid,
          method: method || null,
          reference: reference || null
        },
        updatedAt: now
    } }
  );
  return await invoices.findOne({ _id: existing._id });
}

async function deleteDraft(id) {
  const existing = await getInvoice(id);
  if (existing.status !== "draft") {
    throw new HttpError(403, "Sent invoices cannot be deleted (audit/compliance)");
  }
  const { invoices } = collections();
  await invoices.deleteOne({ _id: existing._id });
}

module.exports = {
  nextInvoiceNumber,
  createInvoice,
  listInvoices,
  getInvoice,
  updateDraft,
  transitionStatus,
  recordPayment,
  deleteDraft,
  autoTransitionOverdue,
};
