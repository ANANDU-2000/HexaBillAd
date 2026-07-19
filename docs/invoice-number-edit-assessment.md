# Invoice Number / Date Edit Assessment (B0)

**Date:** 2026-07-19  
**Scope:** Read-only. No code changes.  
**Sources:** `InvoiceNumberService.cs`, `SaleService.cs`, `SalesController.cs`, EF config, migrations.

---

## Summary

| Question | Answer |
|----------|--------|
| Unique at DB? | **Yes** — `IX_Sales_OwnerId_InvoiceNo` unique on `(OwnerId, InvoiceNo)` where `IsDeleted = false` |
| Generated how? | Tenant max numeric + 1, format `D4` (e.g. `0001`). PG `invoice_number_seq` exists but is **not** used for live allocation |
| Editable `InvoiceNo` on update today? | **No** — intentionally frozen after create |
| Editable `InvoiceDate` on update today? | **Yes** — `UpdateSaleRequest.InvoiceDate` |
| Draft/unposted sales? | Creates finalize immediately (`IsFinalized = true`); no held reservation of invoice numbers |

---

## DB uniqueness

- EF: `AppDbContext` — unique index on `OwnerId` + `InvoiceNo`, filter `"IsDeleted" = false`
- Migration: `20260214070330_InitialPostgreSQL` creates `IX_Sales_OwnerId_InvoiceNo`
- Soft-deleted rows can reuse a number
- App duplicate checks use `TenantId`; index uses `OwnerId` (both set equal on create)

---

## Dependents of sequence / InvoiceNo

| Consumer | Role |
|----------|------|
| `GET /sales/next-invoice-number` | POS preview (non-consuming peek) |
| `CreateSaleInternalAsync` | Allocates on save |
| `POST /sales/validate-invoice-number` | Uniqueness validate (ready for edit UI) |
| Reports / ledger / PDF / email / returns | Display only — do not advance counter |

---

## Recommendation (plan-locked default)

**Approach (b): allow edit of invoice number with mandatory uniqueness check + warn on gap**, restricted initially to **unpaid / non–VAT-locked** invoices (practical stand-in for “draft” given all sales finalize on create).

### Why not free edit of any historical paid invoice

- UAE FTA sequential tax-invoice practice: gaps and post-issue renumbers are risky
- PDFs/emails may already show the old number
- VAT return / locked periods may already include the document

### Implementation sketch (do **not** implement until approved)

1. Feature flag off by default (e.g. `Feature_EditableInvoiceNo`)
2. Optional `InvoiceNo` on `UpdateSaleRequest`
3. Allow only when: not deleted; invoice date not in locked VAT period; **PaidAmount == 0** (or unpaid status); uniqueness via existing `ValidateInvoiceNumberAsync(..., excludeSaleId)`
4. UI: warn if new number creates a gap vs surrounding numbers
5. Audit log: old → new
6. Fix gap: when changing `InvoiceDate`, also validate the **new** date is not in a locked period (today only the existing date is checked)

### Alternative noted in audit

Latest-invoice-only renumber is lower FTA risk if product prefers a tighter gate than (b). Prefer plan (b) unless you approve the tighter alternative.

---

## B0-impl status

**Blocked on explicit user approval.** No money-path edit shipped in this plan session.
