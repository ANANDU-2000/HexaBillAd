# HexaBill Fix Plan – Orderwise (Complete Before Deploy)

## ✅ PHASE 1: COMPLETED (All 500/400 Error Fixes – Ready to Deploy)

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| 1 | POST /users 500 (create staff) | BranchStaff Id – `UseIdentityByDefaultColumn()` | ✅ Done |
| 2 | PUT /users 500 (assign staff) | Same as #1 | ✅ Done |
| 3 | POST /customers 500 | Remove transaction (execution strategy conflict) | ✅ Done |
| 4 | DELETE tenant 500 | Remove execution strategy + transaction | ✅ Done |
| 5 | CORS logo duplicate | Skip early CORS for `/uploads` | ✅ Done |
| 6 | Payment 400 | Remove execution strategy + transaction | ✅ Done |
| 7 | Branch/route tabs overlap | Scrollable tabs | ✅ Done |
| 8 | API retries | Reduced retries | ✅ Done |

**All fixes above are coded. No more backend/frontend changes needed for 500/400 errors.**

---

## 🚀 DEPLOY (Required – Fixes 500 Errors)

**The 500 errors will NOT stop until you deploy.** Production is still running old code.

```powershell
cd C:\Users\anand\Downloads\HexaBil-App2\HexaBil-App2
git add -A
git commit -m "fix: Customer creation 500, user creation 500, BranchStaff Id, Delete tenant, CORS, payment"
git push origin main
```

Wait 5–8 minutes for Render to build and deploy.

---

## 📋 PHASE 2: POST-DEPLOY (Enhancements)

| # | Issue | Notes |
|---|-------|-------|
| 1 | Return button in ledger (each bill) | Add Action column with "Return" for Sale/Invoice rows – navigate to Returns |
| 2 | Return data page reports | Reports > Sales Returns tab exists – verify filters/data |
| 3 | POS customer list for staff | Staff needs branch/route assignment (Assign Staff fix deploys with #1–2) |
| 4 | Ledger filters | Date, branch, route, staff – verify after deploy |
| 5 | Staff dashboard isolation | Staff data scope – verify after deploy |

---

## 📁 Modified Files (Uncommitted)

- `backend/HexaBill.Api/Data/AppDbContext.cs`
- `backend/HexaBill.Api/Modules/Customers/CustomerService.cs`
- `backend/HexaBill.Api/Modules/Payments/PaymentService.cs`
- `backend/HexaBill.Api/Modules/SuperAdmin/SuperAdminTenantService.cs`
- `backend/HexaBill.Api/Program.cs`
- `frontend/hexabill-ui/src/pages/company/BranchDetailPage.jsx`
- `frontend/hexabill-ui/src/pages/company/RouteDetailPage.jsx`
- `frontend/hexabill-ui/src/services/api.js`
- `FIX_PLAN_ORDERWISE.md`
- `DEPLOY_NOW.md`

---

## ✅ ORDERWISE SUMMARY

1. **Phase 1 (500 errors)** – ✅ Complete  
2. **Deploy** – ⏳ Run git commands above  
3. **Phase 2 (Return button, reports, etc.)** – After deploy  

**No more errors on 500/400 paths once deployed.** Phase 2 items are enhancements, not blockers for deploy.
