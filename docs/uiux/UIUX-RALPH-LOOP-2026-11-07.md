# HexaBill UI/UX Ralph Loop: 7 Nov 2026

Save as `docs/uiux/UIUX-RALPH-LOOP-2026-11-07.md`. Section 0 is the goal prompt. Paste it into Claude Code or Cursor. Everything after it is the to-do list the loop works through.

Scope: **frontend UI/UX and flow only.** Anandu owns the AI agent backend. Where a UI task needs a backend endpoint that doesn't exist yet, the task says **NEEDS-BACKEND** and gives the contract. The loop builds the UI behind a flag and stops at that point.

Sources: 291 screenshots (FrozenHub1 desktop, Gulf Harvest phone, HONOR Pad X9a 752×1254) and `frontend/hexabill-ui/src` at the shared ZIP snapshot. Line numbers may have moved, so re-check them against the live branch (CLAUDE.md rule 4).

---

## 0. GOAL PROMPT (paste this)

```
You are the single executor for the HexaBill UI/UX loop.
Read first, every session: docs/uiux/LOOP-STATE.md (your memory), then CLAUDE.md, AGENTS.md + docs/uiux/AGENTS-UIUX-LOOP.md.
Read only the task block you are doing from this file or from docs/uiux/PERF-AND-E2E-CONTROL.md (Phase P + gates),
and only the matching sections of docs/uiux/DESIGN-SYSTEM.md (v2).
ORDER: P-00 → A01–A06 → P-01 → P-03 → P-04 → gate E2E-G1 → B → C → D → P-02, P-05–P-10 → G → E2E-G2 → E → F → E2E-G3.

LOOP (one task per iteration):
1. Pick the FIRST task in ORDER whose status in LOOP-STATE is [ ] and whose "Blocked by" tasks are all [x].
2. Mark it [~]. Read every file listed under "Files". Confirm the problem still exists in the current code.
   If it is already fixed, mark it [x] with the evidence "already fixed" and the commit, then go to the next task.
3. Change only what the task says. Keep the scope locked. Don't refactor neighbouring code.
4. Verify the "Done when" checks: npm run lint, npm test, npm run build, and the Playwright or screenshot check
   at the viewports listed (360x780, 752x1254, 1254x752, 1440x900).
5. Mark it [x]. Under the task, add: commit sha, files changed, test counts, and screenshot paths saved in docs/uiux/evidence/2026-11-07/.
6. Commit with the message "UX-<id>: <title>". Update LOOP-STATE (Now, board, history, learned facts). Then start the next iteration.
   Follow the anti-stuck rules in AGENTS-UIUX-LOOP.md §6: 3 failed attempts → STUCK, move on; timeouts are killed, never waited on.
   A failing E2E gate stops feature work until it is green.

HARD RULES
- Never change money math: VAT, totals, round-off, discount, invoice numbering, payment posting, ledger balance,
  stock movement, or tenant scoping. Any task that would need one of those changes: STOP, write it to
  docs/plan/REVIEW-INBOX.md, and skip to the next task.
- Use design tokens only (tailwind.config.js and src/styles/tokens.css). No new colors, no gradients,
  no emoji, no colored left-border cards. Icons are lucide-react only.
- Never use window.confirm or alert. Use ConfirmDangerModal.
- Don't push, deploy, migrate, or touch live tenants.
- If a task says NEEDS-BACKEND, build the UI against the documented contract behind a flag, mark it
  [~] BLOCKED-BACKEND, and move on.
- Report each iteration in 5 lines: DONE / EVIDENCE / FAILURES / BLOCKERS / NEXT.
Stop when every task is [x] or BLOCKED, or after 3 failed attempts on the same task (write why).
```

Status keys: `[ ]` todo · `[~]` in progress or blocked · `[x]` done with evidence.

---

## 1. What the audit found (read once)

### 1.1 The six problems behind most complaints

1. **Too many colors.** The palette is meant to be one blue plus neutrals. The code has 257 uses of `violet/purple/indigo`, 311 of `amber`, 39 of `orange`, 104 colored left-border cards (`border-l-4`), and 101 `animate-*`. The worst files are ReportsPage, VatReturnPage, CustomerLedgerPage, SalesLedgerPage, UsersPage, SettingsPage, DashboardTally, and AssistantPanel. Emoji appear in 10 page files, including POS and the AI panel. This is where the "AI-slop" look comes from.
2. **Too much padding and too many rows of controls.** Tables use `px-4 py-3` cells while the design system says rows are 36–40 px. Customer Ledger stacks five rows of chrome before the first bill: header, date row, eight quick chips, branch/route/staff selects, and icon-over-label tabs. Sales Ledger opens with a large filter grid plus a KPI strip. On 1080p, only 8–10 rows are visible when 18–22 would fit.
3. **Tablet portrait gets the phone layout.** The shell switches at `md` = 768 px. The HONOR Pad X9a is 752 CSS px wide in portrait, so it gets the bottom nav, single-column cards, and wasted width. In landscape (1254) it gets the full desktop with a squeezed table.
4. **The AI assistant shows the same canned answer for every question.** `assistantChat.js` → `describeChatReply()` hardcodes the text when `mode === 'reply'` and throws away `data.text` from the server. The screenshots show this: "Summary", "Payment", and "Invoice" all return the same "I can look up customers…" block. This bug is in the frontend, not your backend.
5. **The driver flow asks too much of older staff.** Each stop card has Open in maps, Record payment, I'm here, then Arrived/Delivered/Failed/Skipped. Failed or Skipped then asks for a typed reason with a minimum length. Location is read only when the driver presses "I'm here". There is no automatic arrival and no automatic reordering.
6. **Visible bugs on the screen:**
   - **Users page:** the table header is invisible (`thead` has both `text-neutral-800` and `text-white`), and the email column wraps one character per line.
   - **Popups:** Quotations, Agreements, and Salary Certificates delete through the native browser `confirm()` popup.
   - **Returns:** `/returns/create` is a dead end that only says "Open a return from an invoice. Back".
   - **Notifications:** a `DBMismatch` alert shows raw product IDs to the owner.
   - **Payment banners:** the "Payment unconfirmed / Retry previous payment" banners are stacked brown/orange boxes.

### 1.2 Business rules the UI must never break (plain English)

You said you're not sure about the business logic, so here are the rules every task has to respect:

| Area | Rule | What it means for UI work |
|---|---|---|
| Invoice | Grand total = Σ(qty × price − discount) + VAT 5% ± round-off. The server is the source of truth. | Show the server's numbers. Never recompute totals in a new component. |
| Invoice number | The tenant has its own series (e.g. FH1 from 7000). Numbers are never reused, even after a delete (void-safe). | Never let the UI edit or reorder numbers except through the existing Change Invoice Number modal. |
| Customer balance | Dr = customer owes you, Cr = you owe them. Balance = invoices − cleared payments − returns. Historical (Starplus) rows are display-only. | Keep the Dr/Cr suffix and the "Historical" tag. Don't hide either. |
| Payment | Every payment carries an idempotency key. An "unconfirmed" payment means the result is unknown, not that it failed. | The retry banner must stay until it's resolved. You can restyle it, but you can't remove it. |
| Cheque | A cheque counts toward the balance only after it is marked Cleared. | Show Pending cheques separately from Cleared ones. |
| VAT return | Output VAT (sales) − claimable input VAT (purchases + expenses with ITC) = payable. It is a management report, not an FTA filing. | Keep the "Management report. Not an FTA filing." banner. |
| Stock | Stock = purchases − sales ± adjustments. It is never typed in directly. | The product form keeps its "Stock is calculated…" note. |
| Tenant | Each subdomain is fully isolated. FH1, FH2, and Gulf Harvest never share data. | No cross-tenant search, cache, or localStorage keys without the tenant prefix. |
| Daily close | Expected cash = opening + cash in − cash out. The owner enters the counted cash, and any difference needs a reason. | Never auto-fill the counted cash. |

---

## 2. Phase A: Visible bugs (do first, small, high trust)

### [ ] UX-A01 · Users page: header invisible, email wraps per character · P0
- **Files:** `src/pages/company/UsersPage.jsx` (around L695 `thead`, email `td`).
- **Problem:** `className="bg-neutral-100 text-neutral-800 text-white"`: the white text wins, so the headers vanish. The email cell has no minimum width, so it breaks one character per line.
- **Do:**
  - Header: `bg-neutral-50 text-neutral-600 text-xs font-medium`.
  - Email cell: `min-w-[220px] max-w-[280px] truncate` with `title={email}`.
  - Collapse the Assigned (branch/route) column to one line.
- **Done when:** at 1440 and 1254, every header is readable, each row is ≤ 48 px tall, and the email shows on one line.

### [ ] UX-A02 · AI assistant drops the server reply · P0
- **Files:** `src/features/assistant/assistantChat.js` `describeChatReply()` (the `mode === 'reply'` branch); `assistantChat.test`.
- **Problem:** the hardcoded fallback text replaces `data.text`.
- **Do:** return `text: data.text?.trim() || <current fallback>`. Add a unit test that a reply with text renders that text.
- **Done when:** the test passes, and in the screenshots different questions show different answers.

### [ ] UX-A03 · Replace native `confirm()` with ConfirmDangerModal · P1
- **Files:** `features/documents/QuotationsPage.jsx`, `AgreementsPage.jsx`, `SalaryCertificatesPage.jsx`, `features/sales/RecurringInvoicesPage.jsx`, `features/sales/pos/PosEnterprisePage.jsx`, `features/reports/VatReturnPage.jsx`, plus the platform pages (leave those last).
- **Do:** use the existing `ConfirmDangerModal` with title, consequence line, and a red confirm button.
- **Done when:** `grep -rn "window.confirm\|[^.]confirm(" src --include=*.jsx` finds only ConfirmDangerModal internals.

### [ ] UX-A04 · Returns page dead end · P1
- **Files:** `features/returns/ReturnCreatePage.jsx`.
- **Do:** when no invoice is in the URL, show an invoice search (number or customer, last 30 days) that opens the existing return flow for the selected invoice. Keep the return math unchanged.
- **Done when:** `/returns/create` with no params lets you pick an invoice in at most 2 taps.

### [ ] UX-A05 · Owner-facing notification language · P1
- **Files:** `components/AlertNotifications.jsx` (around L204).
- **Do:**
  - `DBMismatch` / `BalanceMismatch`: replace the ID dump with "Stock needs a recount for N products". Show a single action ("Review") that opens the Products filter. Keep the raw IDs behind a "Details" disclosure that only Owner/Admin can see.
  - Tabs: rename "System" to "Other".
- **Done when:** no numeric ID list is visible by default.

### [ ] UX-A06 · Payment-unconfirmed banners · P1
- **Files:** `features/payments/PaymentsPage.jsx` (around L687), plus the ledger receive-payment modal that shows the same message.
- **Do:**
  - Show ONE neutral `Alert` (warning token, no brown/orange fill) that lists the unconfirmed intents: amount, customer, time, [Check result], [Retry].
  - Collapse it to one line when there are 2 or more. Don't change the recovery logic.
- **Done when:** with 2 unconfirmed intents, the page shows one alert block ≤ 64 px tall.

---

## 3. Phase B: Foundation (premium feel comes from here)

### [ ] UX-B01 · Density tokens + table primitive · P0
- **Files:** `src/styles/tokens.css`, `tailwind.config.js`, `components/ui/ModernTable.jsx`, `index.css`.
- **Do:**
  - Add the tokens `--row-h-compact: 36px`, `--row-h: 40px`, `--cell-px: 8px`, `--cell-py: 6px`, and table text 13px with `tabular-nums` for numbers.
  - Add `.hb-table` classes: sticky header `bg-neutral-50 text-xs text-neutral-600`, hover `neutral-50`, numbers right-aligned, and an actions column that is fixed-width and right-sticky.
  - Make ModernTable use them. Add a `density` prop (`compact` default on ≥1024).
- **Done when:** a story/test renders 20 rows at 1440×900 with ≥ 18 visible without scrolling the page.

### [ ] UX-B02 · Kill the off-palette colors (slop sweep) · P0
- **Blocked by:** B01.
- **Files (in order):** DashboardTally, ReportsPage, CustomerLedgerPage, SalesLedgerPage, VatReturnPage, SettingsPage, UsersPage, ExpensesPage, PaymentsPage, AssistantPanel. Leave the platform/SuperAdmin pages for last.
- **Do:**
  - Map `violet/purple/indigo/teal` → `primary` or `neutral`.
  - Use `amber/orange` only through the `warning` token, and only for a real warning state.
  - Remove `border-l-4` accent cards and replace them with a 1px border plus a small status dot when status matters.
  - Remove decorative `animate-*`. Keep only the spinner and skeleton.
  - Remove emoji and use lucide icons.
- **Money color rule:** green = received or credit, red = owed or overdue, neutral = everything else. See `MONEY-COLOUR-ROLLOUT.md`.
- **Done when:** grep counts drop to 0 for `violet-|purple-|indigo-|teal-|orange-` and emoji in the listed files, `border-l-4` ≤ 5 (alerts only), and screenshots are attached.

### [ ] UX-B03 · One toolbar pattern for every list page · P0
- **Blocked by:** B01.
- **Files:** new `components/ui/ListToolbar.jsx`; reuse `DateRangeFilter`, `FilterPanel`.
- **Do:**
  - Desktop toolbar is a single row: `[Search] [Date preset ▾ dd/mm–dd/mm] [Filters (n) ▾] … [Export ▾] [Primary action]`.
  - The quick chips (Today, Yesterday, Last 7 days, This month, Last month, All dates) move into the Date preset dropdown.
  - Branch, route, staff, status, and type move into the Filters popover. Active filters show as removable chips under the toolbar, and only when something is set.
  - Phone: Search plus a Filters button that opens a bottom sheet.
- **Done when:** the component is unit-tested, and the toolbar height is ≤ 44 px desktop and ≤ 96 px phone.

### [ ] UX-B04 · Tabs: compact segmented style · P1
- **Files:** `components/ui/TabNavigation.jsx`.
- **Do:** a single row of text tabs (icon optional, inline, 16px) with a 36 px height and an underline for the active tab. Remove the icon-stacked-over-label variant used in Customer Ledger.
- **Done when:** Customer Ledger tabs are 36 px tall (the current version is about 56).

### [ ] UX-B05 · KPI strip pattern · P1
- **Files:** `components/ui/StatCard.jsx` (add a `variant="strip"`).
- **Do:** one bordered row with 4–6 cells (label 12px muted, value 18px semibold tabular) and no colored backgrounds. Use money color only on the value when it means owed or received.
- **Done when:** Dashboard, Sales Ledger, Customer Ledger Stats, Worksheet, and Purchases all use the strip.

### [ ] UX-B06 · Tablet breakpoint · P0 · **Owner decision needed: approve the `tab` screen**
- **Files:** `tailwind.config.js` (`screens`), `components/Layout.jsx` (L55, L103, `md:` shell classes), `components/BottomNav.jsx`.
- **Problem:** at 752 px portrait, the tablet gets the phone shell.
- **Do:**
  - Add `screens: { tab: '700px' }` and keep `md/lg/xl`.
  - From 700–1023 px: show a compact icon rail (w-16) with no bottom nav, the header search visible, two-column forms, and tables with priority columns (not cards) for the ledgers.
  - ≥1024 px stays as today.
- **Done when:** at 752×1254, there is no bottom nav, a rail is visible, the Customer Ledger bills render as a table with ≥ 12 visible rows, and phone 360 is unchanged.

---

## 4. Phase C: Ledgers and tables (your "scroll rows smaller" request)

### [ ] UX-C01 · Customer Ledger header and filters · P0
- **Blocked by:** B03, B04.
- **Files:** `features/customers/CustomerLedgerPage.jsx` (5,835 lines; touch only the header/filter/tab blocks).
- **Do:**
  - One header row: `← Customer name · phone · TRN · Switch (F2)`, then on the right `Balance 4961.00 Dr · 4 unpaid`, then `[Receive payment] [Pay all] [⋯]`.
  - Replace the date row and the branch/route/staff selects with ListToolbar.
  - Tabs: `Pending (n) · Bills · Payments · Ledger · Stats`.
- **Done when:** at 1440×900, the first bill row starts ≤ 200 px from the top of `main` (currently about 330).

### [ ] UX-C02 · Customer Ledger rows · P0
- **Blocked by:** B01.
- **Do:**
  - Bills: rows are 36 px. Actions = `[Pay]` (only when there is a balance) + `[⋯]` with View, Edit, PDF, Print, Return, Delete. The current version shows up to 6 icons.
  - Keep the "Historical" tag as a small neutral badge. Status pill: Pending is warning, Paid is success.
  - Put the totals row in a sticky footer: `Total invoices · Total paid · Total pending`.
  - Ledger tab: debit/credit/balance columns stay right-aligned. Drop the red and green row backgrounds; color only the balance text.
- **Done when:** ≥ 18 bill rows are visible at 1440×900, and no action has been removed (it is just moved into the menu).

### [ ] UX-C03 · Sales Ledger · P0
- **Blocked by:** B03, B05.
- **Files:** `features/sales/SalesLedgerPage.jsx`.
- **Do:**
  - Filters hidden by default on all widths. The `SHOW_FILTERS_KEY` default stays false, but the desktop grid has to respect it too.
  - Replace the large filter grid with the toolbar.
  - Make the KPI strip (Sales, Returns, Received, VAT, Unpaid, Balance, Invoices, Rows) a single row of cells.
  - Table: 36 px rows and an Actions overflow menu. The totals row stays sticky.
  - Phone cards: shrink the "Record payment" orange full-width button to an outline `Collect` button, and show the money lines in a 2-column grid.
- **Done when:** the first data row is ≤ 240 px from the top of `main` at 1440, the phone card height is ≤ 140 px, and the totals are unchanged (compare with a before/after export).

### [ ] UX-C04 · Billing History · P1
- **Files:** `features/sales/BillingHistoryPage.jsx`.
- **Do:** apply ListToolbar, 36 px rows, actions `[Collect]` (if due) + `[⋯]`. On phone, a card shows number, customer, amount, status, and date on 2 lines.
- **Done when:** 20 rows are visible at 1440 and the phone card is ≤ 72 px.

### [ ] UX-C05 · Payments list · P1
- **Files:** `features/payments/PaymentsPage.jsx`.
- **Do:**
  - Move the description sentence into a `?` tooltip.
  - The tabs "Current / Historical (Starplus)" stay.
  - 36 px rows. Show the method as text, not an icon plus text.
  - Phone card: 2 lines. The selection checkbox is visible only in select mode (the bulk "Generate receipt" flow).
- **Done when:** the first row is ≤ 180 px from the top.

### [ ] UX-C06 · Purchases list + entry · P1
- **Files:** `features/purchases/PurchasesPage.jsx`, `ProductPicker.jsx`.
- **Do:** follow `08_Tablet_UX_Spec §4`.
  - The New Purchase entry opens as its own focused panel or route, with no list underneath.
  - The supplier balance note becomes a neutral info line.
  - Items: desktop table rows are 36 px. The phone item card shows qty, unit, cost, and total on one row.
  - Totals footer: Subtotal, VAT, Total, then Cancel / Save.
- **Done when:** the entry has no nested scroll boxes, and Save is visible without scrolling at 1440 and 752.

### [ ] UX-C07 · Suppliers / Supplier detail · P2
- **Do:** list rows are 36 px. Detail: one header row (name, outstanding, unpaid bills, Edit, Pay), and the tabs use B04. The Paid tab supports Edit/Delete through `⋯`.

### [ ] UX-C08 · Products / Price list / Stock adjustments · P2
- **Files:** `features/products/ProductsPage.jsx`, `ProductsTable.jsx`, `PriceList.jsx`, `features/inventory/StockAdjustmentsHistoryPage.jsx`.
- **Do:**
  - Products: when the price is 0, show `—` in neutral, not "AED 0.00".
  - Zero stock: one banner at the top ("10 products show zero stock") instead of a red warning icon on every row.
  - Price list: remove the three KPI cards (Total products, Average price, Search results add nothing) and make the price editable inline in the row.
  - Stock adjustments: 36 px rows.
- **Done when:** no row shows a warning icon unless that product is actually below its reorder level.

### [ ] UX-C09 · Expenses · P2
- **Do:** the Add Expense modal uses a two-column grid on ≥700 with a fixed footer. The empty state is one line plus a button. The `Ledger / By category` toggle uses segmented B04.

---

## 5. Phase D: POS

### [ ] UX-D01 · POS desktop layout · P0
- **Files:** `features/sales/pos/PosEnterprisePage.jsx` (keep `PosPageLegacy` untouched).
- **Problem:** the cart area is mostly empty, a shortcuts text line takes a row, the Payment block sits in the middle, the right third is empty, and Save Invoice is a pale green that reads as disabled.
- **Do:**
  - Two columns. Left (flex): customer bar + cart table (36 px rows, the cart grows to fill the height).
  - Right (360 px, sticky): Totals → Payment (method segmented: Cash/Card/Credit/Cheque, amount + quick chips) → primary **Save invoice (F9)** button using the full `primary` color, with a disabled state only when the cart is empty.
  - Move the shortcuts line to a `?` button (it already exists as ShortcutHelp).
  - Header: Hold / Resume / Repeat / New become ghost buttons. Remove the dark-blue filled bar and use a white header with a bottom border.
- **Business guard:** don't touch the cart engine, VAT, round-off, the discount popup math, invoice numbering, or the payment default (PS-05 is an open owner decision).
- **Done when:** at 1440×900 the cart shows ≥ 12 lines, and at 1254×752 Save is visible without scrolling. Keyboard flow F2→F3→Tab→F9 still works (existing tests).

### [ ] UX-D02 · POS tablet + phone · P1
- **Blocked by:** B06.
- **Do:**
  - Tablet (700–1023): the same two columns, with the right column at 320 px.
  - Phone:
    - The cart list shows 1 line per item (name · qty × price · total), with tap to expand qty/unit.
    - The sticky bottom bar shows `Total AED x · [Checkout]`.
    - The checkout sheet = payment block.
    - "Add product to bill" is a full-width outline button, not filled.
- **Done when:** the phone cart shows ≥ 5 items above the bottom bar at 360×780.

### [ ] UX-D03 · Product drawer search · P2
- **Files:** `features/sales/pos/ProductDrawer.jsx`.
- **Do:**
  - Each result row is one line (name · SKU · stock · price) at 40 px.
  - Keep the Frequent section first, then All.
  - The keyboard ↑↓ Enter flow stays.

---

## 6. Phase E: AI assistant UI (backend is yours)

Today the assistant is a side panel with emoji chips, a generic empty state, no full view, and a text-only reply bubble. The target is an agent that looks premium and alive: clear states (idle, listening, thinking, speaking, acting), streaming text, action cards, and a voice mode.

### [ ] UX-E01 · Panel shell: drawer, full view, tablet sheet · P0
- **Files:** `features/assistant/AssistantPanel.jsx` (1,405 lines; split it), `components/Layout.jsx`.
- **Do:**
  - Split into `AssistantShell` (frame + mode), `AssistantThread` (messages), `AssistantComposer`, `ActionCard`, and `VoiceMode`.
  - Desktop ≥1024: a right drawer, 420 px wide, that pushes content (no overlay), plus an Expand button → `/assistant` full page (thread centered at max 760 px, history list on the left).
  - Tablet 700–1023: a bottom sheet at 90% height with a drag handle.
  - Phone: full screen.
  - Esc closes it. The open state persists per tenant in localStorage (prefixed key).
- **Done when:** the drawer works at 1440 and 1254, full view works, the sheet works at 752×1254, and phone is full screen.

### [ ] UX-E02 · Visual language · P0
- **Do:**
  - Chips: lucide icons (BarChart3, AlertCircle, Package, Wallet, Receipt, CreditCard, UserPlus), neutral outline style, and no emoji.
  - Empty state: the greeting with the user's name plus 4 suggestion cards in a 2×2 grid, using the language-aware text already in `voice.js`.
  - Messages:
    - User messages are right-aligned in a neutral-100 bubble.
    - Agent messages have no bubble: plain text with a small agent mark.
    - Tool results render as a compact table card with an "as of" time.
  - Header: "HexaBill Agent" with a state dot (idle grey, thinking primary pulse, error red), a language select, Expand, and Close.
- **Done when:** emoji count is 0 in the assistant files and screenshots are attached for the empty state, a tool result, and a suggestion card.

### [ ] UX-E03 · Thinking/streaming states · P1 · NEEDS-BACKEND (optional)
- **Do:**
  - Show a typing indicator (3 dots, `motion-reduce` aware) while a request is pending.
  - If the backend later supports SSE `POST /assistant/chat/stream` → `event: token|tool|card|done`, render tokens as they arrive. Until then, fall back to the current single response.
- **Contract for backend:** `text/event-stream`; events `{type:"token",text}`, `{type:"tool",name,status}`, `{type:"card",card}`, `{type:"done",reply}` (the same shape as the ChatReply today).

### [ ] UX-E04 · Action cards (confirm-to-post) · P0
- **Files:** `InvoiceDraftActionCard` and the suggestion rendering in AssistantPanel; `assistantDraft.js`.
- **Do:**
  - One `ActionCard` component: title (e.g. "Record payment"), a field grid (editable inline), a warning line ("Nothing is saved until you confirm"), and `[Confirm] [Edit in full form] [Cancel]`.
  - Use the existing draft confirm API with `payloadHash` + `idempotencyKey`. After confirm, show a success state with a link to the created record.
- **Business guard:** all money posting goes through the existing draft/confirm endpoints. The UI never posts directly.
- **Done when:** customer and expense drafts work end to end locally. Invoice/payment cards hand off to POS / Payments prefilled (that's what exists now).

### [ ] UX-E05 · Voice mode UI (LiveKit + Gemini / OpenRouter) · P1 · NEEDS-BACKEND
- **Do:**
  - Voice is a mode inside the shell, not a separate page.
  - A large animated orb (CSS only, `prefers-reduced-motion` = static) shows the listening, thinking, and speaking states. Below it, a live transcript (user and agent lines) and `[Mute] [End] [Switch to text]`.
  - A first-use consent screen per `docs/plan/VOICE-AND-LIVE-LOCATION-CONSENT-DESIGN.md`.
  - Use `livekit-client` (add the dependency only in this task).
  - If the backend token endpoint is unavailable, fall back to the existing browser SpeechRecognition push-to-talk in `voice.js`.
- **Contract for backend:** `POST /assistant/voice/session` → `{ url, token, room, expiresAt, provider: "gemini-live"|"openrouter" }`, scoped to tenant + user server-side. The agent sends `card` data messages on the LiveKit data channel with the same ActionCard payload as UX-E04.
- **Note:** check Gemini's current free-tier limits and data-use terms before routing customer data to it (CLAUDE.md rule 8). The UI shows the provider name from the session response and doesn't hardcode it.
- **Done when:** with the flag `VITE_ASSISTANT_VOICE=livekit`, the mock session renders all states. With the flag off, push-to-talk still works.

### [ ] UX-E06 · Entry points · P2
- **Do:**
  - Header sparkle button (exists).
  - Ctrl+J to toggle.
  - A "Ask agent about this" item in the `⋯` menu on ledger rows, which pre-fills the composer with the record reference.
  - Phone: the Agent opens from the "More" sheet top row (not a 6th tab).

---

## 7. Phase F: Routes, live location, auto flow (for older drivers)

Today the owner builds a route by hand, many stops have no pin ("Location needed"), and the driver has to press "I'm here" and then choose among four status buttons. The target is one big button per stop, with the phone doing the rest.

**Platform limits (honest):**
- The browser must ask for location permission once. It can't be silent.
- On a phone browser or PWA, tracking stops when the screen locks or the app goes to the background (iOS especially).
- The design below keeps the screen awake during a route (Wake Lock API where supported) and degrades to a manual "I'm here".
- True background tracking needs a native wrapper. That's out of scope here.

### [ ] UX-F01 · Driver route: one-button stops · P0
- **Files:** `features/branches/DriverRoutePage.jsx` (`StopCard`), `driverRoute.js`.
- **Do:**
  - Route header: progress `3 / 11 done`, then a large `Start route` button, which becomes `End route` once the route is running.
  - Only the **Next stop** card is expanded: name, address, distance/ETA, `[Navigate]` (big), and one big green **Delivered** button plus a smaller **Problem** button.
  - Problem opens a sheet with preset reasons as big buttons: Shop closed, No one to receive, Customer refused, Skip for now, Other (text). This replaces the typed minimum-length reason; keep it valid for the existing API by sending the preset text.
  - "Arrived" is set automatically (F02), not tapped.
  - Record payment: `[Collect]` appears on the next-stop card only if the customer has a balance.
  - Other stops are collapsed into 1-line rows (number, name, status dot).
- **Business guard:** status values sent to the API stay `Arrived/Delivered/Failed/Skipped`.
- **Done when:** the next stop shows ≤ 3 buttons, and a 360×780 screenshot shows the next stop card fully above the fold.

### [ ] UX-F02 · Auto location during a running route · P0 · NEEDS-BACKEND (small)
- **Files:** `DriverRoutePage.jsx`, `LocationSharingPanel.jsx` (reuse its `watchPosition`), new `useRouteTracker.js`.
- **Do:**
  - When the route starts: ask permission once and explain why in one sentence. Start `watchPosition` (high accuracy, 15 s max age) and request the Wake Lock.
  - Geofence: within 80 m of the next stop's pin for 20 s → auto-send `Arrived` (with the GPS fix) and show the toast "Arrived at X". No tap needed.
  - Stop has no pin: when the driver taps Delivered, attach the current GPS fix as a **proposed pin**. The office approves it (consent design: "your location goes to the office to confirm"). Show "Location saved for office review".
  - Send a live position every 60 s while running, for the office map.
  - Stop everything on End route, tab close, or permission revoke.
- **Owner setting:** "Auto location during routes: Required / Optional", on the Branches & Routes settings tab.
- **Reuse first:** `driverRoute.js` `arrivalRequest()` already sends `latitude/longitude` with the visit. It sets `updateSavedLocation` for an owner or admin on an unpinned stop when the fix is accurate. For staff, the fix already "goes to the office to confirm". The auto geofence should call this same function, so no new pin endpoint is needed.
- **NEEDS-BACKEND (small):** add an optional `source: "auto"|"manual"` field on the visit body, plus a lightweight `POST /routes/{id}/live-position` for the 60 s ping if the existing LocationSharingPanel endpoint can't be reused (check it first).
- **Done when:** Playwright with mocked geolocation moving toward a pin auto-marks Arrived once, and `source:"auto"` is recorded.

### [ ] UX-F03 · Auto next-stop order from live position · P1
- **Files:** `features/routes/routeLine.js` (OSRM already used), `routeMapState.js` (already has "nearest").
- **Do:**
  - After each Delivered, recompute the remaining order: nearest pinned stop first, or the OSRM `/trip` endpoint when it is reachable. Unpinned stops stay at the end in the owner's order.
  - Show "Order updated to save distance · Undo" for 10 s.
  - Owner setting: "Auto-reorder: On/Off". If Off, keep the owner's order.
  - Never reorder silently while the driver is navigating to a stop.
- **Done when:** with 5 mocked pins, delivering stop 1 reorders the rest by distance, and Undo restores it.

### [ ] UX-F04 · Owner route builder + map · P1
- **Files:** `features/branches/RouteDetailPage.jsx` (Stops & order tab), `features/routes/RouteMapPage.jsx`, `components/StopLocationMap.jsx`.
- **Do:**
  - Map on the left (desktop) and the stop list on the right, with drag-to-reorder and up/down buttons kept for touch.
  - A blue road line through the stops in order (exists). Dashed = straight-line fallback (exists). Stop pins are numbered.
  - "Location needed": stops with no pin show a `Pin now` action. Tap the map, or "Use the driver's proposed pin" when F02 provides one.
  - "Optimize order" button (same logic as F03), with a preview before saving.
  - Live driver dot with the last-update time (stale after 5 min turns grey).
- **Done when:** the owner can pin, reorder, and optimize, and save once. The 1440 and 752 screenshots both work.

### [ ] UX-F05 · Branches & Routes empty states and route map page · P2
- **Do:**
  - Empty states become one guided card: "1. Add a branch → 2. Add a route → 3. Add customers to the route".
  - Route map page: if there are no routes, link to that guide, not a thin banner.
  - "My routes" empty state for staff: "No routes assigned. Ask the office." (exists; just restyle).

---

## 8. Phase G: Remaining pages (page-by-page polish)

### [ ] UX-G01 · Dashboard · P1
- **Blocked by:** B05.
- **Files:** `features/dashboard/DashboardTally.jsx`.
- **Do:** follow `08_Tablet_UX_Spec §3`.
  - Order: period chips → a 4-cell KPI strip (Net sales, Received, Receivable, Profit). Purchases and Expenses go in a "More" disclosure.
  - Then "Needs attention": Overdue N customers, Daily close not done, Low stock, VAT estimate. One list, each row links to the fix.
  - Then 6 quick actions as neutral outline buttons with their shortcut badge.
  - Then the sales trend, then top customers and top products side by side.
  - Remove the colored tiles.
- **Done when:** the owner sees the receivable and Daily Close without scrolling at 1440 and 752.

### [ ] UX-G02 · Customers list + detail · P2
- **Do:**
  - List: names in default text color (not all blue links), the whole row clickable, 36 px rows, `[Ledger] [⋯]`.
  - Detail: the four totals become a strip, and the transaction history uses the B01 table.

### [ ] UX-G03 · Reports · P1
- **Files:** `features/reports/ReportsPage.jsx` (254 padding hits, 23 amber, 18 violet).
- **Do:**
  - Left: a report list grouped as Sales, Receivables, Payables, Operations, Company. On phone it is a searchable sheet, replacing the long native select.
  - Right: the report with a ListToolbar, KPI strip, chart, and table.
  - The "Data source" chips (Current / Legacy Starplus / Comparative) become one segmented control.
- **Done when:** no off-palette color remains, and phone report switching is a sheet with search.

### [ ] UX-G04 · VAT Return · P2
- **Do:**
  - Keep the content. Period controls go in one row.
  - Export buttons go into one `Export ▾` menu.
  - Tabs use B04. The warnings box uses the neutral Alert.

### [ ] UX-G05 · Daily close · P1
- **Do:** follow `08_Tablet_UX_Spec §5`.
  - Steps: Date/branch → Expected (read-only breakdown) → Counted cash → Difference + reason → Submit.
  - Capital & transfers collapses as "Owner cash movements (optional)".
  - The sticky footer holds `Save draft · Submit close`.
- **Business guard:** the counted cash is never prefilled.

### [ ] UX-G06 · Worksheet · P2
- **Do:** the KPI strip. Replace the two donuts with one horizontal "Collected vs Pending" bar and one "Money out" bar (the donuts take 2 screen-heights on phone).

### [ ] UX-G07 · Documents: Quotations, Agreements, Salary certs, Delivery notes · P2
- **Do:**
  - Editors keep the dual pane on ≥1024. On 700–1023 use tabs `Form | Preview`, and on phone the preview opens as a sheet.
  - List actions: `[Edit] [⋯ Print A4/A5/Letterhead, PDF, Copy, Delete]` (currently 6–7 inline links).
  - Delivery notes: 36 px rows, `[View] [⋯]`.

### [ ] UX-G08 · Settings · P2
- **Do:**
  - A left section nav on ≥1024 (Company, Billing, Invoice print, Letterhead, Return template, Email, Notifications, Backup) and a single scroll with anchors.
  - A sticky Save bar appears only when the form is dirty.
  - The danger zone (Clear all data) moves to the bottom behind ConfirmDangerModal with a typed confirmation.

### [ ] UX-G09 · Users / Activity log / Backup / Profile / Help · P3
- **Do:**
  - Activity log: 36 px rows. The detail opens in a side sheet, not a modal.
  - Backup: one status card.
  - Help: keep it as is.

### [ ] UX-G10 · Command palette + New menu · P3
- **Do:**
  - The palette groups results as Pages / Customers / Products / Invoices, with keyboard hints.
  - The "+ New" menu shows each item's shortcut on the right.

---

## 9. Phase H: Verification gate

### [ ] UX-H01 · Responsive screenshot sweep
- **Do:** Playwright at 360×780, 752×1254, 1254×752, and 1440×900 for every route in `docs/plan/ROUTE-MANIFEST.json`. Save to `docs/uiux/evidence/2026-11-07/<viewport>/<route>.png`.
- **Fail when:**
  - the page scrolls horizontally,
  - a control extends past the right edge,
  - the first data row sits below 50% of the viewport on a list page, or
  - a bottom nav overlaps content.

### [ ] UX-H02 · Slop lint
- **Do:** add `scripts/ui-lint.mjs`. It fails CI on:
  - `violet-|purple-|indigo-|teal-|orange-` in `src/features|pages|components`,
  - emoji,
  - `window.confirm|alert(`,
  - `border-l-4` outside `components/ui/Alert.jsx`.
- **Done when:** it is wired into `npm run lint`.

### [ ] UX-H03 · Money regression
- **Do:** before and after the full loop, export Sales Ledger, Customer Ledger (3 customers), VAT Return, and Worksheet totals for the same period on the local seed. All numbers must match exactly.

---

## 10. Recommended order (if you only have a few days)

1. A01 → A02 → A03 → A06: one sitting, visible wins.
2. B01 → B03 → B04 → C01 → C02 → C03: the ledgers fit 2× the rows.
3. B06: tablet (needs your OK on the `tab: 700px` screen).
4. D01: POS.
5. E01 → E02 → E04 (assistant UI). Then E05 when your LiveKit session endpoint is ready.
6. F01 → F02 → F03 → F04: driver auto flow.
7. B02 slop sweep, page by page, alongside the rest. Then G and H.

## 11. Owner decisions this loop needs (answer in REVIEW-INBOX)

| ID | Question | Default if no answer |
|---|---|---|
| D-UX-1 | Add a `tab: 700px` breakpoint so 752 px portrait tablets get the tablet layout? | Yes |
| D-UX-2 | Auto location during routes: Required or Optional for drivers? | Optional, on by default |
| D-UX-3 | Auto-reorder remaining stops after each delivery? | On, with Undo |
| D-UX-4 | Does a driver's proposed pin need office approval, or is it saved directly? | Office approval |
| D-UX-5 | Which voice provider first: Gemini Live via LiveKit or OpenRouter (text) + browser TTS? | Gemini Live, after you check its data terms |
