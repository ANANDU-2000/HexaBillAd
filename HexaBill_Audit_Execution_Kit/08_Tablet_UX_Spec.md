# Tablet-first UX specification

Proposed product behaviour. Validate actual CSS viewport width, zoom, device-pixel ratio and browser before assigning breakpoints from screenshot dimensions.

## 1. One shell across devices

| Surface | Navigation | Content and forms | Assistant |
| --- | --- | --- | --- |
| Phone, 360/390/430 CSS px | Home, Sale, New, Ledger, More on browsing pages; contextual back on detail pages | One column; full-screen create/edit; cards for transaction lists; bottom actions above safe area | Full screen; keyboard-aware composer |
| Portrait tablet, 768/820 CSS px | Drawer or compact rail; no wide persistent sidebar | Two-column fields only when labels and values remain readable; cards or priority-column lists | Full-screen sheet when a side panel would squeeze content |
| Landscape tablet, 1024/1180 CSS px | Compact rail; expandable menu | Split list/detail where useful; 4-6 essential columns; 44 px touch controls | Side drawer if at least a useful minimum content width remains; Expand available |
| Desktop, 1280/1440 CSS px | Expandable sidebar | Denser tables with sticky identity/action columns; optional split workspace | Right drawer roughly 380-440 px; full-screen toggle |

Breakpoints are starting specifications, not a mandate to rewrite every Tailwind class. Resolve the mismatched md/xl treatment in purchases first. Test real iPad Safari and Android Chrome as well as emulated widths. Add 200% zoom and tablet split view.

## 2. Navigation and scrolling

One predictable primary vertical scroll container per page. A popup/list may scroll independently when it is a deliberate overlay; do not nest several small scroll boxes inside the normal purchase form. Do not hide horizontal overflow globally as a substitute for fixing an element's width.

On detail/create pages, keep a Back button at the start of the page header, next to the title. Return to the originating list with search/filter/scroll state intact; use an explicit safe list route if no valid history exists. Warn before discarding an unsaved draft. Browser Back should behave consistently with the visible Back control. Do not display separate duplicate back controls in both the page and shell.

Header stays compact. Sticky action bars must know whether bottom navigation is present; reserve enough content space and respect safe-area insets. Hide bottom browsing navigation while a form, keyboard or blocking dialog owns the screen. Existing useShellChrome helpers already attempt this; verify and reuse them before adding another observer.

## 3. Owner home layout

Read order: date/branch -> four totals -> attention -> six actions -> one trend -> optional details. A nontechnical owner should identify money owed and open Daily Close without scrolling through charts.

| Item | Meaning | Interaction |
| --- | --- | --- |
| Net sales | Backend net sales for selected business date/range | Opens filtered sales ledger |
| Collected | Actual eligible collections, labelled by scope | Opens filtered payments |
| Receivable | Outstanding balance as of stated time | Opens overdue/outstanding customers |
| Cash expected | Current drawer/branch cash state | Opens Daily Close and tender breakdown |
| Needs attention | Overdue, low stock, unclosed day, failed task, expiring document | Opens the exact fix/action |
| Collection ring | Explicit amount-based or count-based Paid/Partial/Unpaid distribution | Text legend, totals and link to invoices |

Never combine selected-period sales with all-time receivable without labelling both. Empty is different from failed: "No invoices today" is appropriate only after a successful query. Use an error with Retry for failed loading.

## 4. Purchase entry

Browsing page: title + New purchase; compact search/filter chips; pending summary; purchase cards/table. New purchase opens a focused entry route/panel without the old list and analytics underneath.

Entry: Supplier -> Invoice/date -> Payment/tax choices -> Items -> Review totals. Search opens an anchored popover on desktop or a product picker sheet on touch screens. Item cards show name/SKU, quantity, unit, unit cost, subtotal and tax; use expandable secondary details. For tablet tables, keep item identity visible while editing amounts.

Footer: Total, Cancel and Save purchase. Disable duplicate submission while saving; retain a request/action key for uncertain results. Keep errors beside the field plus a short summary. A successful create followed by a failed list refresh must say the purchase was saved and offer refresh; never invite a duplicate create.

## 5. Daily Close

Expose a dashboard card: Not opened / Open / Needs count / Difference to review / Closed. Follow the actual backend state model; do not invent a completed state from UI alone.

The owner chooses business date and branch/drawer, confirms opening cash, then sees cash in/out from actual movements. At close, enters counted cash and a reason for any difference, reviews the reconciliation, and submits through the authorised service. Use "Money collected", "Cash paid out" and "Difference" with optional accounting detail. Bank/card receipts do not count as physical drawer cash.

Keep Save draft separate from Submit close. Closed periods are visibly locked; reopening requires existing authority, reason and audit. Test two cashiers, returns, deposits, backdated entries and duplicate close attempts. Define whether the current implementation is per branch/company or per cashier before adding a shift UI.

## 6. Visual and interaction system

Use existing design tokens and Lucide icons. Keep one primary action per form. Suggested semantic usage: blue for the primary action/selection, neutral for ordinary text, green for completed or positive collection state, amber for pending/attention and red for failure/overdue/destructive action. Never encode meaning with colour alone.

Use tabular numerals, consistent currency placement and right-aligned money. Labels stay visible above fields. Show full business names on demand without forcing long names to stretch a table. Touch controls should offer at least 44 px practical hit areas, including tablet row menus. Avoid 10 px functional labels; use 14-16 px body text for touch workflows.

Shared components to consolidate gradually: PageHeader, BackButton, FilterBar, FilterSheet, EntityList, StatusBadge, MoneyText, FormField, ActionBar, EmptyState, ErrorState, ConfirmAction and AssistantDrawer. Do not ship duplicate versions per module. Validation belongs to server rules with client feedback; common form components must not hide domain-specific checks.

## 7. Screens that need special attention

| Screens | Proposed treatment |
| --- | --- |
| Price list | Product-name cards on phone; sticky name column and explicit edit on tablet |
| Customer/supplier ledger | Balance summary plus transactions; collapsed date/filter panel; retain customer context |
| Reports/VAT | Compact period toolbar, persistent tab, nonblocking refresh; fold verbose help into details |
| Products | Compact warning summary, one row menu, clear stock status; recompute only under reviewed operational workflow |
| Settings | Short grouped sections, sticky Save when dirty, restricted destructive operations outside profile |
| Quotations/agreements/certificates | Edit and Preview tabs on phones; split preview on wide screens; legible document zoom |
| SuperAdmin logs | Fixed column widths, truncate with accessible detail drawer, group repeated errors; show failure state separately from no logs |
| More menu | Task group names, search, recent/favourite actions; avoid a long undifferentiated list |

## 8. Acceptance evidence

At 360, 390, 768, 820, 1024, 1180 and 1440 CSS px, create/edit/save/refetch must work with a software keyboard. No page-level horizontal scroll on core transaction forms. No hidden primary action, clipped dropdown, overlapping footer or lost dirty form. Table overflow is allowed only where a documented report comparison needs it and identity remains accessible.

Record screenshots and actual browser/API/database results for Owner and Staff using synthetic tenants. Include all relevant empty, loading, failed, stale, saving, success and permission-denied states. A screenshot with attractive spacing is not evidence that its save operation works.
