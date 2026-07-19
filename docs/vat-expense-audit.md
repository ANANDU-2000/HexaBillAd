# VAT & Expense Calculation Audit (HexaBill)

**Scope:** Read-only inventory of VAT/tax and expense aggregation sites (backend + frontend).  
**Date:** 2026-07-19  
**Rate convention in UAE path:** 5% standard = fraction `0.05` or percent `5` depending on call site (see §3).

**Rounding legend used below**

| Label | Mechanism |
|-------|-----------|
| **AwayFromZero** | `Math.Round(x, 2, MidpointRounding.AwayFromZero)` or `VatCalculator.Round` |
| **ToEven** | `Math.Round(x, 2)` default (.NET banker's rounding) |
| **JS half-up** | `Math.round(x * 100) / 100` / `roundMoney` (positive half away from zero) |
| **Unrounded** | Arithmetic only; no per-line 2-dp round before sum |

---

## 1. Distinct VAT computations (formula + file:line)

### 1.1 Canonical calculator — `VatCalculator` (hardcoded 5%)

**File:** `backend/HexaBill.Api/Shared/Services/VatCalculator.cs`

| Site | Formula | Rounding |
|------|---------|----------|
| `StandardRate` L46 | `0.05m` constant | — |
| `Round` L51–54 | `Math.Round(value, 2, AwayFromZero)` | AwayFromZero |
| `ForSupply` Standard L79–85 | `vat = Round(net * 0.05)`; `total = Round(net + vat)` | AwayFromZero |
| `ForSupply` ReverseCharge L68–73 | same as Standard; also `ReverseChargeVat = Round(net * 0.05)` | AwayFromZero |
| `ForExpense` exclusive L128–133 | `vat = Round(net * 0.05)`; `claimable = Round(vat * partialPct/100)`; if entertainment `Round(claimable * 0.5)` | AwayFromZero |
| `ForExpenseInclusive` L169–174 | `net = Round(gross / 1.05)`; `vat = Round(gross - net)`; claimable as above | AwayFromZero |
| `ForReverseChargePurchase` L190–198 | `vat = Round(net * 0.05)` | AwayFromZero |

**Note:** This class does **not** read `VAT_PERCENT` settings. Rate is always `StandardRate = 0.05`.

---

### 1.2 Sales (output VAT) — config-driven percent

**File:** `backend/HexaBill.Api/Modules/Billing/SaleService.cs`

| Site | Formula | Rate source | Rounding |
|------|---------|-------------|----------|
| CreateSale L780–782 | `rowTotal = qty × unitPrice`; `vatAmount = Round(rowTotal × (vatPercent/100), 2, AwayFromZero)`; `lineAmount = rowTotal + vatAmount` | `GetVatPercentAsync` → Settings `VAT_PERCENT` (fallback **5**) L2735–2755 | AwayFromZero |
| CreateSale grand total L853–854 | `grandTotal = Round(subtotal + vatTotal − Discount + RoundOff, 2)` — **invoice discount applied after VAT** (VAT not reduced by discount) | — | default ToEven on outer Round |
| CreateSaleWithOverride L1232–1234 | same line VAT formula | settings | **ToEven** (`Math.Round(..., 2)` — no AwayFromZero) |
| UpdateSale L1797–1798 | same as CreateSale | settings | AwayFromZero |
| Invoice diff helper L2570 | `(Σ unitPrice×qty) * 1.05 − Discount` | **hardcoded 1.05** | none (audit text only) |

**Flags — sales**

1. **Rounding inconsistency:** CreateSale/Update use AwayFromZero; CreateSaleWithOverride uses ToEven (L1233).
2. **Line discount ignored on server:** SaleItem `Discount` forced to `0` (L794, L1245, L1811). Frontend POS VAT uses `(qty×price − lineDiscount)` then VAT; backend recomputes VAT on `qty×price` only → UI vs persisted VAT can diverge when line discounts are used.
3. **Invoice-level discount after VAT:** VAT is computed on full line nets; discount subtracts from grand total only → output VAT can exceed 5% of (net − discount). VatReturnValidation V001 compares `VatTotal` to `Subtotal × 0.05` and would still pass; FTA “taxable amount” semantics may disagree.

---

### 1.3 Returns — hardcoded 5%, ToEven

**File:** `backend/HexaBill.Api/Modules/Billing/ReturnService.cs`

| Site | Formula | Rounding |
|------|---------|----------|
| Sale return L171–173 | `lineTotal = qty × saleItem.UnitPrice`; `vatAmount = Math.Round(lineTotal * 0.05m, 2)` | **ToEven**; rate **hardcoded** (ignores `VAT_PERCENT`) |
| Purchase return L452–454 | `lineTotal = qty × UnitCost`; `vatAmount = Math.Round(lineTotal * 0.05m, 2)` | same |

**Frontend preview:** `frontend/hexabill-ui/src/pages/company/ReturnCreatePage.jsx` L119–120  
`vatTotal = Math.round(subtotal * 0.05 * 100) / 100` — hardcoded 5%, JS half-up.

---

### 1.4 Purchases (input VAT) — percent from request / default 5, mostly unrounded

**File:** `backend/HexaBill.Api/Modules/Purchases/PurchaseService.cs`

| Site | Formula | Rounding |
|------|---------|----------|
| Create L343–399 | `vatPercent = request.VatPercent ?? 5`; if inclusive: `excl = cost/(1+vat%/100)`, `vat = incl−excl`; else `vat = excl×(vat%/100)`; line totals `qty × …` summed **without** per-line Round | **Unrounded** accumulation |
| Update path ~L578–619 | same pattern | Unrounded |
| Has-VAT heuristic L844 | `(TotalAmount − TotalAmount/1.05m) > 0.01` | hardcoded 1.05 |

**Backfill script:** `backend/HexaBill.Api/Scripts/BackfillPurchaseVAT.cs` L16, L66–73 — `_vatPercent = 5m`, same extract/add formulas, unrounded.

**Frontend:** `PurchasesPage.jsx` L1451+, L1607+ — `vat = subtotal * (vatPercent/100)` displayed with `.toFixed(2)` only (display round; payload uses settings percent).

**Flag:** Purchase VAT lines are not rounded AwayFromZero per unit/line before header sum → can disagree with `VatCalculator` / sales rounding by ±0.01+ on multi-line bills.

---

### 1.5 Expenses (input VAT) — via VatCalculator + bulk path

**File:** `backend/HexaBill.Api/Modules/Expenses/ExpenseService.cs`

| Site | Formula | Rounding |
|------|---------|----------|
| Create L448–477 | if withVat & not petroleum: Inclusive → `ForExpenseInclusive(amount, …)` else `ForExpense(amount, …)`; **stores `Amount = Net` when inclusive** (L462) | AwayFromZero (calculator) |
| Update L616–631 | same | AwayFromZero |
| Bulk extract L789–801 | `net = Round(Amount/(1+vatRate), 2, AwayFromZero)`; `vat = total−net`; entertainment claimable `Round(vat*0.5, 2)` (**ToEven** on 0.5 path — no AwayFromZero arg) | mixed |
| Bulk add-on-top L805–817 | `VatCalculator.ForExpense(net, …)` (ignores request rate if Standard; always 5%) | AwayFromZero |

**Frontend preview (not persisted):** `ExpensesPage.jsx`

| Site | Formula |
|------|---------|
| BulkVatForm L51–64 | exclusive: `roundMoney(amount * 0.05)`; inclusive: `roundMoney(amount/(1+0.05))`, vat = amount−net |
| Create/edit preview L2046–2048, L2252–2254 | `net = inclusive ? roundMoney(amt/1.05) : amt`; `vat = inclusive ? roundMoney(amt−net) : roundMoney(amt*0.05)` |
| Bulk API payload L72, L1543 | `vatRate: 0.05` (fraction) |

`roundMoney`: `frontend/hexabill-ui/src/utils/currency.js` L2 — JS half-up.

**Flag — VatInclusive net on VAT Return:** After create/update, `Expense.Amount` is already **net**. But `VatReturnReportService` L332–334 does `netAmount = Amount − VatAmount` when `VatInclusive == true`, which **double-subtracts VAT** for correctly written expenses.

---

### 1.6 VAT Return engine — mix of stored totals + hardcoded 5% rebuilds

**File:** `backend/HexaBill.Api/Modules/Reports/VatReturnReportService.cs`

| Site | Formula | Rounding |
|------|---------|----------|
| Legacy sale rebuild L163–166 | if Subtotal=VatTotal=0 and GrandTotal>0: `net = Round(GrandTotal/1.05, 2)`; `vat = Round(GrandTotal−net, 2)` | **ToEven**; hardcoded 1.05 |
| Zayoga-style rebuild L169–172 | `net = VatCalculator.Round(GrandTotal/(1+0.05))`; `vat = Round(GrandTotal−net)` | AwayFromZero |
| Box1a/1b L177–178 | sum of `VatCalculator.Round(net/vat)` per sale | AwayFromZero |
| Returns L214–217 | use stored `Subtotal`/`VatTotal` | AwayFromZero on add |
| Purchase fallback L272–273 | `pVat = Round(TotalAmount − TotalAmount/1.05)` | AwayFromZero; hardcoded 1.05 |
| Expense claimable fallback L326–327 | `claimable = Round(Amount * VatRate / 100)` | AwayFromZero — **unit bug** (see flags) |
| Box totals L438–448 | Round each box | AwayFromZero |

**Validation:** `VatReturnValidationService.cs` L190 — `expectedVat = VatCalculator.Round(s.Subtotal * 0.05m)` — **always 5%**, ignores tenant `VAT_PERCENT`.

---

### 1.7 POS / cart (frontend) — settings percent, JS half-up

| File | Formula |
|------|---------|
| `pos/PosEnterprisePage.jsx` L665, L707, L880 | `rowTotal = qty×price − lineDiscount`; `vatAmount = Math.round(rowTotal * (vatPercent/100) * 100) / 100` |
| `pos/engine/CommandDispatcher.js` L23 | same |
| `PosPageLegacy.jsx` L627, L667, L924 | same |

`vatPercent` from `settingsAPI.getCompanySettings().vatPercent`, fallback **5** (`FALLBACK_VAT_PERCENT`).

Totals: sum of line `vatAmount` (not re-rounded at invoice level). Invoice discount subtracted after VAT (L918).

---

### 1.8 Seed / migration / PDF / other

| Site | Formula | Notes |
|------|---------|-------|
| `SeedController.cs` L118, L269 | `Math.Round(subtotal * 0.05m, 2)` | ToEven; hardcoded |
| `Scripts/ZayogaMigration/Program.cs` L102–104 | `Round(gross/1.05, AwayFromZero)`; `Round(gross−net)` | AwayFromZero; hardcoded |
| PDF labels (`PdfService.cs`, `SimplePdfService.cs`, etc.) | Display “VAT 5%” + stored `VatTotal` | Label hardcoded; amount from DB |
| `InvoiceTemplatesController.cs` sample L347 | static sample amounts | demo only |
| `ExcelImportService.cs` L162, L430 | product `TaxRate` default **5** (percent 0–100) | product field; not sale calc |

Settlement tolerances (`0.05` AED) in `SalePaymentHelpers`, `PurchaseService`, `salePaymentSettlement.js` are **not VAT rates**.

---

### 1.9 Rounding inconsistency matrix (summary flags)

| Path | Mode | Flag |
|------|------|------|
| VatCalculator / Expense create / Sale Create+Update | AwayFromZero | Canonical for FTA engine |
| Sale CreateSaleWithOverride | ToEven | Differs from CreateSale |
| ReturnService sale & purchase returns | ToEven + hardcoded 0.05 | Differs from SaleService settings + AwayFromZero |
| SeedController | ToEven + hardcoded 0.05 | Demo data only |
| VatReturn legacy GrandTotal split L165–166 | ToEven | Sibling path L171 uses AwayFromZero |
| PurchaseService line VAT | Unrounded | Can drift vs Round(·,2) |
| POS / ExpensesPage / ReturnCreatePage | JS half-up | Aligns with AwayFromZero for typical positive AED; not identical to ToEven |
| Bulk expense entertainment L801 | `Math.Round(vat*0.5, 2)` ToEven | Calculator path uses AwayFromZero |

---

## 2. Expense aggregation paths vs Worksheet

### 2.1 What `Expense.Amount` means

On create/update with VAT:

- **Exclusive:** `Amount` = entered net; `TotalAmount` = net + VAT; `VatAmount` = VAT.
- **Inclusive:** `Amount` = **extracted net**; `TotalAmount` = gross entered; `VatAmount` = VAT.

So `Amount` is generally **net (excl. VAT)** when VAT is present; cash/receipt total is `TotalAmount`.

### 2.2 Worksheet

| Layer | Path | Aggregation |
|-------|------|-------------|
| API | `ReportService.GetWorksheetReportAsync` L954–979 | `TotalExpenses = summary.ExpensesToday` |
| Summary | `GetSummaryReportAsync` L293–304 | Approved expenses only; **`Sum(e.Amount)`** (net) |
| UI | `WorksheetPage.jsx` L228–230 | Displays `data.totalExpenses` |

**Worksheet Total Expenses = Σ net Amount of Approved expenses in period** (not `TotalAmount`, not Pending).

### 2.3 Parallel expense totals (comparison)

| Consumer | File:line | Field summed | Status filter | Matches Worksheet? |
|----------|-----------|--------------|---------------|-------------------|
| Worksheet / Dashboard summary | `ReportService.cs` L304 | `Amount` | **Approved** | Baseline |
| Expense summary API | `ExpenseService.GetExpensesSummaryAsync` L334 | **`TotalAmount ?? Amount`** (gross when VAT set) | Approved | **No** — higher when VAT present |
| Profit / P&L | `ProfitService.cs` L81–87 | `Amount` | **None** (includes Pending/Rejected) | **No** — status + possibly same net field |
| Reports → Expenses by category | `ReportService.GetExpensesByCategoryAsync` L1765 | `Amount` | **None** | **No** — includes non-Approved |
| Sales vs Expenses chart | `ReportService` L1817–1825, L1893–1907 | `Amount` | **None** | **No** |
| Branch summary | `BranchService.cs` L278–280 | `Expenses.Amount` | None | **No**; also **adds `RouteExpenses.Amount`** (separate table, no VAT fields) L272–280, L380–381 |
| Route summary | `RouteService.cs` L136–138, L471–473 | `RouteExpenses.Amount` only | N/A | Different entity than company Expenses |
| SuperAdmin usage | `SuperAdminTenantService.cs` L1434–1436 | `Amount` | (check call site) | Likely net only |
| SuperAdmin dashboard | `DashboardController.cs` L79 | `Amount` | depends on query | — |
| VAT Return Box 9b | `VatReturnReportService` L300–330 | Claimable VAT (not expense total) | Approved + claimable rules | Different metric |
| Reports UI summary card | `ReportsPage.jsx` L364–374 | Uses summary `expensesToday` | Approved / Amount | Aligns with Worksheet |
| Reports UI expenses tab footer | `ReportsPage.jsx` L1843 | Sum of category `totalAmount` from by-category API | No Approved filter | Can disagree with summary card |
| Expenses page list paid display | `ExpensesPage.jsx` L396, L1756 | Prefers `totalAmount` then amount+vat | UI only | Gross-oriented |

### 2.4 Flags — expense totals

1. **Worksheet vs Expense Summary API:** Worksheet = net `Amount`; Expenses summary = gross `TotalAmount ?? Amount`.
2. **Worksheet vs ProfitService / category reports:** Worksheet filters **Approved**; Profit and by-category **do not**.
3. **Worksheet vs Branch/Route:** Branch profit mixes company `Expenses` + `RouteExpenses` (no VAT model); Route pages use route expenses only.
4. **VAT inclusive storage vs VAT Return net line:** Return may understate expense net when `VatInclusive` (see §1.5 / §1.6).
5. **Claimable VAT for dashboard:** Summary uses `ClaimableVat ?? VatAmount` (L305); Expense summary uses `ClaimableVat` only (L336) — another small divergence for input VAT KPIs.

---

## 3. Hardcoded rates vs config

### 3.1 Configured rate (percent, typically `5`)

| Store | Key / property | Used by |
|-------|----------------|---------|
| `Settings` table | `VAT_PERCENT` (string, e.g. `"5"`) | `SaleService.GetVatPercentAsync`; `SettingsService` default seed; onboarding/Settings UI |
| `CompanySettings` model | `VatPercent = 5.0m` | Exposed via company settings API as `vatPercent` |
| Purchase request | `VatPercent ?? 5` | Purchase create/update |
| POS / Purchases UI | loaded from company settings; fallback 5 | Display + purchase payload |

### 3.2 Hardcoded `0.05` / `1.05` / “5%” (ignore tenant settings)

| Area | Examples |
|------|----------|
| `VatCalculator.StandardRate` | All expense VAT via calculator; reverse charge helpers |
| Returns | `ReturnService` `* 0.05m`; `ReturnCreatePage` `0.05` |
| VAT Return rebuild / validation | `/1.05`, `* 0.05m`, V001 |
| Expense UI | previews and bulk `vatRate: 0.05` |
| Seed / Zayoga migration | `0.05m` |
| Sale audit diff | `* 1.05m` |
| PDF / UI copy | “VAT 5%” labels |
| Expense category defaults | UI options `0.05`; model comment “0.05 for 5%” |
| DTO default | `DTOs.cs` L685 `VatRate = 0.05m` |

**Implication:** Changing `VAT_PERCENT` to e.g. 15 updates **new sales** (and POS preview if settings load). It does **not** update expense VAT, returns, VatCalculator, or VAT Return validation/rebuild paths.

### 3.3 Rate **unit** inconsistencies (fraction vs percent)

| Field / usage | Stored / sent as | Consumer assumption |
|---------------|------------------|---------------------|
| `SaleItem.VatRate` | `vatPercent/100` → **0.05** | Fraction |
| `Expense.VatRate` from calculator | **0.05** | Fraction |
| Bulk update request from UI | **0.05** | Fraction in `/(1+vatRate)` |
| Category `DefaultVatRate` | **0.05** in UI | Fraction; `withVat = DefaultVatRate > 0` |
| `VatReturnReportService` L327 | `Amount * VatRate / 100` | Treats rate as **percent** → if DB has `0.05`, claimable ≈ **Amount × 0.0005** |
| Product import `TaxRate` | **5** (0–100) | Percent |
| Settings `VAT_PERCENT` | **5** | Percent |

**Flag:** Fallback claimable formula at `VatReturnReportService.cs:327` is inconsistent with how `Expense.VatRate` is written (fraction). Only matters when ClaimableVat/VatAmount/TotalAmount paths all fail.

### 3.4 Onboarding

`OnboardingWizard.jsx` L26, L350–356 — user can pick 5% or 15%; writes `VAT_PERCENT`. Expense/return/calculator paths remain 5% hardcoded regardless.

---

## 4. Quick reference — primary files

| Concern | Primary files |
|---------|----------------|
| Pure VAT math | `backend/HexaBill.Api/Shared/Services/VatCalculator.cs` |
| Sales VAT | `…/Billing/SaleService.cs` |
| Returns VAT | `…/Billing/ReturnService.cs` |
| Purchase VAT | `…/Purchases/PurchaseService.cs` |
| Expense VAT | `…/Expenses/ExpenseService.cs` |
| VAT Return | `…/Reports/VatReturnReportService.cs`, `VatReturnValidationService.cs` |
| Worksheet expenses | `…/Reports/ReportService.cs` (`GetWorksheetReportAsync`, summary L304) |
| Profit expenses | `…/Reports/ProfitService.cs` |
| POS VAT UI | `frontend/.../pos/PosEnterprisePage.jsx`, `CommandDispatcher.js` |
| Expense VAT UI | `frontend/.../ExpensesPage.jsx` |
| Settings rate | `Settings` / `SettingsService`, `SettingsPage.jsx` |

---

## 5. Flag list only (no fix proposals)

1. Rounding: AwayFromZero vs ToEven vs unrounded vs JS half-up across Sale (override), Returns, Purchases, Seed, VAT Return legacy split.
2. Sales invoice discount after VAT; line discounts applied in POS VAT but stripped on server.
3. Returns & VatCalculator & expense engine ignore `VAT_PERCENT`.
4. V001 validation always assumes 5% of Subtotal.
5. Expense `VatRate` fraction vs VAT Return `/100` fallback.
6. VAT Return expense net when `VatInclusive` may double-subtract VAT.
7. Worksheet expenses = Approved **net** `Amount`; Expense Summary = **gross**; Profit/category charts = **Amount** without Approved filter; Branch mixes RouteExpenses.
8. Hardcoded “5%” PDF/UI labels vs configurable sales rate.
9. Purchase VAT unrounded vs sale/expense rounded.

---

*End of audit. Generated for documentation only; no code changes proposed beyond flags above.*
