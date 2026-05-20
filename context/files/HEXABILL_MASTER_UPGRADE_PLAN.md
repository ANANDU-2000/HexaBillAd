# HexaBill — Master Upgrade Plan
**Based on full ZIP audit · May 2026**  
**Audience: Anandu (solo founder, Cursor Pro)**

---

## 0. Reality Check First

Before any UI changes: the codebase is already well-structured. You have real paying clients. The stack is production-grade (.NET 8 + PostgreSQL + React/Vite + Tailwind). The VAT engine is correct (per-line rounding, MidpointRounding.AwayFromZero). The multi-tenant isolation using TenantId on every query is fundamentally sound.

What this plan targets is the **30% of changes that produce 80% of business results** — specifically for Gulf distributor and food trading clients like Vahid (StarPlus), Frozen Magic, and Zayoga.

---

## 1. CRITICAL BUGS — Fix First, Before Anything Else

### 1.1 Duplicate useDebounce Hook
**File:** `src/hooks/useDebounce.js` AND `src/hooks/useDebounce.jsx` both exist.  
**Risk:** Import confusion, tree-shaking issues, potential stale closure on mobile.  
**Fix:** Delete `useDebounce.jsx`, keep only `useDebounce.js`.

### 1.2 Two Conflicting Design Token Files
**Files:** `src/styles/tokens.css` (OKLCH) and `src/styles/design-tokens.css` (hex + OKLCH mix).  
**Risk:** Both define `--space-*` with different values. Space-3 = `16px` in one, `0.75rem` in other = silent layout inconsistency across pages.  
**Fix:** Merge into single `tokens.css`. Remove `design-tokens.css`. Standardize on 8pt grid px values.

### 1.3 Tailwind Primary Color vs Design System Mismatch
**tailwind.config.js** defines `primary = indigo (6366f1)`.  
**tokens.css** defines `--primary = oklch(55% 0.18 240)` which is a mid blue.  
**Risk:** Buttons and badges render different colors depending on which class is used. On mobile some states look inconsistent.  
**Fix:** Lock to one color. Recommendation: `#2563EB` (blue-600). Update both tailwind config and CSS vars to match.

### 1.4 BottomNav Missing Pages
**BottomNav.jsx** has 5 items: Home, Products, POS, Purchases, Ledger.  
**Real operators also need:** Expenses (daily), Reports (owners), Customers (account managers).  
**Risk:** Staff must exit to sidebar for common tasks → wasted taps on mobile.  
**Fix:** See Section 5 for BottomNav redesign.

### 1.5 Dashboard Has Two Files
`Dashboard.jsx` and `DashboardTally.jsx` both exist. No routing logic found to differentiate them.  
**Risk:** Dead code, confusion for future AI code edits, potential A/B test artifact never cleaned.  
**Fix:** Pick one (DashboardTally appears more Tally-style; evaluate and delete the other).

### 1.6 Sidebar Collapse Stored in localStorage
```js
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
  return localStorage.getItem('sidebar_collapsed') === 'true'
})
```
**Risk:** On mobile browsers localStorage can be cleared by OS. Sidebar state is lost. On tablets this is jarring.  
**Fix:** This is low risk but document it. Consider falling back to default `false` gracefully.

### 1.7 BalanceService — Documented Tech Debt
You already know this. `BalanceService.RecalculateAll` is a known risk. Every payment, return, and sale delete triggers recalculation. Under concurrent requests, this can produce incorrect running balances.  
**Fix:** See Section 3 — Transaction Safety.

### 1.8 OwnerId / TenantId Inconsistency
Archive scripts show `MigrateOwnerIdToTenantId.sql`. This migration exists but older code paths may still write `OwnerId`.  
**Fix:** Grep all controllers for `.OwnerId` assignment. Verify `TenantContextMiddleware` always sets `TenantId`, never `OwnerId`.

---

## 2. SECURITY AUDIT — Real Risks

### 2.1 SuperAdmin SQL Console Exposure
**File:** `SuperAdminSqlConsolePage.jsx` + `SqlConsoleController.cs`  
**Risk:** Raw SQL execution interface accessible to SystemAdmin role. If JWT is leaked or role check has a bug, any tenant data is exposed.  
**Required:** Rate limiting, IP whitelist (Render IP), mutation whitelist (SELECT only in prod), audit log every execution with full query text.

### 2.2 SeedController in Production
**File:** `Modules/Seed/SeedController.cs` exists.  
**Risk:** If not behind a production guard, seed data can be triggered on live tenant.  
**Fix:** Gate with `!IsDevelopment()` check at controller level, not just endpoint-level.

### 2.3 File Upload — No MIME Validation Check Found
**File:** `FileUploadService.cs` + `R2FileUploadService.cs`  
Only extension check visible. SVG with embedded JS, or polyglot files, can bypass extension checks.  
**Fix:** Add content-type verification using magic bytes, not just MIME header from client.

### 2.4 Auth Token — No Refresh Token Implementation Visible
`useAuth.jsx` stores JWT. No refresh token flow visible.  
**Risk:** Long-lived sessions. If JWT expiry is 7+ days, a stolen token has a long blast radius.  
**Fix:** Implement refresh token rotation. 15-min access token, 7-day refresh with rotation.

### 2.5 Console Logging Disabled in Production
`disableConsoleInProduction.js` exists — good. But `Program.cs` likely still has `Console.WriteLine` calls.  
**Fix:** You already documented this. Run: `grep -r "Console.WriteLine" backend/` and replace with `ILogger`.

---

## 3. TRANSACTION SAFETY — Money Flows

### 3.1 Sale + Stock Deduction Must Be Atomic
In `SaleService.CreateSaleAsync`, stock deduction happens after sale record insert.  
If server crashes between insert and stock update: sale exists, stock is not deducted. Inventory is wrong.  
**Fix:**
```csharp
using var transaction = await _context.Database.BeginTransactionAsync();
try {
    // Insert sale
    // Deduct stock
    // Create inventory transaction record
    await transaction.CommitAsync();
} catch {
    await transaction.RollbackAsync();
    throw;
}
```
Verify this wrapping exists in `SaleService.cs`. If not, add it immediately.

### 3.2 Payment + Balance Update Must Be Atomic
`PaymentService` + `BalanceService` interaction: if payment is saved but balance recalculation throws, balance is stale.  
**Fix:** Wrap payment creation + balance recalculation in same DB transaction.

### 3.3 Return + Stock Restoration Must Be Atomic
`ReturnService.cs` creates return record + restores stock. Same atomic risk.  
**Fix:** Same transaction wrapping pattern.

### 3.4 Recurring Invoice Job — No Idempotency Guard
`DailyRecurringInvoiceJob.cs` runs daily. If Render restarts during the job, it may create duplicate invoices.  
**Fix:** Add `LastRunDate` timestamp check. If already ran today for this tenantId, skip.

---

## 4. DESKTOP UX — What to Fix Now

### 4.1 Dashboard KPI Cards
**Current:** Today/Week/Month toggle is good. But KPI cards are generic (sales, purchases, expenses, profit).  
**What Gulf distributors actually need at a glance:**
- Cash Collected Today (vs Credit Outstanding)
- Overdue Customers (with count and amount)
- Low Stock Items Count (with link to products)
- Today's Route Performance (if routes are active)
- VAT Payable This Period

**Implementation:**
```jsx
// Priority KPI layout (desktop: 5 cards row, tablet: 3+2, mobile: 2+2+1)
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
  <StatCard icon={Banknote} label="Cash Today" value={cashToday} trend={cashTrend} color="emerald" />
  <StatCard icon={Clock} label="Overdue" value={overdueAmount} count={overdueCount} color="red" />
  <StatCard icon={Package} label="Low Stock" value={lowStockCount} color="amber" />
  <StatCard icon={TrendingUp} label="Revenue" value={salesTotal} trend={salesTrend} />
  <StatCard icon={Receipt} label="VAT Due" value={vatPayable} color="blue" />
</div>
```

### 4.2 Sales Ledger Table — Mobile Card View Missing
`SalesLedgerPage.jsx` renders a standard table.  
On mobile: horizontal scroll is the current experience.  
**Fix:** Add responsive card rows for < 768px:
```jsx
{/* Mobile: card per row */}
<div className="block md:hidden space-y-2">
  {rows.map(row => (
    <div key={row.id} className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex justify-between">
        <span className="font-medium text-sm">{row.customerName}</span>
        <Badge status={row.paymentStatus} />
      </div>
      <div className="flex justify-between mt-2 text-sm text-neutral-500">
        <span>{row.invoiceNumber}</span>
        <span className="font-semibold text-neutral-900">{formatCurrency(row.total)}</span>
      </div>
    </div>
  ))}
</div>
{/* Desktop: table */}
<div className="hidden md:block">
  <ModernTable ... />
</div>
```

### 4.3 POS Page Touch Targets
`PosPage.jsx` has quantity +/- buttons. On mobile these are likely `w-8 h-8` or smaller.  
Gulf operators use phones to punch invoices. Minimum 44px touch target required.  
**Fix:**
```jsx
<button className="w-11 h-11 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100">
  <Minus className="w-4 h-4" />
</button>
```

### 4.4 Form Field Order — POS Invoice Flow
Current POS likely shows: Customer → Items → Payment.  
Gulf operator's mental model: Items first (they know what was ordered), then Customer, then Payment.  
**Consider:** Allow "anonymous" item entry first, then attach customer at payment step.

---

## 5. MOBILE-FIRST REDESIGN — Specific Changes

### 5.1 BottomNav Redesign (5 Tabs)
Current tabs: Home, Products, POS, Purchases, Ledger.

**Proposed tabs based on actual daily workflow:**
| Tab | Icon | Who Uses | Why |
|-----|------|----------|-----|
| Home | Home | Everyone | Dashboard |
| POS | ShoppingCart | Staff daily | Invoice entry |
| Ledger | BookOpen | Owner + Staff | Sales history |
| Customers | Users | Account managers | Overdue tracking |
| More | Menu | Everyone | Expenses, Reports, Settings |

**Implementation:**
```jsx
const navItems = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'POS', href: '/pos', icon: ShoppingCart, primary: true },
  { name: 'Ledger', href: '/ledger', icon: BookOpen },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'More', href: '/more', icon: Menu },
]
```
The "More" screen is a simple full-screen list of: Expenses, Products, Purchases, Reports, Settings, Profile, Logout.

### 5.2 More Screen (Replace Deep Sidebar on Mobile)
```jsx
const MorePage = () => (
  <div className="p-4 space-y-2">
    <MoreItem icon={DollarSign} label="Expenses" href="/expenses" />
    <MoreItem icon={Package} label="Products" href="/products" />
    <MoreItem icon={Truck} label="Purchases" href="/purchases" />
    <MoreItem icon={BarChart3} label="Reports" href="/reports" />
    <MoreItem icon={Settings} label="Settings" href="/settings" />
  </div>
)
```

### 5.3 Swipe-to-Action on Lists
For Sales Ledger and Customer list on mobile: swipe right = Record Payment, swipe left = View.  
This is a power-user feature. Add only after core fixes.

### 5.4 Sticky Invoice Total Bar
On POS page mobile view: the total (subtotal, VAT, grand total) must be a sticky bar at the bottom (above BottomNav).
```jsx
{/* Sticky summary bar */}
<div className="fixed bottom-14 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-3 z-40">
  <div className="flex justify-between items-center">
    <div>
      <p className="text-xs text-neutral-500">Subtotal · VAT 5%</p>
      <p className="text-sm text-neutral-600">{formatCurrency(subtotal)} · {formatCurrency(vatAmount)}</p>
    </div>
    <div className="text-right">
      <p className="text-xs text-neutral-500">Total</p>
      <p className="text-xl font-bold text-neutral-900">{formatCurrency(grandTotal)}</p>
    </div>
  </div>
</div>
```

---

## 6. TABLET UX — Split-Screen Layout

For tablets (768–1024px), the current layout collapses sidebar. Better approach:

### 6.1 POS Tablet Split View
Left panel (60%): Product search + item list  
Right panel (40%): Customer + totals + payment  
```jsx
<div className="hidden md:flex lg:hidden h-full">
  <div className="w-3/5 border-r border-neutral-200 overflow-y-auto">
    {/* Products */}
  </div>
  <div className="w-2/5 flex flex-col">
    {/* Customer, totals, pay button */}
  </div>
</div>
```

### 6.2 Customer Detail Tablet Layout
Left: Customer info + balance summary  
Right: Transaction history  
This mirrors how accountants work — they want both visible simultaneously.

---

## 7. MISSING FEATURES — Highest Business Impact

### Priority 1 (Build Now — Revenue Impact)
| Feature | Why | Effort |
|---------|-----|--------|
| WhatsApp Invoice Share | Gulf operators share invoices on WhatsApp daily. You have `whatsapp.js` — complete the flow with a single tap button on invoice | Low (already partially built) |
| Overdue Customer Alert | Owner needs: "Who hasn't paid in 30+ days?" — sortable list with amount | Medium |
| Customer Statement PDF | Monthly statement per customer — standard Gulf requirement for B2B | Medium |
| Cash vs Credit Split on Dashboard | Owners want to see how much they collected in cash vs credit today | Low |

### Priority 2 (Build in 30-60 days)
| Feature | Why | Effort |
|---------|-----|--------|
| Route Performance Report | For distribution businesses (Frozen Magic), route-level P&L | Medium |
| Barcode Scan (Camera) | Mobile POS product lookup via camera scan | Medium |
| Stock Reorder Alerts | When product stock < reorder level, auto-alert owner via WhatsApp | Medium |
| Recurring Purchase | For monthly rent, utilities — same as recurring invoice | Low |

### Priority 3 (Future)
- Multi-currency (if expanding beyond UAE/Gulf)
- Customer portal (they can see their own ledger)
- Delivery receipt signature capture

### Avoid Building
- AI-powered suggestions — not trusted by Gulf business owners yet
- Complex approval workflows — overengineered for SMB
- Built-in accounting (P&L, balance sheet) — Tally handles this; HexaBill wins on operations

---

## 8. COLOR SYSTEM — Final Lock

Stop the OKLCH vs hex inconsistency. Lock to this:

```css
/* tokens.css — FINAL LOCKED SYSTEM */
:root {
  /* Brand */
  --color-primary: #2563EB;      /* Blue 600 — CTAs only */
  --color-primary-light: #EFF6FF; /* Blue 50 — active backgrounds */
  --color-primary-dark: #1D4ED8;  /* Blue 700 — hover */

  /* Surfaces */
  --bg-base: #FAFAFA;
  --bg-card: #FFFFFF;
  --bg-elevated: #F1F5F9;        /* Sidebar, table header */

  /* Text */
  --text-primary: #0F172A;       /* Almost black */
  --text-secondary: #475569;     /* Slate 600 */
  --text-tertiary: #94A3B8;      /* Slate 400 — labels, captions */

  /* Borders */
  --border: #E2E8F0;             /* Slate 200 */
  --border-focus: #2563EB;       /* Blue — focus rings */

  /* Semantic */
  --color-success: #059669;      /* Emerald 600 */
  --color-warning: #D97706;      /* Amber 600 */
  --color-error: #DC2626;        /* Red 600 */
  --color-info: #2563EB;         /* Same as primary */

  /* Invoice/Payment Status */
  --status-paid: #059669;
  --status-partial: #D97706;
  --status-unpaid: #DC2626;
  --status-credit: #7C3AED;      /* Violet — credit notes */
  --status-draft: #6B7280;       /* Gray */

  /* VAT Status */
  --vat-filed: #059669;
  --vat-pending: #D97706;
  --vat-locked: #1E40AF;
}

/* Dark mode — explicit, not inverted */
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

## 9. TYPOGRAPHY SYSTEM — Final Lock

One font: **Inter** (already in tailwind config). Lock the scale:

```css
/* ERP Typography Scale */
--font-xs: 11px;   /* Labels inside tables, badges */
--font-sm: 13px;   /* Table rows, form helper text */
--font-base: 14px; /* Default body, form inputs */
--font-md: 15px;   /* Form labels, card titles */
--font-lg: 18px;   /* Page section headers */
--font-xl: 22px;   /* Page titles */
--font-2xl: 28px;  /* Dashboard KPI numbers */

/* Dashboard KPI numbers deserve special treatment */
.kpi-number {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}

/* Table rows — compact density */
.table-cell {
  font-size: 13px;
  line-height: 1.4;
  padding: 10px 12px;
}
```

---

## 10. SPACING SYSTEM

8pt grid. Consistent, no exceptions.

```
4px  = gap-1  (icon spacing inside buttons)
8px  = gap-2  (tight groupings, badge padding)
12px = gap-3  (form field internal padding)
16px = gap-4  (section spacing mobile, card padding mobile)
24px = gap-6  (card padding desktop, section gaps)
32px = gap-8  (major section gaps desktop)
48px = gap-12 (page top padding desktop)
```

---

## 11. PERFORMANCE WINS — Quick

### 11.1 Memoize StatCard
`StatCard` re-renders on every parent state change. Wrap with `React.memo`.
```jsx
export const StatCard = React.memo(({ label, value, trend, icon, color }) => { ... })
```

### 11.2 Debounce All Search Inputs
`useDebounce.js` exists but verify every search input uses it. POS product search must be debounced at 300ms.

### 11.3 Virtualize Long Lists
Products page and Customer list can have 200+ items. Use `react-virtual` or `@tanstack/react-virtual` for lists exceeding 50 items.

### 11.4 Remove Recharts if Only Used in Dashboard
Check if Recharts is only used in one place. If so, replace with a lightweight alternative or native SVG charts. Recharts adds ~150KB to bundle.

---

## 12. PRODUCTION RELIABILITY

### 12.1 Invoice Number Race Condition
`InvoiceNumberService.cs` — if two requests hit simultaneously, they may generate the same invoice number.  
**Fix:** Use `SELECT ... FOR UPDATE` or PostgreSQL sequence directly.
```sql
CREATE SEQUENCE IF NOT EXISTS invoice_seq_tenant_{tenantId} START 1;
SELECT nextval('invoice_seq_tenant_{tenantId}');
```

### 12.2 Float vs Decimal in Frontend
Frontend uses JavaScript numbers for calculations (VAT, totals). JS floats will drift.  
Example: `0.1 + 0.2 === 0.30000000000000004`  
**Fix:** Always receive final calculated values from backend. Never recalculate totals in frontend. Display only.
```js
// BAD
const vat = quantity * price * 0.05

// GOOD — trust backend
const { vatAmount, totalAmount } = saleData
```

### 12.3 Alert Check Background Service — Tenant Isolation
`AlertCheckBackgroundService.cs` runs across all tenants.  
Verify: each alert query includes `.Where(x => x.TenantId == tenantId)`.  
If a `foreach tenants` loop exists, verify it doesn't leak alerts between iterations.

---

## 13. IMPLEMENTATION ROADMAP

### Week 1 — Zero-Risk Fixes
- [ ] Delete duplicate `useDebounce.jsx`
- [ ] Merge token CSS files into single source
- [ ] Fix tailwind primary color to `#2563EB`
- [ ] Delete unused Dashboard file (keep one)
- [ ] Replace `Console.WriteLine` with `ILogger` in backend
- [ ] Add `React.memo` to StatCard, Badge, Button

### Week 2 — Mobile UX
- [ ] BottomNav redesign (5 tabs with More screen)
- [ ] Mobile card rows for Sales Ledger
- [ ] Sticky invoice total bar in POS
- [ ] Touch targets ≥ 44px for all action buttons
- [ ] Tablet split-view for POS page

### Week 3 — Business Features
- [ ] WhatsApp invoice share (complete the flow)
- [ ] Overdue customer filter + report
- [ ] Cash vs Credit split on Dashboard KPI
- [ ] Customer statement PDF endpoint

### Week 4 — Production Hardening
- [ ] Verify atomic transactions on Sale, Payment, Return
- [ ] Fix invoice number race condition with PostgreSQL sequence
- [ ] Add refresh token flow to Auth
- [ ] Gate SeedController for production
- [ ] SQL Console — audit log + IP restriction

---

## 14. WHAT NOT TO TOUCH

1. VAT calculation engine — it is correct per UAE FTA
2. Multi-tenant TenantId isolation — it's working
3. Existing migration history — additive only
4. The RecurringInvoice job flow — just add idempotency guard
5. The auth middleware chain — it works; don't refactor for refactoring's sake

---

## 15. THE REAL COMPETITIVE ADVANTAGE

**Why Gulf businesses will pay for HexaBill over Tally/Zoho:**

1. **Mobile-first, not mobile-afterthought** — Tally is a desktop app; Zoho Mobile is clunky
2. **Gulf VAT compliance built-in** — not an addon
3. **Route-based distribution tracking** — unique to food/FMCG distribution
4. **WhatsApp-native workflow** — Gulf operators live on WhatsApp; invoices shared with one tap
5. **Owner dashboard in 3 seconds** — no accountant needed to run reports
6. **Arabic-ready fonts** — you already have NotoSansArabic loaded

**The pitch to Vahid's 9 contacts:**
"HexaBill gives your accountant speed (Tally-like operations) and gives you visibility (owner dashboard) — in one app that works on your phone."

**Retention mechanism:** The more invoices, customers, and transaction history a business accumulates in HexaBill, the harder it is to leave. Every month of data is switching cost. This is operational lock-in, not feature lock-in.
