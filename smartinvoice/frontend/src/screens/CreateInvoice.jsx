import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInvoices, useClients } from "../hooks/useInvoices";
import { formatINR, toPaise, fromPaise, todayISO, isoPlusDays } from "../utils/format";

function blankLine() { return { description: "", qty: 1, unitPrice: "", hsnSac: "" }; }

export default function CreateInvoice({ editMode }) {
  const nav = useNavigate();
  const { id } = useParams();
  const invSvc = useInvoices();
  const clientSvc = useClients();

  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState(null); // object when adding
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(isoPlusDays(todayISO(), 30));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState([blankLine()]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("(next on save)");

  useEffect(() => { clientSvc.list().then(setClients); }, [clientSvc]);

  useEffect(() => {
    if (editMode && id) {
      invSvc.get(id).then((inv) => {
        if (inv.status !== "draft") { setErr("Only draft invoices can be edited"); return; }
        setClientId(inv.clientRef.clientId);
        setIssueDate(new Date(inv.issueDate).toISOString().slice(0, 10));
        setDueDate(new Date(inv.dueDate).toISOString().slice(0, 10));
        setNotes(inv.notes || "");
        setLineItems(inv.lineItems.map((li) => ({
          description: li.description,
          qty: li.qty,
          unitPrice: fromPaise(li.unitPricePaise),
          hsnSac: li.hsnSac || "",
        })));
        setInvoiceNumber(inv.invoiceNumber);
      }).catch((e) => setErr(e.message));
    }
  }, [editMode, id, invSvc]);

  function updateLine(idx, field, val) {
    setLineItems((arr) => arr.map((li, i) => i === idx ? { ...li, [field]: val } : li));
  }
  function addLine() { setLineItems((arr) => [...arr, blankLine()]); }
  function removeLine(idx) {
    if (lineItems.length <= 1) return;
    setLineItems((arr) => arr.filter((_, i) => i !== idx));
  }

  // Live totals (mirror calc on backend)
  const totals = (() => {
    let subtotal = 0;
    const enriched = lineItems.map((li) => {
      const q = parseInt(li.qty, 10) || 0;
      const p = toPaise(li.unitPrice);
      const lineTotal = q * p;
      subtotal += lineTotal;
      return { ...li, lineTotalPaise: lineTotal };
    });
    const tax = Math.floor(subtotal * 18 / 100);
    return { enriched, subtotal, tax, grand: subtotal + tax };
  })();

  async function ensureClient() {
    if (clientId && clientId !== "__new__") return clientId;
    if (!newClient) throw new Error("Select or add a client");
    const c = await clientSvc.create(newClient);
    return c._id;
  }

  async function save(sendOnSave) {
    setErr(null); setBusy(true);
    try {
      const resolvedClientId = await ensureClient();
      const payload = {
        clientId: resolvedClientId,
        issueDate, dueDate, notes,
        lineItems: lineItems.map((li) => ({
          description: li.description,
          qty: parseInt(li.qty, 10),
          unitPricePaise: toPaise(li.unitPrice),
          hsnSac: li.hsnSac || null,
        })),
      };
      const inv = editMode ? await invSvc.update(id, payload) : await invSvc.create(payload);
      if (sendOnSave) await invSvc.patchStatus(inv._id, "pending");
      nav(`/invoices/${inv._id}`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{editMode ? "Edit Invoice" : "New Invoice"}</h1>
        <span style={{ fontFamily: "monospace", background: "var(--surface-elev)", padding: "6px 14px", borderRadius: 6, color: "var(--text-muted)" }}>
          {invoiceNumber}
        </span>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Client &amp; Dates</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label>Client</label>
            <select value={clientId} onChange={(e) => {
              const v = e.target.value;
              setClientId(v);
              setNewClient(v === "__new__" ? { name: "", email: "", phone: "", address: { line1: "", city: "", state: "", pincode: "" } } : null);
            }}>
              <option value="">— Select existing client —</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.email})</option>)}
              <option value="__new__">＋ Add new client…</option>
            </select>
          </div>
          <div>
            <label>Issue Date</label>
            <input type="date" value={issueDate} onChange={(e) => { setIssueDate(e.target.value); setDueDate(isoPlusDays(e.target.value, 30)); }} />
          </div>
          <div>
            <label>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label>Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {newClient && (
          <div style={{ background: "var(--surface-elev)", padding: 14, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--text-muted)" }}>NEW CLIENT</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label>Name</label><input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></div>
              <div><label>Email</label><input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} /></div>
              <div><label>Phone</label><input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></div>
              <div><label>GSTIN (optional)</label><input value={newClient.gstin || ""} onChange={(e) => setNewClient({ ...newClient, gstin: e.target.value || null })} /></div>
              <div><label>Address Line 1</label><input value={newClient.address.line1} onChange={(e) => setNewClient({ ...newClient, address: { ...newClient.address, line1: e.target.value } })} /></div>
              <div><label>City</label><input value={newClient.address.city} onChange={(e) => setNewClient({ ...newClient, address: { ...newClient.address, city: e.target.value } })} /></div>
              <div><label>State</label><input value={newClient.address.state} onChange={(e) => setNewClient({ ...newClient, address: { ...newClient.address, state: e.target.value } })} /></div>
              <div><label>Pincode</label><input value={newClient.address.pincode} onChange={(e) => setNewClient({ ...newClient, address: { ...newClient.address, pincode: e.target.value } })} maxLength={6} /></div>
            </div>
          </div>
        )}

        <div className="card-header"><span className="card-title">Line Items</span>
          <button className="btn-ghost btn-sm" onClick={addLine}>＋ Add Item</button>
        </div>
        <table style={{ marginBottom: 16 }}>
          <thead><tr>
            <th>Description</th><th>Qty</th><th>Unit Price (₹)</th><th>HSN/SAC</th><th>Line Total</th><th></th>
          </tr></thead>
          <tbody>
            {lineItems.map((li, idx) => (
              <tr key={idx} onClick={(e) => e.stopPropagation()}>
                <td><input value={li.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder="e.g., Tarpaulin 20x30 ft" /></td>
                <td><input type="number" min={1} value={li.qty} onChange={(e) => updateLine(idx, "qty", e.target.value)} style={{ width: 70 }} /></td>
                <td><input type="number" step={0.01} value={li.unitPrice} onChange={(e) => updateLine(idx, "unitPrice", e.target.value)} style={{ width: 110 }} /></td>
                <td><input value={li.hsnSac} onChange={(e) => updateLine(idx, "hsnSac", e.target.value)} placeholder="optional" style={{ width: 100 }} /></td>
                <td style={{ fontWeight: 600 }}>{formatINR(totals.enriched[idx].lineTotalPaise)}</td>
                <td><button className="btn-ghost btn-sm" onClick={() => removeLine(idx)} title="Remove">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ background: "var(--surface-elev)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "14px 18px", maxWidth: 320, marginLeft: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
            <span className="muted">Subtotal</span><span>{formatINR(totals.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
            <span className="muted">GST @ 18% (CGST 9% + SGST 9%)</span>
            <span style={{ color: "var(--warning)", fontWeight: 600 }}>{formatINR(totals.tax)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0",
            borderTop: "1px solid var(--border)", marginTop: 6, fontWeight: 700, fontSize: 15 }}>
            <span>Grand Total</span><span>{formatINR(totals.grand)}</span>
          </div>
        </div>

        {err && <div className="error-msg" style={{ marginTop: 16 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn-secondary" onClick={() => nav(-1)}>✕ Cancel</button>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={() => save(false)} disabled={busy}>💾 Save as Draft</button>
          <button className="btn-primary" onClick={() => save(true)} disabled={busy}>📤 Save &amp; Mark as Sent</button>
        </div>
      </div>
    </div>
  );
}
