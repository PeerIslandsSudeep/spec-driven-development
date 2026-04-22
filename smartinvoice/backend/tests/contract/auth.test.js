const request = require("supertest");
const { setupTestApp, teardownTestApp, getApp } = require("../helpers/testApp");
const { collections } = require("../../src/config/db");

beforeAll(async () => { await setupTestApp(); });
afterAll(async () => { await teardownTestApp(); });

async function clearUsers() {
  const { users, sessions } = collections();
  await users.deleteMany({});
  await sessions.deleteMany({});
}

describe("auth endpoints", () => {
  describe("POST /api/setup", () => {
    beforeEach(clearUsers);

    test("first-run creates owner and sets session cookie", async () => {
      const res = await request(getApp())
        .post("/api/setup")
        .send({ username: "owner", password: "hunter2025" });
      expect(res.status).toBe(201);
      expect(res.body.username).toBe("owner");
      expect(res.headers["set-cookie"].some((c) => c.startsWith("sid="))).toBe(true);
    });

    test("second call returns 409", async () => {
      await request(getApp()).post("/api/setup").send({ username: "owner", password: "hunter2025" });
      const res = await request(getApp()).post("/api/setup").send({ username: "other", password: "hunter2025" });
      expect(res.status).toBe(409);
    });

    test("rejects short password", async () => {
      const res = await request(getApp()).post("/api/setup").send({ username: "x", password: "abc1" });
      expect(res.status).toBe(400);
    });
    test("rejects password without digit", async () => {
      const res = await request(getApp()).post("/api/setup").send({ username: "x", password: "abcdefgh" });
      expect(res.status).toBe(400);
    });
    test("rejects password without letter", async () => {
      const res = await request(getApp()).post("/api/setup").send({ username: "x", password: "12345678" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/login + throttle", () => {
    beforeEach(async () => {
      await clearUsers();
      await request(getApp()).post("/api/setup").send({ username: "owner", password: "hunter2025" });
    });

    test("correct credentials", async () => {
      const res = await request(getApp()).post("/api/login").send({ username: "owner", password: "hunter2025" });
      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"][0]).toMatch(/^sid=/);
    });

    test("wrong password returns 401", async () => {
      const res = await request(getApp()).post("/api/login").send({ username: "owner", password: "wrongpass1" });
      expect(res.status).toBe(401);
    });

    test("unknown username returns 401 (no user enumeration)", async () => {
      const res = await request(getApp()).post("/api/login").send({ username: "nobody", password: "hunter2025" });
      expect(res.status).toBe(401);
    });

    test("5 failed attempts → lockout (429)", async () => {
      for (let i = 0; i < 4; i++) {
        const r = await request(getApp()).post("/api/login").send({ username: "owner", password: "wrongpass1" });
        expect(r.status).toBe(401);
      }
      const r5 = await request(getApp()).post("/api/login").send({ username: "owner", password: "wrongpass1" });
      expect(r5.status).toBe(429);
      expect(r5.body.retryAfterSeconds).toBeGreaterThan(0);
      // Correct password during lockout is still 429
      const r6 = await request(getApp()).post("/api/login").send({ username: "owner", password: "hunter2025" });
      expect(r6.status).toBe(429);
    });

    test("successful login resets failure counter", async () => {
      for (let i = 0; i < 3; i++) {
        await request(getApp()).post("/api/login").send({ username: "owner", password: "wrongpass1" });
      }
      const ok = await request(getApp()).post("/api/login").send({ username: "owner", password: "hunter2025" });
      expect(ok.status).toBe(200);
      const { users } = collections();
      const u = await users.findOne({ username: "owner" });
      expect(u.failedAttempts).toEqual([]);
    });
  });

  describe("POST /api/logout", () => {
    test("204 regardless of session", async () => {
      const res = await request(getApp()).post("/api/logout");
      expect(res.status).toBe(204);
    });
  });

  describe("GET /api/session", () => {
    test("no owner → ownerExists false", async () => {
      await clearUsers();
      const res = await request(getApp()).get("/api/session");
      expect(res.status).toBe(200);
      expect(res.body.ownerExists).toBe(false);
    });
    test("owner exists, no cookie → not authenticated", async () => {
      await clearUsers();
      await request(getApp()).post("/api/setup").send({ username: "owner", password: "hunter2025" });
      const res = await request(getApp()).get("/api/session");
      expect(res.body.ownerExists).toBe(true);
      expect(res.body.authenticated).toBe(false);
    });
    test("owner exists, valid session → authenticated", async () => {
      await clearUsers();
      const setup = await request(getApp()).post("/api/setup").send({ username: "owner", password: "hunter2025" });
      const cookie = setup.headers["set-cookie"][0];
      const res = await request(getApp()).get("/api/session").set("Cookie", cookie);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.username).toBe("owner");
    });
  });
});
