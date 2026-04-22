import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInvoices } from "../hooks/useInvoices";
import { formatINR, formatDate } from "../utils/format";
import StatusBadge from "../components/StatusBadge";

function Timeline({ status, sentAt, paidAt }) {
  const steps = [
    { key: "draft", label: "Draft", done: true, date: null },
    { key: "sent", label: "Sent", done: status !== "draft", date: sentAt },
    { key: "overdue", label: "Overdue", done: false, current: status === "overdue" },
    { key: "paid", label: "Paid", done: status === "paid", date: paidAt },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 0" }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: s.done ? "var(--accent)" : (s.current ? "var(--warning)" : "var(--surface-elev)"),
              color: s.done || s.current ? "#fff" : "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid var(--border)", fontSize: 12, fontWeight: 700
            }}>{s.done ? "✓" : (s.current ? "!" : "○")}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{s.label}</div>
            {s.date && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{formatDate(s.date)}</div>}
          </div>
          {i < steps.length - 1 && <div style={{ height: 2, flex: 1, background: steps[i + 1].done ? "var(--accent)" : "var(--border)", marginTop: -22 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const invSvc = useInvoices();
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(() => { invSvc.get(id).then(setInv).catch((e) => setErr(e.message)); }, [id, invSvc]);
  useEffect(() => { load(); }, [load]);

  async function send() { await invSvc.patchStatus(id, "pending"); load(); }
  async function payNow() {
    await invSvc.recordPayment(id, { amountPaise: inv.grandTotalPaise, paidAt: new Date().toISOString(), method: "upi" });
    load();
  }
  async function del() {
    if (!window.confirm("Delete this draft invoice permanently?")) return;
    await invSvc.del(id);
    nav("/invoices");
  }

  if (err) return <div className="error-msg">{err}</div>;
  if (!inv) return <p className="muted">Loading…</p>;

  const locked = inv.status !== "draft";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost btn-sm" onClick={() => nav(-1)}>← Back</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
              {inv.invoiceNumber} <StatusBadge status={inv.status} />
            </h1>
            <p className="muted" style={{ fontSize: 12 }}>
              Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)}
              {inv.paidAt && ` · Paid ${formatDate(inv.paidAt)}`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={invSvc.pdfUrl(id)} target="_blank" rel="noreferrer"><button className="btn-secondary">⬇ Download PDF</button></a>
          {inv.status === "draft" && (
            <>
              <button className="btn-secondary" onClick={() => nav(`/invoices/${id}/edit`)}>Edit</button>
              <button className="btn-primary" onClick={send}>📤 Mark as Sent</button>
              <button className="btn-danger" onClick={del}>Delete</button>
            </>
          )}
          {(inv.status === "pending" || inv.status === "overdue") && (
            <button className="btn-success" onClick={payNow}>✓ Mark as Paid</button>
          )}
        </div>
      </div>

      {locked && (
        <div style={{ background: "rgba(210,153,34,0.15)", border: "1px solid var(--warning)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "var(--warning)" }}>
          🔒 This invoice is locked — sent invoices cannot be edited. Create a new invoice if correction is needed.
        </div>
      )}

      <div className="card"><div className="card-header"><span className="card-title">Invoice Lifecycle</span></div>
        <Timeline status={inv.status} sentAt={inv.sentAt} paidAt={inv.paidAt} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>Client</div>
          <div style={{ lineHeight: 1.6 }}>
            <div><strong>{inv.clientRef.name}</strong></div>
            <div className="muted">{inv.clientRef.email}</div>
            {inv.clientRef.gstin && <div className="muted">GSTIN: {inv.clientRef.gstin}</div>}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>Invoice Info</div>
          <div style={{ lineHeight: 1.6 }}>
            <div>Number: <span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{inv.invoiceNumber}</span></div>
            <div>Issue: {formatDate(inv.issueDate)}</div>
            <div>Due: {formatDate(inv.dueDate)}</div>
            {inv.payment && <div>Payment: {formatINR(inv.payment.amountPaise)} via {inv.payment.method || "—"}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Line Items</span></div>
        <table>
          <thead><tr><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Unit Price</th><th style={{ textAlign: "right" }}>Line Total</th></tr></thead>
          <tbody>
            {inv.lineItems.map((li, i) => (
              <tr key={i}>
                <td>{li.description}</td>
                <td className="muted">{li.hsnSac || "—"}</td>
                <td>{li.qty}</td>
                <td>{formatINR(li.unitPricePaise)}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{formatINR(li.lineTotalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <div style={{ background: "var(--surface-elev)", padding: "14px 18px", borderRadius: 8, minWidth: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
              <span className="muted">Subtotal</span><span>{formatINR(inv.subtotalPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
              <span className="muted">GST @ 18%</span><span style={{ color: "var(--warning)" }}>{formatINR(inv.taxPaise)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0",
              borderTop: "1px solid var(--border)", marginTop: 6, fontWeight: 700, fontSize: 15 }}>
              <span>Grand Total</span><span>{formatINR(inv.grandTotalPaise)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
