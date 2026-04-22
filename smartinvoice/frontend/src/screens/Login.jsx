import React, { useState, useEffect } from "react";
import ThemeToggle from "../components/ThemeToggle";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);

  useEffect(() => {
    if (lockRemaining > 0) {
      const t = setTimeout(() => setLockRemaining((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [lockRemaining]);

  async function submit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await onLogin(username, password); }
    catch (e) {
      if (e.status === 429) {
        const secs = e.retryAfterSeconds || 900;
        setLockRemaining(secs);
        setErr(`Too many failed attempts. Locked for ${Math.ceil(secs / 60)} minutes.`);
      } else {
        setErr(e.message || "Login failed");
      }
    }
    finally { setBusy(false); }
  }

  const locked = lockRemaining > 0;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative" }}>
      <div style={{ position: "absolute", top: 16, right: 16 }}><ThemeToggle /></div>
      <div className="card" style={{ width: 420, maxWidth: "100%" }}>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Sign in to SmartInvoice</h1>
        <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
          Enter your owner credentials to continue.
        </p>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <div className="error-msg">{err}</div>}
          {locked && (
            <div className="error-msg" style={{ marginTop: 8 }}>
              Unlocks in {Math.floor(lockRemaining / 60)}:{String(lockRemaining % 60).padStart(2, "0")}
            </div>
          )}
          <button className="btn-primary" disabled={busy || locked} style={{ width: "100%", marginTop: 10 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
