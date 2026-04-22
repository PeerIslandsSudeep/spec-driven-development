const express = require("express");
const {
  validatePasswordPolicy, createOwner, createSession, destroySession,
  attemptLogin, ownerExists, validateSession
} = require("../services/authService");

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/"
};

// POST /api/setup — first-run owner creation (FR-000c)
router.post("/setup", async (req, res, next) => {
  try {
    if (await ownerExists()) return res.status(409).json({ error: "Owner already exists" });
    const { username, password } = req.body || {};
    if (!username || typeof username !== "string" || username.length > 40 || username.length < 1) {
      return res.status(400).json({ error: "Invalid username" });
    }
    const pwErr = validatePasswordPolicy(password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    const user = await createOwner(username, password);
    const sid = await createSession(user._id);
    res.cookie("sid", sid, COOKIE_OPTS);
    res.status(201).json({ username: user.username });
  } catch (e) { next(e); }
});

// POST /api/login — with throttling (FR-000d)
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password required" });
    const result = await attemptLogin(username, password);
    if (result.status === 429) {
      res.set("Retry-After", String(result.retryAfterSeconds));
      return res.status(429).json({ error: "Locked", retryAfterSeconds: result.retryAfterSeconds });
    }
    if (!result.ok) return res.status(401).json({ error: "Invalid credentials" });
    res.cookie("sid", result.sid, COOKIE_OPTS);
    res.status(200).json({ username: result.username });
  } catch (e) { next(e); }
});

// POST /api/logout
router.post("/logout", async (req, res, next) => {
  try {
    const sid = req.cookies && req.cookies.sid;
    await destroySession(sid);
    res.clearCookie("sid", { path: "/" });
    res.status(204).send();
  } catch (e) { next(e); }
});

// GET /api/session
router.get("/session", async (req, res, next) => {
  try {
    const owner = await ownerExists();
    if (!owner) return res.json({ authenticated: false, ownerExists: false });
    const sid = req.cookies && req.cookies.sid;
    const ctx = await validateSession(sid);
    if (!ctx) return res.json({ authenticated: false, ownerExists: true });
    res.json({ authenticated: true, ownerExists: true, username: ctx.user.username });
  } catch (e) { next(e); }
});

module.exports = router;
