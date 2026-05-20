# Tier 2 backlog — implementation order (HexaBill)

Aligned with product backlog:

1. **route P&L** — Reports → **Route** tab (branch comparison, flat route rows).  
2. **Mobile barcode POS** — POS camera button + `html5-qrcode` + USB/type code fallback.  
3. **Recurring purchases** — deferred; see PR sequence below.  
4. **Stock adjustment history** — list UI + `GET /products/stock-adjustments` (implemented).  
5. **Purchase return** — deferred; mirror sale-return transaction patterns.  
6. **Low-stock WhatsApp alerts** — tenant setting + **feature flag (default off)** + background hook; do not ship a half-baked notifier.

## Suggested PR sequence

1. **Stock adjustment history** (done in current wave): read-only `GET`, tenant-scoped, then `StockAdjustmentsHistoryPage` + More link.  
2. **Barcode POS polish**: optional camera permission UX; fallback “type SKU / barcode” search already exists on rows.  
3. **Recurring purchases**: schema for schedule + next run + **feature flag**; background job idempotent per tenant; start with weekly/monthly only.  
4. **Purchase return**: mirror **sale return** patterns—**single transaction** for stock, supplier balance, and GL-facing totals; tenant + role checks on every endpoint.

## API rules (all slices)

- Validate **role** and **TenantId** on every mutating handler.  
- **try/catch**, log without PII/secrets.  
- **Additive migrations** only; new risky behavior behind **feature flags** (default off).
