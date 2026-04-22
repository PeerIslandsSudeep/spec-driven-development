const argon2 = require("argon2");
const crypto = require("crypto");
const { collections } = require("../config/db");

const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 24 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000;

function validatePasswordPolicy(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(pw)) return "Password must contain at least one letter";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one digit";
  return null;
}

async function hashPassword(pw) {
  return argon2.hash(pw, { type: argon2.argon2id });
}

async function verifyPassword(hash, pw) {
  try { return await argon2.verify(hash, pw); } catch { return false; }
}

async function ownerExists() {
  const { users } = collections();
  return (await users.countDocuments({})) > 0;
}

async function createOwner(username, password) {
  const { users } = collections();
  const passwordHash = await hashPassword(password);
  const now = new Date();
  const doc = { username, passwordHash, createdAt: now, failedAttempts: [], lockedUntil: null };
  const result = await users.insertOne(doc);
  return { _id: result.insertedId, username };
}

function generateSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

async function createSession(userId) {
  const { sessions } = collections();
  const now = new Date();
  const sid = generateSessionId();
  const doc = {
    _id: sid,
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
  };
  await sessions.insertOne(doc);
  return sid;
}

async function destroySession(sid) {
  if (!sid) return;
  const { sessions } = collections();
  await sessions.deleteOne({ _id: sid });
}

async function validateSession(sid) {
  if (!sid) return null;
  const { sessions, users } = collections();
  const session = await sessions.findOne({ _id: sid });
  if (!session) return null;
  const now = new Date();
  if (session.expiresAt <= now) { await sessions.deleteOne({ _id: sid }); return null; }
  if (now - session.lastSeenAt > SESSION_IDLE_MS) { await sessions.deleteOne({ _id: sid }); return null; }
  await sessions.updateOne({ _id: sid }, { $set: { lastSeenAt: now } });
  const user = await users.findOne({ _id: session.userId });
  if (!user) { await sessions.deleteOne({ _id: sid }); return null; }
  return { sid, user: { _id: user._id, username: user.username } };
}

async function attemptLogin(username, password) {
  const { users } = collections();
  const now = new Date();
  const user = await users.findOne({ username });
  if (!user) return { ok: false, status: 401 };

  if (user.lockedUntil && now < user.lockedUntil) {
    const retryAfterSeconds = Math.ceil((user.lockedUntil - now) / 1000);
    return { ok: false, status: 429, retryAfterSeconds };
  }

  const prunedAttempts = (user.failedAttempts || []).filter((d) => now - d <= WINDOW_MS);
  const verified = await verifyPassword(user.passwordHash, password);

  if (!verified) {
    const updated = [...prunedAttempts, now];
    if (updated.length >= MAX_FAILURES) {
      const lockedUntil = new Date(now.getTime() + LOCK_MS);
      await users.updateOne(
        { _id: user._id },
        { $set: { failedAttempts: [], lockedUntil } }
      );
      return { ok: false, status: 429, retryAfterSeconds: Math.ceil(LOCK_MS / 1000) };
    }
    await users.updateOne(
      { _id: user._id },
      { $set: { failedAttempts: updated, lockedUntil: null } }
    );
    return { ok: false, status: 401 };
  }

  await users.updateOne(
    { _id: user._id },
    { $set: { failedAttempts: [], lockedUntil: null } }
  );
  const sid = await createSession(user._id);
  return { ok: true, status: 200, sid, username: user.username };
}

module.exports = {
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  ownerExists,
  createOwner,
  createSession,
  destroySession,
  validateSession,
  attemptLogin,
  MAX_FAILURES, WINDOW_MS, LOCK_MS,
  SESSION_ABSOLUTE_MS, SESSION_IDLE_MS,
};
