async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const ctype = res.headers.get("content-type") || "";
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("unauthenticated"));
  }
  if (!res.ok) {
    let body;
    try { body = ctype.includes("json") ? await res.json() : await res.text(); } catch { body = null; }
    const err = new Error((body && body.error) || res.statusText || "Request failed");
    err.status = res.status;
    err.body = body;
    err.retryAfterSeconds = body && body.retryAfterSeconds;
    throw err;
  }
  if (res.status === 204) return null;
  if (ctype.includes("application/json")) return res.json();
  return res;
}

export const api = {
  get:    (p) => request(p),
  post:   (p, body) => request(p, { method: "POST", body: JSON.stringify(body) }),
  patch:  (p, body) => request(p, { method: "PATCH", body: JSON.stringify(body) }),
  del:    (p) => request(p, { method: "DELETE" }),
  raw:    (p, options) => fetch(p, { credentials: "include", ...options }),
};
