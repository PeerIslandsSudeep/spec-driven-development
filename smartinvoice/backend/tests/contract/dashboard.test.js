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
  const { invoices, clients, counters } = collections();
  await Promise.all([invoices.deleteMany({}), clients.deleteMany({}), counters.deleteMany({})]);
}

describe("GET /api/dashboard", () => {
  beforeEach(clearAll);

  test("auth required", async () => {
    const res = await request(getApp()).get("/api/dashboard");
    expect(res.status).toBe(401);
  });

  test("empty DB returns all-zero stats", async () => {
    const res = await request(getApp()).get("/api/dashboard").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.stats.totalRevenuePaise).toBe(0);
    expect(res.body.stats.totalOutstandingPaise).toBe(0);
    expect(res.body.stats.overdueCount).toBe(0);
    expect(res.body.stats.totalInvoiceCount).toBe(0);
    expect(res.body.chart).toHaveLength(12);
    expect(res.body.chart.every((m) => m.revenuePaise === 0)).toBe(true);
    expect(res.body.recent).toHaveLength(0);
  });

  test("chart always has 12 months", async () => {
    const res = await request(getApp()).get("/api/dashboard").set("Cookie", cookie);
    expect(res.body.chart).toHaveLength(12);
    const year = new Date().getFullYear();
    expect(res.body.chart[0].month).toBe(`${year}-01`);
    expect(res.body.chart[11].month).toBe(`${year}-12`);
  });

  test("single paid invoice reflected in totalRevenue", async () => {
    const { invoices, clients } = collections();
    const c = await clients.insertOne({
      name: "X", email: "x@test.in", phone: null,
      address: { line1: "1", city: "C", state: "S", pincode: "560001" },
      gstin: null, createdAt: new Date()
    });
    const now = new Date();
    await invoices.insertOne({
      invoiceNumber: "INV-0001", status: "paid",
      clientRef: { clientId: c.insertedId, name: "X", email: "x@test.in", gstin: null },
      lineItems: [{ description: "A", qty: 1, unitPricePaise: 10000, lineTotalPaise: 10000, hsnSac: null }],
      subtotalPaise: 10000, taxPaise: 1800, grandTotalPaise: 11800,
      issueDate: now, dueDate: now, sentAt: now, paidAt: now,
      payment: { amountPaise: 11800, paidAt: now, method: "upi", reference: null },
      notes: "", createdAt: now, updatedAt: now
    });
    const res = await request(getApp()).get("/api/dashboard").set("Cookie", cookie);
    expect(res.body.stats.totalRevenuePaise).toBe(11800);
    expect(res.body.stats.totalInvoiceCount).toBe(1);
  });
});
