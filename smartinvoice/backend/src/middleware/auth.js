const { validateSession } = require("../services/authService");

async function requireAuth(req, res, next) {
  const sid = req.cookies && req.cookies.sid;
  const ctx = await validateSession(sid);
  if (!ctx) {
    res.clearCookie("sid");
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = ctx.user;
  req.sid = ctx.sid;
  next();
}

module.exports = { requireAuth };
