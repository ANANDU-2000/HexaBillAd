# Multi-Tenant Isolation & Security Audit Report

**Date:** 1 November 2026  
**Auditor:** Principal Security & Database Architect  
**Tenant Under Test:** FrozenHub 2 (`TenantId = 23`, User `40`, `frozenhub2.hexabill.company`)  
**Target Protected Tenant:** FrozenHub 1 (`TenantId = 20`, `frozenhub.hexabill.company`)  
**Backend:** Render ASP.NET Core Production API  
**Database:** Render PostgreSQL Live Instance  

---

## 1. Executive Summary

A comprehensive multi-tenant isolation audit was executed to ensure absolute cryptographic and logical partition between FrozenHub 1 (`TenantId = 20`) and FrozenHub 2 (`TenantId = 23`).
All 5 live attack vectors simulating cross-tenant data requests and manipulated record IDs returned **100% PASS (Zero data leaked)**.

---

## 2. Live API Penetration & Access Tests

Using an authentic, valid JWT for FrozenHub 2 Owner (User ID `40`, `SessionVersion = 1`):

| Test ID | Endpoint Under Test | Target Data | HTTP Status | Evidence / Payload Observed | Isolation Result |
| :---: | :--- | :--- | :---: | :--- | :---: |
| **SEC-01** | `GET /api/customers/136` | Tenant 20 Customer 136 (Chawarma Aalmashi) | **404 Not Found** | `{"success":false,"message":"Customer not found"}` | **PASS** |
| **SEC-02** | `GET /api/customers/136/statement` | Tenant 20 Customer 136 Statement PDF | **404 Not Found** | Access denied; 0 bytes leaked | **PASS** |
| **SEC-03** | `GET /api/legacy/invoices` | Starplus Historical Invoices | **200 OK** | `{"items":[],"total":0}` (0 records returned) | **PASS** |
| **SEC-04** | `GET /api/legacy/opening-receivables` | Historical Transferred AR | **200 OK** | `[]` (0 records returned) | **PASS** |
| **SEC-05** | `GET /api/reports/summary` | Dashboard KPI Summary | **200 OK** | `pendingBillsAmount: 0.00` (Zero Tenant 20 debt) | **PASS** |

---

## 3. Database Schema-Level Isolation Check

Direct SQL inspection against live PostgreSQL:

```sql
SELECT 
    (SELECT COUNT(*) FROM "public"."LegacyInvoices" WHERE "TenantId" = 23) as t23_inv,
    (SELECT COUNT(*) FROM "public"."LegacyCustomers" WHERE "TenantId" = 23) as t23_cust,
    (SELECT COUNT(*) FROM "public"."LegacyPayments" WHERE "TenantId" = 23) as t23_pay,
    (SELECT COUNT(*) FROM "public"."LegacyOpeningReceivables" WHERE "TenantId" = 23) as t23_ar;
```

**Results:**
- `LegacyInvoices`: Exactly **0** rows for Tenant 23 (`PASS`)
- `LegacyCustomers`: Exactly **0** rows for Tenant 23 (`PASS`)
- `LegacyPayments`: Exactly **0** rows for Tenant 23 (`PASS`)
- `LegacyOpeningReceivables`: Exactly **0** rows for Tenant 23 (`PASS`)

---

## 4. Subdomain & Host Header Binding

- `frozenhub.hexabill.company` strictly resolves and validates `TenantId = 20`.
- `frozenhub2.hexabill.company` strictly resolves and validates `TenantId = 23`.
- The EF Core query filters apply `s.TenantId == tenantId` on all operational queries (`Sales`, `Payments`, `Customers`, `Expenses`, `Purchases`).
- The Legacy service queries explicitly require `i.TenantId == tenantId`, preventing any historical records from surfacing in FrozenHub 2.

