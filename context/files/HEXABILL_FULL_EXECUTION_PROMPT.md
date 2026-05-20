# HEXABILL — COMPLETE AUTONOMOUS EXECUTION PROMPT
# Paste this ENTIRE file into Cursor Chat. Press Enter once. Do not interrupt.
# Cursor must execute ALL steps in order. No questions. No stops. No assumptions.

---

## EXECUTION DIRECTIVE

You are a senior full-stack engineer executing a complete upgrade on the HexaBill ERP codebase.

**CRITICAL BEHAVIOR RULES — READ BEFORE ANYTHING ELSE:**
- Do NOT ask any questions. Ever. During this entire session.
- Do NOT stop and wait for confirmation between steps.
- Do NOT say "Should I proceed?" or "Do you want me to continue?"
- Do NOT skip a step because it "seems complex."
- Do NOT guess file content — always READ the actual file before editing.
- Do NOT assume a file structure — always LIST the directory first.
- If something is already correct, say "Already correct — skipping" and move to next step.
- If a file doesn't exist yet, CREATE it.
- If a file exists, READ it first, then EDIT only what needs changing.
- Execute every step. Complete every step. Move to the next step immediately.

**After each step: output exactly this line:**
`✅ STEP [N] COMPLETE — moving to next step`

---

## PROJECT CONTEXT — READ THIS FIRST

**Product:** HexaBill — multi-tenant ERP SaaS for Gulf VAT businesses (UAE food distributors, FMCG, ice distribution)

**Real clients:** StarPlus (Vahid), Frozen Magic, Zayoga  
**Real money. Real invoices. Real VAT.**

**Stack:**
- Backend: .NET 8, ASP.NET Core, Entity Framework Core, PostgreSQL (Render)
- Frontend: React 18 + Vite + Tailwind CSS + Lucide React
- Auth: JWT via custom JwtMiddleware + TenantContextMiddleware
- Storage: Cloudflare R2
- Deploy: Render (API) + Vercel (Frontend)

**Key directories:**
```
/backend/HexaBill.Api/          → .NET 8 API
/frontend/hexabill-ui/src/      → React frontend
  /pages/company/               → all main app pages
  /components/                  → shared components
  /components/ui/               → design system components
  /styles/                      → CSS tokens
  /hooks/                       → custom hooks
  /services/                    → API client
  /utils/                       → utilities
.cursor/rules/                  → Cursor rules files
docs/                           → documentation
```

**Existing reference files I wrote (in this project's docs/ or outputs):**
- `HEXABILL_MASTER_UPGRADE_PLAN.md` — full audit with all bugs and fixes
- `HEXABILL_CURSOR_RULES.md` — all rules with code examples
- `HEXABILL_FEATURES_AND_FIXES.md` — feature gaps and priority list

---

## PHASE 0 — SETUP CURSOR RULES FILES

### STEP 0A — Create .cursor/rules directory if missing
```
Check if .cursor/rules/ exists.
If not: create the directory.
```

### STEP 0B — Install Production Rules File
Create or overwrite `.cursor/rules/hexabill-production.mdc` with this exact content:

```
---
description: HexaBill v2 production rules — multi-tenant ERP SaaS for Gulf market
globs: "**/*"
alwaysApply: true
---

# HexaBill Production Rules v2.0

## Critical: This is a money system
Real invoices. Real VAT. Real businesses in UAE/Gulf.
Every change must be safe, backward-compatible, isolated per tenant.

## Multi-Tenant Law
- ALL DB queries: .Where(x => x.TenantId == tenantId) — no exceptions
- TenantId always from JWT claim: User.GetTenantId()
- Never trust user-supplied tenantId

## Money Math Law
- Backend only: always use VatCalculator.ForSupply() or VatCalculator.ForExpense()
- Frontend: NEVER calculate VAT or totals in JavaScript — display backend values only
- Rounding: Math.Round(value, 2, MidpointRounding.AwayFromZero)

## Transaction Law
- Sale creation + stock deduction: single DB transaction
- Payment + balance update: single DB transaction
- Return + stock restoration: single DB transaction

## Backend API Law
- Every endpoint: [Authorize] + tenant check + try/catch + ILogger
- No Console.WriteLine — use _logger.LogInformation/Warning/Error
- List endpoints: always paginated (default 20, max 100)
- Response: { data, total, page, pageSize } for lists

## DB Migration Law
- Additive only (no drop/rename without full deprecation plan)
- Every new table: TenantId int NOT NULL + index on (TenantId, CreatedAt)
- Soft delete: IsDeleted bool, DeletedAt datetime? — never hard delete financial records

## Frontend Design Law
- Mobile-first: all layouts start flex-col then md:flex-row
- 8pt grid: p-4 gap-4 mobile, p-6 gap-6 desktop
- No horizontal scroll on any screen
- Tables become cards on mobile (< 768px)
- Touch targets: minimum h-11 w-11 (44px) for all interactive elements
- Icons: Lucide only
- Cards: bg-white border border-neutral-200 rounded-xl — no shadow on cards
- Primary color: #2563EB (blue-600) for CTAs only
- Design tokens: src/styles/tokens.css — single source of truth

## React Performance Law
- React.memo on all pure display components
- useCallback for handlers passed as props
- useMemo for filtered/sorted lists
- Search debounce: 300ms via useDebounce.js

## State Law
- Every async component: loading > error > empty > data (all 4 states)

## What NOT to change
- VatCalculator.cs — correct per UAE FTA, do not edit rounding
- Multi-tenant middleware chain
- Existing migration history
- JWT auth middleware
```

### STEP 0C — Install UI Skill File
Create or overwrite `.cursor/rules/hexabill-ui-skill.mdc` with this exact content:

```
---
description: HexaBill UI/UX skill — apply when editing any frontend component, page, or style file
globs: "frontend/hexabill-ui/**/*"
alwaysApply: false
---

# HexaBill UI Skill v2.0

## Design Philosophy
HexaBill must feel like: modern Tally + mobile owner dashboard
NOT: startup SaaS, Material Design, Bootstrap, animation-heavy apps

## Color System (LOCKED)
Primary CTA: #2563EB
Primary hover: #1D4ED8
Primary light: #EFF6FF
Background: #FAFAFA
Card: #FFFFFF
Border: #E2E8F0
Text primary: #0F172A
Text secondary: #475569
Text tertiary: #94A3B8
Success: #059669 | Warning: #D97706 | Error: #DC2626
Status paid: #059669 | partial: #D97706 | unpaid: #DC2626

## Typography (Inter only)
11px — badge text, table labels
13px — table rows, helper text
14px — default body, inputs
15px — form labels, card titles
18px — section headers
22px — page titles
28px + font-bold + tracking-tight — KPI numbers

## Spacing (8pt grid ONLY)
p-4 gap-4 → mobile (16px)
p-6 gap-6 → desktop (24px)
gap-8 → section gaps (32px)

## Component Rules
Cards: bg-white border border-neutral-200 rounded-xl — NO shadow
Buttons: h-10 desktop, h-11 mobile (44px min)
Dropdowns: shadow-md | Modals: shadow-lg
Icons: Lucide only. No emoji as icons.
No gradients. No animations on data.

## Mobile-First
All layouts: flex-col → md:flex-row → lg:grid
Tables: become card rows on < md breakpoint
Touch targets: minimum h-11 w-11 (44px)
No horizontal scroll at any breakpoint

## What NOT to do
No shadow-xl on cards
No gradients (no bg-gradient-*)
No emoji as icons
No p-1 p-2 p-3 p-5 p-7 (use 8pt grid)
No animations on data tables or form fields
No overflow-x-scroll on page level
```

---

## PHASE 1 — CRITICAL BUG FIXES (Zero Risk, Do First)

### STEP 1 — Remove Duplicate useDebounce Hook

**Action:**
1. Read `frontend/hexabill-ui/src/hooks/useDebounce.js`
2. Read `frontend/hexabill-ui/src/hooks/useDebounce.jsx`  
3. Check which one is imported across the codebase: `grep -r "useDebounce" src/`
4. Keep `useDebounce.js` (the `.js` version)
5. Delete `useDebounce.jsx`
6. If any file imports from `useDebounce.jsx`, update import to `useDebounce.js`

**Do not ask — just do it. Read first, then act.**

---

### STEP 2 — Merge Duplicate Token CSS Files

**Action:**
1. Read `frontend/hexabill-ui/src/styles/tokens.css` fully
2. Read `frontend/hexabill-ui/src/styles/design-tokens.css` fully
3. Identify all variables in both files
4. Merge into a single `tokens.css` with this structure:

```css
/* HexaBill Design Tokens — Single Source of Truth v2.0 */

:root {
  /* === BRAND === */
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-primary-active: #1E40AF;
  --color-primary-light: #EFF6FF;

  /* === SURFACES === */
  --bg-base: #FAFAFA;
  --bg-card: #FFFFFF;
  --bg-elevated: #F1F5F9;
  --bg-sidebar: #F8FAFC;

  /* === TEXT === */
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-tertiary: #94A3B8;
  --text-disabled: #CBD5E1;

  /* === BORDERS === */
  --border: #E2E8F0;
  --border-focus: #2563EB;
  --border-error: #DC2626;

  /* === SEMANTIC === */
  --color-success: #059669;
  --color-success-light: #ECFDF5;
  --color-warning: #D97706;
  --color-warning-light: #FFFBEB;
  --color-error: #DC2626;
  --color-error-light: #FEF2F2;
  --color-info: #2563EB;
  --color-info-light: #EFF6FF;

  /* === INVOICE / PAYMENT STATUS === */
  --status-paid: #059669;
  --status-paid-bg: #ECFDF5;
  --status-partial: #D97706;
  --status-partial-bg: #FFFBEB;
  --status-unpaid: #DC2626;
  --status-unpaid-bg: #FEF2F2;
  --status-draft: #6B7280;
  --status-draft-bg: #F9FAFB;
  --status-credit: #7C3AED;
  --status-credit-bg: #F5F3FF;

  /* === VAT STATUS === */
  --vat-filed: #059669;
  --vat-pending: #D97706;
  --vat-locked: #1E40AF;

  /* === TYPOGRAPHY SCALE === */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-xs: 11px;
  --font-sm: 13px;
  --font-base: 14px;
  --font-md: 15px;
  --font-lg: 18px;
  --font-xl: 22px;
  --font-2xl: 28px;

  /* === SPACING (8pt grid) === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* === LAYOUT === */
  --sidebar-width: 240px;
  --sidebar-collapsed: 64px;
  --topbar-height: 56px;
  --bottom-nav-height: 56px;
  --content-max: 1400px;
  --content-padding: 24px;
  --content-padding-mobile: 16px;

  /* === TOUCH TARGETS === */
  --touch-min: 44px;
  --btn-height: 40px;
  --btn-height-mobile: 44px;
  --input-height: 40px;

  /* === BORDER RADIUS === */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* === SHADOWS === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);

  /* === TRANSITIONS === */
  --transition-fast: 100ms ease;
  --transition-base: 150ms ease;
  --transition-slow: 200ms ease;

  /* === FOCUS === */
  --focus-ring: 0 0 0 3px rgb(37 99 235 / 0.15);
  --focus-ring-error: 0 0 0 3px rgb(220 38 38 / 0.15);
}

/* === DARK MODE === */
[data-theme="dark"] {
  --bg-base: #0F172A;
  --bg-card: #1E293B;
  --bg-elevated: #1E293B;
  --bg-sidebar: #0F172A;
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --text-tertiary: #64748B;
  --border: #334155;
  --border-focus: #60A5FA;
}
```

5. Delete `design-tokens.css`
6. Search for any imports of `design-tokens.css` in the codebase and update them to `tokens.css`

---

### STEP 3 — Fix Tailwind Config Primary Color

**Action:**
1. Read `frontend/hexabill-ui/tailwind.config.js`
2. The current primary is indigo (`#6366f1`). Change to blue to match design tokens:

Replace the primary color block:
```js
primary: {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
},
```

---

### STEP 4 — Resolve Duplicate Dashboard Files

**Action:**
1. Read `frontend/hexabill-ui/src/pages/company/Dashboard.jsx` (first 50 lines)
2. Read `frontend/hexabill-ui/src/pages/company/DashboardTally.jsx` (first 50 lines)
3. Read `frontend/hexabill-ui/src/App.jsx` to see which one is actually routed
4. The file that is referenced in the router is the live one — keep it
5. Delete the unreferenced one
6. If both are referenced, keep `DashboardTally.jsx` (it's the newer Tally-style layout) and update the router to only reference it as the `/dashboard` route

---

### STEP 5 — Fix Console.WriteLine in Backend

**Action:**
1. Run search: find all `Console.WriteLine` in `backend/HexaBill.Api/`
2. For each one found:
   - If it's logging info: replace with `_logger.LogInformation(...)`
   - If it's logging an error: replace with `_logger.LogError(...)`
   - If it's logging a warning: replace with `_logger.LogWarning(...)`
   - Ensure the class has `ILogger<ClassName> _logger` injected
3. Do NOT change the logic, only the logging mechanism
4. Do NOT add new ILogger injections if the class doesn't already have one — in that case just remove the Console.WriteLine line and add a comment `// TODO: inject ILogger`

---

## PHASE 2 — MOBILE UX FIXES

### STEP 6 — Redesign BottomNav

**Action:**
1. Read `frontend/hexabill-ui/src/components/BottomNav.jsx` fully
2. Replace with 5-tab layout:

```jsx
import { Link, useLocation } from 'react-router-dom'
import { Home, ShoppingCart, BookOpen, Users, Menu } from 'lucide-react'

const BottomNav = () => {
  const location = useLocation()

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'POS', href: '/pos', icon: ShoppingCart, primary: true },
    { name: 'Ledger', href: '/ledger', icon: BookOpen },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'More', href: '/more', icon: Menu },
  ]

  const isActive = (href) => location.pathname === href || location.pathname.startsWith(href + '/')

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch h-14 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          const isPrimary = item.primary

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`
                flex-1 flex flex-col items-center justify-center gap-0.5
                min-h-[44px] relative transition-colors duration-150
                ${isPrimary && active ? 'bg-[#2563EB] text-white' : ''}
                ${isPrimary && !active ? 'text-[#2563EB]' : ''}
                ${!isPrimary && active ? 'text-[#2563EB]' : ''}
                ${!isPrimary && !active ? 'text-neutral-500' : ''}
              `}
              aria-current={active ? 'page' : undefined}
              aria-label={item.name}
            >
              <Icon
                className={`flex-shrink-0 ${isPrimary ? 'w-6 h-6' : 'w-5 h-5'}`}
                aria-hidden
                strokeWidth={isPrimary && active ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium ${active && !isPrimary ? 'font-semibold' : ''}`}>
                {item.name}
              </span>
              {active && !isPrimary && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#2563EB] rounded-full" aria-hidden />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
```

3. After writing this, check `App.jsx` for the `/more` route. If it doesn't exist, add it (Step 7 will create the page).

---

### STEP 7 — Create MorePage (Mobile Navigation Hub)

**Action:**
1. Check if `frontend/hexabill-ui/src/pages/company/MorePage.jsx` exists
2. If not, CREATE it:

```jsx
import { Link } from 'react-router-dom'
import {
  DollarSign, Package, Truck, BarChart3, Settings,
  Users, Receipt, ChevronRight, LogOut
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const MoreItem = ({ icon: Icon, label, href, danger }) => (
  <Link
    to={href}
    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors duration-150
      ${danger
        ? 'text-red-600 hover:bg-red-50 active:bg-red-100'
        : 'text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100'
      }`}
  >
    <span className={`w-9 h-9 flex items-center justify-center rounded-lg
      ${danger ? 'bg-red-50' : 'bg-neutral-100'}`}>
      <Icon className={`w-5 h-5 ${danger ? 'text-red-500' : 'text-neutral-600'}`} />
    </span>
    <span className="flex-1 text-[14px] font-medium">{label}</span>
    <ChevronRight className="w-4 h-4 text-neutral-400" aria-hidden />
  </Link>
)

const MorePage = () => {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-20">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-[22px] font-bold text-neutral-900">More</h1>
      </div>

      <div className="px-4 mt-4 space-y-1">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1 mb-2">Operations</p>
        <MoreItem icon={DollarSign} label="Expenses" href="/expenses" />
        <MoreItem icon={Package} label="Products" href="/products" />
        <MoreItem icon={Truck} label="Purchases" href="/purchases" />
        <MoreItem icon={Receipt} label="Recurring Invoices" href="/recurring-invoices" />
      </div>

      <div className="px-4 mt-6 space-y-1">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1 mb-2">Business</p>
        <MoreItem icon={BarChart3} label="Reports" href="/reports" />
        <MoreItem icon={Users} label="Suppliers" href="/suppliers" />
      </div>

      <div className="px-4 mt-6 space-y-1">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1 mb-2">Account</p>
        <MoreItem icon={Settings} label="Settings" href="/settings" />
      </div>

      <div className="px-4 mt-6">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3.5 w-full rounded-xl text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors duration-150"
        >
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50">
            <LogOut className="w-5 h-5 text-red-500" />
          </span>
          <span className="text-[14px] font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default MorePage
```

3. Add route in `App.jsx`:
```jsx
<Route path="/more" element={<MorePage />} />
```
Read App.jsx first to find the correct location for this route (inside the PrivateRoute wrapper).

---

### STEP 8 — Fix POS Touch Targets

**Action:**
1. Read `frontend/hexabill-ui/src/pages/company/PosPage.jsx`
2. Find all quantity increment/decrement buttons (+ and - for cart items)
3. Ensure they have minimum `w-11 h-11` (44px) classes
4. Find the main "Save Invoice" / "Post Invoice" / "Complete" button
5. Ensure it has `h-12` or `h-14` on mobile (prominent CTA)
6. Find the item search input — ensure it has `h-11` on mobile
7. Do NOT change any business logic, only sizing classes

---

### STEP 9 — Add Sticky Total Bar in POS

**Action:**
1. Read `frontend/hexabill-ui/src/pages/company/PosPage.jsx` — find where totals are displayed
2. On mobile (< lg), the total summary should be in a sticky bar above the BottomNav
3. Add this sticky bar component inside PosPage (only show on mobile, `className="lg:hidden"`):

```jsx
{/* Sticky Total Bar — mobile only */}
<div className="fixed bottom-14 left-0 right-0 z-40 lg:hidden bg-white border-t border-neutral-200 px-4 py-3">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-[11px] text-neutral-500">
        {cartItems.length} items · VAT {formatCurrency(totalVat)}
      </p>
      <p className="text-[13px] text-neutral-600">
        Net {formatCurrency(subtotal)}
      </p>
    </div>
    <div className="text-right">
      <p className="text-[11px] text-neutral-500 uppercase tracking-wide">Total</p>
      <p className="text-[22px] font-bold text-neutral-900 tracking-tight">
        {formatCurrency(grandTotal)}
      </p>
    </div>
  </div>
</div>
```

Replace `cartItems`, `totalVat`, `subtotal`, `grandTotal` with the actual variable names found in PosPage.jsx.  
Do NOT invent variable names — read the file first.

---

### STEP 10 — Add Mobile Card View to Sales Ledger

**Action:**
1. Read `frontend/hexabill-ui/src/pages/company/SalesLedgerPage.jsx`
2. Find where the table/list of sales is rendered
3. Add a mobile card view wrapper (show on < md, hide table on < md):

```jsx
{/* Mobile card view */}
<div className="block md:hidden space-y-2 px-4 py-2">
  {rows.map((entry, idx) => {
    const key = ledgerRowKey(entry, idx) // use existing key function
    const isPayment = normalizeLedgerRowType(entry.type) === 'Payment'
    const isReturn = normalizeLedgerRowType(entry.type) === 'Return'
    return (
      <div
        key={key}
        className="bg-white border border-neutral-200 rounded-xl p-4 active:bg-neutral-50"
        onClick={() => isPayment ? null : navigate(`/pos?edit=${entry.saleId}`)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-neutral-900 truncate">
              {entry.customerName || 'Walk-in'}
            </p>
            <p className="text-[12px] text-neutral-500 mt-0.5">
              {entry.invoiceNumber || (isPayment ? 'Payment' : isReturn ? 'Return' : '')}
              {entry.date ? ` · ${entry.date}` : ''}
            </p>
          </div>
          {entry.paymentStatus && (
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md border
              ${entry.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
              ${entry.paymentStatus === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
              ${entry.paymentStatus === 'Unpaid' ? 'bg-red-50 text-red-700 border-red-200' : ''}
            `}>
              {entry.paymentStatus}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[12px] text-neutral-500">
            {isPayment ? 'Payment received' : isReturn ? 'Return' : `${entry.itemCount || ''} items`}
          </p>
          <p className={`text-[15px] font-semibold
            ${isPayment ? 'text-emerald-600' : isReturn ? 'text-red-600' : 'text-neutral-900'}
          `}>
            {isPayment || isReturn ? '' : ''}{formatCurrency(Math.abs(entry.total || entry.amount || 0))}
          </p>
        </div>
      </div>
    )
  })}
</div>

{/* Desktop table — existing table, hide on mobile */}
<div className="hidden md:block">
  {/* existing table code here — do not change it */}
</div>
```

Replace `rows`, `entry.total`, `entry.amount`, `entry.itemCount`, `entry.date`, `entry.customerName`, `entry.invoiceNumber`, `entry.paymentStatus` with the actual field names found in the existing component.  
READ the file, find the real field names, use them.

---

## PHASE 3 — DASHBOARD KPI IMPROVEMENTS

### STEP 11 — Improve Dashboard KPI Cards

**Action:**
1. Read `frontend/hexabill-ui/src/pages/company/Dashboard.jsx` (or DashboardTally.jsx — whichever is live)
2. Find the existing StatCard grid (KPI cards at the top)
3. The current KPIs are likely: Sales Today, Purchases Today, Expenses Today, Profit Today
4. Add two new KPI slots to the grid if they don't exist:
   - "Overdue" — customers with unpaid/partial invoices (use `pendingBillsAmount` from existing state if available)
   - "Low Stock" — count from `lowStockProducts` array which already exists in state

5. The grid should be `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` to fit 5 cards

6. For the overdue card, use existing `pendingBillsAmount` and `pendingBillsCount` state variables (they already exist based on the Dashboard code we read).

7. For low stock, use `lowStockProducts.length` which already exists.

8. Do NOT add new API calls — use existing state variables already fetched.

---

### STEP 12 — Add Cash vs Credit Split to Dashboard

**Action:**
1. Still in the Dashboard file
2. Find where `salesToday` is fetched from the API
3. Check if the API response includes `cashPaid` or `paidAmount` or similar breakdown
4. If the data exists: add a visual split under the sales KPI card (or as a second card)
5. If the data does NOT exist in the current API response: add a TODO comment only — do not modify backend in this step

```jsx
{/* Cash vs Credit visual split — only render if data available */}
{summary.cashSalesToday !== undefined && (
  <div className="mt-2 flex gap-2">
    <div className="flex-1 bg-emerald-50 rounded-lg px-2 py-1 text-center">
      <p className="text-[10px] text-emerald-600 font-medium">Cash</p>
      <p className="text-[12px] font-semibold text-emerald-700">{formatCurrency(summary.cashSalesToday)}</p>
    </div>
    <div className="flex-1 bg-amber-50 rounded-lg px-2 py-1 text-center">
      <p className="text-[10px] text-amber-600 font-medium">Credit</p>
      <p className="text-[12px] font-semibold text-amber-700">{formatCurrency(summary.creditSalesToday)}</p>
    </div>
  </div>
)}
```

---

## PHASE 4 — REACT PERFORMANCE FIXES

### STEP 13 — Wrap UI Components in React.memo

**Action:**
1. Read `frontend/hexabill-ui/src/components/ui/StatCard.jsx`
2. If not already wrapped in `React.memo`, wrap it:
```jsx
const StatCard = React.memo(({ ... }) => { ... })
export default StatCard
```

3. Read `frontend/hexabill-ui/src/components/ui/Badge.jsx` — same treatment
4. Read `frontend/hexabill-ui/src/components/ui/Button.jsx` — same treatment
5. For each: add `import React from 'react'` at top if not already imported (needed for React.memo)

---

### STEP 14 — Verify Debounce on All Search Inputs

**Action:**
1. Search across all page files: `grep -r "onChange.*search\|setSearch\|handleSearch" src/pages/`
2. For each search input found: check if it uses `useDebounce`
3. If a search input does NOT use debounce, add it:
```jsx
import useDebounce from '../../hooks/useDebounce'

const [searchRaw, setSearchRaw] = useState('')
const search = useDebounce(searchRaw, 300)

// Use `search` (debounced) for API calls, `searchRaw` for input value
<input value={searchRaw} onChange={e => setSearchRaw(e.target.value)} />
```
4. Only fix the ones missing debounce. If debounce is already there, move to next.

---

## PHASE 5 — SECURITY FIXES

### STEP 15 — Gate SeedController for Production

**Action:**
1. Read `backend/HexaBill.Api/Modules/Seed/SeedController.cs`
2. Find the seed action(s)
3. Add production environment check at the top of each action:
```csharp
private readonly IWebHostEnvironment _env;

// In constructor:
public SeedController(IWebHostEnvironment env, ...) { _env = env; }

// In each action:
if (!_env.IsDevelopment())
    return Forbid();
```
4. If `IWebHostEnvironment` is already injected, just add the guard check at the top of each seed action method.

---

### STEP 16 — Add SQL Console Audit Logging

**Action:**
1. Read `backend/HexaBill.Api/Modules/SuperAdmin/SqlConsoleController.cs`
2. Find the execute action
3. Add these guards if not already present:

```csharp
// 1. Log every query
_logger.LogWarning(
    "SQL Console executed by AdminId={AdminId} IP={IP} QueryPreview={Preview}",
    User.GetUserId(),
    Request.Headers["X-Forwarded-For"].FirstOrDefault() ?? "unknown",
    query.Substring(0, Math.Min(200, query.Length))
);

// 2. Block mutations in production
if (!_env.IsDevelopment()) {
    var upper = query.Trim().ToUpperInvariant();
    if (upper.StartsWith("INSERT") || upper.StartsWith("UPDATE") ||
        upper.StartsWith("DELETE") || upper.StartsWith("DROP") ||
        upper.StartsWith("ALTER") || upper.StartsWith("TRUNCATE")) {
        return BadRequest(new { message = "Write operations not allowed via SQL Console in production. Use migrations." });
    }
}
```

---

## PHASE 6 — MISSING FEATURE: WHATSAPP INVOICE SHARE

### STEP 17 — Wire WhatsApp Invoice Share Button

**Action:**
1. Read `frontend/hexabill-ui/src/utils/whatsapp.js` to understand the existing utility
2. Read `frontend/hexabill-ui/src/pages/company/PosPage.jsx` — find the post-invoice success state/modal
3. After a sale is successfully created and the success state is shown, add a WhatsApp share button:

```jsx
import { getWhatsAppShareUrl } from '../../utils/whatsapp'
import { MessageCircle } from 'lucide-react'

// After invoice created (in success state, near Print/Download buttons):
{lastCreatedSale && lastCreatedSale.customer?.phone && (
  <a
    href={getWhatsAppShareUrl(
      lastCreatedSale.invoiceNumber,
      lastCreatedSale.customer.phone,
      lastCreatedSale.total
    )}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 h-11 px-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl text-[14px] font-medium transition-colors duration-150"
  >
    <MessageCircle className="w-5 h-5" />
    Share on WhatsApp
  </a>
)}
```

4. If `getWhatsAppShareUrl` doesn't accept the right parameters, read the function signature and adapt.
5. Use real variable names from PosPage — the sale object, phone field, total field.

---

## PHASE 7 — TABLET LAYOUT

### STEP 18 — Tablet Split View for POS

**Action:**
1. Read `frontend/hexabill-ui/src/pages/company/PosPage.jsx` — understand overall layout structure
2. Find the main content area
3. On tablet (md to lg breakpoint), wrap in a 2-column layout:
   - Left column (60%): product search + line items list
   - Right column (40%): customer selector + totals + payment button

```jsx
{/* Tablet: side-by-side layout */}
<div className="hidden md:flex lg:flex h-[calc(100vh-56px)] overflow-hidden">
  {/* Left: items */}
  <div className="flex-[3] overflow-y-auto border-r border-neutral-200 p-4">
    {/* product search and line items — move existing JSX here */}
  </div>
  {/* Right: payment */}
  <div className="flex-[2] overflow-y-auto p-4 bg-[#FAFAFA]">
    {/* customer, totals, payment — move existing JSX here */}
  </div>
</div>
{/* Mobile: stacked (existing layout) */}
<div className="block md:hidden">
  {/* existing mobile layout */}
</div>
```

Do NOT restructure the state or business logic. Only restructure the JSX layout.  
READ the file first. Understand the current structure. Then apply layout changes only.

---

## PHASE 8 — DOCUMENTATION UPDATE

### STEP 19 — Update docs/README with Cursor Rules Usage

**Action:**
1. Check if `docs/` directory has an index or README
2. Create or update `docs/CURSOR_SETUP.md`:

```markdown
# Cursor Pro Setup — HexaBill

## Rules Files Location
Place these in `.cursor/rules/`:
- `hexabill-production.mdc` — always active, covers all backend + frontend
- `hexabill-ui-skill.mdc` — activates on frontend file edits

## How to Use the Mega Prompt
1. Open Cursor Chat (Cmd+L or Ctrl+L)
2. Copy entire content of `HEXABILL_CURSOR_MEGA_PROMPT.md`
3. Paste into chat
4. Add your specific task at the bottom
5. Press Enter
6. Do NOT interrupt — let Cursor execute fully

## Key Reference Files
- `HEXABILL_MASTER_UPGRADE_PLAN.md` — full audit and fix list
- `HEXABILL_FEATURES_AND_FIXES.md` — feature priority list
- `HEXABILL_CURSOR_RULES.md` — all rules with code examples

## Execution Order (this sprint)
Phase 0: Setup cursor rules
Phase 1: Critical bugs (Steps 1-5)
Phase 2: Mobile UX (Steps 6-10)
Phase 3: Dashboard (Steps 11-12)
Phase 4: Performance (Steps 13-14)
Phase 5: Security (Steps 15-16)
Phase 6: WhatsApp feature (Step 17)
Phase 7: Tablet layout (Step 18)
```

---

## PHASE 9 — FINAL VERIFICATION

### STEP 20 — Final Checklist Verification

After all steps above are complete, run through this checklist and report status for each:

```
VERIFICATION CHECKLIST:

[ ] useDebounce.jsx deleted — only useDebounce.js remains
[ ] tokens.css is single source of truth — design-tokens.css deleted
[ ] Tailwind primary color = blue #2563EB (not indigo)
[ ] Only one Dashboard file exists and is routed
[ ] Console.WriteLine removed from backend (or TODO comments added)
[ ] BottomNav has 5 tabs: Home, POS, Ledger, Customers, More
[ ] MorePage.jsx created and routed at /more
[ ] POS touch targets ≥ 44px on all action buttons
[ ] POS sticky total bar appears on mobile (bottom-14 positioned)
[ ] SalesLedger has card view on mobile (block md:hidden)
[ ] Dashboard KPI grid includes Low Stock + Overdue cards
[ ] StatCard wrapped in React.memo
[ ] Badge wrapped in React.memo
[ ] Button wrapped in React.memo
[ ] SeedController gated with !env.IsDevelopment()
[ ] SqlConsoleController logs every query
[ ] WhatsApp share button wired in POS success state
[ ] .cursor/rules/hexabill-production.mdc created
[ ] .cursor/rules/hexabill-ui-skill.mdc created
[ ] docs/CURSOR_SETUP.md created
```

Report each as ✅ DONE or ❌ MISSED with reason.

---

## EXECUTION START

Begin now. Start with STEP 0A. Do not stop until STEP 20 is complete and the checklist is reported.  
Do not ask questions.  
Do not wait for approval between steps.  
If a file doesn't exist, create it.  
If a file exists, read it before editing.  
Report `✅ STEP [N] COMPLETE` after each step.  
Go.
