# HexaBill Frontend Production Audit Report

**Scope:** `frontend/hexabill-ui/src/pages/company/`  
**Date:** February 19, 2025  
**Pages Audited:** CustomerLedgerPage, PosPage, SalesLedgerPage, ExpensesPage, ReportsPage, ProductsPage, CustomersPage, UsersPage, DashboardTally, BranchesPage, BranchDetailPage

---

## 1. CustomerLedgerPage (`/ledger`)

| Aspect | Details |
|--------|---------|
| **Filters** | Date (from/to), Branch, Route, Staff – from BranchesRoutesContext. Staged in `filterDraft`, applied via Apply. Debounced ~800ms. |
| **Form Fields** | Add/Edit customer: name, phone, email, trn, address, creditLimit, branchId, routeId. Payment: amount, saleId, paymentMode. |
| **Buttons** | Save, Apply, Refresh, Add Customer, Add Payment, Edit, Delete – work. |
| **Tabs** | ledger, invoices, payments, reports – tab switch works. |
| **Owner vs Staff** | Staff: only assigned branches/routes; filters scoped. |
| **Potential Bugs** | `fetchCustomerSearch` vs `fetchCustomers` race on rapid filter changes; debounce callback may be cleared early. |

---

## 2. PosPage (`/pos`)

| Aspect | Details |
|--------|---------|
| **Filters** | Branch, Route – from BranchesRoutesContext. Auto-select when single option; filled from customer. |
| **Form Fields** | Product search, qty, discount; customer; payment method, amount, notes; invoice date. |
| **Buttons** | Save/Complete, Print, Edit, Refresh, Hold/Resume – work. |
| **Tabs** | None. |
| **Owner vs Staff** | Staff: branches/routes limited to assignments; `staffHasNoAssignments` message. |
| **Potential Bugs** | `loadSaleForEdit` uses `customers` in closure – may be stale; `customerChangedDuringEdit` sync risk. |

---

## 3. SalesLedgerPage (`/sales-ledger`)

| Aspect | Details |
|--------|---------|
| **Filters** | Date, Branch, Route, Staff – from context. `dateRange`, `branchId`/`routeId`/`staffId` trigger fetch. Client filters apply instantly. |
| **Form Fields** | None; table read-only. |
| **Buttons** | Export Excel/PDF, Clear All, Load More, Show/Hide Filters – work. |
| **Tabs** | None. |
| **Owner vs Staff** | Staff: auto-select branch when 1; only self in staff filter. |
| **Potential Bugs** | `dataUpdated` listener closure may miss latest `fetchSalesLedger` (deps). |

---

## 4. ExpensesPage (`/expenses`)

| Aspect | Details |
|--------|---------|
| **Filters** | Date range (presets: 7d, week, month, year); group by; search. Branch/route in Add/Edit form only (from context). |
| **Form Fields** | Add/Edit: category, amount, date, note, branchId, routeId, attachment. Routes filtered by branch. |
| **Buttons** | Refresh, Add, Edit, Delete, Approve/Reject – work. |
| **Tabs** | None. |
| **Owner vs Staff** | Staff: auto-select branch when 1; totals scoped to assignments. |
| **Potential Bugs** | **HIGH:** `Eye` used but not imported → runtime error. `handleDownloadAttachment(expense.attachmentUrl)` passes URL but fn expects expense object. Expenses fetch may not pass branchId for staff. |

---

## 5. ReportsPage (`/reports`)

| Aspect | Details |
|--------|---------|
| **Filters** | Date (persisted), Branch, Route, Product, Customer, Category, Status, Search. Branches/routes from context. Apply button; debounced search 400ms. |
| **Form Fields** | Filter controls only. |
| **Buttons** | Apply, Export, Refresh – work. |
| **Tabs** | summary, sales, products, customers, expenses, branch, route, aging, profit-loss, branch-profit, outstanding, collections, cheque, staff, ai. Admin-only: profit-loss, branch-profit, cheque, staff, ai. |
| **Owner vs Staff** | Staff cannot see admin-only tabs. |
| **Potential Bugs** | Fast tab switching edge cases; `loadDateRangeFromStorage` may restore invalid dates. |

---

## 6. ProductsPage (`/products`)

| Aspect | Details |
|--------|---------|
| **Filters** | Search (debounced 300ms); tab: all, lowStock, inactive; unit type, category. |
| **Form Fields** | Add/Edit: nameEn, sku, costPrice, sellPrice, stockQty, categoryId, unitType, expiryDate, image. |
| **Buttons** | Refresh, Add, Edit, Deactivate, Reset Stock, Stock Adjustment, Import, Categories – work. |
| **Tabs** | All Products, Low Stock, Inactive. Tab change refetches. |
| **Owner vs Staff** | Staff: no Import, Reset Stock, Edit, Delete; can adjust stock. |
| **Potential Bugs** | **HIGH:** `handleUpdateProduct(id, productData)` ignores 3rd arg `imageFile` – image upload on edit does not work. |

---

## 7. CustomersPage (`/customers`)

| Aspect | Details |
|--------|---------|
| **Filters** | Search (debounced); tab: all, outstanding, active, inactive (client-side). Branch/route in Add/Edit form. |
| **Form Fields** | Add/Edit: name, phone, email, trn, address, creditLimit, branchId, routeId, paymentTerms. |
| **Buttons** | Add, Edit, Delete, Export, View Ledger – work. |
| **Tabs** | All, Outstanding, Active, Inactive. Client-side only. |
| **Owner vs Staff** | Same UI; backend scopes by assignments. |
| **Potential Bugs** | `?edit=ID` may not open if customer not on current page; `filterCustomers` not memoized. |

---

## 8. UsersPage (`/users`)

| Aspect | Details |
|--------|---------|
| **Filters** | Search (client-side). Branches/routes from context for assignment forms. |
| **Form Fields** | Add: name, email, phone, role, password. Edit: name, phone, role; dashboard permissions; assigned branches/routes. |
| **Buttons** | Add, Edit, Delete, Reset Password, Activity, Sessions – work. |
| **Tabs** | User modal: details, access, assignments. |
| **Owner vs Staff** | Page is admin/owner only. |
| **Potential Bugs** | `fetchUsers` useEffect empty deps; `filterUsers` not memoized. |

---

## 9. DashboardTally (`/dashboard`)

| Aspect | Details |
|--------|---------|
| **Filters** | Period (today/week/month/custom); Branch (staff only) – from context. |
| **Form Fields** | Custom date inputs when period = custom. |
| **Buttons** | Refresh, Period buttons – work. |
| **Tabs** | None; gateway menu links. |
| **Owner vs Staff** | Staff: branch filter; `branchId` in summary API; some cards hidden by permissions. |
| **Potential Bugs** | Custom dates empty fallback; 10s throttle may delay updates. |

---

## 10. BranchesPage (`/branches`)

| Aspect | Details |
|--------|---------|
| **Filters** | Tab: branches, routes; route filter by branch. From context. |
| **Form Fields** | Add branch: name, address, assignedStaffIds. Add route: name, branchId, assignedStaffIds. |
| **Buttons** | Add Branch, Add Route – work. |
| **Tabs** | Branches, Routes. |
| **Owner vs Staff** | Page blocked for staff (redirect). |
| **Potential Bugs** | **MEDIUM:** `canManage` uses `localStorage` instead of `useAuth()` – stale after login/impersonation. |

---

## 11. BranchDetailPage (`/branches/:id`)

| Aspect | Details |
|--------|---------|
| **Filters** | Date range with Apply. Branches/routes from context (transfer modal). |
| **Form Fields** | Edit branch; Add route; Add expense. |
| **Buttons** | Edit, Save, Add Route, Add Expense, Assign/Remove Staff, Transfer Customer – work. |
| **Tabs** | overview, routes, staff, customers, expenses, performance, report. Tab-specific data fetched when active. |
| **Owner vs Staff** | Page blocked for staff. |
| **Potential Bugs** | Tab race on fast switching; verify expense categories API. |

---

## Summary: Critical Bugs to Fix

| Page | Bug | Severity |
|------|-----|----------|
| **ExpensesPage** | `Eye` used but not imported | **HIGH** (runtime crash) |
| **ExpensesPage** | `handleDownloadAttachment` expects expense object, called with URL | Medium |
| **ProductsPage** | `handleUpdateProduct` ignores `imageFile` – edit image upload broken | **HIGH** |
| **BranchesPage** | `canManage` from localStorage instead of `useAuth()` | Medium |
| **SalesLedgerPage** | `dataUpdated` listener closure may miss `fetchSalesLedger` | Low |

---

## Fix Order (Recommended)

1. **ExpensesPage – Eye import** – Add `Eye` to lucide-react imports (prevents crash).
2. **ProductsPage – image on edit** – Extend `handleUpdateProduct(id, data, imageFile)` and wire image upload.
3. **ExpensesPage – download attachment** – Fix `handleDownloadAttachment` signature/usage.
4. **BranchesPage – canManage** – Use `useAuth()` for `canManage` instead of localStorage.
5. **SalesLedgerPage – dataUpdated** – Add `fetchSalesLedger` to deps or wrap in `useCallback`.

---

## Owner vs Staff Summary

- **Staff** cannot access: BranchesPage, BranchDetailPage, RoutesPage, RouteDetailPage.
- **Staff** sees: branches/routes limited to `assignedBranchIds`/`assignedRouteIds` from context.
- **Staff** auto-select: branch and route when only one option.
- **Admin-only** tabs: Reports (profit-loss, branch-profit, cheque, staff, ai); UsersPage (entire page).
