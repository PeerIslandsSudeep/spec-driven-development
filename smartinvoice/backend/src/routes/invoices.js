const express = require("express");
const {
  createInvoice, listInvoices, getInvoice, updateDraft,
  transitionStatus, deleteDraft, recordPayment
} = require("../services/invoiceService");
const { invoicesToCsv } = require("../services/csvExportService");
const { renderInvoicePdf } = require("../services/pdfService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const data = await listInvoices({
      status: req.query.status,
      page: req.query.page,
      pageSize: req.query.pageSize,
      q: req.query.q,
      sort: req.query.sort,
    });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/export.csv", async (req, res, next) => {
  try {
    const data = await listInvoices({ status: req.query.status, page: 1, pageSize: 10000 });
    const csv = invoicesToCsv(data.invoices);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="invoices-${stamp}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const inv = await createInvoice(req.body);
    res.status(201).json(inv);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try { res.json(await getInvoice(req.params.id)); }
  catch (e) { next(e); }
});

router.patch("/:id", async (req, res, next) => {
  try { res.json(await updateDraft(req.params.id, req.body)); }
  catch (e) { next(e); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: "status required" });
    res.json(await transitionStatus(req.params.id, status));
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try { await deleteDraft(req.params.id); res.status(204).send(); }
  catch (e) { next(e); }
});

router.post("/:id/payments", async (req, res, next) => {
  try {
    const invoice = await recordPayment(req.params.id, req.body || {});
    res.status(201).json({ invoice, payment: invoice.payment });
  } catch (e) { next(e); }
});

router.get("/:id/pdf", async (req, res, next) => {
  try {
    const inv = await getInvoice(req.params.id);
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `attachment; filename="${inv.invoiceNumber}.pdf"`);
    renderInvoicePdf(inv, res);
  } catch (e) { next(e); }
});

module.exports = router;
