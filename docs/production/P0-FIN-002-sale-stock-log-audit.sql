-- P0-FIN-002 audit: READ-ONLY. Lists sales whose stock-movement log does not net to the current
-- line quantity per product (before the fix every edit added an unreversed "Sale Updated" deduction).
-- Run only inside a read-only transaction against an approved replica/backup; never writes.
-- Optional: set the tenant / invoice filters in the params CTE (NULL = all).
BEGIN TRANSACTION READ ONLY;

WITH params AS (
    SELECT NULL::int AS tenant_id,
           ARRAY['1791254852','1791254857','1791254859']::text[] AS focus_invoices  -- informational flag only
),
lines AS (   -- expected deduction per sale/product, in base units (0 for deleted / non-finalised sales)
    SELECT s."Id" AS sale_id, s."TenantId", s."InvoiceNo", s."IsDeleted", si."ProductId",
           CASE WHEN s."IsDeleted" OR NOT s."IsFinalized" THEN 0
                ELSE SUM(si."Qty" * COALESCE(si."ConversionAtSale", p."ConversionToBase", 1)) END AS expected_base_qty
    FROM "Sales" s
    JOIN "SaleItems" si ON si."SaleId" = s."Id"
    LEFT JOIN "Products" p ON p."Id" = si."ProductId"
    CROSS JOIN params
    WHERE params.tenant_id IS NULL OR s."TenantId" = params.tenant_id
    GROUP BY s."Id", s."TenantId", s."InvoiceNo", s."IsDeleted", s."IsFinalized", si."ProductId"
),
moves AS (   -- movements linked to the sale, scoped to the SAME tenant and to sale-related types only:
             -- create/edit (Sale), edit reversal (Sale, +), linked delete reversal (Adjustment, same invoice).
             -- (RefId alone is not unique: Purchase/Return/other-tenant rows can share the id -> false positives.)
    SELECT s."Id" AS sale_id, it."ProductId",
           SUM(it."ChangeQty") AS net_change,
           SUM(CASE WHEN it."ChangeQty" < 0 THEN -it."ChangeQty" ELSE 0 END) AS gross_deducted,
           COUNT(*) FILTER (WHERE it."Reason" LIKE 'Sale Updated:%') AS edit_rows,
           COUNT(*) AS movement_rows
    FROM "InventoryTransactions" it
    JOIN "Sales" s ON s."Id" = it."RefId"
                  AND s."TenantId" = COALESCE(it."TenantId", it."OwnerId")
    WHERE it."RefId" IS NOT NULL
      AND (it."TransactionType" = 'Sale'
           OR (it."TransactionType" = 'Adjustment'
               AND it."Reason" = 'Sale Deleted/Canceled: ' || s."InvoiceNo"))
    GROUP BY s."Id", it."ProductId"
),
unlinked_delete_reversals AS (  -- pre-d17c362 delete reversals had RefId NULL; match them by reason text
    SELECT s."Id" AS sale_id, it."ProductId", SUM(it."ChangeQty") AS qty
    FROM "InventoryTransactions" it
    JOIN "Sales" s ON s."TenantId" = COALESCE(it."TenantId", it."OwnerId")
                  AND it."TransactionType" = 'Adjustment'
                  AND it."Reason" = 'Sale Deleted/Canceled: ' || s."InvoiceNo"
    WHERE it."RefId" IS NULL
    GROUP BY s."Id", it."ProductId"
)
SELECT l."TenantId", l.sale_id, l."InvoiceNo", l."IsDeleted", l."ProductId",
       l.expected_base_qty,
       -(COALESCE(m.net_change, 0) + COALESCE(u.qty, 0)) AS logged_net_deduction,
       -(COALESCE(m.net_change, 0) + COALESCE(u.qty, 0)) - l.expected_base_qty AS excess_deduction_in_log,
       m.gross_deducted, m.edit_rows, m.movement_rows,
       l."InvoiceNo"::text = ANY((SELECT focus_invoices FROM params)::text[]) AS is_focus_invoice
FROM lines l
LEFT JOIN moves m ON m.sale_id = l.sale_id AND m."ProductId" = l."ProductId"
LEFT JOIN unlinked_delete_reversals u ON u.sale_id = l.sale_id AND u."ProductId" = l."ProductId"
WHERE -(COALESCE(m.net_change, 0) + COALESCE(u.qty, 0)) <> l.expected_base_qty
ORDER BY l."TenantId", l."InvoiceNo", l."ProductId";

-- Per-product drift: StockQty vs the sum of the movement log (should be equal after the fix + any repair).
SELECT p."TenantId", p."Id" AS product_id, p."NameEn", p."StockQty",
       COALESCE(SUM(it."ChangeQty"), 0) AS log_sum,
       p."StockQty" - COALESCE(SUM(it."ChangeQty"), 0) AS drift
FROM "Products" p
LEFT JOIN "InventoryTransactions" it ON it."ProductId" = p."Id" AND it."TenantId" = p."TenantId"
GROUP BY p."TenantId", p."Id", p."NameEn", p."StockQty"
HAVING p."StockQty" <> COALESCE(SUM(it."ChangeQty"), 0)
ORDER BY p."TenantId", p."Id";

ROLLBACK;
