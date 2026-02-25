# 🔥 HEXABILL FULL CODEBASE DEEP ANALYSIS

**Senior SaaS architect technical audit**  
**Date:** 2026-02-25  
**Scope:** Entire HexaBill codebase — facts from code, no guessing

---

## 1. PROJECT STRUCTURE ANALYSIS

### 1.1 Full Folder Structure

```
HexaBillAd-main/
├── backend/
│   ├── HexaBill.Api/                    # ASP.NET Core 9 API
│   │   ├── Modules/                     # Feature modules (15 modules)
│   │   │   ├── Auth/                   # Authentication, JWT, Signup, LoginLockout
│   │   │   ├── Billing/                # SaleService, Returns, PDF, InvoiceNumber, InvoiceTemplate
│   │   │   ├── Branches/               # BranchService, RouteService, CustomerVisits, RouteExpenses
│   │   │   ├── Customers/              # CustomerService, BalanceService
│   │   │   ├── Expenses/               # ExpenseService
│   │   │   ├── Import/                 # SalesLedgerImport
│   │   │   ├── Inventory/             # ProductService, StockAdjustmentService
│   │   │   ├── Notifications/         # AlertService
│   │   │   ├── Payments/              # PaymentService
│   │   │   ├── Purchases/             # PurchaseService, SupplierService
│   │   │   ├── Reports/               # ReportService, ProfitService
│   │   │   ├── Seed/                  # Data seeding
│   │   │   ├── Subscription/          # Stripe subscription management
│   │   │   ├── SuperAdmin/            # Platform administration (11+ services)
│   │   │   └── Users/                 # User management
│   │   ├── Shared/
│   │   │   ├── Authorization/         # AdminOrOwnerPolicy, AdminOrOwnerOrStaffPolicy
│   │   │   ├── Extensions/             # SecurityConfiguration, TenantIdExtensions, OwnerIdExtensions
│   │   │   ├── Middleware/             # JWT, TenantContext, Subscription, Audit, Exception handling
│   │   │   ├── Security/               # R2FileUpload, FileUpload
│   │   │   ├── Services/               # AuditService, TenantContext, RouteScope, ErrorLog
│   │   │   └── Validation/            # ValidationService, CurrencyService
│   │   ├── BackgroundJobs/             # TrialExpiryCheck, DailyBackupScheduler
│   │   ├── Data/                       # AppDbContext
│   │   ├── Models/                     # 43+ entity/DTO files
│   │   ├── Migrations/                 # EF Core migrations
│   │   ├── Scripts/                    # SQL scripts, backfill, fix scripts
│   │   ├── Templates/                  # Invoice templates
│   │   ├── Fonts/                      # PDF fonts
│   │   └── Program.cs
│   └── Scripts/
├── frontend/
│   └── hexabill-ui/                    # React 18 + Vite
│       └── src/
│           ├── pages/                  # 44 page components
│           │   ├── company/            # 30+ tenant pages
│           │   └── superadmin/          # 11 SuperAdmin pages
│           ├── components/
│           ├── hooks/
│           ├── services/
│           ├── utils/                  # roles.js
│           └── security/
├── DATABASE_SCHEMA.md
└── README.md
```

### 1.2 Technology Identification

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18.3.1, Vite 5.0.8, Tailwind CSS 3.3.6, Zustand 5.0.8, Recharts 2.8.0, Axios 1.6.0 |
| **Backend** | ASP.NET Core 9.0, .NET 9.0 |
| **Database** | PostgreSQL (Npgsql 9.0.1, EF Core 9.0) — SQLite supported for dev |
| **Auth** | JWT Bearer, BCrypt.Net-Next 4.0.3 |
| **PDF** | QuestPDF 2024.12.2 |
| **Excel** | EPPlus 7.5.2 |
| **Payments** | Stripe.net 47.0.0 |
| **Storage** | AWSSDK.S3 / Cloudflare R2 |
| **Logging** | Serilog, file + console |

### 1.3 What Is Clean

- **Modular backend** — Feature folders (Auth, Billing, Customers, etc.) with clear separation
- **Consistent multi-tenant pattern** — `tenantId` passed to service methods; middleware enforces
- **Index strategy** — `AddPerformanceIndexes.sql` defines 40+ composite indexes for tenant+date, tenant+branch, etc.
- **Concurrency tokens** — `RowVersion` on Sale, Product, Customer, Payment to prevent race conditions
- **Idempotency** — `PaymentIdempotencies` table for duplicate payment prevention
- **Audit trail** — `AuditService` with field-level change tracking (OldValues/NewValues JSON)
- **Role-based access** — Admin, Owner, Staff, SystemAdmin with `PageAccess` for Staff granularity

### 1.4 What Is Messy

- **OwnerId vs TenantId dual schema** — Both exist across 25+ entities. `MigrateOwnerIdToTenantId.sql` exists; migration in progress. Causes: inconsistent filtering, potential cross-tenant leaks if wrong field used
- **InvoiceTemplates NOT tenant-scoped** — `InvoiceTemplate` model has no TenantId/OwnerId. `InvoiceTemplateService.GetTemplatesAsync()` returns ALL templates globally. **Data isolation violation**
- **ExpenseCategories global** — `ExpenseCategory` has `Name` unique globally, not per-tenant (no TenantId)
- **Console.WriteLine in production code** — 50+ occurrences in ReportService, DashboardController, SettingsController, SuperAdminTenantController, etc. Debug output in production
- **PRODUCTION_MASTER_TODO comments** — 15+ unimplemented features referenced (e.g. #46 onboarding tracker, #47 SQL console, #48 bulk tenant actions, #49 diagnostics, #50 tenant invoices, #51 subscription history, #52 tenant export)

### 1.5 What Causes Future Merge Conflicts

- **SaleService.cs** — 2,893 lines; monolithic; many responsibilities (CRUD, PDF, validation, balance updates, lock logic)
- **ReportService.cs** — 2,600+ lines; single class handles all report types
- **SuperAdminTenantService.cs** — 1,300+ lines; tenant CRUD + demo + export logic
- **AppDbContext.OnModelCreating** — 530+ lines; all entity config in one place

### 1.6 Tight Coupling

- **BalanceService** — Every invoice/payment event calls `RecalculateCustomerBalanceAsync` (full table scan per customer). No incremental updates
- **SaleService** → **BalanceService, AlertService, PdfService, InvoiceNumberService, ValidationService** — Heavy service orchestration; SaleService knows too many modules
- **ReportService** → **SalesSchemaService** — Dynamic schema check `SalesHasBranchIdAndRouteIdAsync()` on every report; runtime column detection
- **Settings** — Key-value with composite PK (Key, OwnerId); `SettingsService` has fallback logic for missing columns

### 1.7 Environment Config

- **Backend:** `.env.example` — DATABASE_URL, JwtSettings__SecretKey, ALLOWED_ORIGINS, R2_*, SMTP_*, STRIPE_API_KEY
- **Frontend:** `.env.example` — VITE_API_BASE_URL, VITE_GROQ_API_KEY, VITE_GEMINI_API_KEY
- **Database fix at startup** — Program.cs adds `PageAccess` column if missing (runtime migration workaround)

---

## 2. FEATURE EXTRACTION

### 2.1 Invoice System

| Aspect | Status | Notes |
|--------|--------|-------|
| Create/Update/Delete | ✅ Complete | SaleService with soft delete, 8-hour edit window, locking |
| Invoice numbering | ✅ Complete | InvoiceNumberService, per-tenant sequence, Zayorga exception handled |
| PDF generation | ✅ Complete | QuestPDF, customizable templates |
| Versioning | ✅ Complete | InvoiceVersions table, DataJson snapshot, DiffSummary |
| Held/draft invoices | ✅ Complete | HeldInvoices table |
| Duplicate prevention | ✅ Complete | ExternalReference unique, RowVersion concurrency |

**Scalability:** Invoice list paginated (max 100/page). Full `Include` on Customer, Items, Product for list — N+1 risk on large datasets.

### 2.2 VAT Calculation

| Aspect | Status | Notes |
|--------|--------|-------|
| Sales VAT | ✅ Complete | Sale.VatTotal, SaleItem.VatAmount |
| Purchase VAT | ⚠️ Half-built | Purchase.Subtotal, VatTotal nullable; BackfillPurchaseVAT.cs exists for legacy |
| VAT rate | ⚠️ Configurable | Via Settings; no global VAT rate constant in code |

### 2.3 Credit Sales

| Aspect | Status | Notes |
|--------|--------|-------|
| Credit limit | ✅ Complete | Customer.CreditLimit |
| Pending balance | ✅ Complete | Customer.PendingBalance, TotalSales, TotalPayments |
| Balance recalculation | ⚠️ Inefficient | Full recalc (4 table scans) on every invoice/payment change |
| Credit validation | ✅ Complete | BalanceService.CanCustomerReceiveCreditAsync |
| Mismatch detection | ✅ Complete | DetectAllBalanceMismatchesAsync, FixBalanceMismatchAsync |

**Scaling risk:** `RecalculateCustomerBalanceAsync` does:
- Sum Sales where CustomerId
- Sum Payments where CustomerId (CLEARED, non-refund)
- Sum SaleReturns
- Sum refunds
- Update Customer

Per customer, per event. For 10K customers × 100 events/day = 1M aggregate queries/day. No incremental engine.

### 2.4 Inventory

| Aspect | Status | Notes |
|--------|--------|-------|
| Products CRUD | ✅ Complete | ProductService, multi-unit (ConversionToBase) |
| Stock adjustments | ✅ Complete | StockAdjustmentService, InventoryTransactions audit |
| Low stock alerts | ✅ Complete | ReorderLevel per product, global fallback |
| Atomic updates | ✅ Complete | RowVersion on Product |
| Categories | ✅ Complete | ProductCategories, tenant-scoped |
| Price change log | ✅ Complete | PriceChangeLogs table |
| Damage tracking | ✅ Complete | DamageCategories, DamageInventory, SaleReturnItem.DamageCategoryId |

**Modular:** ProductService, StockAdjustmentService separated. Logic not heavily duplicated.

### 2.5 Reporting Engine

| Report Type | Status | Performance |
|-------------|--------|-------------|
| Summary (sales, purchases, expenses) | ✅ Complete | Multiple queries; branch/route filter |
| Sales report (paged) | ✅ Complete | Paginated |
| Product sales | ✅ Complete | Top N, filtering |
| Outstanding customers | ✅ Complete | Paged |
| Customer report | ✅ Complete | Min outstanding filter |
| Cheque report | ✅ Complete | Paged |
| Pending bills | ✅ Complete | Paged |
| Aging report | ✅ Complete | AsOfDate |
| Stock report | ✅ Complete | Low stock filter |
| Expenses by category | ✅ Complete | Date range |
| Sales vs Expenses | ✅ Complete | Group by day/week/month |
| Sales ledger | ✅ Complete | Comprehensive, staff-scoped |
| Staff performance | ✅ Complete | Route filter |
| AI suggestions | ✅ Complete | Period-based |

**Scaling:** No materialized views. All reports query live data. `GetSummaryReportAsync` runs 6+ separate queries. `DetectAllBalanceMismatchesAsync` iterates ALL customers and validates each — O(n) full recalc.

### 2.6 Dashboard

- **Backend:** DashboardController.GetDashboardBatch — single batch endpoint
- **Metrics:** Sales today, outstanding customers, low stock, recent transactions
- **Staff scope:** Route-restricted for Staff role
- **Profit calculation:** Cash-based (Sales - Purchases - Expenses)

### 2.7 Role-Based Permissions

| Role | Capability | Implementation |
|------|------------|----------------|
| SystemAdmin | Full platform access, tenant_id=0 | JWT claim, AdminOrOwnerPolicy |
| Owner | Full tenant access | JWT claim |
| Admin | Full tenant access | Same as Owner |
| Staff | Page-level + route-level | PageAccess (comma-separated), BranchStaff, RouteStaff |

**PageAccess:** Staff can access pos, invoices, products, customers, expenses, reports. Never: users, settings, backup, branches, routes, purchases. Enforced in `roles.js` and backend route scope.

**DashboardPermissions:** JSON on User; used for dashboard widget visibility. Not deeply enforced in code audit.

### 2.8 Audit Logs

- **AuditService** — Action, EntityType, EntityId, OldValues, NewValues (JSON), IpAddress, UserId
- **AuditMiddleware** — Logs requests
- **SuperAdminAuditLogsPage** — Frontend exists
- **Indexes:** TenantId, UserId, CreatedAt, (EntityType, EntityId)

### 2.9 Customer Ledger

- **CustomerLedgerPage.jsx** exists
- **BalanceService** + **CustomerService** provide balance and transaction data
- **Sales ledger** — ReportService.GetComprehensiveSalesLedgerAsync

### 2.10 Expense Module

- **ExpenseService** — CRUD, category, branch/route, recurring
- **RecurringExpenses** — Frequency, DayOfRecurrence
- **Expense approval** — Status: Draft, Approved, Rejected
- **RouteExpenses** — Route-level expenses (CustomerVisits, route staff)

### 2.11 Purchase Module

- **PurchaseService** — CRUD, items, stock increment
- **PurchaseReturns** — Return tracking
- **Suppliers** — SupplierService exists; Purchases use SupplierName (string), not FK to Supplier entity in many cases
- **VAT** — Subtotal, VatTotal on Purchase; backfill script for legacy

---

## 3. DATABASE ANALYSIS

### 3.1 Tables (40 total)

Tenants, Users, SubscriptionPlans, Subscriptions, Branches, Routes, BranchStaff, RouteStaff, RouteCustomers, RouteExpenses, CustomerVisits, Products, ProductCategories, PriceChangeLogs, InventoryTransactions, Customers, Sales, SaleItems, SaleReturns, SaleReturnItems, Payments, PaymentIdempotencies, Purchases, PurchaseItems, PurchaseReturns, PurchaseReturnItems, Expenses, ExpenseCategories, RecurringExpenses, InvoiceVersions, InvoiceTemplates, DamageCategories, Settings, AuditLogs, Alerts, ErrorLogs, HeldInvoices, UserSessions, FailedLoginAttempts, DemoRequests

### 3.2 Relationships

- **Tenant** → Users, Branches, Customers, Products, Sales, Payments, etc. (TenantId FK)
- **Legacy OwnerId** still on Sales, Purchases, Customers, Products, etc.
- **Branch** → Routes → RouteStaff, RouteCustomers, RouteExpenses, CustomerVisits
- **Sale** → SaleItems, InvoiceVersions, SaleReturns
- **Customer** → Sales, Payments, SaleReturns

### 3.3 Index Usage

- **AddPerformanceIndexes.sql** — 40+ indexes: TenantId+CreatedAt, TenantId+BranchId, TenantId+RouteId, TenantId+CustomerId, TenantId+PaymentStatus, etc.
- **Unique:** (OwnerId, InvoiceNo) on Sales with IsDeleted filter; (TenantId, Sku) on Products; Email on Users

### 3.4 Missing Constraints / Risks

| Issue | Risk |
|-------|------|
| InvoiceTemplates no TenantId | Cross-tenant data leak — Tenant A sees Tenant B templates |
| ExpenseCategories no TenantId | All tenants share categories |
| OwnerId/TenantId dual schema | Migration incomplete; inconsistent queries |
| Settings composite PK (Key, OwnerId) | OwnerId used; TenantId nullable — inconsistency |

### 3.5 Scaling Assessment

| Scenario | Assessment |
|----------|------------|
| 100+ concurrent users | **Risky** — No connection pooling config visible; BalanceService full recalc per event. ReportService multiple queries per request. |
| 10M invoices | **Risky** — Sales table indexed on TenantId+InvoiceDate. No partitioning. List sales does full table scan with pagination; date range filters help. AuditLogs, InvoiceVersions will grow unbounded. |
| Credit calculation | **Not efficient** — Full recalculation per customer per event. No event-sourced or incremental balance engine. |

---

## 4. ARCHITECTURE STRENGTH

### 4.1 Maturity Level

**Between MVP and production-ready.** Core billing, inventory, reporting work. Multi-tenant isolation mostly correct. But: dual schema, InvoiceTemplate leak, BalanceService scaling, debug Console output, unimplemented PRODUCTION_MASTER_TODOs.

### 4.2 What Will Break First Under Heavy Load

1. **BalanceService.RecalculateCustomerBalanceAsync** — Called on every invoice/payment change. 4 aggregate queries per customer. High-frequency tenants will hit DB hard.
2. **ReportService** — Multiple sequential queries per report; no caching; no async batching.
3. **SaleService.GetSalesAsync** — Include(Customer, Items, Product) for list — large result sets.
4. **AuditLogs** — Unbounded growth; no retention/archive policy in code.
5. **Dashboard batch** — Multiple metric queries; no caching.

### 4.3 Security Risks

| Risk | Severity | Evidence |
|------|----------|----------|
| InvoiceTemplate cross-tenant | **High** | No TenantId; GetTemplatesAsync returns all |
| ExpenseCategory cross-tenant | Medium | Global unique Name |
| SQL console (SuperAdmin) | Medium | Read-only, blacklist, but raw SQL execution |
| Console.WriteLine leaking data | Low | Debug output may expose PII in logs |
| JWT secret in env | Standard | Must be kept secret |

### 4.4 Data Integrity Risks

| Risk | Evidence |
|------|----------|
| Balance drift | BalanceService detects mismatches; alerts. But full recalc can race with concurrent payments. |
| Sale/Payment consistency | PaymentStatus on Sale can desync from Payments; ReconcileAllPaymentStatusAsync exists to fix |
| Stock oversell | RowVersion on Product; atomic adjustment. Sale finalization decrements stock. |
| Invoice number collision | Unique (OwnerId, InvoiceNo) with IsDeleted filter; sequence per tenant. |

---

## 5. BUSINESS CAPABILITY ANALYSIS (CODE ONLY)

### 5.1 What HexaBill ACTUALLY Solves

- **B2B invoicing** — Create, edit (8hr window), lock, PDF, version history
- **Credit sales** — Customer credit limit, pending balance, payment terms
- **Multi-branch / route sales** — Branches, routes, route staff, customer visits
- **Inventory** — Products, categories, stock, adjustments, low stock alerts, damage tracking
- **Purchases** — PO entry, returns, supplier name (no full supplier master)
- **Expenses** — Categories, recurring, branch/route scoped, approval workflow
- **Payments** — Multiple modes, idempotency, link to sale/customer
- **Returns** — Sale returns, purchase returns, damage categories
- **Reporting** — Sales, product, customer, aging, stock, profit, ledger
- **Multi-tenant SaaS** — Tenant isolation, subscription plans, Stripe billing
- **Audit** — Field-level change tracking
- **Roles** — Owner, Admin, Staff (page + route scoped)

### 5.2 What It Partially Solves

- **VAT** — Sales VAT complete; purchase VAT backfilled, not always populated
- **Profit calculation** — Cash-based (Sales - Purchases - Expenses); no accrual
- **Supplier management** — SupplierService exists but Purchase uses SupplierName string
- **API access** — SubscriptionPlan.HasApiAccess; no public API routes found in codebase

### 5.3 What It Does NOT Solve Yet

- **Public API / webhooks** — HasApiAccess in plan; no API key or webhook implementation found
- **Offboarding export** — PRODUCTION_MASTER_TODO #52; export ZIP mentioned, not confirmed complete
- **Onboarding tracker** — PRODUCTION_MASTER_TODO #46
- **Bulk tenant actions** — PRODUCTION_MASTER_TODO #48
- **Email backup delivery** — TODO in SuperAdminController: "Implement email service to send backup file"

---

## 6. MARKETING POSITIONING BASED ON REAL CODE

### 6.1 Real Positioning

**Multi-tenant B2B billing & route sales for distributors/wholesalers**

- Branches, routes, route staff, customer visits
- Credit sales with limits and aging
- Arabic + English support (NameEn, NameAr)
- UAE-focused (default country AE, currency AED)
- Stripe subscriptions for SaaS monetization

### 6.2 Real Competitive Edge

- **Route-based sales** — Route staff, customer visits, route expenses. Competitors often lack this.
- **8-hour invoice edit window** — Lock after 8hr; version history with diff. Good for compliance.
- **Damage categories on returns** — AffectsStock, AffectsLedger, IsResaleable. Return handling is nuanced.
- **Held/draft invoices** — POS can hold and resume

### 6.3 Real Differentiation

- **Staff role with page + route scope** — Granular: Staff sees only assigned routes/branches
- **Multi-unit products** — ConversionToBase (e.g. 1 box = 12 pieces)
- **Invoice template customization** — HTML/CSS templates (but not tenant-scoped — fix before marketing)

### 6.4 Real Limitations

- No public API yet (despite HasApiAccess in plans)
- Credit balance: full recalc, not incremental — scaling concern
- InvoiceTemplates shared across tenants — do not market "per-tenant branding" until fixed
- Expense categories global — not per-tenant
- Profit is cash-based only
- No automated backup email

---

## 7. REFACTOR RECOMMENDATION

### 7.1 Folder Restructuring

- Split **SaleService** into: SaleCrudService, SalePdfService, SaleValidationService
- Split **ReportService** into report-type modules (SalesReportService, CustomerReportService, etc.)
- Extract **BalanceEngine** from BalanceService — incremental balance updates or event-sourced design
- Move **Console.WriteLine** to proper ILogger

### 7.2 Module Separation

- InvoiceTemplateService: add TenantId to InvoiceTemplate, filter by tenant
- ExpenseCategory: add TenantId, unique (TenantId, Name)
- Complete OwnerId → TenantId migration; remove OwnerId from new code paths

### 7.3 Backend Cleanup

- Remove or guard all Console.WriteLine (use ILogger)
- Resolve PRODUCTION_MASTER_TODOs or remove misleading comments
- Consolidate tenant filtering: single helper (e.g. TenantFilterExtensions) instead of ad-hoc `TenantId == tenantId`

### 7.4 Permission System Improvement

- Formalize DashboardPermissions schema (JSON structure)
- Add permission checks at API level for each Staff-restricted endpoint (not just frontend)
- Document STAFF_NEVER_ACCESS in backend

### 7.5 Credit Engine Improvement

- Option A: Incremental balance — on Payment create, add to TotalPayments, subtract from PendingBalance (single row update)
- Option B: Event-sourced ledger — append-only transactions; balance = SUM(transactions)
- Option C: Background reconciliation job — async recalc, don’t block invoice creation
- Add DB index on (CustomerId, TenantId) for Payments/Sales if not exists

### 7.6 Reporting Engine Scaling

- Add response caching for summary/aggregate reports (e.g. Redis, in-memory with TTL)
- Consider materialized views for daily/monthly sales aggregates
- Paginate `DetectAllBalanceMismatchesAsync` or run as nightly job
- Add date-partitioning strategy for AuditLogs, InvoiceVersions

### 7.7 Immediate Fixes (Before Marketing)

1. **InvoiceTemplate tenant scope** — Add TenantId, backfill, filter all reads
2. **ExpenseCategory tenant scope** — Add TenantId, migrate
3. **Remove Console.WriteLine** — Replace with ILogger
4. **Document what is NOT built** — Update marketing to avoid promising API, advanced onboarding, etc.

---

## APPENDIX: File Counts & Key Paths

| Area | Count |
|------|-------|
| Backend modules | 15 |
| Frontend pages | 44 |
| Database tables | 40 |
| EF Models | 43+ |
| Migrations | 15+ |

**Key files:**
- `SaleService.cs` — 2,893 lines
- `ReportService.cs` — 2,600+ lines
- `BalanceService.cs` — 356 lines
- `AppDbContext.cs` — 530 lines OnModelCreating
- `roles.js` — 101 lines (Staff page access)
- `DATABASE_SCHEMA.md` — 886 lines

---

**End of Analysis.** Use this document for positioning, refactor planning, and scaling strategy. No fluff. Facts only.
