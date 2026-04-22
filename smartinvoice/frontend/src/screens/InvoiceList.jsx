import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useInvoices } from "../hooks/useInvoices";
import { formatINR, formatDate } from "../utils/format";
import StatusBadge from "../components/StatusBadge";

const TABS = [
  { key: "",        label: "All" },
  { key: "draft",   label: "Draft" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
  { key: "paid",    label: "Paid" },
];

export default function InvoiceList() {
  const invSvc = useInvoices();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState(null);
  const [sp, setSp] = useSearchParams();
  const status = sp.get("status") || "";
  const page = parseInt(sp.get("page") || "1", 10);
  const nav = useNavigate();

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await invSvc.list({ status: status || undefined, q: search || undefined, page });
      setData(r);
    } catch (e) { setErr(e.message); }
  }, [invSvc, status, search, page]);

  useEffect(() => { load(); }, [load]);

  function setTab(k) {
    const np = new URLSearchParams(sp);
    if (k) np.set("status", k); else np.delete("status");
    np.delete("page");
    setSp(np);
  }

  async function send(id, e) {
    e.stopPropagation();
    await invSvc.patchStatus(id, "pending");
    load();
  }
  async function markPaid(id, amountPaise, e) {
    e.stopPropagation();
    await invSvc.recordPayment(id, { amountPaise, paidAt: new Date().toISOString() });
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Invoices</h1>
          <p className="muted" style={{ fontSize: 12 }}>
            {data ? `${data.total} invoices${status ? ` in ${status}` : ""}` : "Loading…"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={invSvc.csvUrl(status)}><button className="btn-secondary">⬇ Export CSV</button></a>
          <Link to="/invoices/new"><button className="btn-primary">➕ New Invoice</button></Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <div key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 16px", cursor: "pointer", fontSize: 13,
            color: status === t.key ? "var(--accent)" : "var(--text-muted)",
            borderBottom: status === t.key ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input placeholder="Search by invoice number or client name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {err && <div className="error-msg">{err}</div>}
      {data && data.invoices.length === 0 && <p className="muted">No invoices match this filter.</p>}
      {data && data.invoices.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th><th>Client</th><th>Subtotal</th><th>GST</th><th>Total</th>
                <th>Status</th><th>Due</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv._id} onClick={() => nav(`/invoices/${inv._id}`)}>
                  <td style={{ fontFamily: "monospace", color: "var(--accent)" }}>{inv.invoiceNumber}</td>
                  <td>{inv.clientRef.name}</td>
                  <td>{formatINR(inv.subtotalPaise)}</td>
                  <td className="muted">{formatINR(inv.taxPaise)}</td>
                  <td style={{ fontWeight: 600 }}>{formatINR(inv.grandTotalPaise)}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="muted">{formatDate(inv.dueDate)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {inv.status === "draft" && (
                      <button className="btn-primary btn-sm" onClick={(e) => send(inv._id, e)}>Send</button>
                    )}
                    {(inv.status === "pending" || inv.status === "overdue") && (
                      <button className="btn-success btn-sm" onClick={(e) => markPaid(inv._id, inv.grandTotalPaise, e)}>Mark Paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
