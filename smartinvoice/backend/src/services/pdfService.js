const PDFDocument = require("pdfkit");
const { paiseToWords } = require("./numberToWords");

function formatINR(paise) {
  const rupees = (paise / 100).toFixed(2);
  const [whole, dec] = rupees.split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `Rs. ${rest ? grouped + "," : ""}${last3}.${dec}`;
}

function formatDMY(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function renderInvoicePdf(invoice, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(stream);

  const supplier = {
    name: "SmartInvoice SMB",
    address: "Tech Park, Bengaluru, Karnataka 560001",
    gstin: "29ABCDE1234F1Z5"
  };

  doc.fontSize(20).text("TAX INVOICE", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor("#666").text("GST Rule 46 compliant", { align: "center" });
  doc.moveDown();
  doc.fillColor("#000");

  doc.fontSize(11).font("Helvetica-Bold").text("Supplier");
  doc.font("Helvetica").fontSize(10)
    .text(supplier.name)
    .text(supplier.address)
    .text(`GSTIN: ${supplier.gstin}`);
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(11).text("Invoice Details");
  doc.font("Helvetica").fontSize(10)
    .text(`Invoice #: ${invoice.invoiceNumber}`)
    .text(`Issue Date: ${formatDMY(new Date(invoice.issueDate))}`)
    .text(`Due Date: ${formatDMY(new Date(invoice.dueDate))}`);
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(11).text("Bill To");
  doc.font("Helvetica").fontSize(10)
    .text(invoice.clientRef.name)
    .text(`Email: ${invoice.clientRef.email}`);
  if (invoice.clientRef.gstin) doc.text(`GSTIN: ${invoice.clientRef.gstin}`);
  doc.moveDown();

  // Line items table
  const tableTop = doc.y;
  const cols = { desc: 50, hsn: 260, qty: 320, rate: 360, total: 450 };
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Description", cols.desc,  tableTop);
  doc.text("HSN/SAC",     cols.hsn,   tableTop);
  doc.text("Qty",         cols.qty,   tableTop);
  doc.text("Rate",        cols.rate,  tableTop);
  doc.text("Amount",      cols.total, tableTop, { width: 90, align: "right" });
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
  doc.font("Helvetica").fontSize(10);

  let y = tableTop + 22;
  for (const li of invoice.lineItems) {
    doc.text(li.description,                   cols.desc,  y, { width: 200 });
    doc.text(li.hsnSac || "",                   cols.hsn,   y);
    doc.text(String(li.qty),                    cols.qty,   y);
    doc.text(formatINR(li.unitPricePaise),      cols.rate,  y);
    doc.text(formatINR(li.lineTotalPaise),      cols.total, y, { width: 90, align: "right" });
    y += 18;
  }
  doc.moveTo(50, y + 5).lineTo(545, y + 5).stroke();
  y += 15;

  // Totals block
  const cgst = Math.round(invoice.taxPaise / 2);
  const sgst = invoice.taxPaise - cgst;
  const labelX = 340; const valX = 450;
  doc.font("Helvetica").text("Taxable value",  labelX, y); doc.text(formatINR(invoice.subtotalPaise), valX, y, { width: 90, align: "right" });
  y += 16;
  doc.text("CGST @ 9%",   labelX, y); doc.text(formatINR(cgst), valX, y, { width: 90, align: "right" });
  y += 16;
  doc.text("SGST @ 9%",   labelX, y); doc.text(formatINR(sgst), valX, y, { width: 90, align: "right" });
  y += 16;
  doc.font("Helvetica-Bold").text("Grand Total", labelX, y);
  doc.text(formatINR(invoice.grandTotalPaise),   valX, y, { width: 90, align: "right" });
  y += 24;

  // Amount in words
  doc.font("Helvetica").fontSize(10).text(
    `Amount in words: ${paiseToWords(invoice.grandTotalPaise)}`, 50, y, { width: 495 }
  );
  y += 30;

  // Place of supply (recipient address state is ideal; supplier state as fallback for v1)
  doc.text(`Place of Supply: Karnataka`, 50, y);
  y += 40;

  doc.font("Helvetica-Oblique").text("Authorised signatory", 50, y, { align: "right" });
  doc.end();
}

module.exports = { renderInvoicePdf, formatINR, formatDMY };
