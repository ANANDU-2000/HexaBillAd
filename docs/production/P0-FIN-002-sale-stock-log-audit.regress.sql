-- Regression fixture for P0-FIN-002-sale-stock-log-audit.sql. THROWAWAY DATABASE ONLY.
-- Builds minimal tables in schema audit_regress: two tenants whose sale/purchase ids overlap.
-- Expected: Query 1 returns exactly one row (tenant 1, INV-B, product 10, excess 2 = unreversed edit).
-- Usage: psql -v ON_ERROR_STOP=1 -f this_file  (then the audit file runs with search_path=audit_regress)
DROP SCHEMA IF EXISTS audit_regress CASCADE;
CREATE SCHEMA audit_regress;
SET search_path = audit_regress;
CREATE TABLE "Sales"("Id" int PRIMARY KEY, "TenantId" int, "InvoiceNo" text, "IsDeleted" bool, "IsFinalized" bool);
CREATE TABLE "SaleItems"("Id" serial, "SaleId" int, "ProductId" int, "Qty" numeric, "ConversionAtSale" numeric);
CREATE TABLE "Products"("Id" int PRIMARY KEY, "TenantId" int, "NameEn" text, "StockQty" numeric, "ConversionToBase" numeric);
CREATE TABLE "InventoryTransactions"("Id" serial, "OwnerId" int, "TenantId" int, "ProductId" int, "ChangeQty" numeric,
  "TransactionType" text, "RefId" int, "Reason" text);
INSERT INTO "Products" VALUES (10,1,'T1 prod',96,1),(20,6,'T6 prod',50,1);
-- tenant 1: sale 1 clean; sale 2 edited once with unreversed deduction; sale 3 deleted with linked reversal; sale 4 deleted, legacy NULL RefId
INSERT INTO "Sales" VALUES (1,1,'INV-A',false,true),(2,1,'INV-B',false,true),(3,1,'INV-C',true,true),(4,1,'INV-D',true,true);
INSERT INTO "SaleItems"("SaleId","ProductId","Qty","ConversionAtSale") VALUES (1,10,2,1),(2,10,2,1),(3,10,5,1),(4,10,1,1);
INSERT INTO "InventoryTransactions"("OwnerId","TenantId","ProductId","ChangeQty","TransactionType","RefId","Reason") VALUES
 (1,1,10,-2,'Sale',1,'Sale: INV-A'),
 (1,1,10,-2,'Sale',2,'Sale: INV-B'),(1,1,10,-2,'Sale',2,'Sale Updated: INV-B'),
 (1,1,10,-5,'Sale',3,'Sale: INV-C'),(1,1,10,5,'Adjustment',3,'Sale Deleted/Canceled: INV-C'),
 (1,1,10,-1,'Sale',4,'Sale: INV-D'),(1,1,10,1,'Adjustment',NULL,'Sale Deleted/Canceled: INV-D'),
 -- noise that shares RefIds 1..3 with tenant 1's sales: tenant 6 purchases/adjustments, tenant 1 purchase
 (6,6,20,40,'Purchase',1,'Purchase: P-1'),(6,6,20,10,'Purchase',2,'Purchase: P-2'),
 (6,NULL,20,0,'Adjustment',3,'Manual adjustment'),
 (1,1,10,100,'Purchase',2,'Purchase: P-9');
