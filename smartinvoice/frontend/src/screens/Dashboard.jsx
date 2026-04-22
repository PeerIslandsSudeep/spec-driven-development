import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useDashboard } from "../hooks/useInvoices";
import { formatINR, formatDate } from "../utils/format";
import StatusBadge from "../components/StatusBadge";

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div className="card" style={{ cursor: onClick ? "pointer" : "default", margin: 0 }} onClick={onClick}>
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 2px", color }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { get } = useDashboard();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const nav = useNavigate();

  useEffect(() => { get().then(setData).catch((e) => setErr(e.message)); }, [get]);

  if (err) return <div className="error-msg">{err}</div>;
  if (!data) return <p className="muted">Loading dashboard…</p>;

  const { stats, chart, recent } = data;
  const empty = stats.totalInvoiceCount === 0;
  const currentMonth = new Date().getMonth();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h1>
          <p className="muted" style={{ fontSize: 12 }}>
            As of {formatDate(new Date())} · Manual refresh required for updates.
          </p>
        </div>
        <Link to="/invoices/new"><button className="btn-primary">➕ New Invoice</button></Link>
      </div>

      {empty && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40 }}>🧾</div>
          <h2 style={{ marginTop: 12 }}>No invoices yet</h2>
          <p className="muted">Create your first invoice to start tracking.</p>
          <Link to="/invoices/new"><button className="btn-primary" style={{ marginTop: 16 }}>Create Invoice</button></Link>
        </div>
      )}

      {!empty && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
            <StatCard label="Total Revenue"     value={formatINR(stats.totalRevenuePaise)}     sub={`${stats.totalInvoiceCount} invoices`} color="var(--success)" onClick={() => nav("/invoices?status=paid")} />
            <StatCard label="Total Outstanding" value={formatINR(stats.totalOutstandingPaise)} sub="pending + overdue" color="var(--warning)" onClick={() => nav("/invoices?status=pending")} />
            <StatCard label="Overdue Invoices"  value={stats.overdueCount}                     sub="at risk"            color="var(--danger)"  onClick={() => nav("/invoices?status=overdue")} />
            <StatCard label="Total Invoices"    value={stats.totalInvoiceCount}                sub="since INV-0001"     color="var(--info)"    onClick={() => nav("/invoices")} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Monthly Revenue — {new Date().getFullYear()}</span></div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <XAxis dataKey="month" tickFormatter={(m) => m.slice(5)} stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: "var(--surface-elev)", border: "1px solid var(--border)" }}
                      formatter={(v) => formatINR(v)}
                    />
                    <Bar dataKey="revenuePaise">
                      {chart.map((entry, i) => (
                        <Cell key={i} fill={i === currentMonth ? "var(--accent)" : (entry.revenuePaise === 0 ? "var(--border)" : "#4a8b77")} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Recent Invoices</span>
                <Link to="/invoices" style={{ fontSize: 12 }}>View all →</Link>
              </div>
              {recent.length === 0
                ? <p className="muted">No invoices yet.</p>
                : (
                  <table>
                    <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {recent.map((inv) => (
                        <tr key={inv.id} onClick={() => nav(`/invoices/${inv.id}`)}>
                          <td style={{ fontFamily: "monospace", color: "var(--accent)" }}>{inv.invoiceNumber}</td>
                          <td>{inv.clientName}</td>
                          <td>{formatINR(inv.grandTotalPaise)}</td>
                          <td><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}
