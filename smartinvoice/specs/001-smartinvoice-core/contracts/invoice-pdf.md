# Contract: Invoice PDF

**Status**: ✅ UNBLOCKED as of session 3 (2026-04-22). Spec FR-006b explicitly authorises
per-invoice, owner-initiated PDF download with GST Rule 46 compliance.

---

## `GET /api/invoices/:id/pdf`

Stream a GST Rule 46 compliant PDF of the invoice.

### Authentication

Required. Only the logged-in owner can download PDFs.

### Response `200 OK`

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="INV-0055.pdf"`
- Body: PDF bytes streamed via `pdfkit` (no intermediate file on disk).

### GST Rule 46 Mandatory Fields (all MUST appear)

| Rule 46 Field | Source |
|---------------|--------|
| Supplier name, address, GSTIN | Backend config / owner profile (future: editable via settings) |
| Invoice number | `invoice.invoiceNumber` |
| Invoice date | `invoice.issueDate` rendered as DD/MM/YYYY (FR-015) |
| Recipient name, address | `invoice.clientRef` + `clients.address` |
| Recipient GSTIN (when present) | `invoice.clientRef.gstin` |
| HSN / SAC per line item | `lineItem.hsnSac` (blank when omitted — per key entity spec) |
| Description, qty, unit, rate, taxable value per line | `invoice.lineItems[]` |
| CGST 9% + SGST 9% split amounts | `invoice.taxPaise / 2` each, rounded via `Math.round` |
| Total taxable value | `invoice.subtotalPaise` |
| Total invoice value | `invoice.grandTotalPaise` |
| Place of supply | Derived from `clientRef.address.state` |
| Amount in words | `numberToWords(grandTotalPaise / 100)` — Indian numbering |
| "Authorised signatory" line | Static footer text |

### Rendering Rules

- Monetary values: `₹1,23,456.78` (lakh/crore grouping, FR-015).
- Dates: DD/MM/YYYY (FR-015).
- A4 portrait, 20 mm margins.
- Single page for ≤ 10 line items; auto-pagination thereafter.
- Font: embedded (e.g., Noto Sans) to ensure ₹ renders across viewers.

### Response `404 Not Found`

```json
{ "error": "Invoice not found" }
```

### Response `401 Unauthorized`

No session cookie → `401` with `{ "error": "Authentication required" }`.

### Dependency

- `pdfkit@0.14`
- `backend/src/services/numberToWords.js` — Indian number-to-words helper (crore/lakh/thousand)

### Contract Tests

| Test | Expected |
|------|----------|
| Valid invoice id | `200`, `application/pdf`, non-empty body |
| Unknown id | `404` |
| No auth | `401` |
| Draft invoice | `200` (FR-006b: any status) |
| Parsed PDF text contains INV-XXXX | Matches invoice number |
| Parsed PDF text contains grand total with `₹` and Indian grouping | e.g., `₹18,88,000.00` |
| Parsed PDF text contains date DD/MM/YYYY | Issue date matches |
| Parsed PDF contains "CGST @ 9%" and "SGST @ 9%" labels | Both present |
| CGST amount + SGST amount == `invoice.taxPaise` | Exact |
| Parsed PDF contains "Amount in words" with Indian formatting | e.g., "Eighteen lakh eighty-eight thousand rupees only" |
| HSN/SAC absent when `lineItem.hsnSac` is null | Column blank for that row |
| HSN/SAC rendered when provided | Column contains the code string |
