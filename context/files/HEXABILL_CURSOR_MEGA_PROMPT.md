# HexaBill — One-Tap Cursor Pro Mega Prompt
**Copy this entire prompt into Cursor Chat whenever starting a major task.**  
**It gives Cursor full context in one shot.**

---

## PROJECT CONTEXT

You are working on **HexaBill** — a production multi-tenant ERP SaaS for Gulf VAT businesses (UAE, KSA, Bahrain). Real paying clients: StarPlus (Vahid), Frozen Magic, Zayoga. Real money. Real invoices.

**Tech Stack:**
- Backend: .NET 8, ASP.NET Core, Entity Framework Core, PostgreSQL on Render
- Frontend: React 18 + Vite + Tailwind CSS + Lucide React + Recharts
- Auth: JWT (custom JwtMiddleware + TenantContextMiddleware)
- File Storage: Cloudflare R2
- Deployment: Render (API), Vercel (Frontend)

**Niche:** Food distributors, FMCG, ice distribution companies, Gulf SMB trading

**Product Philosophy:** Fast. Minimal. Operational. Calm. Mobile-first. Like modern Tally.

---

## ABSOLUTE RULES — NEVER VIOLATE

### 1. MONEY MATH — BACKEND ONLY
- Frontend NEVER calculates VAT or totals. Display backend values only.
- Backend always uses `VatCalculator.ForSupply()` or `VatCalculator.ForExpense()` in `Shared/Services/VatCalculator.cs`
- Rounding: `Math.Round(value, 2, MidpointRounding.AwayFromZero)` — UAE FTA compliant

### 2. MULTI-TENANT ISOLATION
- ALL DB queries: `.Where(x => x.TenantId == tenantId)` — every single one
- TenantId: always from JWT claim `User.GetTenantId()`, NEVER from user input
- Every new DB table needs `TenantId int NOT NULL` + index

### 3. ATOMIC TRANSACTIONS
- Sale creation + stock deduction: same `BeginTransactionAsync()`
- Payment + balance update: same transaction
- Return + stock restoration: same transaction
- Pattern:
```csharp
using var tx = await _context.Database.BeginTransactionAsync();
try { /* all */ await tx.CommitAsync(); }
catch { await tx.RollbackAsync(); throw; }
```

### 4. NO CONSOLE.WRITELINE
Use `_logger.LogInformation/Warning/Error`. Never `Console.WriteLine` in backend.

### 5. MIGRATIONS — ADDITIVE ONLY
Add columns, add tables. NEVER drop or rename without explicit deprecation plan.

---

## DESIGN SYSTEM — FRONTEND

**Colors (locked):**
```
Primary CTA: #2563EB (blue-600)
Primary hover: #1D4ED8 (blue-700)
Primary light: #EFF6FF (blue-50)
Background: #FAFAFA
Card surface: #FFFFFF
Border: #E2E8F0
Text primary: #0F172A
Text secondary: #475569
Text tertiary: #94A3B8
Success: #059669
Warning: #D97706
Error: #DC2626
```

**Tailwind `primary` scale is aligned to `#2563EB` (blue-600). Prefer semantic tokens from [`frontend/hexabill-ui/src/styles/tokens.css`](frontend/hexabill-ui/src/styles/tokens.css) for custom CSS; use Tailwind `primary-*` only where utilities match that scale.**

**Typography (Inter, single font):**
```
11px → badge text, table labels
13px → table rows, helper text
14px → default body, inputs (base)
15px → form labels, card titles
18px → section headers
22px → page titles
28px + font-bold + tracking-tight → KPI numbers
```

**Spacing (8pt grid):**
```
p-4 gap-4 → mobile default (16px)
p-6 gap-6 → desktop default (24px)
gap-8 → major section gaps (32px)
```

**Component rules:**
- Cards: `bg-white border border-neutral-200 rounded-xl` — NO shadow on cards
- Buttons: `h-10` desktop, `h-11` (44px min) mobile
- Dropdowns: `shadow-md`. Modals: `shadow-lg`
- Icons: Lucide only. No emoji as icons.
- No gradients. No animations on data.

---

## NAVIGATION (MOBILE)

BottomNav — 5 tabs:
```
Home → /dashboard
POS → /pos (primary center tab, larger)
Ledger → /ledger  
Customers → /customers
More → /more (links to Expenses, Products, Purchases, Reports, Settings)
```

---

## MOBILE-FIRST RULES

- All layouts: `flex-col` → `md:flex-row` → `lg:grid`
- Tables: become card rows on `< md` breakpoint
- Touch targets: minimum `h-11 w-11` (44px)
- No horizontal scroll at any breakpoint
- POS: sticky total bar above BottomNav on mobile

---

## KNOWN TECH DEBT (don't introduce more)

**Resolved in repo (keep clean):** single `useDebounce.js`; single `tokens.css` (no `design-tokens.css`); dashboard route uses `DashboardTally.jsx` only; Tailwind primary aligned to blue `#2563EB`; backend runtime uses `ILogger` (verify with `rg Console.WriteLine` before adding new console output).

**Still watch:**

1. **BalanceService / concurrent recalcs** — `RecalculateCustomerBalanceAsync` skips starting a nested transaction when the caller already holds one; high concurrency across requests can still race; consider per-tenant advisory locks if mismatches appear in production.
2. **JWT refresh** — long-lived access tokens; treat refresh-token rotation as a separate security initiative (see `docs/JWT_REFRESH_SPIKE.md`).

---

## SECURITY RULES

- SuperAdmin SQL Console: SELECT only in prod, log every query
- SeedController: gated by `!env.IsProduction()`
- File uploads: validate magic bytes (not just extension)
- Every SuperAdmin mutation: audit log entry

---

## STATE PATTERN — ALL ASYNC COMPONENTS

```jsx
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)

// Must handle all 4 states:
if (loading) return <LoadingSkeleton />
if (error) return <ErrorState message={error} onRetry={fn} />
if (!data.length) return <EmptyState ... />
return <DataView data={data} />
```

---

## PERFORMANCE RULES

- `React.memo` on StatCard, Badge, Button, ModernTable, table rows
- `useCallback` on all handlers passed as props
- `useMemo` for filtered/sorted lists
- Debounce: 300ms on all search inputs via `useDebounce.js`
- Lists > 50 items: virtualize

---

## API RESPONSE FORMAT

```json
// Lists
{ "data": [], "total": 100, "page": 1, "pageSize": 20 }

// Single record
{ "data": { "id": 1, ... } }

// Error
{ "message": "Human readable error", "code": "VALIDATION_ERROR" }
```

---

## TASK EXECUTION PATTERN

When I give you a task:
1. Read the relevant existing files first (don't assume structure)
2. Identify what currently exists vs what needs to change
3. Make minimal changes (don't rewrite working code)
4. Check: tenant isolation? transaction safety? mobile responsive? all async states?
5. If a migration is needed, create the migration file
6. If frontend is changed, verify mobile + desktop + tablet views

---

## WHAT NOT TO TOUCH

- `VatCalculator.cs` — correct per UAE FTA
- Multi-tenant middleware chain in `Program.cs`
- Existing migration files (additive only)
- JWT auth middleware logic
- Existing VAT return engine

---

Now proceed with the task:

[PASTE YOUR SPECIFIC TASK HERE]
