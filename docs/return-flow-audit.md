# Sales Return Flow Audit (B1)

**Date:** 2026-07-19  
**Scope:** Read-only. Fixes = one prompt each later (after approval).  
**Entry:** `ReturnCreatePage.jsx` → `POST /returns/sales` → `ReturnService`.

---

## Formulas

### Frontend preview (display only)

```
lineNet     = returnQty × unitPrice
subtotal    = Σ lineNet
vatTotal    = round(subtotal × 0.05, 2)   // hardcoded 5%
grandTotal  = subtotal + vatTotal
```

### Backend (authoritative)

```
lineNet     = item.Qty × saleItem.UnitPrice
vatAmount   = Round(lineNet × 0.05m, 2)   // hardcoded 5%
lineTotal   = lineNet + vatAmount         // stored on SaleReturnItem
grandTotal  = subtotal + vatTotal − Discount
```

**Ignores:** `SaleItem.VatRate`, `VatScenario`, `IsZeroInvoice`, company `VAT_PERCENT`, original line discounts.

---

## VAT credit vs original sale

| Location | Uses original sale VAT? |
|----------|-------------------------|
| `ReturnCreatePage` preview | No — always 5% |
| `ReturnService.CreateSaleReturnAsync` | No — always `× 0.05m` |
| Return PDF | Label “VAT 5%”; amounts from stored lines |
| `VatReturnReportService` | Uses stored return Subtotal/VatTotal |

Sale/POS use settings `VAT_PERCENT` + `MidpointRounding.AwayFromZero`. Returns diverge.

---

## Duplication vs POS / SaleService

- Same shape (qty × price + VAT) but return path weaker (no discount, hardcoded rate, default Math.Round)
- Stock restore × `ConversionToBase` — OK shared pattern
- PDF is inline QuestPDF in `ReturnService`, not shared `PdfService`

---

## Print / PDF mismatches

| Issue | Flag |
|-------|------|
| “Credit note” UI opens return note PDF; CN entity only if sale fully paid | Bug / UX |
| PDF hardcodes “VAT 5%” | Bug if non-5% / zero-rated |
| Footer Grand Total only (no Subtotal/VAT breakout) | Gap |
| `URL.revokeObjectURL` after 100ms may race | Mild |

---

## Bug vs OK

### Bugs / high risk

1. **Max-returnable qty broken in UI** — `SaleReturnItemDto` missing `SaleItemId`; `GetSaleReturnsAsync` does not `.Include(Items)` → prior qty never accumulates
2. **VAT always 5%** on return — wrong refund / VAT return for zero-rated or non-5% sales
3. **Approve path checks `ReturnType` for CreditIssued/RefundNow** — those live on `RefundStatus`; approval never creates CN/refund when require-approval is on
4. **CN only if sale fully paid** despite `CreateCreditNote=true`
5. **Approve skips damage inventory / write-off** that create-path runs when `!requireApproval`

### OK

- Server qty/max validation; tenant filters; transactions on create/delete
- Append-only ledger (do not mutate original sale Paid status)
- Feature flags `Returns_Enabled` / `Returns_RequireApproval`

---

## Suggested fix order (one prompt each; not in this session)

1. DTO `SaleItemId` + Include Items on get-sale-returns  
2. VAT from original `VatRate` / proportional `VatAmount`; honor zero invoice  
3. Approve keyed off `RefundStatus` + mirror damage/write-off  
4. Align CN create with unpaid invoices / UI label  
5. PDF Subtotal + VAT from data  
