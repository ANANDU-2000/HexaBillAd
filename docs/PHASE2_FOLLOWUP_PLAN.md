# Phase 2 Follow-up Plan — Branch/Route, Staff Scope, Reports, Sales, Frontend

Order of work (better way):

| Step | Task | Scope |
|------|------|--------|
| 1 | Apply migration | Run `dotnet ef database update` in backend/HexaBill.Api (requires DB connection). |
| 2 | Staff scope | Restrict Staff role to data for their assigned route(s) only. Owner/Admin see all. |
| 3 | Reports + customer ledger filters | Add optional `branchId`, `routeId`, `staffId` (and apply staff scope when applicable). |
| 4 | Sales/POS BranchId/RouteId | Accept in CreateSaleRequest; set on Sale when creating. Optional from current context. |
| 5 | Frontend | Branches/Routes management UI, route expense screen, branch/route dashboards. |

---

## 1. Apply migration

- From repo root: `cd backend/HexaBill.Api` then `dotnet ef database update --context AppDbContext`.
- Requires connection string (env or appsettings). If using SQLite default, migration applies to `hexabill.db`.

---

## 2. Staff scope (Phase 1 security)

- **Rule:** Staff see only data for routes they are assigned to (via RouteStaff). Owner/Admin see all tenant data.
- **Implementation:**
  - Add `IRouteScopeService`: given `(userId, tenantId, role)` returns `int[]?` route IDs — `null` = no restriction (Owner/Admin), else list of route IDs for Staff.
  - Use in: SaleService.GetSalesAsync, ReportService (summary, sales report, ledger), CustomerService.GetCustomersAsync / GetCustomerLedgerAsync.
  - When `routeIds != null`, add filter: `Sale` → `RouteId.HasValue && routeIds.Contains(RouteId.Value)`; Customer → filter by customers that appear in RouteCustomer for those route IDs, or sales for those routes; etc.

---

## 3. Reports + customer ledger filters

- **ReportService:** Add optional parameters to existing methods where relevant: `branchId?, routeId?, staffId?`. Filter sales/expenses by BranchId, RouteId; if staffId provided, filter by that staff’s sales or route.
- **Customer ledger:** Add optional `branchId?, routeId?, staffId?` to GetCustomerLedgerAsync / GetCustomerReportAsync; filter transactions by branch/route/staff when provided.
- **ReportsController / CustomersController:** Pass query params through to services.

---

## 4. Sales/POS BranchId and RouteId

- **CreateSaleRequest:** Add `int? BranchId`, `int? RouteId`.
- **CreateSaleInternalAsync:** Set `sale.BranchId = request.BranchId`, `sale.RouteId = request.RouteId`.
- **SaleDto:** Add `BranchId?`, `RouteId?` (and optionally branch/route names) for display.
- Frontend can send BranchId/RouteId from current context (e.g. selected branch/route in POS).

---

## 5. Frontend

- **Branches:** List, create, edit, delete; branch summary (sales, expenses, profit by route).
- **Routes:** List (filter by branch), create, edit, delete; assign customers and staff; route summary and route expense list.
- **Route expenses:** Per-route expense list; add expense (Fuel, Staff, Delivery, Misc).
- **Dashboards:** Branch summary card/page; route summary card/page; link from main dashboard.
- **Sales/POS:** Optional branch/route selector; send BranchId/RouteId when creating sale.

---

## Completion checklist

- [ ] **Migration:** Run manually: `cd backend/HexaBill.Api` then `dotnet ef database update`. (DLL may be locked if API is running; stop API first if copy fails.)
- [x] **IRouteScopeService** implemented; Staff restricted to assigned routes in Sales (GetSalesAsync), Reports (GetSummaryReportAsync, GetSalesReportAsync, GetComprehensiveSalesLedgerAsync).
- [x] **Report APIs** accept and apply branchId, routeId query params; staff scope applied when role is Staff.
- [x] **CreateSaleRequest** has BranchId, RouteId; Sale entity and SaleDto set/expose them; CreateSaleInternalAsync sets sale.BranchId, sale.RouteId.
- [ ] **Frontend:** Branches page, Routes page, Route expenses, Branch/Route dashboards, POS branch/route selection (optional).
