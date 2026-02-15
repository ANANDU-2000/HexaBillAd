# HexaBill Enterprise Architecture Plan

**Purpose:** Single source of truth for cleanup, folder structure, SuperAdmin, security, backup/restore, SaaS scale, and implementation order. No guessing.

---

## Goal (Real Product Goal)

**HexaBill Goal:** Make trading companies increase profit, reduce mistakes, and control operations with full data isolation and enterprise reliability.

**Not:** UI, AI, or fancy dashboards.

**Core pillars:**
- Profit visibility
- Operational control
- Role-based restriction
- Route + branch accounting
- Secure multi-tenant isolation
- Scalable SaaS architecture
- Reliable import/export
- Enterprise audit trail

Everything else is secondary.

---

## Part 1 — Deep Project Cleanup Plan

### Step 1 — Generate full tree

```bash
tree -I "node_modules|bin|obj|dist|.git"
```

Or in Cursor: *Show full backend + frontend folder tree including duplicate files and SQL scripts.*

### Step 2 — Remove unwanted files

**Delete:**
- Old migration scripts not used
- Duplicate SQL scripts
- Old OwnerId references (after migration complete)
- Old SQLite configs if PostgreSQL-only
- Dead controllers
- Duplicate services
- Fake demo seed data
- Unused JS utilities
- Old MD docs not needed

**Rule:** If file not referenced in solution → delete.

### Step 3 — Remove duplicate logic

**Check:**
- Repeated validation logic
- Repeated TenantId logic
- Multiple error handlers
- Multiple auth middlewares

Keep one clean implementation.

---

## Part 2 — Enterprise Folder Structure

Backend must look like this:

```
/HexaBill.Api
  /Core
    /Entities
    /Enums
    /Interfaces
    /DTOs

  /Infrastructure
    /Persistence
      AppDbContext.cs
      Configurations/
    /Repositories
    /Migrations
    /Services
      EmailService.cs
      StorageService.cs
      AuditService.cs

  /Application
    /Features
      /Auth
      /Tenants
      /Branches
      /Routes
      /Customers
      /Products
      /Sales
      /Expenses
      /Reports
      /SuperAdmin
    /Validators
    /Mapping

  /API
    /Controllers
    /Middleware
    /Filters
    /Extensions
```

- No random services in Shared.
- No mixed business logic inside controllers.

---

## Part 3 — SuperAdmin Enterprise Plan

SuperAdmin must not be fake.

### Desktop SuperAdmin Dashboard — Must include

- Total Tenants
- Active Tenants
- Suspended Tenants
- Monthly Revenue
- Cloud Cost Estimate
- DB Storage per tenant
- Error logs summary
- Daily API calls
- Top 5 usage tenants
- Latest login attempts

### SuperAdmin Features Required

**Tenant Management**
- View tenant profile
- Reset password
- Suspend / Activate
- Delete
- Reset tenant data
- Force logout
- Force upgrade

**Usage Monitoring**
- DB size
- Sales count
- Invoice count
- Storage usage
- API usage
- Daily active users

**Feature Flags (per tenant)**
- Enable Routes
- Enable Branches
- Enable AI
- Enable Advanced Reports
- Enable WhatsApp

**Audit Logs**
- Who changed price
- Who deleted invoice
- Who reset data
- Who changed role

---

## Part 4 — Security for 1000 Clients

**Enforce:**

1. **Row Level Security**  
   Every query: `WHERE TenantId = CurrentTenantId`. Never rely on frontend.

2. **Middleware Validation**  
   Validate tenant active, JWT, role.

3. **Strict Role Model**  
   Roles: SuperAdmin, Owner, Manager, Staff.  
   Owner only: profit & loss, company analytics.  
   Staff cannot: full company reports, global profit.

4. **Prevent Data Leak**  
   Never allow `GET /api/sales/123` without checking `sale.TenantId == CurrentTenantId`.

---

## Part 5 — Backup / Restore Enterprise Design

**Current system weak.** Correct design:

**Backup — Export:** Customers, Products, Sales, Payments, Expenses, Branches, Routes in structured JSON.

**Restore — Must:**
- Validate file version
- Validate schema
- Validate required columns
- Use transaction
- Rollback on failure
- Never partially import

**CSV Import Fix**
- Map columns strictly
- Validate numeric fields
- Validate date format
- Validate invoice uniqueness
- Reject duplicate invoice numbers

---

## Part 6 — 1000 Client Scalability

**Infrastructure**
- PostgreSQL with indexing: TenantId, CustomerId, InvoiceDate, RouteId, BranchId
- Connection pooling
- Pagination everywhere
- No full table loading
- Lazy loading disabled
- Use projection DTO queries

**Prevent crash**
- Global exception middleware
- Log errors
- Never expose stack trace
- Return standardized error object

---

## Part 7 — Route + Branch System

**Design:**

- **Branch:** Id, TenantId, Name
- **Route:** Id, BranchId, TenantId, Name, AssignedStaffId
- **Sales:** Sale → TenantId, BranchId, RouteId, CustomerId

**Reports filter:** By Branch, Route, Staff, Date.

---

## Part 8 — UI/UX Enterprise Design Rules

- No emojis. No random colors. No vertical long stacking.
- Primary: Deep Blue (#1E3A8A). Neutral: White + Light Gray (#F3F4F6). Accent: Emerald (positive), Red (errors).
- Font: Inter or Google Sans style. Consistent size scale.
- Max width container desktop: 1280px. Grid system. 8px spacing scale.
- No duplicated buttons. No double scroll inside mobile.

---

## Part 9 — Enterprise Feature Roadmap

| Phase | Focus |
|-------|--------|
| 1 | Clean architecture, security fix, route system, SuperAdmin dashboard |
| 2 | Backup fix, CSV import fix, usage tracking, feature flags |
| 3 | Multi-branch analytics, advanced reports, owner role restrictions |
| 4 | Scaling optimization, query optimization, indexing, load testing |

---

## Risk Analysis

If not fixed:
- Data leak risk
- Wrong profit calculation
- CSV corruption
- Tenant crossover
- Performance crash with 200+ users
- No audit trail = legal risk

---

## Routes + Branches System (Detailed)

### Structure to add

**New tables:** Branches, Routes, RouteCustomers (mapping), RouteStaff (mapping), RouteExpenses.

**Relationships:**
```
Tenant
 ├── Branches
 │     ├── Routes
 │     │     ├── Customers
 │     │     ├── Staff
 │     │     ├── Sales
 │     │     └── Expenses
```

### Workflows

**Owner:** Create Branch → Create Route → Assign Staff/Customers. View route sales total, route expenses, route profit, branch summary.

**Staff (assigned to route):** Only their route customers, sales, expenses. Cannot see other routes or global profit.

**Customer Ledger:** Branch filter, Route filter, Date filter, Staff filter.

### Calculations

- **Route:** Total Sales − Route Expenses = Route Profit
- **Branch:** Sum(Route Sales) − Sum(Route Expenses) = Branch Profit
- **Company:** Sum(All Branches) = Total Company Profit

### Route expense tracking

Per route: Fuel, Staff, Delivery, Misc. Plus route expense report page.

---

## Data Reset Feature

SuperAdmin: **Reset Tenant Data** button.

Deletes: Sales, Customers, Products, Expenses.  
Keeps: Tenant account, Owner user.  
Requires: Confirmation popup with double confirmation.

---

## Features to Remove

- Fake demo requests / marketing data
- Tenant word confusion
- Trial system if not stable
- Duplicate sidebar items
- Emojis in UI
- Too many overlapping tabs

---

## Features to Add

**Core:** Branch management, route management, staff assignment, expense by route, owner-only analytics, role-based visibility.

**Security:** Strict TenantId enforcement, activity log per user, login audit, IP tracking, rate limiting.

**Enterprise:** Feature flags, update rollout control, backup verification, error notification panel.

**Storage tracking:** Tenant storage (MB), DB size, monthly growth, invoice count, API usage.

---

## Pricing Model (Reference)

- Small: 20k–30k AED setup. Medium: 40k–60k AED.
- Monthly: Base 300 AED, 50 per branch, 50 per route, storage tier.

---

## Master Cursor Pro Prompt (Summary)

Use in Cursor to drive analysis and refactor:

1. Generate full backend + frontend tree.
2. Identify: duplicate files, unused services, old OwnerId refs, dead controllers, SQLite refs if PG active, unused SQL, duplicate validation.
3. Refactor to enterprise layers: Core, Application, Infrastructure, API.
4. Enforce multi-tenant security: all queries filter by TenantId; find endpoints missing tenant filter and data leak risks.
5. Analyze controllers: missing validation, error handling, race conditions.
6. Review CSV import and restore: schema enforcement, transaction rollback, failure points.
7. Design Route + Branch: entity structure, Sales entity, reports filtering, indexes.
8. Analyze SuperAdmin: missing features, logs, usage metrics, feature flags, tenant controls.
9. Evaluate performance for 1000 tenants: indexes, N+1, overfetching, pagination.
10. Provide ordered implementation plan: phase-wise, risk-based, with priority levels.

**Do not change UI yet.** Focus on architecture, security, and logic.

---

## Best Strategy

**Do not add:** AI, ML, HuggingFace, LLM, fancy dashboards.

**First:** Fix tenant architecture, add branch–route system, fix CSV import, fix restore, fix permissions, fix mobile UI issues, strengthen SuperAdmin. Then scale.

Operate in phases. Do not try all at once.
