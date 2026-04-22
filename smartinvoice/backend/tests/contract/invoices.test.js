const request = require("supertest");
const { setupTestApp, teardownTestApp, getApp } = require("../helpers/testApp");
const { collections } = require("../../src/config/db");

let cookie;
let clientId;

beforeAll(async () => {
  await setupTestApp();
  const setup = await request(getApp()).post("/api/setup").send({ username: "owner", password: "hunter2025" });
  cookie = setup.headers["set-cookie"][0];
  const c = await request(getApp()).post("/api/clients").set("Cookie", cookie).send({
    name: "Test Client", email: "client@test.in", phone: "+91 99999 00001",
    address: { line1: "1 Test Rd", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
    gstin: null,
  });
  clientId = c.body._id;
});

afterAll(async () => { await teardownTestApp(); });

async function clearInvoices() {
  const { invoices, counters } = collections();
  await invoices.deleteMany({});
  await counters.deleteMany({});
}

describe("POST /api/invoices", () => {
  beforeEach(clearInvoices);

  test("creates invoice with auto-computed totals and INV-0001 number", async () => {
    const res = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId,
      lineItems: [{ description: "Widget", qty: 10, unitPricePaise: 120000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    expect(res.status).toBe(201);
    expect(res.body.invoiceNumber).toBe("INV-0001");
    expect(res.body.subtotalPaise).toBe(1200000);
    expect(res.body.taxPaise).toBe(216000);
    expect(res.body.grandTotalPaise).toBe(1416000);
    expect(res.body.status).toBe("draft");
  });

  test("second create gets INV-0002", async () => {
    await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 100 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    const r2 = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "B", qty: 1, unitPricePaise: 100 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    expect(r2.body.invoiceNumber).toBe("INV-0002");
  });

  test("GST floor on sub-paisa (11 paise → 1)", async () => {
    const res = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "X", qty: 1, unitPricePaise: 11 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    expect(res.body.taxPaise).toBe(1);
    expect(res.body.grandTotalPaise).toBe(12);
  });

  test("empty lineItems → 400", async () => {
    const res = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [], issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    expect(res.status).toBe(400);
  });

  test("qty 0 → 400", async () => {
    const res = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "X", qty: 0, unitPricePaise: 100 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    expect(res.status).toBe(400);
  });

  test("unknown clientId → 400", async () => {
    const res = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId: "507f1f77bcf86cd799439011",
      lineItems: [{ description: "X", qty: 1, unitPricePaise: 100 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    expect(res.status).toBe(400);
  });

  test("no auth → 401", async () => {
    const res = await request(getApp()).post("/api/invoices").send({});
    expect(res.status).toBe(401);
  });
});

describe("GET /api/invoices", () => {
  beforeEach(clearInvoices);

  test("returns paginated list", async () => {
    await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 100 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    const res = await request(getApp()).get("/api/invoices").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.invoices).toHaveLength(1);
  });

  test("?status=draft filters", async () => {
    await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 100 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    const res = await request(getApp()).get("/api/invoices?status=draft").set("Cookie", cookie);
    expect(res.body.invoices.every((i) => i.status === "draft")).toBe(true);
  });

  test("?status=foo → 400", async () => {
    const res = await request(getApp()).get("/api/invoices?status=foo").set("Cookie", cookie);
    expect(res.status).toBe(400);
  });
});

describe("lifecycle transitions", () => {
  beforeEach(clearInvoices);

  async function createDraft() {
    const r = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    return r.body;
  }

  test("draft → pending via PATCH /status", async () => {
    const inv = await createDraft();
    const r = await request(getApp()).patch(`/api/invoices/${inv._id}/status`).set("Cookie", cookie).send({ status: "pending" });
    expect(r.body.status).toBe("pending");
    expect(r.body.sentAt).toBeTruthy();
  });

  test("paid → draft rejected", async () => {
    const inv = await createDraft();
    await request(getApp()).patch(`/api/invoices/${inv._id}/status`).set("Cookie", cookie).send({ status: "pending" });
    const r = await request(getApp()).patch(`/api/invoices/${inv._id}/status`).set("Cookie", cookie).send({ status: "draft" });
    expect(r.status).toBe(400);
  });

  test("PATCH body on locked invoice → 403", async () => {
    const inv = await createDraft();
    await request(getApp()).patch(`/api/invoices/${inv._id}/status`).set("Cookie", cookie).send({ status: "pending" });
    const r = await request(getApp()).patch(`/api/invoices/${inv._id}`).set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "X", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    expect(r.status).toBe(403);
  });
});

describe("DELETE /api/invoices/:id", () => {
  beforeEach(clearInvoices);

  test("draft is deletable", async () => {
    const r = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    const d = await request(getApp()).delete(`/api/invoices/${r.body._id}`).set("Cookie", cookie);
    expect(d.status).toBe(204);
    const g = await request(getApp()).get(`/api/invoices/${r.body._id}`).set("Cookie", cookie);
    expect(g.status).toBe(404);
  });

  test("non-draft refuses delete", async () => {
    const r = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    await request(getApp()).patch(`/api/invoices/${r.body._id}/status`).set("Cookie", cookie).send({ status: "pending" });
    const d = await request(getApp()).delete(`/api/invoices/${r.body._id}`).set("Cookie", cookie);
    expect(d.status).toBe(403);
  });
});

describe("POST /api/invoices/:id/payments", () => {
  beforeEach(clearInvoices);

  async function createPending() {
    const r = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 10000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    await request(getApp()).patch(`/api/invoices/${r.body._id}/status`).set("Cookie", cookie).send({ status: "pending" });
    return r.body;
  }

  test("pending + matching amount → paid", async () => {
    const inv = await createPending();
    const r = await request(getApp()).post(`/api/invoices/${inv._id}/payments`).set("Cookie", cookie).send({
      amountPaise: 11800, paidAt: new Date().toISOString(), method: "upi", reference: "TXN-1"
    });
    expect(r.status).toBe(201);
    expect(r.body.invoice.status).toBe("paid");
  });

  test("partial amount → 400", async () => {
    const inv = await createPending();
    const r = await request(getApp()).post(`/api/invoices/${inv._id}/payments`).set("Cookie", cookie).send({
      amountPaise: 5000
    });
    expect(r.status).toBe(400);
  });

  test("already paid → 409", async () => {
    const inv = await createPending();
    await request(getApp()).post(`/api/invoices/${inv._id}/payments`).set("Cookie", cookie).send({
      amountPaise: 11800
    });
    const r = await request(getApp()).post(`/api/invoices/${inv._id}/payments`).set("Cookie", cookie).send({
      amountPaise: 11800
    });
    expect(r.status).toBe(409);
  });

  test("draft → 409", async () => {
    const cr = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 10000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    const r = await request(getApp()).post(`/api/invoices/${cr.body._id}/payments`).set("Cookie", cookie).send({
      amountPaise: 11800
    });
    expect(r.status).toBe(409);
  });
});

describe("GET /api/invoices/:id/pdf", () => {
  beforeEach(clearInvoices);

  test("returns application/pdf for any status", async () => {
    const r = await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    const pdf = await request(getApp()).get(`/api/invoices/${r.body._id}/pdf`).set("Cookie", cookie);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/application\/pdf/);
    expect(pdf.body.length).toBeGreaterThan(100);
  });
});

describe("GET /api/invoices/export.csv", () => {
  beforeEach(clearInvoices);

  test("returns CSV with header", async () => {
    await request(getApp()).post("/api/invoices").set("Cookie", cookie).send({
      clientId, lineItems: [{ description: "A", qty: 1, unitPricePaise: 10000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    const r = await request(getApp()).get("/api/invoices/export.csv").set("Cookie", cookie);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);
    expect(r.text).toMatch(/Invoice Number,Client Name/);
    expect(r.text).toMatch(/INV-\d{4}/);
  });
});
