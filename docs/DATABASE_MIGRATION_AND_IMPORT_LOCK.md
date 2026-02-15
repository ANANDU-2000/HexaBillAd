# 🔒 Database Migration & Data Import Lock

**Purpose:** Single source of truth for SQLite→PostgreSQL migration, CSV import, ledger UI, and calculations. No guessing — all implementation must follow this and the full master prompt.  
**Full prompt:** `docs/DATABASE_AND_IMPORT_MASTER_PROMPT.md`  
**Status:** ACTIVE — DO NOT DEVIATE

---

## Rule: Build Only From This and the Master Prompt

When working on:

- **Database:** Migration to PostgreSQL, connection, DateTime UTC, MaxLength, migrations.
- **CSV / file import:** Upload, preview, field mapping, customer auto-create, sales import, duplicate handling.
- **Ledger:** Customer ledger UI, table format, customer list/names, balance display, desktop full width, mobile cards.
- **Calculations:** VAT, profit, totals, decimal precision, report correctness.

Always:

1. Read (or recall) `docs/DATABASE_AND_IMPORT_MASTER_PROMPT.md` and this lock.
2. Implement exactly as specified; do not guess or invent behavior.
3. Validate using the checklist at the end of the master prompt.

---

## Responsible Areas (Who Owns What)

| Feature | Backend | Frontend |
|--------|---------|----------|
| **CSV upload / file import** | Import API (controller + service), CSV parse, field mapping, save to DB | DataImportPage / SalesLedgerImportPage: upload, preview, mapping UI, run import |
| **Ledger (customer)** | Ledger/balance API (customer balance, transactions list) | CustomerLedgerPage: search, customer list, selected customer, table/cards |
| **Ledger (sales/table format)** | Sales/Payments APIs | SalesLedgerPage, BillingHistoryPage: table of sales/invoices |
| **Customer data** | Customers API, tenant isolation | CustomersPage, ledger dropdown, POS customer select |
| **Outside-app files (scraping)** | Not in scope of this lock; see “Compare to outside-app” below | N/A |

---

## Which files are responsible (CSV upload, ledger, customer data)

**CSV / file upload and import**

- **Backend**
  - `backend/HexaBill.Api/Modules/Import/SalesLedgerImportController.cs` — `POST /api/import/sales-ledger/parse` (upload file, return headers + rows), `POST /api/import/sales-ledger/apply` (apply mapped rows).
  - `backend/HexaBill.Api/Modules/Import/SalesLedgerImportService.cs` — `ParseFileAsync` (CSV + Excel), `ApplyImportAsync` (create customers, sales, payments; skip duplicates).
- **Frontend**
  - `frontend/hexabill-ui/src/pages/DataImportPage.jsx` — Hub: links to Backup, Products import, **Import Sales Ledger** (`/import/sales-ledger`).
  - `frontend/hexabill-ui/src/pages/SalesLedgerImportPage.jsx` — Upload file → Parse → Map columns (Invoice No, Customer Name, Payment Type, Date, Net Sales, VAT, etc.) → Apply import; calls `importAPI.parseSalesLedger` and apply API.
- **Product Excel import (separate):** `ExcelImportService.cs`, product import in `ProductsController`; UI: Products page → Import Excel.

**Ledger and table-format ledger**

- **Customer ledger (per-customer balance and transactions)**
  - **Backend:** Customers API, Sales API, Payments API, Reports API (balance/ledger data).
  - **Frontend:** `frontend/hexabill-ui/src/pages/CustomerLedgerPage.jsx` — Search customers, select customer, show ledger table (date, invoice no, debit, credit, balance) and customer name + balance. Fix layout per master prompt (full width, customer name/balance visible).
- **Sales ledger (table of all sales/invoices)**
  - **Backend:** Sales API, Reports API.
  - **Frontend:** `frontend/hexabill-ui/src/pages/SalesLedgerPage.jsx`, `BillingHistoryPage.jsx` — Table of invoices/sales.

**Customer and data display**

- **Backend:** Customers API (CRUD, list, balance); tenant-scoped.
- **Frontend:** `CustomersPage.jsx` (list/edit customers), `CustomerLedgerPage.jsx` (customer + ledger), POS (customer select). Ledger must show customer name and balance; data comes from same APIs.

---

## Compare to scraping / outside-app file system

- **In-app CSV/Excel import (current):** User **uploads** a file (CSV or Excel) from their device. Backend parses it, user maps columns, then we create customers, sales, and payments **inside HexaBill**. Data stays in our DB; ledger and reports use it. No scraping; no reading from another app’s filesystem or server.
- **Outside-app / “scraping” (plan only):** `IMPORT_OUTSIDE_APP_PLAN.md` describes importing from **outside** sources (e.g. PDF reports, HTML tables exported from another system). That would mean: read from PDF/HTML/Excel **exported from the other app**, parse tables, then map and import into HexaBill (same end result: customers, sales, payments). Not yet built; current implementation is **upload only** (user selects file in browser). So:
  - **Same:** Column mapping, create customers/sales/payments, ledger and calculations.
  - **Different:** Source of the file — in-app = user upload; outside-app = could be automated fetch from URL or shared drive + parse (future). Lock and master prompt apply to **in-app upload flow**; outside-app is an extension and must still follow the same data and calculation rules.

---

## Quick Reference

- **Database:** PostgreSQL connection, Npgsql, UTC dates, MaxLength on strings, identity columns.
- **CSV import:** CsvHelper or equivalent; preview → map columns → import; create customers if missing; skip duplicate invoice no.
- **Ledger UI:** Full-width container, visible customer name and balance, table (desktop) + cards (mobile), no overflow hiding content.
- **Calculations:** Round to 2 decimals; VAT 5%; profit = revenue − cost − expenses.

---

**File locations**

- **Full master prompt (migration steps, CSV workflow, ledger fixes, calculations):**  
  `docs/DATABASE_AND_IMPORT_MASTER_PROMPT.md`
- **This lock:**  
  `docs/DATABASE_MIGRATION_AND_IMPORT_LOCK.md`
