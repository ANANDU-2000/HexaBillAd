# HexaBill – Issues & Fixes Task List

## Done in this pass

### 1. Branch report calculations
- **Issue:** Branch tab showed Expenses 0.00 and profit looked wrong (Sales − Expenses ≠ Profit).
- **Fix:** Branch profit is **Sales − COGS − Expenses**. COGS (cost of goods sold) was missing from the UI. **COGS column added** to the Branch comparison table and to route sub-rows so the formula is clear. Backend was already correct.

### 2. Customer Ledger – Branch & Route filters
- **Issue:** No branch/route filters visible before selecting a customer.
- **Fix:** **Branch and Route filter dropdowns** added above the customer search bar so you can filter the customer list by branch/route before selecting a customer. The existing Date/Branch/Route/Staff filters still apply after a customer is selected.

### 3. Company logo not updating on dashboard/header
- **Issue:** Owner uploads company logo but header still showed “Z” or default.
- **Fix:** Branding context now reads `companyLogo` from API (camelCase). Logo component has **onError** fallback and resets when `companyLogo` changes. Settings page already calls **refreshBranding()** after save.

### 4. Staff can add expenses
- **Issue:** Staff could not add expenses in their route/branch.
- **Fix:** **Expenses** is now in the main nav for **all roles** (including Staff). Staff can open Expenses and add entries; backend already scopes by tenant. (Optional later: restrict Staff to their assigned branch/route when adding.)

### 5. User management – Copy credentials & copy icon
- **Issue:** Owner wanted to copy credentials when creating a user and copy from the users table.
- **Fix:**  
  - After **Add User** success, a **“User created – copy credentials”** modal shows **Email** and **Password** with a **Copy credentials** button.  
  - In the **users table**, a **Copy** icon per row copies that user’s **email** to the clipboard.

### 6. Super Admin – Delete company failure
- **Issue:** “Failed to delete company – An error occurred” with no detail.
- **Fix:** Frontend now shows **backend error detail** (e.g. FK constraint) when delete fails: `response.errors?.[0]` or `error.response?.data?.errors?.[0]` so you can see the real reason.

---

## Not changed (design / scope)

### Data isolation (Staff sees only their company)
- Staff already see only their tenant’s data via `CurrentTenantId` and route/branch assignments. If “Staff doesn’t see Customer Ledger” or “wrong company name”, it may be assignment (branch/route) or a specific page bug; can be debugged with a concrete scenario.

### Owner feature permissions (e.g. enable/disable Purchase, Products)
- This would need a **tenant-level feature flags** (e.g. “Can use Purchases”, “Can use Products”) and UI to toggle them. Not implemented in this pass.

### Database management tab (tables, columns, PSQL, URLs)
- A full “Database management” UI (table list, column names, run SQL, connection URLs) is a separate, security-sensitive feature and was not built here.

### Super Admin Infrastructure not updating fast / correct
- No code change; likely environment/cache or API timing. If you have a specific metric or screen that’s wrong, that can be targeted.

---

## Summary

| Item | Status |
|------|--------|
| Branch report: COGS column, correct profit formula visible | Done |
| Customer Ledger: Branch/Route filters on list | Done |
| Company logo on dashboard/header | Done (branding + logo fallback) |
| Staff can add expenses (nav + access) | Done |
| User create: copy credentials modal | Done |
| Users table: copy email icon | Done |
| Super Admin delete company: show error detail | Done |
| Data isolation / company name for Staff | Deferred (needs concrete case) |
| Owner feature permissions | Deferred (needs feature-flag design) |
| Database management tab | Deferred (separate feature) |

All code changes are in the repo; run backend and frontend and test. If any specific issue remains (e.g. Staff still not seeing ledger, or logo still not loading), share the exact screen and role and we can narrow it down.
