# HEXABILL — QUICK REFERENCE DOCS
# Use alongside the master prompt. These are page-level and flow-level references.

**Live status:** [`docs/MASTER_PROMPT_STATUS.md`](../docs/MASTER_PROMPT_STATUS.md) (what is implemented vs backlog).

---

## agents.md — What Each File Does

```
BACKEND AGENTS (services that do real work):

SaleService.cs              → Create/edit/delete invoices + stock deduction
  └─ SaleValidationService  → Lock/unlock invoice, 8-hour edit window
  └─ InvoiceNumberService   → Generate sequential invoice numbers
  └─ RecurringInvoiceService→ Auto-create recurring invoices daily

PaymentService.cs           → Record customer payments, update sale status
  └─ PaymentReceiptService  → Generate payment receipt PDF

ReturnService.cs            → Process sale returns, restore stock

ProductService.cs           → CRUD products, stock management
  └─ StockAdjustmentService → Manual stock in/out with reason

CustomerService.cs          → CRUD customers
  └─ BalanceService         → Recalculate customer outstanding balance

PurchaseService.cs          → Record supplier purchases, increase stock
  └─ SupplierService        → CRUD suppliers

ReportService.cs            → Dashboard summary, date-range reports
  └─ ProfitService          → Gross/net profit calculations
  └─ VatReturnReportService → UAE FTA VAT return computation

AlertService.cs             → Create/resolve alerts
  └─ AlertCheckBackground   → Runs every 15min: low stock, overdue invoices

VatCalculator.cs            → SINGLE SOURCE OF TRUTH for VAT math

AuditService.cs             → Record every important action with old/new values

BackupService.cs            → Tenant data backup to Cloudflare R2

SubscriptionService.cs      → Manage trial/paid subscription status

BACKGROUND JOBS:
  BalanceReconciliationJob  → Nightly: fix any stale customer balances
  DailyRecurringInvoiceJob  → Daily: create recurring invoices
  DailyBackupScheduler      → Daily: tenant data backups
  TrialExpiryCheckJob       → Daily: expire trials, send reminders

FRONTEND PAGES:

DashboardTally.jsx          → Owner/admin dashboard (KPIs, pending bills, low stock)
PosPage.jsx                 → Primary billing screen (invoice creation, POS)
SalesLedgerPage.jsx         → All invoices list with filter/search
CustomerLedgerPage.jsx      → Customer-specific invoice + payment history
BillingHistoryPage.jsx      → Archived/deleted invoice history
CustomersPage.jsx           → Customer list (name, balance, phone)
CustomerDetailPage.jsx      → Single customer: ledger, payments, contact
ProductsPage.jsx            → Product catalog (name, price, stock)
PurchasesPage.jsx           → Supplier purchase records
SuppliersPage.jsx           → Supplier list
SupplierDetailPage.jsx      → Supplier purchase history + payments
ExpensesPage.jsx            → Business expenses with VAT
PaymentsPage.jsx            → All payment records
ReportsPage.jsx             → P&L, sales summary, item reports
VatReturnPage.jsx           → UAE FTA VAT return filing
WorksheetPage.jsx           → Owner-only financial worksheet
BranchesPage.jsx            → Multi-branch management
RoutesPage.jsx              → Delivery route management
ReturnCreatePage.jsx        → Create sale return / credit note
UsersPage.jsx               → Staff user management + permissions
SettingsPage.jsx            → Company settings, VAT%, invoice prefix
AuditLogPage.jsx            → Full action audit trail
BackupPage.jsx              → Manual backup + restore
```

---

## flows.md — Critical Business Flows

### INVOICE CREATION FLOW
```
1. Staff opens POS page (/pos)
2. Optionally selects Branch/Route (auto-selected if only 1)
3. Types customer name → autocomplete from loaded customers
4. Types product name or scans barcode → item added to cart
5. Adjusts quantity (+ / - buttons)
6. Optionally applies discount
7. Backend calculates: subtotal, VAT (per line), grand total
8. Selects payment method (Cash / Credit / Cheque / Online)
9. Enters amount paid
10. Clicks "Save Invoice"

BACKEND ATOMIC TRANSACTION:
  a. Generate unique invoice number (PostgreSQL sequence)
  b. Insert Sale record
  c. Insert SaleItem records (one per cart row)
  d. Deduct StockQty from each Product
  e. Insert InventoryTransaction records
  f. If payment amount > 0: insert Payment record
  g. Update Sale.PaidAmount + Sale.PaymentStatus
  h. Update Customer balance (BalanceService)
  i. Insert AuditLog entry
  j. COMMIT

POST-SAVE:
  - Show invoice number to staff
  - Offer: Print PDF | Share WhatsApp | New Invoice
  - Check if any product now below reorder level → create Alert
```

### PAYMENT RECORDING FLOW
```
1. Owner/staff opens Sales Ledger or Customer Ledger
2. Finds unpaid/partial invoice
3. Clicks "Record Payment"
4. Enters amount, payment method, date, reference
5. Clicks "Save"

BACKEND ATOMIC TRANSACTION:
  a. Insert Payment record
  b. Update Sale.PaidAmount += amount
  c. Recalculate Sale.PaymentStatus (Partial or Paid)
  d. Recalculate Customer balance
  e. Insert AuditLog entry
  f. COMMIT
```

### STOCK ADJUSTMENT FLOW
```
1. Owner opens Products page
2. Clicks "Adjust Stock" on a product
3. Modal: enter quantity (+/-), reason, reference
4. Saves

BACKEND:
  a. Update Product.StockQty
  b. Insert InventoryTransaction (type: Adjustment)
  c. Insert AuditLog entry
  All in single transaction.
```

### VAT RETURN FLOW
```
1. Owner goes to VAT Return page
2. Selects tax period (quarter)
3. System shows: Output VAT (from sales), Input VAT (from purchases + expenses)
4. Shows net VAT payable
5. Owner downloads PDF for FTA submission
6. Marks period as filed → LOCKS all invoices in that period
```

---

## pages.md — Per-Page Improvement Notes

### Dashboard (DashboardTally.jsx)
DONE (recent): Cash & bank collections, on-account billed, overdue count + amount with links, **owner-only net VAT payable** for selected date range (from summary API), lighter card chrome (no heavy shadows on key blocks).
STILL USEFUL:
- Route performance summary tile (if routes heavily used)
REMOVE: AI suggestions field (not trusted by Gulf operators) — keep out of dashboard

### POS (PosPage.jsx)
DONE (recent): Tablet/desktop **split** (lines left, payment right); barcode camera entry points; **Enter** on product search adds next row when dropdown is closed; **initial focus** on first empty product row after catalog load (new invoice).
STILL USEFUL:
- Sticky totals bar on mobile (above BottomNav)
- 44px min touch targets audit pass
- WhatsApp share on invoice success

### Sales Ledger (SalesLedgerPage.jsx)
DONE (recent): **Overdue only** chip + URL `overdue=1`, days overdue column, Record payment → customer ledger with payment modal (`recordPayment`).
STILL USEFUL:
- Swipe actions on mobile rows (optional)

### Customers (CustomersPage.jsx)
DONE (recent): Sort **balance desc** / **activity desc** / name (API `sortBy`); **WhatsApp** when phone present (desktop + mobile).
STILL USEFUL:
- Overdue-only filter on this list (if product wants parity with ledger)
- “Generate Statement” on customer detail

### Products (ProductsPage.jsx)
DONE (recent): **History** link to stock adjustments with `productId` filter; barcode surfaced in list (verify column vs product data).
STILL USEFUL:
- Low stock filter
- Richer stock movement drill-down from catalog

### Reports (ReportsPage.jsx)
DONE (recent): **AI Insights** tab behind `VITE_REPORTS_AI_INSIGHTS` (default off).
STILL USEFUL:
- Route performance report (distribution clients)
- Extra aging buckets if finance asks

---

## tasks-today.md — MUST BUILD NOW (Ordered by Impact)

### DONE (May 2026 backlog slice — see `docs/MASTER_PROMPT_STATUS.md`)
- Sales ledger overdue filter + days overdue + payment deep-link
- Customers sort + WhatsApp actions
- Products → stock adjustments by `productId`
- Dashboard net VAT owner card + summary API field
- Reports AI tab feature-flag (off by default)
- POS tablet split + Enter-to-add-row + initial product focus

### NEXT (revenue / daily ops):
1. WhatsApp share button on POS invoice success ← 2-4 hours
2. Sticky total bar on POS mobile ← 1-2 hours
3. 44px touch targets in POS (audit + fixes) ← 1-2 hours
4. Mobile card rows for Sales Ledger (if still desired over current layout) ← 2-3 hours

### THIS WEEK (retention impact):
5. BottomNav redesign + MorePage ← 2-3 hours
6. Customer statement PDF endpoint + button ← 1 day
7. Overdue-only filter on Customers page (optional parity) ← 2-3 hours

### THIS MONTH (trust impact):
8. Verify all 3 atomic transactions (sale/payment/return) in staging
9. Invoice number concurrency audit (`InvoiceNumberService`) + doc
10. Refresh token auth flow (see `docs/JWT_REFRESH_SPIKE.md`)
11. Route performance report page
12. Report/index tuning after profiling (see `docs/BACKEND_TRUST_TRANCHE_NOTES.md`)

### NEVER BUILD:
- AI-powered product suggestions
- Built-in accounting (P&L balance sheet) — Tally does this
- Multi-currency support (Gulf is mostly AED/SAR)
- Customer portal login
- Complex approval workflows
- Real-time chat/support inside app
- Inventory forecasting ML

---

## cursor-snippets.md — Reusable Code Patterns

### Mobile card row pattern:
```jsx
{/* Mobile: card rows */}
<div className="block md:hidden space-y-2 px-4 pb-20">
  {items.map(item => (
    <div key={item.id} className="bg-white border border-neutral-200 rounded-xl p-4">
      {/* content */}
    </div>
  ))}
</div>
{/* Desktop: table */}
<div className="hidden md:block">
  <ModernTable ... />
</div>
```

### Stat card (Gulf-relevant):
```jsx
<StatCard
  icon={IconComponent}
  label="Label"
  value={formatCurrency(amount)}
  subValue={`${count} items`}
  color="error" // or "success", "warning", "default"
  onClick={() => navigate('/target')}
  clickable
/>
```

### WhatsApp share button:
```jsx
<button
  onClick={() => {
    const msg = `Invoice ${inv.invoiceNo} — ${formatCurrency(inv.grandTotal)}`
    window.open(`https://wa.me/971${phone?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank')
  }}
  className="flex items-center gap-2 h-11 px-4 bg-[#25D366] text-white rounded-xl text-sm font-medium"
>
  <MessageCircle className="w-5 h-5" />
  Share
</button>
```

### Atomic backend transaction:
```csharp
using var tx = await _context.Database.BeginTransactionAsync();
try {
    // all DB operations here
    await _context.SaveChangesAsync();
    await tx.CommitAsync();
    _logger.LogInformation("Operation completed for tenant {TenantId}", tenantId);
} catch (Exception ex) {
    await tx.RollbackAsync();
    _logger.LogError(ex, "Operation failed for tenant {TenantId}", tenantId);
    throw;
}
```

### New API endpoint template:
```csharp
[Authorize]
[HttpGet("your-endpoint")]
public async Task<IActionResult> YourEndpoint()
{
    var tenantId = User.GetTenantId();
    if (tenantId <= 0) return Unauthorized();

    try {
        var result = await _service.YourMethodAsync(tenantId);
        return Ok(new { success = true, data = result });
    } catch (Exception ex) {
        _logger.LogError(ex, "YourEndpoint failed for tenant {TenantId}", tenantId);
        return StatusCode(500, new { success = false, message = "An error occurred." });
    }
}
```

### New React page template:
```jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { someAPI } from '../../services'
import { StatCard, EmptyState, LoadingSkeleton } from '../../components/ui'
import { formatCurrency } from '../../utils/currency'

const YourPage = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await someAPI.getItems()
        if (res.success) setData(res.data)
      } catch (err) {
        if (!err?._handledByInterceptor) showToast.error('Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <LoadingSkeleton rows={5} />
  if (!data.length) return <EmptyState message="No items yet" />

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-semibold text-neutral-900 mb-4">Page Title</h1>
      {/* content */}
    </div>
  )
}

export default YourPage
```
