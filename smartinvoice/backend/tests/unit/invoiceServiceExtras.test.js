const { setupTestApp, teardownTestApp } = require("../helpers/testApp");
const { collections } = require("../../src/config/db");
const invSvc = require("../../src/services/invoiceService");
const clientSvc = require("../../src/services/clientService");

beforeAll(async () => { await setupTestApp(); });
afterAll(async () => { await teardownTestApp(); });

async function clearAll() {
  const { invoices, clients, counters } = collections();
  await Promise.all([invoices.deleteMany({}), clients.deleteMany({}), counters.deleteMany({})]);
}

describe("invoiceService edge cases", () => {
  beforeEach(clearAll);

  test("getInvoice 404s for unknown id", async () => {
    await expect(invSvc.getInvoice("507f1f77bcf86cd799439011")).rejects.toThrow(/not found/i);
  });

  test("getInvoice 400s for invalid id format", async () => {
    await expect(invSvc.getInvoice("not-an-id")).rejects.toThrow(/Invalid/);
  });

  test("updateDraft rejects on non-draft", async () => {
    const client = await clientSvc.createClient({
      name: "A", email: "a@a.in", address: { line1: "1", city: "c", state: "s", pincode: "560001" }
    });
    const inv = await invSvc.createInvoice({
      clientId: client._id.toHexString(),
      lineItems: [{ description: "A", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    });
    await invSvc.transitionStatus(inv._id.toHexString(), "pending");
    await expect(invSvc.updateDraft(inv._id.toHexString(), {
      clientId: client._id.toHexString(),
      lineItems: [{ description: "A", qty: 1, unitPricePaise: 2000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    })).rejects.toThrow(/draft/i);
  });

  test("overdue auto-transition for past-due pending invoices", async () => {
    const client = await clientSvc.createClient({
      name: "B", email: "b@b.in", address: { line1: "1", city: "c", state: "s", pincode: "560001" }
    });
    const inv = await invSvc.createInvoice({
      clientId: client._id.toHexString(),
      lineItems: [{ description: "A", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-01-01", dueDate: "2026-01-31"
    });
    await invSvc.transitionStatus(inv._id.toHexString(), "pending");
    const r = await invSvc.listInvoices({});
    const found = r.invoices.find((i) => String(i._id) === String(inv._id));
    expect(found.status).toBe("overdue");
  });

  test("createInvoice rejects invalid clientId format", async () => {
    await expect(invSvc.createInvoice({
      clientId: "not-an-id",
      lineItems: [{ description: "A", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-04-21", dueDate: "2026-05-21"
    })).rejects.toThrow(/Invalid clientId/);
  });

  test("createInvoice rejects when dueDate < issueDate", async () => {
    const client = await clientSvc.createClient({
      name: "C", email: "c@c.in", address: { line1: "1", city: "c", state: "s", pincode: "560001" }
    });
    await expect(invSvc.createInvoice({
      clientId: client._id.toHexString(),
      lineItems: [{ description: "A", qty: 1, unitPricePaise: 1000 }],
      issueDate: "2026-05-21", dueDate: "2026-04-21"
    })).rejects.toThrow(/on or after/);
  });
});
