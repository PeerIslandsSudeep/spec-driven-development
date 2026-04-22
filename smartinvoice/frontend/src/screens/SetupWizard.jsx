import React, { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";

export default function SetupWizard({ onSetup }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await onSetup(username, password); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative" }}>
      <div style={{ position: "absolute", top: 16, right: 16 }}><ThemeToggle /></div>
      <div className="card" style={{ width: 420, maxWidth: "100%" }}>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Welcome to SmartInvoice</h1>
        <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
          First-run setup — create your owner account. This form appears only once.
        </p>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required minLength={1} maxLength={40} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Minimum 8 characters, at least one letter and one digit.
            </div>
          </div>
          {err && <div className="error-msg">{err}</div>}
          <button className="btn-primary" disabled={busy} style={{ width: "100%", marginTop: 10 }}>
            {busy ? "Creating…" : "Create Owner Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
