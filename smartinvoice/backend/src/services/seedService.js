const { collections } = require("../config/db");

function daysAgo(n, now = new Date()) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() - n);
  return d;
}

async function seedIfEmpty() {
  const { invoices, clients, counters } = collections();
  const n = await invoices.countDocuments({});
  if (n > 0) return false;

  const now = new Date();
  const clientDocs = [
    { name: "Mehta Traders",  email: "mehta@tarpaulinco.in",  phone: "+91 98765 10001", address: { line1: "14 Industrial Estate", line2: "Phase II", city: "Bengaluru", state: "Karnataka", pincode: "560058" }, gstin: "29AADCE3455F1Z5", createdAt: daysAgo(180, now) },
    { name: "Reddy Exports",  email: "reddy@exports.co.in",   phone: "+91 98765 10002", address: { line1: "12 MG Road",           line2: null,        city: "Bengaluru", state: "Karnataka", pincode: "560001" }, gstin: "29AAECR1234K1Z8", createdAt: daysAgo(160, now) },
    { name: "Singh & Sons",   email: "singh@singhandsons.com",phone: "+91 98765 10003", address: { line1: "88 GT Karnal Road",    line2: null,        city: "New Delhi", state: "Delhi",     pincode: "110033" }, gstin: "07AAACS7890M1ZC", createdAt: daysAgo(140, now) },
    { name: "Nair Tech",      email: "nair@nairtech.io",      phone: "+91 98765 10004", address: { line1: "4 Infopark",           line2: "Phase I",   city: "Kochi",     state: "Kerala",    pincode: "682042" }, gstin: "32AAFCN4567L1ZD", createdAt: daysAgo(120, now) },
  ];
  const clientInsert = await clients.insertMany(clientDocs);
  const [c1, c2, c3, c4] = clientDocs.map((c, i) => ({ ...c, _id: clientInsert.insertedIds[i] }));

  const makeInvoice = (num, client, status, linePrices, issueD, dueD, paidD) => {
    const lineItems = linePrices.map((p, i) => ({
      description: `Line item ${i + 1}`,
      qty: 1,
      unitPricePaise: p,
      lineTotalPaise: p,
      hsnSac: i === 0 ? "6306" : null
    }));
    const subtotalPaise = lineItems.reduce((s, li) => s + li.lineTotalPaise, 0);
    const taxPaise = Math.floor(subtotalPaise * 18 / 100);
    const grandTotalPaise = subtotalPaise + taxPaise;
    return {
      invoiceNumber: `INV-${String(num).padStart(4, "0")}`,
      status,
      clientRef: { clientId: client._id, name: client.name, email: client.email, gstin: client.gstin || null },
      lineItems, subtotalPaise, taxPaise, grandTotalPaise,
      issueDate: issueD, dueDate: dueD,
      sentAt: status !== "draft" ? issueD : null,
      paidAt: status === "paid" ? paidD : null,
      payment: status === "paid" ? { amountPaise: grandTotalPaise, paidAt: paidD, method: "upi", reference: `SEED-${num}` } : null,
      notes: "", createdAt: issueD, updatedAt: paidD || issueD,
    };
  };

  const invoiceDocs = [
    makeInvoice(1, c1, "paid",    [2000000],         daysAgo(100, now), daysAgo(70, now),  daysAgo(85, now)),
    makeInvoice(2, c2, "overdue", [1000000],         daysAgo(60, now),  daysAgo(30, now),  null),
    makeInvoice(3, c3, "paid",    [3000000, 1000000],daysAgo(80, now),  daysAgo(50, now),  daysAgo(55, now)),
    makeInvoice(4, c4, "paid",    [5000000],         daysAgo(75, now),  daysAgo(45, now),  daysAgo(40, now)),
    makeInvoice(5, c1, "pending", [700000],          daysAgo(5, now),   daysAgo(-25, now), null),
    makeInvoice(6, c3, "paid",    [1300000],         daysAgo(45, now),  daysAgo(15, now),  daysAgo(20, now)),
    makeInvoice(7, c2, "pending", [800000],          daysAgo(2, now),   daysAgo(-28, now), null),
    makeInvoice(8, c4, "draft",   [400000],          daysAgo(1, now),   daysAgo(-29, now), null),
  ];
  await invoices.insertMany(invoiceDocs);
  await counters.updateOne(
    { _id: "invoiceSeq" },
    { $set: { seq: 8 } },
    { upsert: true }
  );
  return true;
}

module.exports = { seedIfEmpty };
