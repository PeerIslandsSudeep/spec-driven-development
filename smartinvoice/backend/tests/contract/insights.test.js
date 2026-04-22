const request = require("supertest");
const { setupTestApp, teardownTestApp, getApp } = require("../helpers/testApp");
const { collections } = require("../../src/config/db");

let cookie;

beforeAll(async () => {
  await setupTestApp();
  const r = await request(getApp()).post("/api/setup").send({ username: "owner", password: "hunter2025" });
  cookie = r.headers["set-cookie"][0];
});

afterAll(async () => { await teardownTestApp(); });

async function clearAll() {
  const { invoices, clients } = collections();
  await Promise.all([invoices.deleteMany({}), clients.deleteMany({})]);
}

async function seedClient(name, email) {
  const { clients } = collections();
  const r = await clients.insertOne({
    name, email, phone: null,
    address: { line1: "1", city: "C", state: "S", pincode: "560001" },
    gstin: null, createdAt: new Date()
  });
  return r.insertedId;
}

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

describe("GET /api/insights", () => {
  beforeEach(clearAll);

  test("empty DB returns insufficient_history", async () => {
    const res = await request(getApp()).get("/api/insights").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.forecast.available).toBe(false);
    expect(res.body.forecast.reason).toBe("insufficient_history");
    expect(res.body.clients).toHaveLength(0);
  });

  test("zero-invoice client returns no_data", async () => {
    await seedClient("Ghost", "ghost@test.in");
    const res = await request(getApp()).get("/api/insights").set("Cookie", cookie);
    const ghost = res.body.clients.find((c) => c.clientEmail === "ghost@test.in");
    expect(ghost).toBeTruthy();
    expect(ghost.riskLevel).toBe("no_data");
    expect(ghost.paymentScore).toBeNull();
  });

  test("all-on-time paid client scores >= 70 (low risk)", async () => {
    const cid = await seedClient("Payer", "payer@test.in");
    const { invoices } = collections();
    for (let i = 0; i < 5; i++) {
      // issue earliest → paid a few days later → due after that (so paid < due = on-time)
      const issue  = daysAgo(40 - i * 5);
      const paidOn = daysAgo(37 - i * 5);
      const due    = daysAgo(32 - i * 5);
      await invoices.insertOne({
        invoiceNumber: `INV-100${i}`, status: "paid",
        clientRef: { clientId: cid, name: "Payer", email: "payer@test.in", gstin: null },
        lineItems: [{ description: "A", qty: 1, unitPricePaise: 10000, lineTotalPaise: 10000, hsnSac: null }],
        subtotalPaise: 10000, taxPaise: 1800, grandTotalPaise: 11800,
        issueDate: issue, dueDate: due, sentAt: issue, paidAt: paidOn,
        payment: { amountPaise: 11800, paidAt: paidOn, method: "upi", reference: null },
        notes: "", createdAt: issue, updatedAt: paidOn,
      });
    }
    const res = await request(getApp()).get("/api/insights").set("Cookie", cookie);
    const payer = res.body.clients.find((c) => c.clientEmail === "payer@test.in");
    expect(payer.paymentScore).toBeGreaterThanOrEqual(70);
    expect(payer.riskLevel).toBe("low");
  });

  test("all-late overdue client scores < 40 (high risk)", async () => {
    const cid = await seedClient("Late", "late@test.in");
    const { invoices } = collections();
    for (let i = 0; i < 2; i++) {
      await invoices.insertOne({
        invoiceNumber: `INV-200${i}`, status: "overdue",
        clientRef: { clientId: cid, name: "Late", email: "late@test.in", gstin: null },
        lineItems: [{ description: "A", qty: 1, unitPricePaise: 10000, lineTotalPaise: 10000, hsnSac: null }],
        subtotalPaise: 10000, taxPaise: 1800, grandTotalPaise: 11800,
        issueDate: daysAgo(90), dueDate: daysAgo(60), sentAt: daysAgo(90), paidAt: null, payment: null,
        notes: "", createdAt: daysAgo(90), updatedAt: daysAgo(60),
      });
    }
    const res = await request(getApp()).get("/api/insights").set("Cookie", cookie);
    const late = res.body.clients.find((c) => c.clientEmail === "late@test.in");
    expect(late.paymentScore).toBeLessThan(40);
    expect(late.riskLevel).toBe("high");
  });
});
