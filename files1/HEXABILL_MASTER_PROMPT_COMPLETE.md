# HEXABILL — ONE-TAP CURSOR MASTER PROMPT
# Version: 3.0 · May 2026 · Built from full ZIP audit
# PASTE THIS ENTIRE FILE INTO CURSOR CHAT. PRESS ENTER ONCE. DO NOT INTERRUPT.
# Cursor executes ALL steps in order. No questions. No stops. No assumptions.

---

## ⚡ EXECUTION DIRECTIVE

You are a senior full-stack engineer executing a complete upgrade on the HexaBill ERP SaaS codebase.
Real clients. Real money. Real Gulf VAT invoices. Production system.

### CRITICAL BEHAVIOR RULES — READ BEFORE ANYTHING

- Do NOT ask questions. Ever.
- Do NOT stop for confirmation between steps.
- Do NOT say "Should I proceed?" or "Want me to continue?"
- Do NOT skip a step because it "seems complex."
- Do NOT guess file content — always READ the actual file first.
- Do NOT assume file structure — always LIST the directory.
- If something is already correct: say `✅ Already correct — skipping` and move on.
- If file doesn't exist: CREATE it.
- If file exists: READ it first, then edit ONLY what needs changing.
- After every single step output exactly: `✅ STEP [N] COMPLETE — moving to next`

DO NOT STOP UNTIL ALL STEPS ARE COMPLETE.

---

## Live repo status (May 2026)

The master prompt is a **runbook**, not a live checklist. For **what is already implemented** (dashboard VAT card, POS keyboard/split layout, sales/customers/products/report changes, API fields), use:

**[`docs/MASTER_PROMPT_STATUS.md`](../docs/MASTER_PROMPT_STATUS.md)**

Trust/backend follow-ups (invoice numbers, logging, JWT refresh spike, indexes) are summarized in **`docs/BACKEND_TRUST_TRANCHE_NOTES.md`**.

---

## 🏗️ PROJECT ARCHITECTURE — READ FIRST

**Product:** HexaBill — multi-tenant ERP SaaS for Gulf VAT businesses
**Real clients:** StarPlus (Vahid), Frozen Magic, Zayoga
**Niche:** Food distributors, FMCG, ice distribution, Gulf SMB trading

**Stack:**
```
Backend:    .NET 8, ASP.NET Core, Entity Framework Core, PostgreSQL (Render)
Frontend:   React 18 + Vite + Tailwind CSS + Lucide React + Recharts
Auth:       JWT (custom JwtMiddleware + TenantContextMiddleware)
Storage:    Cloudflare R2
Deploy:     Render (API) + Vercel (Frontend)
```

**Key directory map:**
```
/backend/HexaBill.Api/
  /BackgroundJobs/           ← BalanceReconciliationJob, DailyRecurringInvoiceJob, etc.
  /Data/AppDbContext.cs      ← EF Core DbContext, all DbSets
  /Migrations/               ← EF Core migrations (NEVER touch existing ones)
  /Models/                   ← All entity models (Sale, Product, Customer, etc.)
  /Modules/
    /Auth/                   ← AuthController, AuthService, SignupService
    /Billing/                ← SaleService, SaleController, PdfService, ReturnService
    /Branches/               ← BranchService, RouteService
    /Customers/              ← CustomerService, BalanceService
    /Expenses/               ← ExpenseService
    /Inventory/              ← ProductService, StockAdjustmentService
    /Notifications/          ← AlertService, AlertCheckBackgroundService
    /Payments/               ← PaymentService, PaymentReceiptService
    /Purchases/              ← PurchaseService, SupplierService
    /Reports/                ← ReportService, ProfitService, VatReturnReportService
    /SuperAdmin/             ← SuperAdminController, BackupService, DiagnosticsController
    /Subscription/           ← SubscriptionService, SubscriptionController
  /Shared/
    /Services/
      /VatCalculator.cs      ← CRITICAL: all VAT math lives here
      /BalanceService.cs     ← customer balance recalculation
      /TenantContextService.cs
    /Middleware/
      /JwtMiddleware.cs
      /TenantContextMiddleware.cs
      /SubscriptionMiddleware.cs
  /Templates/                ← invoice-template.html, sales-report-template.html

/frontend/hexabill-ui/src/
  /pages/company/            ← all main app pages
    Dashboard.jsx            ← OLD (delete this, keep DashboardTally)
    DashboardTally.jsx       ← ACTIVE dashboard
    PosPage.jsx              ← billing / POS
    SalesLedgerPage.jsx
    CustomerLedgerPage.jsx
    ProductsPage.jsx
    PurchasesPage.jsx
    SuppliersPage.jsx
    ExpensesPage.jsx
    ReportsPage.jsx
    VatReturnPage.jsx
    CustomersPage.jsx
    CustomerDetailPage.jsx
    SettingsPage.jsx
    UsersPage.jsx
    BranchesPage.jsx / BranchDetailPage.jsx
    RoutesPage.jsx / RouteDetailPage.jsx
    ReturnCreatePage.jsx
    WorksheetPage.jsx
    AuditLogPage.jsx
    BackupPage.jsx
  /pages/superadmin/         ← SuperAdmin panel (platform management)
  /components/               ← Layout, Modal, PaymentModal, etc.
  /components/ui/            ← StatCard, Button, Input, Badge, ModernTable, etc.
  /hooks/
    useAuth.jsx
    useAutoRefresh.js
    useDebounce.js           ← (useDebounce.jsx is duplicate — delete it)
  /services/api.js           ← Axios client, caching, request dedup
  /services/apiConfig.js
  /styles/
    design-tokens.css        ← DUPLICATE — needs merge
    tokens.css               ← PRIMARY — keep this
  /utils/
    currency.js
    salePaymentSettlement.js
    whatsapp.js              ← WhatsApp share utility (PARTIALLY wired)
    roles.js
    dateFormat.js
    validation.js

/.cursor/rules/
  enterprise-saas-production.mdc   ← existing rules
  hexabill-ui-ux-design.mdc       ← existing UI rules
```

---

## 🔒 ABSOLUTE RULES — NEVER VIOLATE IN ANY STEP

### RULE 1: MONEY MATH = BACKEND ONLY
Frontend NEVER calculates VAT, totals, or balances.
Always display values received from backend.
Backend always uses `VatCalculator.ForSupply()` or `VatCalculator.ForExpense()`.
Rounding: `Math.Round(value, 2, MidpointRounding.AwayFromZero)` — UAE FTA compliant.

```js
// ❌ NEVER
const vat = qty * price * 0.05;
// ✅ ALWAYS
const { vatAmount, totalAmount } = backendResponse;
```

### RULE 2: MULTI-TENANT ISOLATION
ALL DB queries must include `.Where(x => x.TenantId == tenantId)`.
TenantId ALWAYS from JWT claim, NEVER from user input.
Every new table needs `TenantId int NOT NULL` column + index.

```csharp
// ❌ NEVER
var sales = await _context.Sales.ToListAsync();
// ✅ ALWAYS
var tenantId = User.GetTenantId();
var sales = await _context.Sales.Where(s => s.TenantId == tenantId).ToListAsync();
```

### RULE 3: ATOMIC TRANSACTIONS
Sale creation + stock deduction → same transaction.
Payment + balance update → same transaction.
Return + stock restoration → same transaction.

```csharp
using var tx = await _context.Database.BeginTransactionAsync();
try {
    // all operations
    await tx.CommitAsync();
} catch {
    await tx.RollbackAsync();
    throw;
}
```

### RULE 4: NO CONSOLE.WRITELINE
Use `ILogger<T>`. Never `Console.WriteLine` in backend.

### RULE 5: MIGRATIONS ADDITIVE ONLY
Add columns. Add tables. NEVER drop or rename without explicit deprecation plan in comment.
Every schema change = new migration file.

### RULE 6: FEATURE FLAGS
New backend features behind `tenant.Features` JSON flag. Off by default.
Example: `{"barcode_scan": false, "whatsapp_alerts": false}`

### RULE 7: INPUT VALIDATION
Validate on BOTH backend and frontend. Backend is source of truth.
Use `InputValidator` helper in `Shared/Extensions/InputValidator.cs`.

---

## 🎨 DESIGN SYSTEM — LOCKED (use everywhere)

### Colors (hex, not OKLCH):
```css
--color-primary:       #2563EB;   /* Blue-600 — CTAs ONLY */
--color-primary-dark:  #1D4ED8;   /* Blue-700 — hover */
--color-primary-light: #EFF6FF;   /* Blue-50 — active backgrounds */
--bg-base:             #FAFAFA;
--bg-card:             #FFFFFF;
--bg-elevated:         #F1F5F9;   /* sidebar, table headers */
--text-primary:        #0F172A;
--text-secondary:      #475569;
--text-tertiary:       #94A3B8;
--border:              #E2E8F0;
--border-focus:        #2563EB;
--color-success:       #059669;
--color-warning:       #D97706;
--color-error:         #DC2626;
--status-paid:         #059669;
--status-partial:      #D97706;
--status-unpaid:       #DC2626;
--status-credit:       #7C3AED;
```

### Typography (Inter only):
```
11px → badge text, table labels, chip text
13px → table rows, helper text, secondary info
14px → default body, inputs (base font)
15px → form labels, card titles
18px → section headers
22px → page titles
28px bold tracking-tight → KPI numbers
```

### Spacing (8pt grid, strict):
```
4px  = gap-1  (icon spacing inside buttons only)
8px  = gap-2  (tight groupings, badge padding)
12px = gap-3  (form internal padding)
16px = gap-4  (section spacing mobile, card padding mobile)
24px = gap-6  (card padding desktop, section gaps)
32px = gap-8  (major section gaps desktop)
```

### Component Rules:
- Cards: `bg-white border border-neutral-200 rounded-xl` — NO shadow
- Buttons desktop: `h-10` (40px). Mobile: `h-11` (44px minimum)
- Dropdowns: `shadow-md`. Modals: `shadow-lg`
- Icons: Lucide ONLY (from `lucide-react`). No emoji. No other icon libraries.
- No gradients. No animations on data. No colored shadows.
- Tables → cards on mobile (< 768px). No horizontal scroll.

---

## 📋 FULL TASK LIST — EXECUTE IN ORDER

---

### PHASE 0: CURSOR RULES SETUP

---

#### STEP 1 — Delete duplicate useDebounce hook
**File to delete:** `frontend/hexabill-ui/src/hooks/useDebounce.jsx`
**Keep:** `frontend/hexabill-ui/src/hooks/useDebounce.js`
Action: Delete `useDebounce.jsx`. Search entire frontend codebase for imports of `useDebounce.jsx` and update them to `useDebounce.js`.
Risk: Import confusion causing stale closures on mobile.

---

#### STEP 2 — Merge duplicate CSS token files
**Files:**
- `frontend/hexabill-ui/src/styles/tokens.css` (PRIMARY — keep)
- `frontend/hexabill-ui/src/styles/design-tokens.css` (DUPLICATE — merge into tokens.css then delete)

Action:
1. Read both files.
2. Merge all unique token definitions into `tokens.css`.
3. Lock final color values to the hex system above (replace OKLCH with hex).
4. Delete `design-tokens.css`.
5. Search for any import of `design-tokens.css` in codebase and remove/update to `tokens.css`.

Final `tokens.css` must contain this locked system:
```css
:root {
  --color-primary: #2563EB;
  --color-primary-dark: #1D4ED8;
  --color-primary-light: #EFF6FF;
  --bg-base: #FAFAFA;
  --bg-card: #FFFFFF;
  --bg-elevated: #F1F5F9;
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-tertiary: #94A3B8;
  --border: #E2E8F0;
  --border-focus: #2563EB;
  --color-success: #059669;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --status-paid: #059669;
  --status-partial: #D97706;
  --status-unpaid: #DC2626;
  --status-credit: #7C3AED;
  --status-draft: #6B7280;
  --vat-filed: #059669;
  --vat-pending: #D97706;
  --vat-locked: #1E40AF;
  /* Spacing — 8pt grid */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  /* Layout */
  --sidebar-width: 240px;
  --topbar-height: 64px;
  --touch-min: 44px;
  --btn-height: 40px;
  --btn-height-mobile: 44px;
}
[data-theme="dark"] {
  --bg-base: #0F172A;
  --bg-card: #1E293B;
  --bg-elevated: #1E293B;
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --text-tertiary: #64748B;
  --border: #334155;
}
```

---

#### STEP 3 — Fix Tailwind primary color
**File:** `frontend/hexabill-ui/tailwind.config.js`

Read current file. Find the `primary` color definition (currently likely indigo `6366f1`).
Change to:
```js
primary: {
  DEFAULT: '#2563EB',
  light: '#EFF6FF',
  dark: '#1D4ED8',
},
```
This aligns Tailwind with CSS vars. Eliminates dual-color rendering bug.

---

#### STEP 4 — Delete dead Dashboard file
**Files:**
- `frontend/hexabill-ui/src/pages/company/Dashboard.jsx` — DELETE
- `frontend/hexabill-ui/src/pages/company/DashboardTally.jsx` — KEEP (this is the active one)

Read `App.jsx`. It imports `DashboardTally` as `Dashboard`. The old `Dashboard.jsx` is dead code.
Action: Delete `Dashboard.jsx`. Confirm `App.jsx` imports correctly.

---

#### STEP 5 — Update .cursor/rules/hexabill-production.mdc
**File:** `.cursor/rules/hexabill-production.mdc`

Read the existing file. Replace entirely with this content:

```markdown
---
description: HexaBill v3 production rules — multi-tenant ERP SaaS for Gulf market. ALWAYS apply to ALL files.
globs: "**/*"
alwaysApply: true
---

# HexaBill Production Rules v3

## Stack
Backend: .NET 8, ASP.NET Core, EF Core, PostgreSQL
Frontend: React 18, Vite, Tailwind CSS, Lucide React
Auth: JWT (custom JwtMiddleware + TenantContextMiddleware)
Storage: Cloudflare R2
Deploy: Render (API) + Vercel (Frontend)

## Non-Negotiable Rules

1. MULTI-TENANT: Every DB query needs `.Where(x => x.TenantId == tenantId)`. TenantId from JWT ONLY.
2. ATOMIC: Sale+stock, payment+balance, return+stock — must be in same DB transaction.
3. VAT MATH: Backend only. Use VatCalculator.cs. Never calculate in frontend JS.
4. ROUNDING: Math.Round(value, 2, MidpointRounding.AwayFromZero) — UAE FTA compliant.
5. LOGGING: ILogger<T> only. No Console.WriteLine. No sensitive data in logs.
6. MIGRATIONS: Additive only. Never drop/rename without deprecation plan.
7. FEATURE FLAGS: New features behind tenant.Features JSON flag, off by default.
8. NO DIRECT DELETE: Handle FK children before delete. Use soft delete where possible.
9. FRONTEND MONEY: Display backend values only. Never recalculate totals in JS.
10. API ENDPOINTS: Every endpoint needs [Authorize] + User.GetTenantId() check.

## Design System (Frontend)
- Primary CTA: #2563EB (ONLY for main actions)
- Cards: bg-white border border-neutral-200 rounded-xl (NO shadow)
- Mobile touch targets: min 44px height
- Icons: Lucide ONLY (lucide-react)
- No gradients. No emoji icons. No horizontal scroll.
- Tables → card rows on mobile (< 768px)
- All spacing: 8pt grid (4/8/12/16/24/32px)
```

---

#### STEP 6 — Update .cursor/rules/hexabill-ui-ux-design.mdc
**File:** `.cursor/rules/hexabill-ui-ux-design.mdc`

Read existing file. Add/update to include:
- Reference to the locked color system in tokens.css
- Explicit mobile card table pattern
- 44px touch target rule
- No OKLCH in inline styles (use CSS vars)
- Lucide icons ONLY rule

---

### PHASE 1: CRITICAL BUG FIXES — BACKEND

---

#### STEP 7 — Verify and fix SaleService atomic transaction
**File:** `backend/HexaBill.Api/Modules/Billing/SaleService.cs`

Read the `CreateSaleAsync` method. Find where Sale is inserted and where stock is deducted.
If they are NOT wrapped in a `BeginTransactionAsync()` / `CommitAsync()` / `RollbackAsync()` block:
Add the transaction wrapper.

Required pattern:
```csharp
using var tx = await _context.Database.BeginTransactionAsync();
try {
    // 1. Insert sale record
    // 2. Insert sale items
    // 3. Deduct stock from each product (Product.StockQty -= item.Qty)
    // 4. Insert InventoryTransaction records
    // 5. Update customer balance
    await _context.SaveChangesAsync();
    await tx.CommitAsync();
} catch {
    await tx.RollbackAsync();
    throw;
}
```

If already wrapped, verify the stock deduction and customer balance are INSIDE the transaction block.

---

#### STEP 8 — Verify PaymentService atomic transaction
**File:** `backend/HexaBill.Api/Modules/Payments/PaymentService.cs`

Read `CreatePaymentAsync`. Verify that:
1. Payment record insert
2. Sale.PaidAmount update
3. Sale.PaymentStatus update
4. BalanceService.RecalculateForCustomer call

Are ALL inside a single `BeginTransactionAsync()` block.
If not: add the wrapper. Same pattern as Step 7.

---

#### STEP 9 — Verify ReturnService atomic transaction
**File:** `backend/HexaBill.Api/Modules/Billing/ReturnService.cs`

Read `CreateReturnAsync`. Verify:
1. Return record insert
2. SaleReturn items insert
3. Stock restoration (Product.StockQty += returnItem.Qty)
4. InventoryTransaction insert (type: Return)
5. Customer balance update

All inside one transaction. Add wrapper if missing.

---

#### STEP 10 — Fix DailyRecurringInvoiceJob idempotency
**File:** `backend/HexaBill.Api/BackgroundJobs/DailyRecurringInvoiceJob.cs`

Read the job. Find the main execution loop.
Add idempotency guard: before creating a recurring invoice for a tenant on a given date, check if one was already created today.

```csharp
// Add per-tenant, per-date guard
var todayUtc = DateTime.UtcNow.Date;
var alreadyRan = await _context.Sales
    .AnyAsync(s => s.TenantId == tenantId
                && s.CreatedAt.Date == todayUtc
                && s.Notes != null && s.Notes.Contains("[RECURRING]"));
if (alreadyRan) {
    _logger.LogInformation("Recurring invoice already created today for tenant {TenantId}", tenantId);
    continue;
}
```

Adjust the Notes tag or add a dedicated `IsRecurring` bool field if cleaner.

---

#### STEP 11 — Fix OwnerId / TenantId inconsistency
**Files:** All controller files in `backend/HexaBill.Api/Modules/`

Run a search for `.OwnerId =` assignment in all controllers and services.
For each occurrence where code writes `entity.OwnerId = userId`, verify:
1. `entity.TenantId` is ALSO being set from `User.GetTenantId()`
2. The OwnerId assignment still exists (don't remove — backward compat) but TenantId is the authoritative field

If TenantId is not being set alongside OwnerId: add it.
Example fix:
```csharp
// Before:
sale.OwnerId = userId;
// After:
sale.OwnerId = userId;
sale.TenantId = tenantId; // ensure TenantId is always set
```

---

#### STEP 12 — Gate SeedController in production
**File:** `backend/HexaBill.Api/Modules/Seed/SeedController.cs`

Read the file. Find the controller class and its constructor/methods.
Add environment guard at the top of every action method:

```csharp
private readonly IWebHostEnvironment _env;

// In constructor add: IWebHostEnvironment env
// Store: _env = env;

// At top of each seed action:
if (!_env.IsDevelopment()) {
    return Forbid("Seed endpoints are not available in production.");
}
```

---

#### STEP 13 — Fix Console.WriteLine usage in backend
Run search across all backend .cs files for `Console.WriteLine`.
For each occurrence:
1. Ensure the class has `ILogger<T>` injected
2. Replace `Console.WriteLine(...)` with appropriate `_logger.LogInformation(...)` / `_logger.LogWarning(...)` / `_logger.LogError(...)`
3. Never log passwords, JWT tokens, or full PII (customer phone, email in logs is OK at Debug level only)

---

#### STEP 14 — Invoice number race condition fix
**File:** `backend/HexaBill.Api/Modules/Billing/InvoiceNumberService.cs`

Read the file. Find how the next invoice number is generated.
If it uses a MAX(InvoiceNo) + 1 approach: this has a race condition under concurrent requests.

Fix: Use the existing PostgreSQL sequence already defined in AppDbContext.cs:
```sql
-- sequence: invoice_number_seq already exists
SELECT nextval('invoice_number_seq')
```

If the service is already using `nextval`: verify and skip.
If using MAX + 1: replace with:
```csharp
var nextNum = await _context.Database
    .ExecuteSqlRawAsync("SELECT nextval('invoice_number_seq')")
// OR use EF raw query:
var result = await _context.Database
    .SqlQueryRaw<long>("SELECT nextval('invoice_number_seq') AS \"Value\"")
    .FirstAsync();
var invoiceNumber = $"INV-{tenantId:D4}-{result:D6}";
```

---

#### STEP 15 — Add SQL Console audit logging and rate limit
**File:** `backend/HexaBill.Api/Modules/SuperAdmin/SqlConsoleController.cs`

Read the file. Find the execute-query action.
Add:
1. Audit log EVERY execution with: userId, query text, timestamp, tenantId
2. Rate limit: max 10 SQL executions per minute per user
3. Reject any query containing: `DROP`, `TRUNCATE`, `DELETE FROM` (without WHERE), `ALTER TABLE`, `UPDATE` (without WHERE)

```csharp
// At top of execute method:
var auditEntry = new AuditLog {
    TenantId = null, // Super admin action
    UserId = userId,
    Action = "SQL_CONSOLE_EXECUTE",
    EntityType = "SqlConsole",
    NewValue = query, // log full query
    Timestamp = DateTime.UtcNow
};
_context.AuditLogs.Add(auditEntry);
await _context.SaveChangesAsync();

// Dangerous query check:
var dangerous = new[] { "DROP ", "TRUNCATE ", "ALTER TABLE " };
if (dangerous.Any(d => query.ToUpperInvariant().Contains(d))) {
    return BadRequest("Destructive DDL statements are not allowed via SQL console.");
}
```

---

#### STEP 16 — AlertCheckBackgroundService tenant isolation verify
**File:** `backend/HexaBill.Api/Modules/Notifications/AlertCheckBackgroundService.cs`

Read the entire file. Find the main loop that iterates tenants.
Verify: every inner query that checks products/invoices/payments includes `.Where(x => x.TenantId == currentTenantId)`.
If any query is missing the TenantId filter: add it.
Log any tenant loop iteration at Debug level with tenantId.

---

### PHASE 2: FRONTEND BUG FIXES

---

#### STEP 17 — Fix POS touch targets to 44px minimum
**File:** `frontend/hexabill-ui/src/pages/company/PosPage.jsx`

Read the file. Find:
1. The quantity increment/decrement buttons (+ and -)
2. The "Add Row" button
3. The "Delete Row" button
4. The payment method buttons

Change all of these to have at minimum `h-11 w-11` (44px = 2.75rem in Tailwind = h-11).

```jsx
// Before (too small):
<button className="w-8 h-8 ...">
// After:
<button className="w-11 h-11 flex items-center justify-center rounded-lg ...">
```

Also: the cart item rows on mobile should show as full-width cards, not a compressed table row.

---

#### STEP 18 — Add sticky invoice total bar to POS (mobile)
**File:** `frontend/hexabill-ui/src/pages/company/PosPage.jsx`

Read the POS page. Find where subtotal/VAT/grandTotal are calculated and displayed.
On mobile (below md breakpoint), add a sticky fixed bar at bottom showing live totals:

```jsx
{/* Sticky totals bar — mobile only, above bottom nav */}
<div className="fixed bottom-14 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-3 z-40 md:hidden">
  <div className="flex justify-between items-center">
    <div>
      <p className="text-xs text-neutral-500">
        Subtotal · VAT {vatPercent}%
      </p>
      <p className="text-sm text-neutral-600">
        {formatCurrency(subtotal)} · {formatCurrency(vatTotal)}
      </p>
    </div>
    <div className="text-right">
      <p className="text-xs text-neutral-500">Grand Total</p>
      <p className="text-xl font-bold text-neutral-900">
        {formatCurrency(grandTotal)}
      </p>
    </div>
  </div>
</div>
```

This bar must update in real-time as items are added/qty changed.

---

#### STEP 19 — Add mobile card rows to Sales Ledger
**File:** `frontend/hexabill-ui/src/pages/company/SalesLedgerPage.jsx`

Read the file. Find where the table is rendered.
Wrap the table in `hidden md:block`. Add mobile card rows:

```jsx
{/* Mobile view — card rows */}
<div className="block md:hidden space-y-2 px-4">
  {filteredSales.map(sale => (
    <div
      key={sale.id}
      className="bg-white border border-neutral-200 rounded-xl p-4 cursor-pointer"
      onClick={() => handleViewSale(sale)}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-sm font-medium text-neutral-900">
          {sale.customerName || 'Walk-in'}
        </span>
        <PaymentStatusBadge status={sale.paymentStatus} />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-neutral-500">
          {sale.invoiceNo} · {formatDate(sale.invoiceDate)}
        </span>
        <span className="text-sm font-semibold text-neutral-900">
          {formatCurrency(sale.grandTotal)}
        </span>
      </div>
      {sale.paymentStatus !== 'Paid' && (
        <div className="mt-2 pt-2 border-t border-neutral-100 flex justify-between">
          <span className="text-xs text-neutral-500">Balance</span>
          <span className="text-xs font-medium text-red-600">
            {formatCurrency(sale.grandTotal - sale.paidAmount)}
          </span>
        </div>
      )}
    </div>
  ))}
</div>
{/* Desktop view — table */}
<div className="hidden md:block">
  {/* existing table here */}
</div>
```

---

#### STEP 20 — Redesign BottomNav to 5 practical tabs
**File:** `frontend/hexabill-ui/src/components/BottomNav.jsx`

Read current file. Replace the nav items with:

```jsx
const navItems = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'POS', href: '/pos', icon: ShoppingCart, primary: true },
  { name: 'Ledger', href: '/ledger', icon: BookOpen },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'More', href: '/more', icon: Menu },
]
```

The POS tab gets special treatment (slightly larger, primary color icon).
Create the `MorePage` component at `frontend/hexabill-ui/src/pages/company/MorePage.jsx`:

```jsx
// MorePage.jsx
import { DollarSign, Package, Truck, BarChart3, Settings, LogOut, User, FileText, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const MorePage = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const items = [
    { icon: Receipt, label: 'Expenses', href: '/expenses' },
    { icon: Package, label: 'Products', href: '/products' },
    { icon: Truck, label: 'Purchases', href: '/purchases' },
    { icon: FileText, label: 'Reports', href: '/reports' },
    { icon: BarChart3, label: 'VAT Return', href: '/vat-return' },
    { icon: Settings, label: 'Settings', href: '/settings' },
    { icon: User, label: 'Profile', href: '/profile' },
  ]

  return (
    <div className="pb-20 pt-4 px-4">
      <h1 className="text-lg font-semibold text-neutral-900 mb-4">More</h1>
      <div className="space-y-1">
        {items.map(item => (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className="w-full flex items-center gap-4 h-12 px-4 rounded-xl hover:bg-neutral-50 active:bg-neutral-100"
          >
            <item.icon className="w-5 h-5 text-neutral-500" />
            <span className="text-sm text-neutral-900 font-medium">{item.label}</span>
          </button>
        ))}
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-4 h-12 px-4 rounded-xl hover:bg-red-50 active:bg-red-100"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            <span className="text-sm text-red-600 font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default MorePage
```

Add route `/more` in `App.jsx` pointing to `MorePage`.

---

#### STEP 21 — Fix Sales Ledger import page redirect
**File:** `frontend/hexabill-ui/src/App.jsx`

Read current App.jsx. The route `/recurring-invoices` is set to `<Navigate to="/dashboard" replace />` without explanation.
Change to redirect to `/sales-ledger` (more logical destination, or just remove the route if unused):
```jsx
<Route path="/recurring-invoices" element={<RecurringInvoicesPage />} />
```
Import `RecurringInvoicesPage` from `./pages/company/RecurringInvoicesPage`.

Also add the `/more` route inside the Layout block:
```jsx
<Route path="/more" element={<MorePage />} />
```

---

#### STEP 22 — Add React.memo to StatCard, Button, Badge
**Files:**
- `frontend/hexabill-ui/src/components/ui/StatCard.jsx`
- `frontend/hexabill-ui/src/components/ui/Button.jsx`
- `frontend/hexabill-ui/src/components/ui/Badge.jsx`

Read each file. Wrap the default export in `React.memo()`:
```jsx
import React from 'react'
// ...component code...
export default React.memo(StatCard)
```

This prevents unnecessary re-renders on dashboard when parent state changes.

---

#### STEP 23 — Verify all search inputs use useDebounce
**Files:** All page files that have search inputs

Search for `useState` + `search` patterns that trigger API calls.
For each search input that fires an API call on every keystroke, verify it uses:
```js
import useDebounce from '../../hooks/useDebounce'
const debouncedSearch = useDebounce(searchTerm, 300)
useEffect(() => {
  if (debouncedSearch !== undefined) fetchData({ search: debouncedSearch })
}, [debouncedSearch])
```

Key pages to check: ProductsPage, CustomersPage, SuppliersPage, SalesLedgerPage, PosPage (product search).

---

### PHASE 3: NEW FEATURES — HIGH BUSINESS IMPACT

---

#### STEP 24 — WhatsApp Invoice Share (complete the flow)
**Context:** `frontend/hexabill-ui/src/utils/whatsapp.js` has a utility. POS page has a WhatsApp icon in the invoice options. The flow is not complete.

**Backend work (if needed):**
No new endpoint needed — the invoice PDF already exists at `GET /api/sales/{id}/pdf`.

**Frontend work:**

1. Read `utils/whatsapp.js` to understand current helper.
2. In `PosPage.jsx`, find the invoice created success state (where `lastCreatedInvoice` is set and invoice options modal shows).
3. Add a prominent WhatsApp share button:

```jsx
// After invoice is created and lastCreatedInvoice is set:
const handleWhatsAppShare = () => {
  const phone = selectedCustomer?.phone?.replace(/[^0-9]/g, '') || ''
  const invoiceNo = lastCreatedInvoice?.invoiceNo || ''
  const amount = formatCurrency(lastCreatedInvoice?.grandTotal || 0)
  const message = `Invoice ${invoiceNo} — Amount: ${amount}. Please find your invoice from ${companyName}.`
  const url = phone
    ? `https://wa.me/971${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

// Button (shown after successful invoice creation):
<button
  onClick={handleWhatsAppShare}
  className="flex items-center gap-2 h-11 w-full justify-center px-4 bg-[#25D366] text-white rounded-xl text-sm font-medium"
>
  <MessageCircle className="w-5 h-5" />
  Share on WhatsApp
</button>
```

4. This button should appear on the invoice success screen/modal alongside the print/download options.

---

#### STEP 25 — Overdue customers backend endpoint
**File to create:** `backend/HexaBill.Api/Modules/Customers/OverdueReportController.cs`

Create a new endpoint:
```csharp
// GET /api/reports/overdue?days=30
[Authorize]
[HttpGet("reports/overdue")]
public async Task<IActionResult> GetOverdueCustomers([FromQuery] int days = 30)
{
    var tenantId = User.GetTenantId();
    if (tenantId <= 0) return Unauthorized();

    var cutoffDate = DateTime.UtcNow.AddDays(-days);

    var overdueCustomers = await _context.Sales
        .Where(s => s.TenantId == tenantId
                 && !s.IsDeleted
                 && s.PaymentStatus != SalePaymentStatus.Paid
                 && s.InvoiceDate <= cutoffDate)
        .GroupBy(s => new { s.CustomerId, s.Customer!.Name, s.Customer.Phone })
        .Select(g => new {
            CustomerId = g.Key.CustomerId,
            CustomerName = g.Key.Name,
            CustomerPhone = g.Key.Phone,
            TotalOverdue = g.Sum(s => s.GrandTotal - s.PaidAmount),
            OldestInvoiceDate = g.Min(s => s.InvoiceDate),
            InvoiceCount = g.Count()
        })
        .OrderByDescending(x => x.TotalOverdue)
        .ToListAsync();

    return Ok(new { success = true, data = overdueCustomers });
}
```

Register in `Program.cs` if using manual route registration. Ensure TenantId isolation.

---

#### STEP 26 — Overdue customers dashboard widget (frontend)
**File:** `frontend/hexabill-ui/src/pages/company/DashboardTally.jsx`

Read the dashboard. Find where KPI stat cards are rendered.
Add an "Overdue" stat card that:
1. Calls `GET /api/reports/overdue?days=30` on dashboard load
2. Shows count of overdue customers and total overdue amount
3. Is clickable — navigates to `/customers?filter=overdue`
4. Color: red/error when > 0, neutral when 0

```jsx
<StatCard
  icon={AlertTriangle}
  label="Overdue (30d)"
  value={formatCurrency(overdueTotal)}
  subValue={`${overdueCount} customers`}
  color="error"
  onClick={() => navigate('/customers?filter=overdue')}
  clickable
/>
```

Also add Cash vs Credit split to dashboard:
- "Cash Collected Today" card (green) = sum of payments with paymentMode=CASH today
- "Credit Given Today" card (amber) = sum of sales with paymentMode=CREDIT today

These require adding these fields to the existing `GET /api/reports/summary` response in `ReportService.cs`.

---

#### STEP 27 — Add overdue filter to CustomersPage
**File:** `frontend/hexabill-ui/src/pages/company/CustomersPage.jsx`

Read the file. Find the filter/search section.
Add an "Overdue" filter button that shows customers with outstanding balance > 0 where last invoice date is > 30 days ago.

The backend `GET /api/customers` should support `?filter=overdue` query param.
**File:** `backend/HexaBill.Api/Modules/Customers/CustomersController.cs`

Add `overdue` filter to the customers list endpoint:
```csharp
if (filter == "overdue") {
    var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
    // Filter customers who have unpaid sales older than 30 days
    query = query.Where(c =>
        _context.Sales.Any(s =>
            s.CustomerId == c.Id
            && s.TenantId == tenantId
            && !s.IsDeleted
            && s.PaymentStatus != SalePaymentStatus.Paid
            && s.InvoiceDate <= thirtyDaysAgo
        )
    );
}
```

---

#### STEP 28 — Customer statement PDF endpoint
**File:** `backend/HexaBill.Api/Modules/Customers/CustomersController.cs`

Add new endpoint:
```csharp
// GET /api/customers/{id}/statement?from=2025-01-01&to=2025-12-31
[Authorize]
[HttpGet("{id}/statement")]
public async Task<IActionResult> GetCustomerStatement(int id, [FromQuery] DateTime from, [FromQuery] DateTime to)
{
    var tenantId = User.GetTenantId();

    var customer = await _context.Customers
        .Where(c => c.Id == id && c.TenantId == tenantId)
        .FirstOrDefaultAsync();
    if (customer == null) return NotFound();

    var sales = await _context.Sales
        .Include(s => s.Items)
        .Where(s => s.CustomerId == id
                 && s.TenantId == tenantId
                 && !s.IsDeleted
                 && s.InvoiceDate >= from
                 && s.InvoiceDate <= to)
        .OrderBy(s => s.InvoiceDate)
        .ToListAsync();

    var payments = await _context.Payments
        .Where(p => p.CustomerId == id
                 && p.TenantId == tenantId
                 && p.PaymentDate >= from
                 && p.PaymentDate <= to)
        .OrderBy(p => p.PaymentDate)
        .ToListAsync();

    // Build statement using existing PDF infrastructure (PdfService)
    // Return as PDF bytes with Content-Type: application/pdf
    var pdfBytes = await _pdfService.GenerateCustomerStatementAsync(customer, sales, payments, from, to);
    return File(pdfBytes, "application/pdf", $"Statement_{customer.Name}_{from:yyyy-MM}.pdf");
}
```

In `PdfService.cs` add `GenerateCustomerStatementAsync` method using the existing HTML template infrastructure.
Create `Templates/customer-statement-template.html` based on the existing `invoice-template.html` pattern.

Add "Statement" button to `CustomerDetailPage.jsx` frontend.

---

#### STEP 29 — Barcode camera scan on mobile POS
**Context:** Products already have a `Barcode` field. POS search is text-only today.

**Frontend work only (no backend changes):**

1. Install html5-qrcode (already in package.json? If not, add it).
2. In `PosPage.jsx`, add a camera scan button next to the product search input.
3. On tap: open a camera scanner modal.
4. On successful scan: close modal, set the product search term to the scanned barcode, trigger product lookup.

```jsx
// CameraScanner component (inline or separate file):
import { Html5QrcodeScanner } from 'html5-qrcode'

const BarcodeScanner = ({ onScan, onClose }) => {
  const scannerRef = useRef(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('barcode-reader', {
      fps: 10,
      qrbox: { width: 250, height: 150 }
    })
    scanner.render(
      (decodedText) => {
        onScan(decodedText)
        scanner.clear()
      },
      (error) => { /* ignore scan errors */ }
    )
    return () => scanner.clear().catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl p-4 w-full max-w-sm">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium">Scan Barcode</span>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div id="barcode-reader" />
      </div>
    </div>
  )
}
```

After scan: find product by barcode in the loaded products list, auto-add to cart.
```js
const handleBarcodeScanned = (barcode) => {
  setShowScanner(false)
  const product = products.find(p => p.barcode === barcode || p.sku === barcode)
  if (product) addProductToCart(product)
  else showToast.error(`No product found for barcode: ${barcode}`)
}
```

---

#### STEP 30 — Low stock reorder alert WhatsApp notification
**Context:** Alert system exists. `AlertCheckBackgroundService.cs` checks low stock. Only in-app alerts currently.

**Backend work:**

1. Read `AlertCheckBackgroundService.cs` to understand alert trigger mechanism.
2. In `AlertService.cs`, when creating a low stock alert, check tenant settings for `whatsapp_alerts_enabled`.
3. If enabled and owner has a phone number, format and send WhatsApp alert.

The WhatsApp notification can be a server-side `wa.me` link sent via email for now (no WhatsApp Business API cost):
```csharp
// When low stock alert fires:
var setting = await _settingsService.GetSettingAsync(tenantId, "whatsapp_alert_phone");
if (!string.IsNullOrEmpty(setting)) {
    var message = $"⚠️ Low Stock Alert: {product.NameEn} has only {product.StockQty} {product.UnitType} remaining. Reorder level: {product.ReorderLevel}.";
    // Log the alert — actual WhatsApp delivery via email or webhook
    _logger.LogInformation("WhatsApp alert queued for tenant {TenantId}: {Message}", tenantId, message);
}
```

**Frontend:** Add `whatsapp_alert_phone` field to `SettingsPage.jsx` under Notifications section.

---

### PHASE 4: DASHBOARD INTELLIGENCE UPGRADE

---

#### STEP 31 — Upgrade dashboard KPI cards
**File:** `frontend/hexabill-ui/src/pages/company/DashboardTally.jsx`

Read the full dashboard file.
Replace the generic KPI cards with Gulf-business-specific cards:

**5-card layout (desktop: row of 5, tablet: 3+2, mobile: 2+2+1):**

```jsx
{/* KPI Row */}
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
  {canShow('salesToday') && (
    <StatCard
      icon={TrendingUp}
      label={`Revenue (${summaryPeriodLabel})`}
      value={formatCurrency(summary.salesToday)}
      trend={summary.salesChange}
      onClick={() => navigate('/sales-ledger')}
    />
  )}
  {canShow('cashToday') && (
    <StatCard
      icon={Banknote}
      label="Cash Collected"
      value={formatCurrency(summary.cashCollectedToday)}
      color="success"
    />
  )}
  {canShow('overdue') && (
    <StatCard
      icon={Clock}
      label="Overdue"
      value={formatCurrency(summary.overdueAmount)}
      subValue={`${summary.overdueCount} customers`}
      color={summary.overdueAmount > 0 ? 'error' : 'default'}
      onClick={() => navigate('/customers?filter=overdue')}
      clickable
    />
  )}
  {canShow('lowStock') && (
    <StatCard
      icon={Package}
      label="Low Stock"
      value={`${lowStockProducts.length} items`}
      color={lowStockProducts.length > 0 ? 'warning' : 'default'}
      onClick={() => navigate('/products?filter=low_stock')}
      clickable
    />
  )}
  {canShow('vatDue') && isOwner(user) && (
    <StatCard
      icon={Receipt}
      label="VAT Due"
      value={formatCurrency(summary.vatPayable)}
      color="info"
      onClick={() => navigate('/vat-return')}
      clickable
    />
  )}
</div>
```

Also update `ReportService.cs` backend to include `cashCollectedToday`, `overdueAmount`, `overdueCount`, and `vatPayable` in the summary response.

---

#### STEP 32 — Add pending collections panel to dashboard
**File:** `frontend/hexabill-ui/src/components/PendingBillsPanel.jsx`

Read the existing component. The pending bills panel exists. Improve it:
1. Add days-overdue indicator per row (e.g., "32 days" in red)
2. Add "WhatsApp" quick-dial button per row using customer phone
3. Sort by oldest first (most urgent)
4. Show total pending amount prominently

```jsx
// In each pending bill row, add:
<button
  onClick={() => window.open(`https://wa.me/971${bill.customerPhone?.replace(/[^0-9]/g, '')}`, '_blank')}
  className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#25D366]/10 text-[#25D366]"
>
  <MessageCircle className="w-4 h-4" />
</button>
```

---

### PHASE 5: TABLET POS SPLIT VIEW

---

#### STEP 33 — Add tablet split-view to POS page
**File:** `frontend/hexabill-ui/src/pages/company/PosPage.jsx`

Read the full POS page layout. Currently it's single-column on all sizes.
For tablet (768px - 1024px), restructure into split panels:

```jsx
{/* Tablet: 60/40 split */}
<div className="hidden md:flex lg:hidden h-[calc(100vh-64px)]">
  {/* Left: product search + cart items */}
  <div className="w-3/5 border-r border-neutral-200 overflow-y-auto p-4">
    {/* Product search */}
    {/* Cart items list */}
  </div>
  {/* Right: customer, totals, payment */}
  <div className="w-2/5 flex flex-col overflow-y-auto p-4">
    {/* Customer selector */}
    {/* Invoice totals */}
    {/* Payment method */}
    {/* Submit button */}
  </div>
</div>
```

Keep the existing single-column layout for mobile (< 768px) and full-width desktop (> 1024px).

---

### PHASE 6: PERFORMANCE IMPROVEMENTS

---

#### STEP 34 — Add database indexes for common queries
**Create migration:** `backend/HexaBill.Api/Migrations/YYYYMMDD_AddPerformanceIndexes.cs`

Read the existing `AddMissingPerformanceIndexes.sql` file to understand what's already indexed.
Create a new EF Core migration adding:

```csharp
// In migration Up():
migrationBuilder.CreateIndex(
    name: "IX_Sales_TenantId_InvoiceDate",
    table: "Sales",
    columns: new[] { "TenantId", "InvoiceDate" });

migrationBuilder.CreateIndex(
    name: "IX_Sales_TenantId_PaymentStatus",
    table: "Sales",
    columns: new[] { "TenantId", "PaymentStatus" });

migrationBuilder.CreateIndex(
    name: "IX_Sales_CustomerId_PaymentStatus",
    table: "Sales",
    columns: new[] { "CustomerId", "PaymentStatus" });

migrationBuilder.CreateIndex(
    name: "IX_Products_TenantId_Barcode",
    table: "Products",
    columns: new[] { "TenantId", "Barcode" });

migrationBuilder.CreateIndex(
    name: "IX_Payments_TenantId_PaymentDate",
    table: "Payments",
    columns: new[] { "TenantId", "PaymentDate" });
```

Use `migrationBuilder.CreateIndex` with `filter: "\"Barcode\" IS NOT NULL"` for nullable columns.

---

#### STEP 35 — Add response caching to reports endpoints
**File:** `backend/HexaBill.Api/Modules/Reports/ReportsController.cs`

Read the file. Find the summary report endpoint.
Add in-memory response caching with 60-second TTL for the summary report:

```csharp
// In Program.cs add: builder.Services.AddMemoryCache();

// In ReportsController:
private readonly IMemoryCache _cache;

// In GetSummaryReport:
var cacheKey = $"summary_{tenantId}_{fromDate}_{toDate}";
if (_cache.TryGetValue(cacheKey, out var cached)) return Ok(cached);

var result = await _reportService.GetSummaryAsync(...);
_cache.Set(cacheKey, result, TimeSpan.FromSeconds(60));
return Ok(result);
```

Invalidate cache when a new sale is created: in `SaleService.cs` after commit, remove the cache key.

---

### PHASE 7: TRUST & AUDIT SYSTEMS

---

#### STEP 36 — Verify audit log completeness
**File:** `backend/HexaBill.Api/Shared/Services/AuditService.cs`

Read the audit service. Verify it is called (or find where it's called from) for:
1. Sale creation — ✓ verify
2. Sale deletion — ✓ verify
3. Sale edit — ✓ verify (should log old values vs new values)
4. Payment creation — check if audited
5. Stock adjustment — check if audited
6. User creation/deletion — check if audited
7. Settings changes — check if audited

For any missing audit calls, add them in the respective service files.

---

#### STEP 37 — Add invoice version restore UI
**File:** `frontend/hexabill-ui/src/pages/company/SalesLedgerPage.jsx` or `BillingHistoryPage.jsx`

The backend has `GetInvoiceVersionsAsync` and `RestoreInvoiceVersionAsync`.
The frontend does not expose this to owners.

Add to invoice detail view (wherever an invoice is displayed in full):
- "Version History" expandable section
- Shows list of versions with: version number, edited by, date, edit reason
- Owner-only: "Restore this version" button on any previous version

---

#### STEP 38 — Add user activity indicator to UsersPage
**File:** `frontend/hexabill-ui/src/pages/company/UsersPage.jsx`

Read the file. The backend tracks `LastActiveAt` via the ping in `Layout.jsx`.
Add an online/offline indicator next to each user row:
- Green dot: active in last 5 minutes
- Gray dot: last seen timestamp

```jsx
const isOnline = user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime()) < 300000
<span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-neutral-300'}`} />
```

---

### PHASE 8: SCALABILITY & CLEANUP

---

#### STEP 39 — Remove Recharts if only used in one place
**Action:** Search codebase for `recharts` imports.

If Recharts is only used in the dashboard for one chart:
Replace with a lightweight SVG bar chart component.
The dashboard's 7-day sales trend bar chart can be pure SVG (no library needed):

```jsx
// Lightweight SVG bar chart (no recharts dependency):
const MiniBarChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-blue-500 rounded-t"
            style={{ height: `${(d.value / max) * 40}px`, minHeight: d.value > 0 ? '2px' : '0' }}
          />
          <span className="text-xs text-neutral-400">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
```

If Recharts is used in multiple places (reports, etc.), keep it. Just verify bundle impact with `npm run build -- --report`.

---

#### STEP 40 — Clean up dead migration scripts
**Directory:** `backend/HexaBill.Api/Scripts/`

This directory has 40+ individual SQL scripts — most are one-time fixes already applied to production.
Do NOT delete them (they are historical record).
Create a `Scripts/archive/` subdirectory.
Move all one-time fix scripts (anything named `Fix_*`, `Backfill_*`, `FIX_*`, `Ensure_*`, `Mark_*`) to `Scripts/archive/`.
Keep: `01_COMPLETE_DATABASE_SETUP.sql`, `README.md`, ZayogaMigration/, RunSql/.

---

#### STEP 41 — Verify SubscriptionMiddleware doesn't block SuperAdmin
**File:** `backend/HexaBill.Api/Shared/Middleware/SubscriptionMiddleware.cs`

Read the middleware. Verify that SuperAdmin (`role == "SystemAdmin"`) bypasses subscription checks.
If not: add the bypass:
```csharp
var role = context.User.FindFirst(ClaimTypes.Role)?.Value;
if (role == "SystemAdmin") {
    await _next(context);
    return;
}
```

---

### PHASE 9: SUPERADMIN PANEL HARDENING

---

#### STEP 42 — Improve SuperAdmin dashboard metrics
**File:** `frontend/hexabill-ui/src/pages/superadmin/SuperAdminDashboard.jsx`

Read the file. Find what metrics are currently shown.
Add these critical SaaS metrics:
1. Active tenants this week (logged in)
2. New signups last 7 days
3. Trial tenants expiring in 7 days
4. Total invoices created today (across all tenants)
5. System health (API response time, DB connection)

These require a backend endpoint `GET /api/superadmin/metrics` that aggregates:
```csharp
// Add to DashboardController.cs (superadmin):
var metrics = new {
    ActiveTenantsThisWeek = await _context.Tenants
        .CountAsync(t => t.LastActiveAt >= DateTime.UtcNow.AddDays(-7)),
    NewSignupsLast7Days = await _context.Tenants
        .CountAsync(t => t.CreatedAt >= DateTime.UtcNow.AddDays(-7)),
    TrialsExpiringSoon = await _context.Subscriptions
        .CountAsync(s => s.Status == "Trial" && s.ExpiryDate <= DateTime.UtcNow.AddDays(7)),
    TotalInvoicesToday = await _context.Sales
        .CountAsync(s => s.CreatedAt.Date == DateTime.UtcNow.Date && !s.IsDeleted)
};
```

---

#### STEP 43 — Add tenant quick-impersonate from SuperAdmin tenant list
**File:** `frontend/hexabill-ui/src/pages/superadmin/SuperAdminTenantsPage.jsx`

Read current file. Add a "Impersonate" button on each tenant row that lets the SuperAdmin instantly log into that tenant's dashboard to diagnose issues.
This feature likely already exists via `impersonatedTenantId` in `useAuth.jsx`.
If it exists: just add a quick button to the table row.
If not: implement the impersonation flow from the existing auth context.

---

### PHASE 10: PRODUCTION HARDENING

---

#### STEP 44 — Add refresh token flow
**Files:**
- `backend/HexaBill.Api/Modules/Auth/AuthService.cs`
- `frontend/hexabill-ui/src/hooks/useAuth.jsx`

Read AuthService. If JWT expiry is > 4 hours: shorten to 4 hours.
Read useAuth. If no refresh token logic exists:

Backend: Add `POST /api/auth/refresh` endpoint that accepts a refresh token, validates it, issues a new access token.
Frontend: In the Axios interceptor in `api.js`, on 401 response: attempt token refresh before showing login.

This is a critical security hardening step for a financial SaaS.

Minimum implementation:
```csharp
// AuthService.cs: generate refresh token on login
public string GenerateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

// Store hashed refresh token in UserSession with expiry
// Return refresh token in login response (httpOnly cookie preferred)
```

---

#### STEP 45 — Final integration test check
After all steps complete, verify these end-to-end flows work:

1. **Login flow:** User logs in → JWT issued → dashboard loads correctly
2. **Invoice creation:** Products load → item added to cart → VAT calculated by backend → invoice saved → stock deducted → audit log entry created
3. **Payment recording:** Payment amount entered → sale.PaymentStatus updated → customer balance updated → all in one transaction
4. **Mobile POS:** On a phone-sized viewport, BottomNav visible, POS reachable, sticky total bar visible, 44px touch targets all working
5. **WhatsApp share:** After invoice created, WhatsApp button opens wa.me with correct message
6. **Dashboard overdue widget:** Shows correct count of customers with 30+ day unpaid invoices

---

## 📁 NEW FILES TO CREATE (summary)

These files don't exist yet and must be created during the steps above:

```
frontend/hexabill-ui/src/pages/company/MorePage.jsx
backend/HexaBill.Api/Templates/customer-statement-template.html
backend/HexaBill.Api/Migrations/YYYYMMDD_AddPerformanceIndexes.cs
```

---

## 🚫 DO NOT TOUCH

1. `VatCalculator.cs` — UAE FTA compliant, tested, working
2. `TenantContextMiddleware.cs` — multi-tenant isolation is working
3. All existing EF Core migration files (never modify, only add new)
4. `JwtMiddleware.cs` — auth chain is working
5. `BalanceReconciliationJob.cs` — fix is complex, document but don't touch in this session
6. `AppDbContext.cs` entity configurations — additive only
7. `NotoSansArabic` fonts — already correctly configured for Arabic invoice printing

---

## 🏁 COMPLETION CHECKLIST

After all 45 steps, verify:

- [ ] No duplicate files (useDebounce.jsx deleted, Dashboard.jsx deleted)
- [ ] Single tokens.css with locked hex color system
- [ ] Tailwind primary = #2563EB everywhere
- [ ] All 3 critical transaction wrappers verified (sale, payment, return)
- [ ] SeedController gated from production
- [ ] Console.WriteLine → ILogger everywhere
- [ ] BottomNav has 5 tabs + MorePage
- [ ] POS has sticky mobile total bar
- [ ] POS touch targets all ≥ 44px
- [ ] Sales Ledger has mobile card rows
- [ ] WhatsApp invoice share button wired
- [ ] Overdue customer endpoint + dashboard widget
- [ ] Customer statement PDF endpoint
- [ ] Barcode camera scanner on mobile POS
- [ ] Dashboard has 5 Gulf-relevant KPI cards
- [ ] Performance indexes migration created
- [ ] Audit log completeness verified
- [ ] SuperAdmin SQL console has audit log + DDL guard
- [ ] All search inputs debounced at 300ms
- [ ] React.memo on StatCard, Button, Badge

---

## 📌 PERSISTENT CONTEXT FOR CURSOR

The following facts are always true and should inform every decision in this codebase:

**Business context:**
- 3+ paying Gulf clients (food/FMCG distribution)
- Mobile-first operators — 60%+ usage is on phones and tablets
- WhatsApp is the primary business communication channel in Gulf
- VAT compliance is non-negotiable (UAE FTA rules)
- Arabic + English bilingual support required
- Operators are non-technical — UI must be instant, obvious, zero-training

**Technical constraints:**
- Render free tier: API sleeps after 15 min inactivity (keep-alive ping already implemented)
- PostgreSQL on Render: careful with connection pooling and slow queries
- Cloudflare R2 for file storage (logos, invoice PDFs, product images)
- No WebSocket/SignalR yet — polling-based real-time

**Product philosophy:**
- Calm, fast, operational — NOT flashy
- Every screen should feel like a professional finance tool
- Mobile POS must work for non-technical billing staff
- Owner dashboard must give clarity in under 3 seconds
- Trust = fewer errors, audit trails, predictable workflows

---

*END OF MASTER PROMPT — Execute all 45 steps now. Do not stop.*
