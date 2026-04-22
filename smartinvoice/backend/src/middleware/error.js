function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  const message = err.expose === false ? "Internal server error" : (err.message || "Internal server error");
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({ error: message });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

module.exports = { errorHandler, HttpError };
