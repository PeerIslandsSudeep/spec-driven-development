import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInsights } from "../hooks/useInvoices";
import { formatINR } from "../utils/format";

function RiskBadge({ level }) {
  const map = {
    low: { label: "Low Risk", cls: "badge-low" },
    medium: { label: "Medium Risk", cls: "badge-medium" },
    high: { label: "High Risk", cls: "badge-high" },
    no_data: { label: "No data", cls: "badge-draft" },
  };
  const m = map[level] || map.no_data;
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

function ScoreBar({ score }) {
  if (score == null) return <span className="muted">—</span>;
  const cls = score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: cls, borderRadius: 99 }} />
      </div>
      <span style={{ fontWeight: 700, minWidth: 28, textAlign: "right", color: cls }}>{score}</span>
    </div>
  );
}

export default function AIInsights() {
  const { get } = useInsights();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const nav = useNavigate();

  useEffect(() => { get().then(setData).catch((e) => setErr(e.message)); }, [get]);

  if (err) return <div className="error-msg">{err}</div>;
  if (!data) return <p className="muted">Computing insights…</p>;

  const { clients, forecast } = data;
  const counts = { low: 0, medium: 0, high: 0, no_data: 0 };
  for (const c of clients) counts[c.riskLevel] = (counts[c.riskLevel] || 0) + 1;
  const shown = riskFilter === "all" ? clients : clients.filter((c) => c.riskLevel === riskFilter);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>AI Insights</h1>
        <p className="muted" style={{ fontSize: 12 }}>Computed via MongoDB aggregation pipelines · Refreshed on page load</p>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">3-Month Revenue Forecast</span>
          <span className="muted" style={{ fontSize: 12 }}>Weighted SMA · last 6 months</span>
        </div>
        {!forecast.available ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            {forecast.message || "Insufficient history to generate a forecast."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {forecast.months.map((m) => (
              <div key={m.month} style={{
                background: "linear-gradient(135deg, var(--surface-elev), var(--bg))",
                padding: 20, borderRadius: 10, border: "1px solid var(--accent)"
              }}>
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.month}</div>
                <div style={{ fontSize: 24, fontWeight: 700, margin: "8px 0", color: "var(--accent)" }}>{formatINR(m.projectedPaise)}</div>
                <div className="muted" style={{ fontSize: 11 }}>Based on weighted SMA</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Client Risk Distribution</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[{ key: "low", label: "Low Risk (score ≥ 70)", color: "var(--success)" },
            { key: "medium", label: "Medium Risk (40–69)", color: "var(--warning)" },
            { key: "high", label: "High Risk (< 40)", color: "var(--danger)" }].map((r) => (
            <div key={r.key}
              onClick={() => setRiskFilter(r.key === riskFilter ? "all" : r.key)}
              style={{
                cursor: "pointer",
                padding: 16, textAlign: "center", borderRadius: 8,
                background: "var(--surface-elev)",
                border: `1px solid ${r.key === riskFilter ? r.color : "var(--border)"}`
              }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: r.color }}>{counts[r.key] || 0}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Client Payment Scores</span>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={{ width: "auto", fontSize: 12 }}>
            <option value="all">All Clients</option>
            <option value="low">Low Risk only</option>
            <option value="medium">Medium Risk only</option>
            <option value="high">High Risk only</option>
            <option value="no_data">No data</option>
          </select>
        </div>
        {shown.length === 0 ? <p className="muted">No clients match the current filter.</p> : (
          <table>
            <thead><tr>
              <th>Client</th><th>Payment Score</th><th>Risk</th><th>Invoices</th><th>Avg Days to Pay</th><th>On-time Rate</th>
            </tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.clientEmail} onClick={() => nav(`/invoices?q=${encodeURIComponent(c.clientName)}`)}>
                  <td><strong>{c.clientName}</strong></td>
                  <td><ScoreBar score={c.paymentScore} /></td>
                  <td><RiskBadge level={c.riskLevel} /></td>
                  <td>{c.invoiceCount}</td>
                  <td>{c.avgDaysToPay != null ? `${c.avgDaysToPay} days` : "—"}</td>
                  <td>{c.onTimeRate != null ? `${Math.round(c.onTimeRate * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
