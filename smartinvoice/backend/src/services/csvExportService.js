function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
}

function formatINRForCsv(paise) {
  if (paise == null) return "";
  const rupees = (paise / 100).toFixed(2);
  const [whole, dec] = rupees.split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest ? grouped + "," : ""}${last3}.${dec}`;
}

function formatDMYForCsv(d) {
  if (!d) return "";
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function invoicesToCsv(invoices) {
  const header = [
    "Invoice Number","Client Name","Client Email","Client GSTIN",
    "Subtotal (INR)","GST (INR)","Grand Total (INR)",
    "Status","Issue Date","Due Date","Payment Date"
  ];
  const rows = [header.join(",")];
  for (const inv of invoices) {
    const row = [
      inv.invoiceNumber,
      inv.clientRef && inv.clientRef.name,
      inv.clientRef && inv.clientRef.email,
      (inv.clientRef && inv.clientRef.gstin) || "",
      formatINRForCsv(inv.subtotalPaise),
      formatINRForCsv(inv.taxPaise),
      formatINRForCsv(inv.grandTotalPaise),
      inv.status,
      formatDMYForCsv(inv.issueDate),
      formatDMYForCsv(inv.dueDate),
      formatDMYForCsv(inv.paidAt),
    ];
    rows.push(row.map(csvEscape).join(","));
  }
  return rows.join("\n") + "\n";
}

module.exports = { invoicesToCsv, formatINRForCsv, formatDMYForCsv };
