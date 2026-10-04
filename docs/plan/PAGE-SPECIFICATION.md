## Tier 0 override — approved 4 October 2026

This section supersedes conflicting historical requirements below. Two independent tenants use frozenhub1.<configured-domain> and frozenhub2.<configured-domain>; preserve owner 1 records and redirect the old host through a verified migration. GulfHarvest is the confirmed client name. Initially copy verified company identity only; future tenant settings changes are independent. Owner 2 opening data requires an explicit setup choice.

Tier 0 uses standard 5% VAT prospectively; margin treatment is deferred. Every rendered invoice/receipt/PDF/print uses CURRENT tenant company settings, including reprints. Issue-time identity remains audit evidence, never a source for the displayed header. Financial snapshots remain immutable. VAT TRN is empty or 15 ASCII digits, non-unique across tenants; corporate-tax TRN is separate and never used as VAT. Empty VAT TRN blocks Tax Invoice finalization/printing, not ordinary work. Owner/admin settings changes must be audited. Only the top document header changes; preserve tables, totals and footer.

Tier 0 gates: full builds/tests including PostgreSQL; two local tenant hosts; seven invoicing journeys with viewport screenshots/network evidence; A4/thermal/Arabic/grayscale headers; backup restore and migration/rollback rehearsal. Deadline: 4 October 2026 12:00 IST, evidence takes precedence. Commit/push current branch after verification; no main or production changes without explicit authorization. Tier 1 resumes only after Tier 0 sign-off. See repository docs/plan/PHASE-TODO.md for the active checklist. Earlier completion/production statements are historical evidence, not current certification.

# HexaBill: page-by-page desktop, tablet and mobile specification
**3 October 2026 · Proposed behavior, not implemented or visually verified.**

[Architecture, accounting, security and delivery plan](C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/HexaBill-Refactor-Plan.md)

## How to use this specification

All entries inherit the main plan's sizing, keyboard, safe-area, accessibility, loading/error, permissions, date/currency, context preservation and document rules. Sizes are token values: desktop controls 36px; touch targets 44–48px; mobile inputs 16px; dense desktop rows 36–40px, mobile record rows 56–72px. Tables show useful rows before decorative charts. A layout must yield to actual viewport space and translated text, never hide a required field to meet a no-scroll slogan.

For each entry verify: authorized empty state → populated state → search/filter → open detail → edit/save or safe cancel → Back → PDF/print if present → denied/offline/timeout. Record screenshots at desktop/tablet/phone widths, role, tenant, commit, date and observed result. Every acceptance statement below is a future release gate.

The source audit enumerated 60 distinct route patterns. Reused components and route aliases are explicitly grouped. Public invitation is a query state; shell/modals/new features are extra requirements beyond that route count. Field lists describe the target workflow, including additions where needed; they are not claims that every field already exists.

## Existing routes and shared entry states

### A01 · Tenant login

**Route:** `/login`  
**Source:** [Login.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/auth/Login.jsx)  
**Observed:** Host-resolved company branding; shared login component also handles invitations.

- **Desktop:** One centered card, maximum 400px, legal/company name, workspace label and address visible. One Sign in primary button; password reveal and recovery secondary.
- **Fields and actions:** Email, password, optional remember-session policy; pending submit prevents duplicates. Enter submits. Preserve safe internal return destination.
- **Mobile:** Single column, 16px input text, 48px Sign in; keyboard never covers validation. No large marketing panel.
- **Tablet:** Same centered card; no unnecessary two-column layout.
- **Errors/edge cases:** Wrong workspace, inactive company, invalid credentials, lockout, offline and API timeout each have plain messages without account enumeration.
- **Acceptance:** An owner can identify the correct workspace, sign in once, and reach their own home; no previous user's branding flashes.

### A02 · Platform login

**Route:** `/Admin26`  
**Source:** [Login.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/auth/Login.jsx)  
**Observed:** Same component with platform mode; tenant/platform redirects are host-aware.

- **Desktop:** Use Admin Portal identity, platform host and same compact sign-in form. Do not display a client logo.
- **Fields and actions:** Email/password; Sign in; clear platform-only help link.
- **Mobile:** Identical accessible form and keyboard behavior to tenant login.
- **Tablet:** Same 400px card.
- **Errors/edge cases:** Tenant credentials cannot become platform credentials through a route change; wrong-host link offers the correct portal.
- **Acceptance:** Platform token cannot access owner data via ordinary tenant endpoints; sign-in error retains email but clears password only by policy.

### A03 · Signup

**Route:** `/signup`  
**Source:** [SignupPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/auth/SignupPage.jsx)  
**Observed:** Public signup route exists; provisioning and domain validation need parity with admin creation.

- **Desktop:** Short, labelled steps with progress: business/contact → workspace → review. Show exact resulting company URL before create.
- **Fields and actions:** Legal/business name, country/currency, contact, email, proposed slug, credentials/invite as existing flow supports; clear required vs optional fields.
- **Mobile:** One step per screen; sticky Continue/Back; keep inputs after validation failure.
- **Tablet:** Same steps with readable two-column fields only when space permits.
- **Errors/edge cases:** Duplicate/reserved slug, stale availability check, timeout after create and email delivery failure; retry must not create a second tenant.
- **Acceptance:** Unique workspace created once in staging; login and subscription/trial states truthful. Do not make a public signup flow copy another company.

### A04 · Invitation acceptance

**Route:** `/login?invite=`  
**Source:** [Login.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/auth/Login.jsx)  
**Observed:** Invitation state is embedded in login; not a separate top-level route.

- **Desktop:** Show verified invited company/workspace and invite validity, then set-password form.
- **Fields and actions:** Password + confirmation, requirements; Set password. Token stays out of logs/referrers.
- **Mobile:** One card with accessible validation; no hidden required input below keyboard.
- **Tablet:** Same card.
- **Errors/edge cases:** Expired/used/wrong-host invite has a clear recovery path; never display raw token.
- **Acceptance:** Invite binds to intended tenant/user, is single-use and cannot set another owner's password.

### A05 · Onboarding

**Route:** `/onboarding`  
**Source:** [OnboardingWizard.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/OnboardingWizard.jsx)  
**Observed:** Separate onboarding wizard exists.

- **Desktop:** Checklist with saved progress: company identity/contact → tax/numbering → opening setup → first transaction. Owner 2 sees locked shared fields and separate contacts.
- **Fields and actions:** Company/Arabic name, TRN/licence references, currency/time zone, phone/address, invoice series; skip optional steps explicitly.
- **Mobile:** Single step with progress and persistent Next; long sections naturally scroll.
- **Tablet:** Two columns for short fields, full-width preview.
- **Errors/edge cases:** Missing legal fields, upload failure, partial setup and wrong role; save step atomically and resume.
- **Acceptance:** Fresh owner understands what is complete; undecided opening data never silently imports records.

### C01 · App shell and navigation

**Route:** `tenant pages; /`  
**Source:** [Layout.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/components/Layout.jsx)  
**Observed:** Existing catalog has many sidebar items, viewport-only page wrappers and separate mobile shell. Root redirects by role.

- **Desktop:** Daily menu and collapsible groups from main plan; 240px sidebar/80px rail, stable toolbar, company/workspace label, command search and notifications. Root / uses verified role.
- **Fields and actions:** Navigation, search, profile, notifications, New sale; shortcuts documented and disable while modal/input owns them.
- **Mobile:** 56px header; Home/Sale/Ledger/More bottom bar; primary action above safe area. Keep shell through loading.
- **Tablet:** 80px labelled/tooltip rail, drawer for full names; landscape counts as tablet by usable space.
- **Errors/edge cases:** Chunk failure/offline/maintenance/expired auth/support read-only use distinct states; no whole-app white fallback.
- **Acceptance:** Back/forward, collapse, orientation, zoom, keyboard and loaded/empty/error pages all keep primary actions reachable.

### C02 · Home dashboard

**Route:** `/dashboard`  
**Source:** [DashboardTally.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/dashboard/DashboardTally.jsx)  
**Observed:** Four-metric dashboard, attention queue and sales chart already exist.

- **Desktop:** One period/branch toolbar, compact KPI row, Needs attention list, quick actions, then optional charts. FrozenHub/GulfHub show operating profit, margin VAT, cash and dues by policy.
- **Fields and actions:** Period preset/from/to, branch, Apply/Refresh; New sale, Record payment, Add expense, Close day; KPI clicks preserve period.
- **Mobile:** Two-column compact metrics; three most urgent items; charts collapsed. Four quick actions maximum before More.
- **Tablet:** Two/four metric columns as space allows; attention stays ahead of charts.
- **Errors/edge cases:** Partial data failure shows failed section and retry, not zero; stale time visible; permissions filter actions.
- **Acceptance:** Each amount links to a matching source report; VAT policy/role/currency and current date boundaries agree.

### C03 · POS / new or edit invoice

**Route:** `/pos`  
**Source:** [PosEnterprisePage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/sales/pos/PosEnterprisePage.jsx)  
**Observed:** PosPage chooses enterprise or legacy implementation by feature flag; keep rollback until parity.

- **Desktop:** Available-height workspace: header/customer and document context; compact keyboard item grid; totals/payment panel. Product picker is searchable side panel, not a new page.
- **Fields and actions:** Customer, invoice date, branch/route, SKU/barcode/name, unit/quantity, price, discount, allowed tax policy; tender, actual received/change, Hold, Save invoice. Edit mode displays posted status and revision rules.
- **Mobile:** Customer header → item list → sticky totals/Checkout. Product picker and payment use full-screen sheets. Camera permission optional; barcode text always available.
- **Tablet:** Grid plus collapsible picker; totals stack when remaining width is insufficient. Hardware keyboard and touch both work.
- **Errors/edge cases:** No stock, price change, invalid quantity/unit, expired role, duplicate submit, save timeout, PDF failure after save; retain cart/draft and check server status.
- **Acceptance:** Scan/add/edit/remove/hold/restore/checkout work at every width; double click/retry posts one invoice and deducts stock once; financial edits are audited.

### C04 · Billing history / invoices

**Route:** `/billing-history`  
**Source:** [BillingHistoryPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/sales/BillingHistoryPage.jsx)  
**Observed:** Invoice list has URL search/date/page, selection and invoice payment-receipt action.

- **Desktop:** List-first invoice grid: number/date/customer/total/paid/due/status/author; sticky header. Primary New sale; row opens preview.
- **Fields and actions:** Search across all invoices; dates, status, branch, sort, page; bulk checkbox and selected count. Preview, Edit if allowed, Receipt, Download, More.
- **Mobile:** Compact invoice rows with number/name, total/due and status; action sheet. Selection mode has a visible exit and scope count.
- **Tablet:** Keep five key columns; lesser details in row drawer.
- **Errors/edge cases:** No eligible receipt, >100 payment history, void/pending cheque, mixed-customer bulk action, export timeout and stale selection; never confuse sale IDs with payment IDs.
- **Acceptance:** Receipt uses actual eligible payments; edit→Back restores exact list; bulk exports show explicit selection/date scope.

### C05 · Sales ledger

**Route:** `/sales-ledger`  
**Source:** [SalesLedgerPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/sales/SalesLedgerPage.jsx)  
**Observed:** Chronological Sale/Return/Payment view with branch/route/staff and amount filters.

- **Desktop:** Ledger-first grid with date/reference/customer/type/debit/credit/running balance, opening and closing balances. Preserve invoice list as separate view.
- **Fields and actions:** From/to, customer/search, type/status, branch/route/staff, due min/max, received min/max, sort, Apply; Export/Print secondary.
- **Mobile:** Transaction rows show signed amount and balance; filters in one sheet with active chips; sticky totals do not obscure last row.
- **Tablet:** Essential columns and expandable details; one contained ledger scroller.
- **Errors/edge cases:** Impossible ranges, no matches, cancelled stale filter requests and unauthorized staff scope; opening balance computed before selected period.
- **Acceptance:** Displayed/exported running balance reconciles; user returns from payment/invoice detail to same position.

### C06 · Customer ledger workspace

**Route:** `/ledger`  
**Source:** [CustomerLedgerPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx)  
**Observed:** Large page with ledger/invoices/payments/reports state and partial URL persistence; existing race guards must be retained.

- **Desktop:** Customer search/master-detail workspace; selected customer header with dues/credit. Default Ledger; one Record payment primary action. Statement and Receipts beside it.
- **Fields and actions:** Customer search, period, branch/route/staff, status/type, Apply, selected invoice allocations, tab and sort; remember the complete context.
- **Mobile:** Search first, then selected customer ledger; four labelled tabs/selector and sticky Record payment. Back to customers restores search.
- **Tablet:** Customer picker drawer instead of permanently squeezing grid.
- **Errors/edge cases:** No selection, cash-customer rules, query race, wrong customer payment, partial response and insufficient permission; keep prior data marked stale during refresh.
- **Acceptance:** Customer A→B fast search cannot show A's rows under B; payment returns to same tab/filter/scroll; all summaries equal posted journals.

### C07 · Customer list

**Route:** `/customers`  
**Source:** [CustomersPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/customers/CustomersPage.jsx)  
**Observed:** All/Active/Outstanding/Overdue/Inactive tabs and customer forms exist.

- **Desktop:** Table-first with name/phone/route/due/credit limit/last activity; primary Add customer, row opens detail or direct Ledger action.
- **Fields and actions:** Server search; status, branch/route, overdue range, page; name required, phone/email, TRN, address/landmark, customer type, terms/credit limit.
- **Mobile:** Two-line rows, visible Due and Ledger/Collect action; secondary edit/activate in sheet.
- **Tablet:** Readable key columns; no five-card KPI stack above list.
- **Errors/edge cases:** Duplicate phone/name warning with explanation, 15-digit TRN validation by country, limit/terms conflict, inactive customer; do not block legitimate same-name customers blindly.
- **Acceptance:** Tabs count all matching records, not current page; create or edit returns to prior search and opens chosen customer.

### C08 · Customer details

**Route:** `/customers/:id`  
**Source:** [CustomerDetailPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/customers/CustomerDetailPage.jsx)  
**Observed:** Current detail offers information, statement PDF and transaction history; avoid a second competing ledger.

- **Desktop:** Header with name/due, primary Record payment, direct Open ledger; sections Details, Location, Pricing, Activity.
- **Fields and actions:** Contacts/address/landmark, tax identity, terms/limit, branch/route, saved pin and permitted customer-specific prices; statement date range.
- **Mobile:** Summary first, accordion sections; one-tap Call/Navigate only when details exist.
- **Tablet:** Two-column information with full-width recent activity.
- **Errors/edge cases:** Unknown/foreign customer, duplicate changes, price effective-date conflict, no pin and failed statement; never replace error with an empty customer.
- **Acceptance:** Ledger and statement use same customer and applied range; Back restores list; location edit is audited.

### C09 · Purchases

**Route:** `/purchases`  
**Source:** [PurchasesPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/purchases/PurchasesPage.jsx)  
**Observed:** Existing ledger/filter and entry UI; create success message tells users to recompute stock if needed.

- **Desktop:** Purchase register first: date/supplier/bill/net/tax/gross/paid/due/status. New purchase opens focused editor. At wide width optional supplier context and totals side panel; not a mandatory 3-column squeeze.
- **Fields and actions:** Supplier search/add, supplier invoice ref/date, branch/received date as applicable, product/unit/qty/cost/discount/tax, payment mode/amount, attachment; Save purchase and Save draft.
- **Mobile:** List rows then full-screen entry; product lines editable in a sheet; sticky actual total and Save. No giant cards before bills.
- **Tablet:** Two-column header, single usable item grid, totals below if needed.
- **Errors/edge cases:** Duplicate supplier ref scoped to tenant/supplier, cost/quantity mismatch, stock update failure, partial API success, file upload error; save transactionally, no manual Recompute Stock success instruction.
- **Acceptance:** Purchase+stock+payable/payment post together once; existing stock agrees immediately; Back retains filters; failed save preserves entered lines.

### C10 · Suppliers

**Route:** `/suppliers`  
**Source:** [SuppliersPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/purchases/SuppliersPage.jsx)  
**Observed:** List has URL search/overdue/page and row open; retain these working behaviors.

- **Desktop:** Dense supplier balances table; name/contact/purchases/paid/due/overdue; primary Add supplier, Pay/Open ledger on row.
- **Fields and actions:** Search name/phone; active/overdue, pagination; supplier name, contact, email, terms, credit limit/address.
- **Mobile:** Compact supplier rows with outstanding balance; swipe-free labelled Pay/Open actions.
- **Tablet:** Prioritize name/due/contact; expand financial detail.
- **Errors/edge cases:** Duplicate names, inactive supplier with balance, failed payment, zero due; avoid deleting history.
- **Acceptance:** Row, keyboard Enter and ledger link open same supplier; back/search/page preserved.

### C11 · Supplier details and ledger

**Route:** `/suppliers/:name`  
**Source:** [SupplierDetailPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/purchases/SupplierDetailPage.jsx)  
**Observed:** Summary/Ledger/Bills/Paid tabs, payments and ledger-credit actions already exist; route uses supplier name.

- **Desktop:** Default Ledger for accounting work, persistent supplier header and Pay supplier primary; summary compact. Move stable navigation to supplier ID with compatibility redirect after uniqueness review.
- **Fields and actions:** Applied period, payment amount/date/mode/reference/note, ledger-credit type/reason, bill links; Statement PDF/CSV use applied filters.
- **Mobile:** Due header + Pay; compact tabs or selector; ledger rows preserve signs and balance.
- **Tablet:** Full ledger, compact summary panel.
- **Errors/edge cases:** Special characters/duplicate supplier names, stale balance, pending cheque, editing/reversing payment, no ledger credit reason.
- **Acceptance:** Date-filtered statement equals grid; legacy name links still work; payment/credit remains distinct and audit-safe.

### C12 · Expenses

**Route:** `/expenses`  
**Source:** [ExpensesPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/expenses/ExpensesPage.jsx)  
**Observed:** Ledger and By category view exist; current search says this page only; VAT category settings are extensive.

- **Desktop:** Ledger takes most width and first screen. Optional 25–30% analytics side panel only on wide monitors. Compact totals and New expense; donut/pie below/alongside after rows.
- **Fields and actions:** Date, category, amount, cash/bank/payment account, branch/route, paid by, description, supplier/tax evidence and receipt; quick presets Petrol/Shop/Food/Supplies; tax options governed by policy.
- **Mobile:** List-first; Add expense sheet with amount/category/payment source early. Analytics collapsed into View breakdown; 44–48px targets.
- **Tablet:** List + expandable analytics; no 40% chart panel crowding entry.
- **Errors/edge cases:** Invalid date/amount, duplicate receipt, unassigned route, locked tax period, missing category, upload failure; save/error state near field.
- **Acceptance:** List, full filtered totals, chart, PDF/CSV and daily cash use same scope. Chart click filters rows; zero data has no meaningless pie.

### C13 · Products and inventory

**Route:** `/products`  
**Source:** [ProductsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/products/ProductsPage.jsx)  
**Observed:** Tabs All/Low Stock/Missing Barcode/Inactive/Stock Movement; imports, categories and stock actions exist.

- **Desktop:** Grid-first SKU/name/unit/stock/cost if allowed/sell price/reorder/status; primary Add product. Search and lightweight filter chips; stock adjustment through one governed flow.
- **Fields and actions:** SKU/barcode, English/Arabic name, base/selling units and conversion, prices, tax category, reorder level/category; import, barcode print and bulk actions secondary.
- **Mobile:** Compact rows with stock and price, expand stock details; Add/Edit in full-screen form, scan optional.
- **Tablet:** Hide lower-priority columns into detail; keep stock and units visible.
- **Errors/edge cases:** Duplicate SKU/barcode, conversion zero, negative price/stock, decimal precision, inactive stock, import partial failures.
- **Acceptance:** Unit labels consistent; buying/selling/returning converted quantities agrees with stock movements; page counts cover server totals.

### C14 · Product details

**Route:** `/products/:id`  
**Source:** [ProductDetailPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/products/ProductDetailPage.jsx)  
**Observed:** Product info and recent stock movements exist.

- **Desktop:** Summary and editable details above movement ledger; primary Edit or Adjust stock by role; costs permissioned.
- **Fields and actions:** Names/SKU/barcode, units/conversion, prices/reorder/category; movement date/type/reference with before/after quantity.
- **Mobile:** Price/stock header, compact detail sections and movement rows; no offscreen action icons.
- **Tablet:** Two-column details, full movement list.
- **Errors/edge cases:** Concurrency conflict, product deactivated while editing, policy prevents destructive unit changes after transactions.
- **Acceptance:** Changing current cost leaves historical COGS unchanged; Back returns to exact product list state.

### C15 · Price list

**Route:** `/pricelist`  
**Source:** [PriceList.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/products/PriceList.jsx)  
**Observed:** Current price-list screen exists with search and printing.

- **Desktop:** Price table and price-effective date; customer tier selector where supported; primary Export/Print, edit separately permissioned.
- **Fields and actions:** Search product/SKU, category, unit/customer tier, active state; number of selected rows visible.
- **Mobile:** Two-line product + price/unit; Preview/download first, no horizontally squeezed grid.
- **Tablet:** Table with quantity unit always visible.
- **Errors/edge cases:** Stale price, absent customer price, zero/inactive product, export failure; do not label base-unit price as carton price.
- **Acceptance:** Export includes exact policy/currency/date/customer scope and no hidden cost for drivers or unauthorized staff.

### C16 · Stock adjustment history

**Route:** `/stock-adjustments`  
**Source:** [StockAdjustmentsHistoryPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/inventory/StockAdjustmentsHistoryPage.jsx)  
**Observed:** Existing route shows historical adjustments.

- **Desktop:** Read-only movement audit first; New adjustment opens same controlled stock form used by product detail.
- **Fields and actions:** Product, reason/type, branch, date, quantity in explicit unit, note and attachment; before/after stock.
- **Mobile:** History rows with product/delta/reason; adjustment full-screen sheet, clear sign.
- **Tablet:** Grid with expandable note/actor.
- **Errors/edge cases:** Negative result, invalid unit, stale stock, permission denied and duplicate post; require reason, not vague generic confirmation.
- **Acceptance:** Adjustment posts once and reconciles stock; posted adjustments reverse with linkage rather than disappear.

### C17 · Sales return

**Route:** `/returns/create`  
**Source:** [ReturnCreatePage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/returns/ReturnCreatePage.jsx)  
**Observed:** Invoice-linked return with resellable/damaged/write-off categories exists.

- **Desktop:** Invoice lookup/header, eligible line quantities and disposition grid; totals and refund/credit decision. Primary Review return, then Post.
- **Fields and actions:** Invoice, date/reason, quantities limited to net sold/not already returned, condition, credit/refund method and category.
- **Mobile:** Select invoice → select items → quantities/condition → review; sticky total and Next.
- **Tablet:** Grid where space allows; review panel below.
- **Errors/edge cases:** Missing invoice link gets search, excessive quantity, duplicate return, locked period, stock disposition and refund failure.
- **Acceptance:** Return adjusts revenue/tax/AR/payment and inventory exactly once according to policy; no duplicate stock restoration.

### C18 · Delivery note list

**Route:** `/delivery-notes`  
**Source:** [DeliveryNotesPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/sales/DeliveryNotesPage.jsx)  
**Observed:** Existing invoice-backed delivery-note list.

- **Desktop:** Date/customer/note/invoice/route/status table; Open or Print. Link dispatch assignment where enabled.
- **Fields and actions:** Search, dates, branch/route/status, selection; no duplicate sale creation action.
- **Mobile:** Stop/customer rows, Open note and Navigate when pin exists.
- **Tablet:** Table with expandable route/status.
- **Errors/edge cases:** Missing sale, invalid document permission, print failure, unassigned driver.
- **Acceptance:** Delivery note references the correct persisted sale; driver sees only assigned deliveries, without unneeded prices/costs.

### C19 · Delivery note view

**Route:** `/delivery-notes/:saleId`  
**Source:** [DeliveryNoteViewPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/sales/DeliveryNoteViewPage.jsx)  
**Observed:** Packing-list style detail exists.

- **Desktop:** Compact document preview with Print/Download; order reference, recipient, items/units, delivery notes and optional signature/proof.
- **Fields and actions:** Read-only quantities from invoice; delivered/failed belongs to delivery workflow with audit.
- **Mobile:** Readable stacked items and persistent document actions; no forced desktop page-width canvas.
- **Tablet:** Preview fits, zoom available.
- **Errors/edge cases:** Foreign sale, no document, PDF error and failed proof upload.
- **Acceptance:** One saleId maps to the correct note; print/download identical; delivery event never silently alters invoice quantities.

### D01 · Quotations

**Route:** `/quotations`  
**Source:** [QuotationsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/documents/QuotationsPage.jsx)  
**Observed:** List and editor exist; separate document feature gate.

- **Desktop:** Customer/number/date/validity/amount/status rows; primary New quotation; open row.
- **Fields and actions:** Search/date/status, preview/download/duplicate; conversion to sale only if explicitly supported and confirmed.
- **Mobile:** Compact document list and labelled action sheet.
- **Tablet:** Table with essential columns.
- **Errors/edge cases:** Feature unavailable, stale draft, duplicate number, download failure.
- **Acceptance:** List scope is tenant-bound; opening a quote cannot post a sale or stock movement.

### D02 · Quotation editor

**Route:** `/quotations/new; /quotations/:id`  
**Source:** [QuotationEditorPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/documents/QuotationEditorPage.jsx)  
**Observed:** New and edit share one editor.

- **Desktop:** Header/contact/validity plus line grid and letter/terms area; primary Save quotation, Preview/Download secondary.
- **Fields and actions:** Customer/recipient, date/valid until, reference/subject, items/units/qty/prices/discount/tax, notes/terms and branding snapshot.
- **Mobile:** Header section then item sheet, terms collapsed; sticky Save draft with unsaved-state label.
- **Tablet:** Two-column header, item grid and totals below.
- **Errors/edge cases:** Expired validity, unsupported currency/tax, missing recipient, unsaved changes and failed generation.
- **Acceptance:** Saved quote reopens consistently; edit/version history and shared legal/private contact behavior verified.

### D03 · Agreements

**Route:** `/agreements`  
**Source:** [AgreementsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/documents/AgreementsPage.jsx)  
**Observed:** List/editor routes exist.

- **Desktop:** Agreement number/parties/date/status rows; primary New agreement; Preview/Download.
- **Fields and actions:** Search, dates/status, permitted duplicate/archive actions.
- **Mobile:** Readable title/party/date rows; same action labels as quotation list.
- **Tablet:** Compact table.
- **Errors/edge cases:** Missing party, no permission, outdated version, PDF error.
- **Acceptance:** Open/edit/back preserves context; agreement state does not imply it was legally signed.

### D04 · Agreement editor

**Route:** `/agreements/new; /agreements/:id`  
**Source:** [AgreementEditorPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/documents/AgreementEditorPage.jsx)  
**Observed:** Editable agreement document uses existing tenant letter identity.

- **Desktop:** Party and date fields, terms editor, preview panel only on wide desktop. Save draft primary.
- **Fields and actions:** Parties, subject/reference, effective date/term, clauses, signer labels, attachment/branding where supported.
- **Mobile:** One section per screen, explicit preview; large text editor scrolls naturally.
- **Tablet:** Editor first, preview toggle rather than cramped split.
- **Errors/edge cases:** Unsaved text, empty mandatory clause/party, script/HTML injection, failed upload/generation.
- **Acceptance:** Unicode/RTL clauses render safely and paginate correctly; no accidental submission/signing.

### D05 · Salary certificates

**Route:** `/salary-certificates`  
**Source:** [SalaryCertificatesPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/documents/SalaryCertificatesPage.jsx)  
**Observed:** Existing HR-sensitive document list.

- **Desktop:** Restricted-role list with employee/reference/date/status; primary New certificate. No exposure in ordinary driver menu.
- **Fields and actions:** Search/date filters; preview/download with audit.
- **Mobile:** Minimal rows; sensitive salary not exposed in collapsed previews unnecessarily.
- **Tablet:** Table with restricted columns.
- **Errors/edge cases:** Unauthorized direct link/download, missing record and PDF error.
- **Acceptance:** Only authorized tenant roles can see certificate data; downloads scoped and audited.

### D06 · Salary certificate editor

**Route:** `/salary-certificates/new; /salary-certificates/:id`  
**Source:** [SalaryCertificateEditorPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/documents/SalaryCertificateEditorPage.jsx)  
**Observed:** Shared create/edit certificate editor exists.

- **Desktop:** Employee/employment details, salary breakdown and addressee; Save draft primary, Preview secondary.
- **Fields and actions:** Employee name, designation/identifier only if required, join date, salary components/currency, recipient/purpose, issue date and signer.
- **Mobile:** Single column with amount inputs; sectioned long fields; sticky Save.
- **Tablet:** Two-column short fields; full-width declaration.
- **Errors/edge cases:** Salary totals inconsistent, invalid dates, missing signer, unauthorized access and generation failure.
- **Acceptance:** Amount in words and numeric total agree; no HR data enters general AI or platform logs without scoped authorization.

### O01 · Branches and routes list

**Route:** `/branches; /routes`  
**Source:** [BranchesPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/branches/BranchesPage.jsx)  
**Observed:** Branches/Routes are tabs; RoutesPage delegates to this existing surface.

- **Desktop:** Compact branch/route list with name/manager/staff/customers/status. Primary Add branch or Add route matches selected tab.
- **Fields and actions:** Search, active state, branch filter on route tab; name, contact/location and assignments.
- **Mobile:** List-first with labelled tabs; create/edit full-screen form.
- **Tablet:** Two-column list summaries only if useful.
- **Errors/edge cases:** Duplicate names within intended scope, inactive assignments, deleting branch with history and owner-only access.
- **Acceptance:** Both deep links select correct tab; route counts/assignments consistent and staff do not gain full owner access.

### O02 · Branch details

**Route:** `/branches/:id`  
**Source:** [BranchDetailPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/branches/BranchDetailPage.jsx)  
**Observed:** Tabs Overview, Routes, Staff, Customers, Expenses, Performance, Report.

- **Desktop:** Branch header and compact totals; related tables per tab. Actions specific to selected tab, not repeated add/edit buttons everywhere.
- **Fields and actions:** Date/period; route/customer/staff search and assignment; branch expense fields; export applied branch report.
- **Mobile:** Header then compact tab selector; row list per tab; no seven-tab overflow with hidden active tab.
- **Tablet:** Scrollable tab strip with visible active target and table body.
- **Errors/edge cases:** Foreign assignments, reassignment with active delivery, inconsistent date range, failed summary while list succeeds.
- **Acceptance:** Every tab uses current branch and permitted period; staff/customer assignments update counts and preserve return context.

### O03 · Route details

**Route:** `/routes/:id`  
**Source:** [RouteDetailPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/branches/RouteDetailPage.jsx)  
**Observed:** Tabs Overview, Customers, Sales, Expenses, Staff, Performance and feature-gated Stops map.

- **Desktop:** Route header, selected day, list-first stops/customer sequence. Map toggle/secondary panel; collection sheet and staff assignment remain accessible.
- **Fields and actions:** Date, branch/route staff, stop order, visit status/notes, payment-collected action, saved pin/arrival GPS; Navigate and Assign driver.
- **Mobile:** Owner compact tabs; driver uses separate Today workspace. Map has list toggle and never consumes the entire form by default.
- **Tablet:** Map/list split only with sufficient width.
- **Errors/edge cases:** No pin/permission, inaccurate GPS, stale/offline location, foreign route, duplicate collection and failed visit save.
- **Acceptance:** Saved shop pin and visit/driver location have distinct labels/timestamps; collection creates one real payment and receipt.

### R01 · Reports and outstanding shortcut

**Route:** `/reports; /reports/outstanding`  
**Source:** [ReportsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/reports/ReportsPage.jsx)  
**Observed:** 21 report tabs in five groups; outstanding uses same page.

- **Desktop:** Report catalog/selector left, one report body, shared period/filter toolbar, compact summary and table before chart. Avoid 21 equal tabs spanning the screen.
- **Fields and actions:** Report type, period, branch/route/customer/product/staff as applicable; Apply, Export PDF/CSV, Print; saved view keeps scope.
- **Mobile:** Searchable report selector; filters sheet; two summary metrics then rows, chart on demand.
- **Tablet:** Grouped dropdown or vertical list; one visible report.
- **Errors/edge cases:** Unsupported filter/report combination, partial response, stale export job, permission failure; no cached previous report under a new heading.
- **Acceptance:** All 21 tab-specific contracts below pass; /reports/outstanding opens correct report and Back retains filters.

### R02 · VAT workspace

**Route:** `/vat-return`  
**Source:** [VatReturnPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/reports/VatReturnPage.jsx)  
**Observed:** ProfitBased presentation and standard FTA tabs already exist, but current backend basis is not the approved scheme.

- **Desktop:** Policy badge and effective period; margin clients show Summary/Margin calculation/Exceptions/History with amount-first view; standard client retains standard tabs. Filing view permissioned.
- **Fields and actions:** Period, status, validation exclusions, evidence and export; preview/lock/file actions have distinct meanings and owner/accountant role gates.
- **Mobile:** Period and payable/credit amount first; compact selector; transaction details as drill-down, never a huge wide form.
- **Tablet:** Two-column summaries with full-width exceptions.
- **Errors/edge cases:** Unknown policy, missing cost/eligibility evidence, locked period, stale change, negative margin and failed export; block only dependent filing action.
- **Acceptance:** Approved fixtures, effective dates, invoice/return mapping and unchanged Zayogya pass; no 5%-of-net-operating-profit shortcut.

### R03 · Owner worksheet

**Route:** `/worksheet`  
**Source:** [WorksheetPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/reports/WorksheetPage.jsx)  
**Observed:** Owner-only period totals worksheet exists.

- **Desktop:** Rename visible purpose to Cash & capital if adopted; reconcile cash/bank/receivables/inventory/payables/capital with drill-down and Daily close link.
- **Fields and actions:** Week/month/year/custom period, opening-as-of date, included accounts; Export statement. Adjustment through governed journal, not editable summary cell.
- **Mobile:** Short summary then expandable component rows; Close day prominent.
- **Tablet:** Two columns of totals then reconciliation table.
- **Errors/edge cases:** Missing opening balances or inventory cost marks estimate/incomplete, not fabricated balance.
- **Acceptance:** Capital bridge agrees with source journals; profit is not labelled cash available.

### S01 · Company settings

**Route:** `/settings`  
**Source:** [SettingsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/features/settings/SettingsPage.jsx)  
**Observed:** Company/Billing/Email/Notifications/Backup tabs; Backup duplicates a dedicated page surface.

- **Desktop:** Settings index plus one form at a time; sticky Save section. Shared legal fields show source and restricted edit; separate owner contact/bank defaults.
- **Fields and actions:** Detailed tab contracts below. Dirty state scoped to each section; save only that section.
- **Mobile:** Section selector and one-column forms; save stays above keyboard; preview opens separately.
- **Tablet:** Two-column form where safe.
- **Errors/edge cases:** Upload/config save failure, stale revision, invalid TRN/currency, forbidden shared-identity edit; secret fields are write-only/masked.
- **Acceptance:** Changing contact updates future document identity policy without changing old snapshots; Backup link reaches canonical page.

### S02 · Users and staff

**Route:** `/users`  
**Source:** [UsersPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/company/UsersPage.jsx)  
**Observed:** Role, dashboard-card and page-access settings exist.

- **Desktop:** Name/login/role/branch/routes/status/last activity table; primary Invite staff. Use role presets plus advanced capability editor, not a wall of colored toggles.
- **Fields and actions:** Name, email/phone, role, branch/routes, page/capability permissions, language; Driver preset with assigned-route scope.
- **Mobile:** Compact list; invitation wizard: person → role/assignments → review.
- **Tablet:** Permission groups with summary count, touch-size toggles.
- **Errors/edge cases:** Last owner removal, invalid assignment, duplicate invite, revoked session, stale permission and denied role escalation.
- **Acceptance:** Menu, deep links and API agree; disabled staff tokens lose access according to session policy; owner 2 cannot manage owner 1's staff.

### S03 · Profile

**Route:** `/profile`  
**Source:** [ProfilePage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/company/ProfilePage.jsx)  
**Observed:** Language choices currently English/Arabic; Malayalam must be added with real translations.

- **Desktop:** Personal details and language preferences; security/password handled by existing secure flow; no accidental company-wide setting changes.
- **Fields and actions:** Name/contact, English/Arabic/Malayalam preference, time display preference if supported, password change with current-password policy.
- **Mobile:** Single column; clear save scope 'My profile'.
- **Tablet:** Compact two sections.
- **Errors/edge cases:** Invalid contact, stale profile, reauthentication and password failure; no raw credential logging.
- **Acceptance:** Language affects assistant/UI where translated; unsupported content has a clear fallback, not misleading full-localization claim.

### S04 · Activity log

**Route:** `/audit`  
**Source:** [AuditLogPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/company/AuditLogPage.jsx)  
**Observed:** Tenant audit table and detail UI already exist; historical notes say recovery unavailable.

- **Desktop:** Date/user/action/entity/result summary table; detail drawer for redacted before/after and correlation ID.
- **Fields and actions:** Search, action, actor, date, Refresh; export only if role-approved.
- **Mobile:** Readable activity rows with entity and outcome; detail full-screen.
- **Tablet:** Table with expandable technical detail.
- **Errors/edge cases:** Sensitive values redacted, deleted referenced entity, missing old format and unauthorized user.
- **Acceptance:** Money/stock/settings/support actions traceable; no unsupported 'restore' button promises recovery.

### S05 · Backup and restore

**Route:** `/backup`  
**Source:** [BackupPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/company/BackupPage.jsx)  
**Observed:** New local Windows backup agent UI exists; unsupported icons prevent latest build.

- **Desktop:** Status/source/destination/last verified backup first; history table; Backup now and Restore are clearly distinct. Setup/pair PC in separate section.
- **Fields and actions:** Schedule/time zone/retention, device pairing/revoke, backup detail/download and restore target with explicit review.
- **Mobile:** History compact; PC setup explains desktop requirement; never asks phone users for a local Windows folder.
- **Tablet:** Cards only for device/status; history remains rows.
- **Errors/edge cases:** Device offline, storage full, stale key, checksum mismatch, incomplete backup and foreign tenant file; failed backup cannot show complete.
- **Acceptance:** Tenant isolation, restore rehearsal, checksums and retention verified in staging; never restore production as a UI audit test.

### S06 · More

**Route:** `/more`  
**Source:** [MorePage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/company/MorePage.jsx)  
**Observed:** Reads shared navigation catalog; filters sidebar/bottom-nav duplicates.

- **Desktop:** Only secondary destinations not already visible; search and grouping. Prefer short list to tile wall.
- **Fields and actions:** Search tools, navigation and pin/unpin preferences scoped to user.
- **Mobile:** Labelled menu for remaining actions; no repeated Home/Sale/Ledger links.
- **Tablet:** Same catalog used by drawer/rail.
- **Errors/edge cases:** Permission/flag changed while open: unavailable action disappears with explanation if already selected.
- **Acceptance:** All visible links work; no duplicate destination in same navigation surface.

### S07 · Help and support

**Route:** `/help`  
**Source:** [HelpPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/HelpPage.jsx)  
**Observed:** Getting started, FAQs, tips, contact support and quick links sections exist.

- **Desktop:** Task-based help with search and current-page context; short steps and links to real destinations.
- **Fields and actions:** Search topic, select language; contact/support action displays what context will be sent.
- **Mobile:** Accordion topics, large links; don't force long sidebar navigation.
- **Tablet:** Optional contents rail.
- **Errors/edge cases:** Offline help fallback; missing feature linked nowhere; no fabricated support status.
- **Acceptance:** New owner can find invoice, ledger, collect, close and restore instructions; language and role match available features.

### S08 · Feedback

**Route:** `/feedback`  
**Source:** [FeedbackPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/FeedbackPage.jsx)  
**Observed:** General/Bug/Feature/Praise categories exist.

- **Desktop:** Simple form with category, description and optional sanitized diagnostic reference; Submit primary.
- **Fields and actions:** Type, description, optional contact/attachment and explicit included-data summary.
- **Mobile:** Single form; screenshot optional, privacy preview before sending.
- **Tablet:** Compact form.
- **Errors/edge cases:** Offline/duplicate submit/upload failure; retain draft and show submitted ID only on success.
- **Acceptance:** Submitting does not expose invoices/keys automatically; no support message is sent by this audit.

### S09 · Not found, access and connection states

**Route:** `*`  
**Source:** [ErrorPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/pages/ErrorPage.jsx)  
**Observed:** Catch-all ErrorPage plus ErrorBoundary/ConnectionStatus/Maintenance components exist.

- **Desktop:** Stay in appropriate shell; specific title, plain explanation, Retry/Back/Home and reference ID. Unknown route differs from unauthorized record.
- **Fields and actions:** No sensitive stack traces; Retry only appropriate operation, Copy reference.
- **Mobile:** Same shell and bottom navigation when safe; keyboard focus moved to message.
- **Tablet:** Same.
- **Errors/edge cases:** 404/403/401/429/5xx/offline/chunk failure/maintenance/stale session independently handled.
- **Acceptance:** User can recover without losing a saved draft; failed write status is checked before retry.

### S10 · Disabled recurring-invoice route

**Route:** `/recurring-invoices`  
**Source:** [App.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/app/App.jsx)  
**Observed:** Currently redirects to dashboard although a RecurringInvoicesPage file exists.

- **Desktop:** Keep hidden until product decision; old link explains unavailable feature or redirects with clear context.
- **Fields and actions:** No active recurring creation button while scheduler is disabled/unverified.
- **Mobile:** Same intentional unavailable state.
- **Tablet:** Same.
- **Errors/edge cases:** Do not accidentally reactivate scheduled billing while changing navigation.
- **Acceptance:** Old links do not crash; no recurring invoice is generated by refactor or feature migration.

### P01 · Platform overview

**Route:** `/superadmin/dashboard`  
**Source:** [SuperAdminDashboard.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminDashboard.jsx)  
**Observed:** Company/subscription/health indicators exist; diagnostics percentages require correction.

- **Desktop:** Actual company/workspace list and urgent incidents first; compact platform subscription metrics distinct from client sales; deployments and data freshness.
- **Fields and actions:** Period, environment, company status; open company, error, health, AI usage; Refresh.
- **Mobile:** Four truthful summary tiles maximum, priority incident list, company search.
- **Tablet:** Two-column operations summaries.
- **Errors/edge cases:** Telemetry unavailable/stale/permission denied is explicit, not green/zero; no fabricated active users.
- **Acceptance:** Every count has a definition/source/window and drill-down; FrozenHub owners distinguishable despite same legal name.

### P02 · Companies / tenants

**Route:** `/superadmin/tenants`  
**Source:** [SuperAdminTenantsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminTenantsPage.jsx)  
**Observed:** Companies table/create modal already includes slug validation and login URL.

- **Desktop:** Name/workspace/slug/owner/status/plan/usage/last activity/alerts table; primary Create company, related Add owner workspace.
- **Fields and actions:** Search legal name/slug/owner; country/status/plan; create/edit identity, contacts, tax policy and numbering; review step.
- **Mobile:** Company rows show workspace and status; detail form is full-screen.
- **Tablet:** Essential table columns with detail drawer.
- **Errors/edge cases:** Duplicate slug, shared TRN mistaken for duplicate tenant, provisioning timeout and failed invite.
- **Acceptance:** Three client groups/four workspace records distinguished; tenant 2 has unique ID/contacts/data and preserved shared identity.

### P03 · Company detail

**Route:** `/superadmin/tenants/:id`  
**Source:** [SuperAdminTenantDetailPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminTenantDetailPage.jsx)  
**Observed:** Nine tabs: overview/users/invoices/payments/subscription/usage/limits/features/reports.

- **Desktop:** Persistent real legal name + workspace + slug; summary and typed config. Support session action requires reason, shows read-only scope and expiry.
- **Fields and actions:** Identity/contacts, policy/effective date, entitlement/quota, status/subscription, assignments; tab-specific contracts below.
- **Mobile:** Header then compact section selector; dangerous operations separated into Advanced.
- **Tablet:** Summary and details split, tables full width.
- **Errors/edge cases:** Wrong company context, stale limits, unsupported feature dependency, failed support session and unverified revenue sources.
- **Acceptance:** Platform metadata access is separate from financial record access; every flag/limit/status edit audited and server enforced.

### P04 · Demo requests

**Route:** `/superadmin/demo-requests`  
**Source:** [SuperAdminDemoRequestsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminDemoRequestsPage.jsx)  
**Observed:** Contact/request table with status controls exists.

- **Desktop:** Company/contact/country/requested date/status rows; right detail panel and explicit status action.
- **Fields and actions:** Search/status/period; assign/update status; contact links deliberate.
- **Mobile:** Compact request list with status; no auto-contact behavior.
- **Tablet:** Table and detail drawer.
- **Errors/edge cases:** Duplicate leads, stale status, failed update, privacy-limited export.
- **Acceptance:** Status saves once; no email/WhatsApp is sent without operator action.

### P05 · Infrastructure

**Route:** `/superadmin/health`  
**Source:** [SuperAdminHealthPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminHealthPage.jsx)  
**Observed:** DB/migrations/company count and last check exist; expand through measured sources.

- **Desktop:** Separate Frontend, API, Database, Storage, Jobs sections; deployed SHA, last success, measurements, freshness and read-only links.
- **Fields and actions:** Environment/service/time range; Refresh; error trace drill-down; guarded operational actions in separate flow.
- **Mobile:** Status list and critical details; charts optional; no tiny engineering graphs needed to identify an outage.
- **Tablet:** Two-column service panels.
- **Errors/edge cases:** Connector missing, 403, timeout, stale sample, migration mismatch and partial outage.
- **Acceptance:** No hardcoded plan limit used as fact; managed heap is not container utilization; live backend SHA and data source visible.

### P06 · Error logs

**Route:** `/superadmin/error-logs`  
**Source:** [SuperAdminErrorLogsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminErrorLogsPage.jsx)  
**Observed:** Error list with filters exists.

- **Desktop:** Group by fingerprint with count/severity/first-last seen/company/route/version; expandable sanitized trace; Acknowledge/Resolve with actor.
- **Fields and actions:** Company name+ID, severity/status/date/environment/correlation ID/search; Refresh/export.
- **Mobile:** Incident rows, detail sheet, Copy reference.
- **Tablet:** Table plus detail drawer.
- **Errors/edge cases:** Redaction, missing tenant, stale status, repeated error storms and restricted trace access.
- **Acceptance:** Client sees actionable message while platform can correlate; acknowledge does not delete evidence or hide recurrence.

### P07 · Platform audit logs

**Route:** `/superadmin/audit-logs`  
**Source:** [SuperAdminAuditLogsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminAuditLogsPage.jsx)  
**Observed:** Action/actor/date audit list exists.

- **Desktop:** Actor/company/workspace/action/resource/outcome/time; detail redacted before/after and support-session link.
- **Fields and actions:** Date/company/actor/action/result/search; bounded export.
- **Mobile:** Readable chronological records and filter sheet.
- **Tablet:** Table with detail.
- **Errors/edge cases:** Legacy action names, missing entity, redacted secret and permission denied.
- **Acceptance:** Create tenant, feature/tax changes, support access and production actions have immutable audit records.

### P08 · Platform settings

**Route:** `/superadmin/settings`  
**Source:** [SuperAdminSettingsPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminSettingsPage.jsx)  
**Observed:** Defaults/Features/Communication/Announcement/Security/Links tabs exist.

- **Desktop:** Section navigation and Save section; add Providers/AI policy under privileged configuration or proposed AI usage route.
- **Fields and actions:** Defaults, entitlements, communication templates, maintenance announcement, session/security settings, support links; masked provider secret references.
- **Mobile:** One section at a time; dangerous changes have preview of affected tenants.
- **Tablet:** Two columns for short safe settings.
- **Errors/edge cases:** Misconfigured default changes existing tenants unexpectedly, invalid link/template, secret exposure and partial save.
- **Acceptance:** Defaults affect new entities only unless explicitly migrated; global changes show scope and rollback before save.

### P09 · Global search

**Route:** `/superadmin/search`  
**Source:** [SuperAdminGlobalSearchPage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminGlobalSearchPage.jsx)  
**Observed:** Global company/user search exists.

- **Desktop:** Search-first page with categorized results, workspace/slug visible; metadata scope by default.
- **Fields and actions:** Query, entity type/status; clear search; internal open links only.
- **Mobile:** Single search box and grouped compact rows.
- **Tablet:** Same.
- **Errors/edge cases:** Empty/min query, denied results, stale response and overly broad result leakage.
- **Acceptance:** Same-name FrozenHub workspaces distinguishable; financial/prompt content requires explicit support permission, not global search.

### P10 · SQL console

**Route:** `/superadmin/sql-console`  
**Source:** [SuperAdminSqlConsolePage.jsx](C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp/frontend/hexabill-ui/src/platform/SuperAdminSqlConsolePage.jsx)  
**Observed:** Advanced SQL console route exists.

- **Desktop:** Move under Advanced diagnostics; saved read-only queries preferred, purpose/audit, result cap/time limit and explicit database/environment identity.
- **Fields and actions:** Approved query/template, bounded parameters, Run read-only, Cancel, result export with permission.
- **Mobile:** Read-only status/results preferred; no accidental wide editor execution on small screen.
- **Tablet:** Editor/result vertical split.
- **Errors/edge cases:** DDL/DML/multi-statement or unauthorized objects rejected server-side; timeout and cancellation reported.
- **Acceptance:** Database role enforces read-only beyond UI string checks; no AI/provider can call arbitrary SQL.

## Tab-by-tab contracts

Each row inherits its page's separate mobile/tablet behavior. On phones use a labelled selector when a tab strip would hide the active tab. Keep tab and applied filters in the URL; restore them on Back. Do not request a new report on each unrelated input keystroke.

### Customer ledger: 4 views

| View | Desktop content/actions | Phone content/actions | Correctness gate |
|---|---|---|---|
| Ledger | Chronological debit/credit/running balance; opening balance; statement/export | Date/reference/amount/balance rows; tap for detail | Opening + movements = closing; advance and due signs clear |
| Invoices | Number/date/net-tax-total/paid/due/status; select eligible bills; Pay selected | Invoice rows with due; selection bar | Allocation never exceeds allowed outstanding; no accidental all-page selection |
| Payments | Date/mode/received/allocated/unallocated/status; receipt and reversal | Payment rows; Preview receipt/Download | Pending/void/bounced states cannot masquerade as cash received |
| Reports | Customer-only summaries/statement/aging | Summary then drill-down, no duplicate global Reports maze | Period/customer match selected context and exports |

### Products: 5 views

| View | Purpose/actions | Mobile form | Gate |
|---|---|---|---|
| All products | Full searchable register; Add/Edit | Compact product rows | Counts/search are server-wide |
| Low stock | Shortage/threshold; open reorder context | Stock vs reorder visible | Unit conversion correct |
| Missing barcode | Filter missing data; batch generation/printing only after preview | Select and preview label | Unique valid codes; no silent overwrite |
| Inactive | Retain history; reactivate permitted products | Status explicitly shown | Inactive not added to new sale without policy |
| Stock movement | Date/type/reference/quantity/balance | Signed movement rows | One canonical movement history with adjustment page |

### Customers: 5 filters

All, Active, Outstanding, Overdue and Inactive share one register; they are filters, not duplicated data loaders. Outstanding shows positive collectible due; credit/advance is labelled separately. Overdue uses actual invoice due dates/payment terms, with any fixed “30 days” preset labelled honestly. Every badge comes from full filtered server totals. A customer detail opened from any filter returns to that filter on all devices.

### Supplier detail: 4 views

Summary shows concise identity, due and terms. Ledger is the primary accounting view with applied period and opening balance. Bills shows original purchase totals/paid/due and opens purchase detail. Paid should be labelled **Payments**, because entries may include pending/reversed states. Each payment/ledger credit is a distinct journal type; every row has reference and audit. Phone actions are Pay, Statement and More; tab choice persists.

### Expenses: working register and analytics

Ledger is default. By category contains a compact labelled donut/pie for up to six categories plus Other and an exact amount/percent list. Click a slice/list category to filter ledger. For many categories use ranked bars rather than unreadable tiny slices. Pie denominator explicitly says gross expense, net expense or paid cash, matching the current view. Draft typing does not mutate posted analytics. Add/Edit/Category settings share one validation model; Recurring expenses is hidden unless the real scheduler/status is implemented and tested.

### Reports: all 21 current tabs

| ID / current tab | Desktop fields, rows and primary goal | Mobile presentation | Specific acceptance |
|---|---|---|---|
| summary | Period KPIs with drill-down; sales/expenses trends secondary | Two essential KPIs + ranked rows; chart toggle | Summaries reconcile to underlying reports |
| sales | Invoice/date/customer/net/tax/gross/status; branch/route/customer/product filters | Invoice rows with totals and status | Export uses same filter and monetary basis |
| products | Product/unit/quantity/revenue/cost/margin, current-vs-period labels | Ranked product rows; costs permissioned | Cost-at-sale, returns and units correct |
| net-sales | Gross sales less discounts/returns, tax separated | Simple bridge then source rows | Returns counted once; no gross/net label confusion |
| returns | Return/invoice/customer/reason/qty/credit/refund | Return rows with disposition | Matches return journal and stock result |
| customers | Customer sales/collections/due/terms | Name and due, Collect/Open ledger | No current-page-only totals |
| overdue | Invoice due date/age/due/customer/route | Urgency rows, contact/ledger | Terms-based overdue calculation, not all unpaid |
| aging | As-of date; current/1–30/31–60/61–90/90+ buckets | Customer row expands buckets | All buckets equal total outstanding as of date |
| outstanding | Open invoice amounts and allocation status | Invoice due rows; Collect | /reports/outstanding opens correct state |
| collections | Route/staff/customer/contact/amount to collect/collected | Field list with Record collection | Planned amount differs from actually posted collection |
| credit-notes | Credit note/date/reason/invoice/tax/status | Note rows + source | Issued/applied/refunded amounts distinct |
| expenses | Category/date/source/account/net/tax/gross | Category totals then ledger | Same scope as Expenses page; avoid duplicate inconsistent chart |
| ap-aging | Supplier bills/due dates/age/payment state | Supplier due rows | Payables reconcile after partial/pending payments |
| branch | Branch sales/collections/expenses/dues with drill-down | Ranked branch summary | Authorized branch scope enforced |
| route | Route deliveries/sales/collections/expenses/dues | Stops/collection summary | Route assignment/time window consistent |
| branch-profit | Branch net revenue/COGS/expenses/net result | Profit bridge per branch | Shared expense allocation policy explicit |
| damage | Product/qty/unit/cost/reason/source | Damage rows with units | No double count of returned damaged goods |
| staff | Assigned work/sales/collections, metric definitions | Staff summary, no dense chart | Role and assignment privacy, attributable actions |
| cheque | Number/bank/due/received/cleared/bounced/status | Cheque rows sorted by action date | Pending cheque excluded from cash; bounce reverses correctly |
| profit-loss | Net revenue → COGS → gross → expenses → net, comparison | Vertical amount bridge + drill-down | VAT separated appropriately; historical costs immutable |
| ai | Existing deterministic insights plus link to new assistant if enabled | Insight list and Ask about this | Rules labelled as such; scoped evidence and fresh data |

Move reports into five coherent groups instead of a 21-item scroll strip. Keep old `?tab=` links working. Owner-only reports require backend permission, not only a menu restriction.

### VAT: policy-specific views

For approved-margin workspaces: Summary (amount/period/status), Margin calculation (eligible sale/cost evidence and per-item result), Exceptions & validation (missing evidence/mixed treatment/rounding), Filed history (version and accountant export). Standard-policy workspace retains Overview, Transactions, Sales, Purchases, Expenses, Credit Notes and Validation. Each standard tab lists source documents and values contributing to the same period. A shared-TRN accountant export explicitly identifies both operational workspaces and de-duplicates their document references.

Phone: one amount summary and selected tab, then compact drill-down. Desktop: figures above rows, audit/filing view behind role. Never remove statutory evidence because the owner prefers a simpler dashboard.

### Branch detail: 7 current tabs

| Tab | Required flow | Responsive rule | Gate |
|---|---|---|---|
| Overview | Identity, manager, totals and action links | Compact summary, not stacked hero cards | Same branch across all data |
| Routes | Search/add/open/assign routes | List rows on mobile | Cannot link foreign-tenant route |
| Staff | Invite/assign/unassign with active-work warning | Staff rows + assignment sheet | No privilege escalation |
| Customers | Search/open/assign customers | Customer rows + ledger link | Ledger context preserved |
| Expenses | Branch-scoped expense register | Same expense sheet reused | Uses same posting/accounting API |
| Performance | Period metrics and definitions | Charts optional | Actual posted data, no fabricated target score |
| Report | Filtered branch export | Download with status | Export matches selected period/branch |

### Route detail: 7 current tabs

Overview gives assigned staff/date/summary. Customers supplies ordered stops and contacts. Sales links route invoices. Expenses reuses the expense workflow. Staff manages assignments with effective time. Performance defines collections/delivery metrics. Stops map toggles list/map, saved pin vs observed visit, accuracy and freshness. Phone owner selector keeps all seven reachable; the driver version offers Today/Stops/Collections instead of exposing owner analytics. Empty map shows “No saved locations” with an Add location path, never blank white tiles without explanation.

### Company settings: 5 current tabs

| Tab | Fields/actions | Desktop/mobile layout | Guardrail |
|---|---|---|---|
| Company | Legal names/TRN/licence source, operational contact/address/logo, letterhead/stamp/signature, return template | Section form + preview toggle; phone single column | Shared identity edits permissioned; persisted documents use snapshots |
| Billing | Currency/time zone, sequence/prefix, defaults, allowed tax policy, invoice/thermal template | Short groups; sticky Save section | Numbering collision/effective-date checks; no old invoice rewrite |
| Email | Provider/SMTP sender config and test status | Masked secrets; form and explicit test button | No credentials in frontend/logs; test message destination explicit |
| Notifications | Event/channel preferences, due/stock/close alert thresholds | Group toggles with useful descriptions | Owner controls their own messages; rate/de-duplication |
| Backup | Status summary and Open backup & restore | Link to canonical workflow | Remove duplicate restore implementation only after parity proof |

### Company detail in super-admin: 9 current tabs

| Tab | Primary information/action | Mobile | Evidence required |
|---|---|---|---|
| Overview | Legal + workspace identity, owner/contact, status, health with definitions | Summary sections | Real values and freshness |
| Users | Assigned accounts/role/state, invite/revoke by platform policy | User list | Audited cross-scope admin operation |
| Invoices | Permissioned tenant documents or explicit support-session link | Restricted list | No platform-token leakage through ordinary APIs |
| Payments | Same permissioned read scope, actual payment states | Restricted rows | Never auto-create customer receipts from platform metadata |
| Subscription | Platform plan/invoice/payment/renewal state | Subscription summary | Distinct from client's own sales revenue |
| Usage | Users/records/storage bytes/API/AI/maps with source/period | Compact usage list | Row count not labelled MB; unknown not zero |
| Limits | Quotas/current/max/effective date | Limit form/review | Backend enforcement and race-safe usage limits |
| Features | Typed capabilities/dependencies, pilot/disabled reasons | Search/filter features | Off by default for new capabilities; history/audit |
| Reports | Safe report links into reasoned read-only support context | Links with company name | Short-lived audited scope, no implicit impersonation |

### Platform settings: 6 current tabs plus provider setup

Defaults only seed new tenant defaults unless an explicit migration is chosen. Feature Flags control capability availability, with preview of affected workspaces. Communication edits templates with variable validation and preview, never sends automatically. Announcement has audience/start/end and preview. Security changes session/auth policy with versioned review. Help & Support validates links and contact text. Proposed Providers/AI policy stores secret references, allowlisted model capabilities, privacy classification, budget and test results; keys are masked/write-only and validation uses synthetic data.

## Shared dialogs, controls and document surfaces

These are required acceptance items even though they have no router path.

| Surface | Fields/actions and desktop design | Phone/tablet design | Failure and correctness tests |
|---|---|---|---|
| Product picker | Search/code/unit/stock/price; keyboard arrows/Enter; add and remain in flow | Full-screen sheet; 48px rows; search pinned | Cancel/stale search/duplicate scan/out-of-stock/unit conversion |
| Camera barcode scan | Camera selection, scan feedback, explicit stop | Device camera permission with manual code fallback | Permission denied, repeated scan debounce, no camera, poor focus |
| POS cart row | Qty/unit/price/discount with calculated amount | Tap row opens focused editor | Keyboard focus not stolen by parent row click; invalid numeric input preserved |
| Hold/restore invoice | Name/time/owner/context; Preview/Restore/Delete draft | Compact held-draft list | Wrong owner, expired/mismatched product, restore confirmation; no posting |
| Checkout | Invoice total, actual tender(s), due/change, adjustment if enabled | Full-screen review with single Save invoice | Duplicate submit, lost response, credit limit, rounded settlement, mixed tender |
| Record customer payment | Customer, amount actually received, date/mode/reference, allocations, unallocated amount, adjustment reason | Guided sheet with visible totals and selected count | Pending cheque, insufficient due, overpayment, foreign invoice, concurrency |
| Edit/reverse payment | Original receipt/reference and change reason; review balances | Full-screen minimal fields | Locked period, stale version, linked adjustment and allocations reversed correctly |
| Customer create/edit | Identity/contact/type/terms/route/pin; keep form state | Sections, touch controls, country-aware keyboard | Duplicates, malformed TRN/contact, save failure |
| Supplier payment/credit | Type explicit; amount/date/mode/reference/reason | Same pattern as customer payment, outgoing label | Credit is not cash; bank/cash source and reversal integrity |
| Purchase entry | Supplier bill context + item grid + settlement | Header→items→payment; sticky totals | Duplicate bill, stock/ledger atomicity, upload after saved bill |
| Expense entry/category | Amount/category/payment source first; tax advanced by policy | Short primary form; optional fields collapsed | Receipt upload, category validation, tax lock; failed save keeps amount |
| Stock adjustment | Product/unit/before/after/reason, authorization | Single focused sheet | Negative stock, concurrent count, duplicates, reversal |
| Import | File/schema mapping, row preview, totals/errors, dry-run, explicit Commit | Preview summary; recommend desktop for wide mapping but support error view | Encoding/duplicates/mixed tenant/partial failure/idempotency; no silent commit |
| Invoice preview | Persisted DTO, Download/Print/Return/Edit permitted | Fitted preview/zoom and readable actions | Saved record vs view parity; fallback after PDF failure |
| Receipt preview | Cash/adjustment/applied totals, source invoices, Download/Print | One-column details, compact allocation rows | Popup blocked, pending/void receipt, historical balance, currency |
| Bulk receipt/statement | Explicit selected payments/count/customer/date range | Selection mode with clear Exit | Same-customer/tenant validation, large batch pagination, exact totals |
| PDF progress | Status for generation/fetch, cancel/retry/download | Accessible status; no frozen modal | Wrong content type, timeout, expired link, byte size, user cancels |
| Customer/driver map pin | Address/landmark + map/list/search + accuracy, Save | Full-screen map with list alternative; controls away from OS bars | Permission denied, stale GPS, zero coordinates vs missing, wrong owner |
| Notifications | Event/name/context/date/read state + deep link | Drawer/full-height sheet | No duplicated storm, stale event, cross-tenant IDs, dead destination |
| Dangerous action review | Specific entity/impact/reason; confirm only meaningful destructive actions | One clear consequence and cancel | No generic typing challenge on ordinary edit; financial history preserved |
| Support session | Tenant, reason, expiry/read-only banner | Persistent visible banner without covering header | Scope/expiry/exit, disabled mutation and audit |
| Connection/maintenance | Freshness, unsynced work, Retry, reauth with draft handling | Compact persistent status | No false saved/paid state while disconnected |
| Command search | Permitted pages/actions only; results with section labels | Optional quick navigation search | Keyboard shortcut collision, hidden unauthorized actions, stale flag |
| Table selection/pagination | Select this page vs all matching explicitly different; selected count | Dedicated selection mode | Filter changes clear or deliberately reconcile selection; row actions don't toggle it |

## Proposed new feature pages

### N01 · Daily close — `/daily-close` and `/daily-close/:id`

**Desktop:** date/branch/drawer/status toolbar; expected journal and reconciliation table; counted cash/variance panel. Tabs Today, Count cash, Differences, History. Fields denominations or actual total, opening reference, noncash clearing and reason/attachment; actions Save draft, Review, Close, permitted Reopen with reason.

**Mobile:** four short steps, sticky Next/Save, current drawer and business date always visible; last input remains above keyboard. **Tablet:** journal and count side-by-side only in wide landscape, otherwise same steps.

**Errors:** not all receipts synced, drawer already closed, concurrent posting, unexplained variance, no opening balance, denied reopen. **Acceptance:** 1,331/1,330 example, 40 monthly adjustments, capital movements and expected-vs-actual cash reconcile without fake bills. Close can remain honestly incomplete.

### N02 · Owner assistant — `/assistant`

**Desktop:** conversation/history list, central chat, optional cited report/document panel. Header shows company/workspace and date scope; composer text/mic/upload/language; Stop generation always present. Contextual entry from dashboard, ledger, expense, purchase and report pages passes record references with server reauthorization.

**Mobile:** one conversation; history drawer; safe-area composer; mic state and elapsed duration; transcript editable; attachment/source preview full-screen. **Tablet:** chat with expandable evidence panel.

**Errors:** unsupported file/language, provider unavailable/quota exhausted, permission denied, data stale, extraction uncertainty, interrupted audio. **Acceptance:** cited answers reconcile to deterministic tools; no cross-owner context; upload makes a reviewable draft, not a posted transaction; user cancellation stops tool chain.

### N03 · Driver Today — `/driver/today`; stop — `/driver/stops/:id`

**Desktop:** useful for dispatcher preview, but driver task is phone first. Assigned route/date, ordered stops and progress; stop detail customer/landmark/order/allowed collection. Buttons Navigate, Arrived, Delivered, Could not deliver, Record collection, Proof if configured.

**Mobile:** first pending stop prominent; one-tap navigation; statuses separate from collection; Start trip/End trip with explicit location state. **Tablet:** stop list with detail, optional map. Text remains usable without map tiles.

**Errors:** no assignment, reassigned mid-trip, no pin, location denied/stale, offline unsynced status, duplicate collection, payment failure after delivery. **Acceptance:** assignment enforced server-side; one real payment receipt per collection; no margin/cost/other-route records.

### N04 · Dispatch — proposed `/delivery`, reusing route detail/map

**Desktop:** date/route/driver/status filters; ordered stop grid plus optional map; Assign/reorder, view freshness and failures. **Mobile owner:** list-first summary, driver selection, map toggle; no route-editor gymnastics. **Tablet:** split list/map.

**Errors:** routing API unavailable, quota, invalid pin, driver off duty, stale GPS. **Acceptance:** manually ordered delivery works without routing API; “live” shown only for fresh active-trip samples; stop/payment counts reconcile.

### N05 · Platform AI usage — `/superadmin/ai-usage`

**Desktop:** company/workspace/provider/model/date filters; token/audio/document/cost/quota/failure rows; budgets and provider policy links. Charts secondary. **Mobile:** totals then company rows; no raw prompt exposure. **Tablet:** table with details drawer.

**Errors:** provider omits usage, delayed billing, gateway failure, unknown model and budget race. **Acceptance:** estimated vs invoiced amounts distinguished; data metadata tenant-scoped; no fabricated free allowance.

### N06 · Shared legal identity setup — company detail workflow

Do not add a public tenant switcher. **Desktop:** Add owner workspace wizard described in main plan, legal identity on left and separate operational details on right. **Phone:** sequential review. **Tablet:** two-column only at final review. **Acceptance:** source identity/version verified, private fields distinct, opening import explicitly selected, new tenant checks pass before invites.

## Inactive/unrouted files and consolidation candidates

Source-reference searches found no current App.jsx route/import use for the following page candidates. This is a static candidate list, not permission to delete them.

| Candidate | Plan |
|---|---|
| DataImportPage | Decide whether imports live in existing module dialogs or one guarded Company → Import workspace; do not expose an unfinished duplicate |
| SalesLedgerImportPage | Keep only if a supported accountant import flow is chosen; validate posted/legacy records and opening balances separately |
| SubscriptionPlansPage | Link owner plan management only after billing behavior verified; no dead menu |
| SuperAdminSubscriptionsPage | Consolidate with company detail Subscription or intentionally route it; establish platform billing source |
| UpdatesPage | Link release notes from Help only if maintained |
| RecurringInvoicesPage | Remains disabled until recurring billing is explicitly scoped and scheduled job proved safe |
| PosPageLegacy | Preserve rollback until enterprise POS has transaction, keyboard and mobile parity |
| PdfService / SimplePdfService | Trace direct constructors, DI and fallback callers; consolidate only proven duplicated responsibility after PDF golden tests |
| utils/dataCache.js and services/api.js caches | api.js has tenant-aware request keys and logout clearing; separate utility appears unreferenced in inspected source. Confirm before removal; do not falsely report that all caches lack tenant scope |

File moves/deletions require full import/dynamic-reference/DI/config/test proof and a small separate change. Existing database migrations are history, not clutter.

## Working-assurance tracker template

For every entry and tab/dialog above, create a row with: requirement ID, route/feature, role, tenant workspace, device/viewport, preconditions/fixture, action sequence, expected result, actual result, status, code commit, backend version, evidence file/link, owner and remaining risk. Start statuses as **planned**; do not copy the old page matrix's verified values.

Critical click journeys:
1. Login → New sale → add product → partial/credit checkout → invoice PDF → ledger → payment → receipt → Back.
2. Purchases → supplier → bill entry → credit/cash payment → product stock → supplier ledger → statement.
3. Home → Add petrol expense → cash source → ledger/chart → Daily close → count/variance → close history.
4. Products → adjustment/return → movement → profit report; current-price edits do not change historic profit.
5. FrozenHub owner 1 → forbidden owner 2 record/file/AI query → denied without information leak; repeat reverse direction.
6. Super admin → exact client → Add owner workspace preview → flag/quota/policy review → audit.
7. Driver → assigned route → Navigate → Delivered → Record collection → receipt → reconnect without duplicate.
8. Assistant → Malayalam/Arabic/English question → cited tool answer → invoice upload → corrected draft → human review → saved purchase.

No journey is marked working until end-to-end evidence exists. Known production access limits remain in the main plan, and no code or production change was made during this audit.

