---
description: HexaBill master rules — always apply when editing any file in this project
globs: "**/*"
alwaysApply: true
---

# HexaBill — Cursor Pro Master Rules
**Version: 2.0 · May 2026 · Production SaaS ERP**

---

## 0. ROLE CONTEXT

You are a senior engineer working on HexaBill — a multi-tenant ERP SaaS for Gulf VAT businesses (food distributors, FMCG, ice distribution). Real clients with real money. Every change must be safe, backward-compatible, and production-ready.

Stack:
- Backend: .NET 8, ASP.NET Core, Entity Framework Core, PostgreSQL (Render)
- Frontend: React + Vite + Tailwind CSS + Lucide + Recharts
- Auth: JWT (custom middleware)
- Storage: Cloudflare R2
- Deployment: Render (backend), Vercel (frontend)

---

## 1. NON-NEGOTIABLE RULES — ALWAYS

### 1.1 Multi-Tenant Isolation
Every DB query MUST include `.Where(x => x.TenantId == tenantId)`.  
NEVER write a query that returns all tenant data.  
NEVER trust user-supplied tenantId; always extract from authenticated JWT claim.
```csharp
// ALWAYS
var tenantId = User.GetTenantId(); // from JWT claim
var records = await _context.Sales.Where(s => s.TenantId == tenantId).ToListAsync();

// NEVER
var records = await _context.Sales.ToListAsync();
```

### 1.2 Destructive Operations Need DB Transactions
Sale creation, payment, returns, stock adjustments MUST be atomic.
```csharp
using var tx = await _context.Database.BeginTransactionAsync();
try {
    // all changes
    await tx.CommitAsync();
} catch {
    await tx.RollbackAsync();
    throw;
}
```

### 1.3 No Console.WriteLine in Backend
Use `ILogger<T>`. No sensitive data in logs.
```csharp
// NEVER
Console.WriteLine($"Sale created: {saleId}");

// ALWAYS
_logger.LogInformation("Sale {SaleId} created for Tenant {TenantId}", saleId, tenantId);
```

### 1.4 Frontend — No Float Math for Money
Never calculate VAT, totals, or financial values in frontend JavaScript.  
Always receive final calculated values from backend. Display only.
```js
// NEVER
const vat = qty * price * 0.05;
const total = qty * price + vat;

// ALWAYS — use backend-calculated values
const { vatAmount, totalAmount, netAmount } = item;
```

### 1.5 All API Endpoints Need Auth + Tenant Check
```csharp
[Authorize]
[HttpGet]
public async Task<IActionResult> GetSales() {
    var tenantId = User.GetTenantId();
    if (tenantId <= 0) return Unauthorized();
    // ...
}
```

---

## 2. FRONTEND RULES — UI SYSTEM

### 2.1 Design System Tokens (use CSS variables)
```css
/* Primary actions only */
--color-primary: #2563EB;      /* Blue-600 */
--color-primary-dark: #1D4ED8; /* hover */
--color-primary-light: #EFF6FF;/* active bg */

/* Surfaces */
--bg-base: #FAFAFA;
--bg-card: #FFFFFF;
--border: #E2E8F0;

/* Text hierarchy */
--text-primary: #0F172A;
--text-secondary: #475569;
--text-tertiary: #94A3B8;

/* Status colors */
--status-paid: #059669;
--status-partial: #D97706;
--status-unpaid: #DC2626;
```

### 2.2 Tailwind Class Rules
- Cards: `bg-white border border-neutral-200 rounded-xl` — no shadow unless dropdown/modal
- Buttons primary: `bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2.5`
- No gradients in operational UI
- No `shadow-xl` or larger on cards
- Dropdowns/modals: `shadow-lg` only

### 2.3 Typography Scale
```
text-[11px] — table labels, badges
text-[13px] — table rows, helper text  
text-[14px] — default body, inputs (var(--font-base))
text-[15px] — form labels
text-[18px] — section headers
text-[22px] — page titles
text-[28px] — KPI dashboard numbers
```

### 2.4 Spacing — 8pt Grid Only
Mobile: `p-4 gap-4` (16px)  
Desktop: `p-6 gap-6` (24px)  
Section gaps: `gap-8` (32px)  
No random `p-1`, `p-2`, `p-3`, `p-5`, `p-7` unless inside components.

### 2.5 Mobile-First — Required Breakpoints
Every component must be built mobile-first with explicit responsive overrides:
```jsx
// Pattern for responsive layout
<div className="
  flex flex-col gap-4
  md:flex-row md:gap-6
  lg:grid lg:grid-cols-3
">
```
- No horizontal scroll on any screen size
- Tables must become cards on mobile (< 768px)
- Touch targets minimum 44px height on mobile

### 2.6 Icons — Lucide Only
```jsx
import { Package, TrendingUp, DollarSign } from 'lucide-react'
// NEVER use emoji as icons
// NEVER mix icon libraries
```

### 2.7 Loading/Empty/Error States — Always
Every async component needs all three states:
```jsx
if (loading) return <LoadingSkeleton />
if (error) return <ErrorState message={error} onRetry={fetch} />
if (!data.length) return <EmptyState title="No records" subtitle="Add your first..." />
return <DataView data={data} />
```

### 2.8 React Performance
- Wrap pure display components in `React.memo`
- Use `useCallback` for handler functions passed as props
- Use `useMemo` for derived data (filtered/sorted lists)
- Debounce search inputs at 300ms using `useDebounce.js`
- Lists > 50 items need virtualization

---

## 3. MOBILE UX RULES

### 3.1 BottomNav — 5 Tabs
```jsx
const navItems = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'POS', href: '/pos', icon: ShoppingCart, primary: true },
  { name: 'Ledger', href: '/ledger', icon: BookOpen },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'More', href: '/more', icon: Menu },
]
// Tab height: 56px minimum (h-14)
// Icon: w-5 h-5 regular, w-6 h-6 for primary center
// Label: text-[10px] or text-xs
```

### 3.2 POS Sticky Total Bar
When on POS page on mobile, render sticky bar above BottomNav:
```jsx
<div className="fixed bottom-14 left-0 right-0 z-40 bg-white border-t border-neutral-200 px-4 py-3">
  {/* subtotal · vat · total */}
</div>
```

### 3.3 Sales Ledger — Mobile Card View
```jsx
// < 768px: card rows instead of table
<div className="block md:hidden space-y-2 px-4">
  {rows.map(row => (
    <MobileLedgerCard key={row.id} row={row} />
  ))}
</div>
<div className="hidden md:block">
  <ModernTable ... />
</div>
```

### 3.4 Quantity Buttons in POS
```jsx
// Minimum 44px touch targets
<button className="w-11 h-11 flex items-center justify-center border border-neutral-200 rounded-lg active:bg-neutral-100">
  <Minus className="w-4 h-4" />
</button>
```

---

## 4. BACKEND API RULES

### 4.1 Controller Pattern
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SalesController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSales(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var tenantId = User.GetTenantId();
        if (tenantId <= 0) return Unauthorized();
        
        try {
            var result = await _saleService.GetSalesAsync(tenantId, page, pageSize, search);
            return Ok(result);
        } catch (Exception ex) {
            _logger.LogError(ex, "GetSales failed for tenant {TenantId}", tenantId);
            return StatusCode(500, new { message = "Failed to retrieve sales" });
        }
    }
}
```

### 4.2 API Response Format — Consistent
```json
// Success list
{ "data": [], "total": 0, "page": 1, "pageSize": 20 }

// Success single
{ "data": {...} }

// Error
{ "message": "Human-readable error", "code": "VALIDATION_ERROR" }
```

### 4.3 Pagination — Required on List Endpoints
Page size default: 20. Max: 100. Never return unbounded lists.

### 4.4 VAT Calculation — Always Use VatCalculator
```csharp
// ALWAYS use the static VatCalculator
var result = VatCalculator.ForSupply(netAmount, vatScenario);
var vatAmount = result.VatAmount;
var totalAmount = result.TotalAmount;

// NEVER do inline math
var vat = netAmount * 0.05m; // DON'T DO THIS
```

---

## 5. DATABASE RULES

### 5.1 Migrations — Additive Only
```csharp
// OK: add column with default
migrationBuilder.AddColumn<string>("NewField", "Sales", nullable: true);

// NEVER: drop or rename in production
migrationBuilder.DropColumn("OldField", "Sales"); // NEVER without deprecation
```

### 5.2 Every New Table Needs TenantId
```csharp
public class NewEntity
{
    public int Id { get; set; }
    public int TenantId { get; set; }  // REQUIRED
    // ... other fields
}
```

### 5.3 Soft Delete Pattern
```csharp
// Prefer soft delete
public bool IsDeleted { get; set; } = false;
public DateTime? DeletedAt { get; set; }

// Always filter soft-deleted records
.Where(x => !x.IsDeleted)
```

### 5.4 Indexes on TenantId + Common Filters
Every new table: add composite index on `(TenantId, CreatedAt)` at minimum.
```csharp
modelBuilder.Entity<NewEntity>()
    .HasIndex(e => new { e.TenantId, e.CreatedAt });
```

---

## 6. SECURITY RULES

### 6.1 Super Admin — Audit Everything
Any SuperAdmin action must create an audit log entry:
```csharp
await _auditService.LogAsync(new AuditEntry {
    TenantId = targetTenantId,
    UserId = adminUserId,
    Action = "TENANT_RESET",
    Details = JsonSerializer.Serialize(new { reason, timestamp }),
    IpAddress = Request.Headers["X-Forwarded-For"].FirstOrDefault()
});
```

### 6.2 File Uploads — Validate Content
```csharp
// Check magic bytes, not just extension
var allowedSignatures = new Dictionary<string, byte[]> {
    { ".jpg", new byte[] { 0xFF, 0xD8, 0xFF } },
    { ".png", new byte[] { 0x89, 0x50, 0x4E, 0x47 } },
    { ".pdf", new byte[] { 0x25, 0x50, 0x44, 0x46 } }
};
```

### 6.3 SQL Console — Production Guard
```csharp
// SqlConsoleController.cs
if (!_env.IsDevelopment() && !User.IsInRole("SystemAdmin"))
    return Forbid();

// Also: log every query
_logger.LogWarning("SQL Console used by {UserId}: {Query}", userId, query.Substring(0, Math.Min(200, query.Length)));
```

---

## 7. ERROR PREVENTION CHECKLIST

Before submitting any code change:

**Backend:**
- [ ] TenantId isolation on all queries
- [ ] Destructive operations wrapped in DB transaction
- [ ] Try/catch with ILogger error logging
- [ ] No Console.WriteLine
- [ ] New tables have TenantId + index
- [ ] Migration is additive (no drops without plan)
- [ ] VAT calculations use VatCalculator static class

**Frontend:**
- [ ] Mobile-first responsive layout (no horizontal scroll)
- [ ] Loading, empty, and error states all handled
- [ ] No float math for financial values
- [ ] Touch targets ≥ 44px on mobile
- [ ] Using only Lucide icons
- [ ] Using only tokens.css design variables
- [ ] `React.memo` on pure display components
- [ ] Search inputs debounced at 300ms

---

## 8. NAMING CONVENTIONS

**Files:**
- Pages: `PascalCase` + `Page.jsx` suffix (e.g. `SalesLedgerPage.jsx`)
- Components: `PascalCase.jsx` (e.g. `StatCard.jsx`)
- Hooks: `camelCase` + `use` prefix (e.g. `useDebounce.js`)
- Services: `camelCase` + `API` suffix in frontend (e.g. `salesAPI`)
- Backend controllers: `PascalCase` + `Controller.cs`

**CSS/Classes:**
- BEM not required; Tailwind utility classes only
- Custom CSS only for design token variables in `tokens.css`
- No inline `style` attributes except for dynamic values

---

## 9. QUICK REFERENCE — COMMON PATTERNS

### Add a new list page:
1. Create `src/pages/company/NewPage.jsx`
2. Pattern: fetch on mount → loading state → empty state → table/cards
3. Add route in `App.jsx` under `PrivateRoute`
4. Add to sidebar nav and MorePage if needed

### Add a new API endpoint:
1. Add method to service interface + implementation
2. Add controller action with `[Authorize]` + tenant check
3. Add to frontend `src/services/api.js` under appropriate API object

### Add a new DB table:
1. Create model in `Models/` with `TenantId` property
2. Add `DbSet<T>` to `AppDbContext.cs`
3. Add `HasIndex` in `OnModelCreating`
4. Create migration: `dotnet ef migrations add AddNewTable`
5. Test migration on local, then staging

---

## 10. THIS IS A MONEY SYSTEM

Every line of code in this project handles invoices, VAT, inventory, and payments for real Gulf businesses.  
Think before you change.  
Test before you push.  
Verify tenant isolation before deploying.
