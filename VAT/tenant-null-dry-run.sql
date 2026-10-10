-- Read-only inventory for a disposable local/staging copy.
-- Do not point this at production. Do not infer a tenant from numeric OwnerId equality.
-- Every row returned by the second query remains UNRESOLVED until an authoritative
-- ownership mapping is reviewed; this script performs no UPDATE/INSERT/DELETE.

SELECT 'Sales' AS table_name, count(*) AS null_tenant_rows
FROM "Sales" WHERE "TenantId" IS NULL
UNION ALL
SELECT 'Purchases', count(*) FROM "Purchases" WHERE "TenantId" IS NULL
UNION ALL
SELECT 'Expenses', count(*) FROM "Expenses" WHERE "TenantId" IS NULL
UNION ALL
SELECT 'SaleReturns', count(*) FROM "SaleReturns" WHERE "TenantId" IS NULL
UNION ALL
SELECT 'PurchaseReturns', count(*) FROM "PurchaseReturns" WHERE "TenantId" IS NULL
ORDER BY table_name;

SELECT 'Sales' AS table_name, "Id"::text AS row_id, "OwnerId"::text AS owner_candidate,
       'UNRESOLVED' AS resolution
FROM "Sales" WHERE "TenantId" IS NULL
UNION ALL
SELECT 'Purchases', "Id"::text, "OwnerId"::text, 'UNRESOLVED'
FROM "Purchases" WHERE "TenantId" IS NULL
UNION ALL
SELECT 'Expenses', "Id"::text, "OwnerId"::text, 'UNRESOLVED'
FROM "Expenses" WHERE "TenantId" IS NULL
UNION ALL
SELECT 'SaleReturns', "Id"::text, "OwnerId"::text, 'UNRESOLVED'
FROM "SaleReturns" WHERE "TenantId" IS NULL
UNION ALL
SELECT 'PurchaseReturns', "Id"::text, "OwnerId"::text, 'UNRESOLVED'
FROM "PurchaseReturns" WHERE "TenantId" IS NULL
ORDER BY table_name, row_id;
