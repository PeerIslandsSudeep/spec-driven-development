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

async function clearClients() {
  const { clients } = collections();
  await clients.deleteMany({});
}

const base = {
  name: "Test Co", email: "test@co.in", phone: "+91 99999 00000",
  address: { line1: "1 Test Rd", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
  gstin: null,
};

describe("POST /api/clients", () => {
  beforeEach(clearClients);

  test("creates client and returns 201", async () => {
    const r = await request(getApp()).post("/api/clients").set("Cookie", cookie).send(base);
    expect(r.status).toBe(201);
    expect(r.body.email).toBe("test@co.in");
  });

  test("duplicate email rejected with 409", async () => {
    await request(getApp()).post("/api/clients").set("Cookie", cookie).send(base);
    const r = await request(getApp()).post("/api/clients").set("Cookie", cookie).send(base);
    expect(r.status).toBe(409);
  });

  test("bad GSTIN rejected with 400", async () => {
    const r = await request(getApp()).post("/api/clients").set("Cookie", cookie).send({ ...base, gstin: "NOT-VALID" });
    expect(r.status).toBe(400);
  });

  test("bad pincode rejected with 400", async () => {
    const r = await request(getApp()).post("/api/clients").set("Cookie", cookie).send({
      ...base, address: { ...base.address, pincode: "12" }
    });
    expect(r.status).toBe(400);
  });
});

describe("GET /api/clients", () => {
  beforeEach(clearClients);

  test("lists clients", async () => {
    await request(getApp()).post("/api/clients").set("Cookie", cookie).send(base);
    const r = await request(getApp()).get("/api/clients").set("Cookie", cookie);
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(1);
  });
});

describe("GET /api/clients/:id", () => {
  test("404 for unknown", async () => {
    const r = await request(getApp()).get("/api/clients/507f1f77bcf86cd799439011").set("Cookie", cookie);
    expect(r.status).toBe(404);
  });
  test("400 for malformed id", async () => {
    const r = await request(getApp()).get("/api/clients/not-an-id").set("Cookie", cookie);
    expect(r.status).toBe(400);
  });
});
