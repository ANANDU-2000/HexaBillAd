# HexaBill — Missing Features & Business Impact List

**Based on ZIP audit, client profile (Vahid/StarPlus, Frozen Magic, Zayoga), and Gulf distributor needs**

---

## TIER 1 — BUILD NOW (direct revenue impact)

### 1. WhatsApp Invoice Share — One Tap
**Status:** `whatsapp.js` utility exists. NOT fully wired in POS flow.  
**What's missing:** A single "Share on WhatsApp" button on invoice confirmation screen.  
**Gulf operator reality:** After billing, they immediately share on WhatsApp with the customer. Currently they download PDF, open WhatsApp, attach. 3 steps → should be 1 tap.  
**Build:**
```jsx
// After invoice created successfully:
<button
  onClick={() => window.open(getWhatsAppShareUrl(invoiceNumber, customerPhone, total), '_blank')}
  className="flex items-center gap-2 h-11 px-4 bg-[#25D366] text-white rounded-lg"
>
  <MessageCircle className="w-5 h-5" />
  Share Invoice
</button>
```
**Effort:** 2-4 hours (utility already exists)

---

### 2. Overdue Customers Report
**Status:** Not built.  
**What's missing:** A filtered view of customers who have unpaid/partial invoices older than X days.  
**Gulf owner reality:** Every morning the owner wants to know: "Who owes me money and for how long?"  
**Build:**
- Backend: `GET /api/reports/overdue?days=30&tenantId=X` → returns customers with overdue balance + last invoice date
- Frontend: Dashboard widget showing count + total overdue amount (click → full list)
- Full page: sorted by days overdue (oldest first) with phone number + WhatsApp quick-dial

**Effort:** 1 day

---

### 3. Cash vs Credit Split on Dashboard
**Status:** Dashboard shows total sales. Doesn't split cash collections from credit.  
**Gulf owner reality:** Cash flow is king. They need to know: "How much actual cash came in today?"  
**Build:**
```jsx
// Two stat cards instead of one "Sales Today"
<StatCard label="Cash Collected" value={cashPaid} icon={Banknote} color="emerald" />
<StatCard label="Credit Given" value={creditSales} icon={CreditCard} color="amber" />
```
Backend already has payment mode (CASH/CREDIT/CHEQUE) — this is a filter on reports endpoint.  
**Effort:** 4-6 hours

---

### 4. Customer Statement PDF
**Status:** Invoice PDF exists. Customer statement (all transactions in a period) does NOT exist.  
**Gulf B2B reality:** Every Gulf business asks their supplier for a monthly statement. Currently: no way to generate this in HexaBill.  
**Build:**
- Backend: new PDF endpoint `/api/customers/{id}/statement?from=&to=`
- Content: company header, customer details, all invoices + payments in period, opening balance, closing balance
- Frontend: "Generate Statement" button on CustomerDetailPage

**Effort:** 1-2 days (reuse existing PDF template infrastructure)

---

### 5. Low Stock Reorder Alert (WhatsApp / In-App)
**Status:** Low stock alerts exist in AlertCheckBackgroundService. Notification is in-app only.  
**Missing:** WhatsApp notification to owner when stock hits reorder level.  
**Build:**
- Add `WhatsAppAlertEnabled` setting to tenant settings
- When alert fires: if WhatsApp enabled, call WhatsApp Business API or wa.me link
- Dashboard widget: "3 products low stock" → clickable → products filtered by low stock

**Effort:** 4-6 hours (alert infrastructure exists)

---

## TIER 2 — BUILD IN 30-60 DAYS (retention features)

### 6. Route Performance Report
**Status:** Route data model exists (Route, RouteCustomer, RouteExpense). No P&L report per route.  
**For:** Frozen Magic, distribution companies with multiple delivery routes  
**Build:**
- Per-route: total sales, total expenses, net margin, top customers
- Route driver efficiency: invoices per route per day
- This turns HexaBill into an operational intelligence tool for distributors

**Effort:** 2 days

---

### 7. Barcode Scanner (Mobile Camera)
**Status:** Product has barcode field. POS search is text-only.  
**Missing:** Camera-based barcode scan on mobile POS  
**Build:**
```jsx
import { Html5QrcodeScanner } from 'html5-qrcode'
// Add scan button in POS product search
// On scan: auto-populate product
```
**Effort:** 1 day (library integration)

---

### 8. Recurring Purchase Entry
**Status:** Recurring Sales invoice exists. Recurring Purchase does NOT.  
**For:** Monthly rent, utility bills, regular supplier payments — all need recurring entry  
**Build:** Mirror `RecurringInvoiceService.cs` pattern for purchases  
**Effort:** 2 days

---

### 9. Inventory Adjustment History
**Status:** `StockAdjustmentService.cs` exists but history view is unclear.  
**Missing:** A clean page showing all stock adjustments with reason, quantity, user, date  
**For:** Auditing inventory discrepancies (critical for food distribution)  
**Effort:** 1 day

---

### 10. Purchase Return
**Status:** Sales return exists. Purchase return does NOT.  
**For:** When goods sent back to supplier — must deduct from stock, create credit with supplier  
**Effort:** 2-3 days (mirror Return flow)

---

## TIER 3 — FUTURE (once 20+ clients)

### 11. Delivery Challan (Non-VAT Invoice)
Print a delivery slip without price — for drivers carrying goods.  
Common requirement in UAE/Gulf distribution.

### 12. Customer Portal (View Their Own Ledger)
Self-service: customers log in, see their invoices and payment history.  
Reduces "what's my balance?" WhatsApp messages.

### 13. Multi-Currency
For businesses transacting in USD + AED.  
Not needed until explicitly requested by current clients.

### 14. Approval Workflow
For purchase orders requiring owner approval before payment.  
Overengineered for current SMB clients — add only if clients request.

---

## AVOID BUILDING (ever)

- AI invoice suggestions / smart predictions
- Built-in P&L / Balance Sheet (Tally does this; HexaBill wins on operations)
- Complex approval chains (too enterprise for this niche)
- Custom report builder (scope creep; build specific reports instead)
- WhatsApp chatbot for customer queries
- Inventory forecasting ML

---

## PAGES THAT NEED UX FIXES (not new features)

| Page | Problem | Fix |
|------|---------|-----|
| SalesLedgerPage | Table broken on mobile | Add card view < 768px |
| PosPage | Quantity buttons too small on mobile | Min 44px touch targets |
| Dashboard | KPI cards too generic | Add Cash/Credit split, Overdue widget |
| CustomersPage | No "overdue" filter | Add overdue filter badge |
| ReportsPage | Report download is slow, no skeleton | Add loading skeleton + progress |
| ProductsPage | Long list no virtualization | Add react-virtual for 100+ products |
| SettingsPage | Everything on one long page | Group into tabs: Company, VAT, Users, Notifications |

---

## SETTINGS PAGE — MISSING SETTINGS

Settings that should exist but may not:
- Default payment mode (Cash/Credit/Cheque) for POS
- Invoice lock after X hours (currently hardcoded 8 hours)
- WhatsApp number for alerts
- Low stock threshold (currently per-product only; need global default)
- VAT number / TRN display on invoices
- Invoice footer custom text
- Allow negative stock toggle (exists in backend, needs UI)
- Currency display format (AED / د.إ / both)

---

## INSTALLATION INSTRUCTIONS

### Place cursor rules files:
```
project root/
  .cursor/
    rules/
      hexabill-production.mdc    ← copy from this output
      hexabill-ui-skill.mdc      ← copy from this output
```

### Update alwaysApply:
- `hexabill-production.mdc`: `alwaysApply: true`
- `hexabill-ui-skill.mdc`: `alwaysApply: false` (apply when on frontend files)

### Use mega prompt:
Copy `HEXABILL_CURSOR_MEGA_PROMPT.md` content.  
Paste into Cursor chat at start of each major task.  
Add your specific task at the bottom.
