# HexaBill design system

ERP density. One identity. Tokens live in `frontend/hexabill-ui/src/styles/tokens.css` and `tailwind.config.js`. Do not add a second palette. Do not hardcode a tenant name.

## Color

| Token | Value |
|---|---|
| primary | `#2563EB` |
| primary hover | `#1D4ED8` |
| primary active | `#1E40AF` |
| background | `#F8FAFC` |
| surface | `#FFFFFF` |
| elevated | `#F1F5F9` |
| border | `#E5E7EB` |
| text | `#0F172A` |
| muted | `#475569` |
| success | `#059669` |
| warning | `#D97706` |
| danger | `#DC2626` |
| info | `#3B82F6` |
| disabled | opacity `0.4` |

Use `primary-*`, `neutral-*`, `success`, `warning`, `error`, `info`. SuperAdmin uses the same tokens. Its shell label is Platform, not a second hue.

## Type

Font: Inter, system-ui.

| Role | Size | Weight | Line |
|---|---|---|---|
| Page title | 20px | 600 | 1.25 |
| Section | 16px | 600 | 1.3 |
| Card title | 14px | 600 | 1.35 |
| Body | 14px | 400 | 1.5 |
| Small / helper | 12px | 400 | 1.4 |
| Label | 12px | 500 | 1.4 |
| Button | 14px | 500 | 1 |
| Table | 13px | 400 | 1.3 |
| Numeric | 13px | 500 | tabular-nums, right |

## Spacing

Only `4, 8, 12, 16, 20, 24, 32, 40, 48`. Page padding `12` mobile, `16` desktop. Section gap `16`.

## Size

| Control | Compact | Normal | Touch |
|---|---|---|---|
| Button / input / select | 32px | 36px | 44px |
| Table row | 36px | 40px | card or inner scroll |
| Icon nav / action / status | 16px | 16px | 20px |
| Icon-only hit area | 32px | 36px | 44px |
| Sidebar | 240px, collapsed 80px | | drawer, hidden |
| Header | 64px | | |
| Modal | `max-w-lg` default, max height viewport | | |
| Card padding | 12px | 16px | |
| Avatar | 32px | | |

Compact is the default inside POS, tables, and toolbars.

## Radius and shadow

`6px` controls, `8px` cards, `12px` modals, pill badges. Shadow only on menus and modals (`shadow-sm`, `shadow-lg`). Cards use border, not shadow.

## Icons

`lucide-react` only. Stroke 2. Size 16 in nav, rows, and fields. 20 for empty states. No emoji.

## Buttons

`Button` variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `success`, `icon`. Sizes: `sm` 32, `md` 36, `lg` 44. Every variant has hover, active, focus ring, disabled, and `loading`. One primary action per section.

## Forms

`Input` has label, required `*`, placeholder, helper, error, success, disabled, icon prefix. Compact height 36. Error sits under the field. Related fields use two columns from `768px`. One column below that.

## Tables

`ModernTable`: header `text-xs` muted, row hover `neutral-50`, selected `primary-50`, numbers `text-right tabular-nums`, actions on the right. Empty and loading states are inside the table. Horizontal scroll is on the table, not the page. Below `768px`, wide data can stay in that inner scroll.

## Cards, tabs, overlays

- Card variants: `default`, `metric`, `form`, `table`, `empty`.
- Tabs: underline, `primary-600` active, horizontal scroll, no wrap.
- Dropdown: surface, border, `shadow-lg`, min width 160.
- Toast: top-right, one line, semantic color.
- Badge: pill, semantic background at 100 and text at 800.
- Pagination: previous / next, current page text.
- Modal: header fixed, body scrolls, optional footer stays visible, `max-h` within the viewport, body scroll locked.

## Shell

Tenant: `Layout`. Desktop sidebar 240px with icon + label, collapse to icon + title. Mobile drawer only. Header holds tenant identity, page context, alerts, user menu.

Platform: `SuperAdminLayout`. Same tokens. No tenant nav items.

Page stack: shell, header, page title, actions, tabs, content. One vertical scroll on `main`. POS and ledger use the viewport shell (internal scroll).

## Breakpoints

`320, 375, 390, 430, 768, 1024, 1280, 1440, 1920`. Tailwind `sm 640`, `md 768`, `lg 1024`, `xl 1280`. No page-specific breakpoints.

## Overflow

`overflow-x-hidden` on the app shell. Tables scroll inside. Modals scroll inside. No nested page scroll. Fixed bars must not cover content (mobile bottom nav uses padding).

## POS

Two or three regions on desktop: search/products, cart, totals. Laptop tightens padding. Mobile stacks search, cart, checkout. Touch targets 44px. Speed over decoration.

Live route `/pos` renders `PosEnterprisePage` unless `VITE_POS_ENTERPRISE_V2=false` or `localStorage.hexabill_pos_enterprise_v2=0`, which keeps `PosPageLegacy`. Do not delete the legacy page in this pass. Do not change VAT, cart totals, invoice numbers, payment posting, or stock. Grand total type is `text-lg` / 600. Amounts stay the calculated values with the existing `AED` prefix.

## Tenant branding

The app header shows the resolved tenant name from `TenantBrandingContext` after a verified session. Platform chrome is labeled Platform. Never hardcode Surag, ZAYOGA, or HexaBill as a company name in tenant UI. Authentication branding rules are below.

## Authentication entry

Applies only to `/login`, tenant host `/login`, `/Admin26`, and `/login?invite=`. ERP pages do not inherit this background. Do not add a second palette. Primary stays `#2563EB`. The sign-in page is one centered card.

### Decision

One centered card. No second column at any width.

The built screen is a 50/50 split from `1024px`: white card on the left, full-height `bg-primary-600` on the right, a second HexaBill logo, a `28px` slogan, and an SVG of vertical bars. That layout is not the spec.

At `1024`, each side is about `512px`. The form is squeezed and the blue field is larger than the task. `#2563EB` as a full-height panel reads as a poster. The bars read as a chart. Login has no charts. The slogan does not say which company the user is entering. On a tenant host, that panel is platform identity beside the company. Those are different identities.

Brand stays in the card. Resolved company on a tenant host. HexaBill plus Admin Portal on `/Admin26`.

### Structure

1. One mark: tenant logo and company name, or the platform mark. Not both.
2. Heading and one line of context.
3. One inline alert when an operational error exists.
4. Fields, then one primary action.
5. Recovery note. No link to a flow that does not exist.
6. Footer: copyright only.

Shell: full viewport, column, centered, `overflow-x: hidden`. Padding `16px` below `768px`, `24px` from `768px`. Vertical padding `24px` when height is under `1280px`, `32px` from `1280px` when height allows. Footer sits `24px` under the card. It is not pinned over the form.

Card: `max-width: 400px`, width `100%`, `#FFFFFF`, `1px` border `#E5E7EB`, radius `8px`, padding `24px` below `1024px` and `32px` from `1024px`. Border, not a shadow. No glass, gradient, blur, or decorative shapes.

### Layout

| Viewport | Card | Alignment | Scroll |
|---|---|---|---|
| Desktop `1280`, `1366`, `1440`, `1920` | `400px`, padding `32px`, page padding `24px` | Center both axes | None when the card fits |
| Laptop `1024×768`, `1280×800` | Same card, vertical padding `24px` | Center | Page scroll only if the keyboard or a long error requires it |
| Tablet `768`, `820`, `834` | Same column. No split | Center | Same |
| Mobile `320`, `375`, `390`, `430` | Full width inside `16px` gutters. Padding `24px` | `32px` above the brand, then the card | Form scrolls. No horizontal overflow |

Mobile order: brand, heading, context, email, password, assistance, primary action, footer. Touch targets `44px`. Password visibility is a `44×44px` hit area. Input text `16px`. The submit control stays in the document flow.

### Pattern, color, border, radius

Page `#F8FAFC`. Static `24px` ledger grid on the page only. Lines `#E5E7EB` at about `45%` opacity. Not on the card. Not on ERP routes. No skyline, bars, illustration, motion, or glow.

| Surface | Light | Dark |
|---|---|---|
| Page | `#F8FAFC` | `#0B1220` |
| Card | `#FFFFFF` | `#121A22` |
| Input | `#FFFFFF` | `#0F172A` |
| Border | `#E5E7EB` | `#1E293B` |
| Text | `#0F172A` | `#F8FAFC` |
| Muted | `#475569` | `#8B9BB4` |

Primary button `#2563EB`, hover `#1D4ED8`, active `#1E40AF`. Danger `#DC2626`, warning `#D97706`, success `#059669`. Borders `1px`. Controls radius `6px`, card `8px`. Focus uses `--focus-ring`. Dark is not pure black and not a neon wash.

### Identity

| Host | What the card shows |
|---|---|
| `{slug}.{base}` valid tenant | Name and logo only after `GET /api/public/tenant-context`. The server resolves the host. Skeleton until that returns. HexaBill is not the company name. |
| Tenant, no logo | `32px` initial in primary, plus the name |
| Tenant context missing or unknown host | Platform mark and `Sign in`. The form still submits. The server rejects a bad host |
| `/Admin26` | HexaBill mark. Heading `Admin Portal`. Context `Platform administration`. No tenant logo or name |
| Marketing or localhost `/login` | HexaBill mark. Heading `Sign in`. Context `Access your company workspace.` |

Never hardcode a tenant name. Do not read a tenant id from the query, the body, or storage. Clear logo and name in state before the public context request so a previous company cannot remain on screen. Title is `{company name} | Sign in` after resolution, `Admin Portal` on the platform route, `Sign in` when unresolved.

`AuthService` and `TenantHostMiddleware` stay the authority. Display is not authorization. Platform account on a tenant host: log out, `This account belongs to the platform portal.` Tenant account on the platform host: log out, `This portal is restricted to platform administrators.` Do not name the other organization.

### Form

| Control | From `1024px` | Below `1024px` |
|---|---|---|
| Input and button height | `38px` | `44px` |
| Width | `100%` of the card | `100%` |
| Label | `12px` / `500` | same |
| Input text | `14px` / `400` | `16px` / `400` |
| Button | `14px` / `500` | same |
| Field gap | `16px` | `16px` |
| Icons | Lucide, stroke `2`, `16px` | same |

Email: label `Email address`, required `*`, `type="email"`, `inputmode="email"`, `autocomplete="username"`. Prefix `Mail`. Error under the field, `aria-invalid` and `aria-describedby`.

Password: label `Password`, prefix `Lock`, visibility `Eye` / `EyeOff`, `autocomplete="current-password"`. The toggle and any error icon do not share a slot. `aria-label` is `Show password` or `Hide password`.

Validate on blur and submit. Login: email required and a normal email pattern; password required, minimum `6`. Invite: both passwords required, minimum `8`, and they must match. Field text sits under that field only.

One primary button. Full width. No gradient, pill, or extra shadow. Disabled opacity `0.4`. While submitting: label `Signing in…`, button disabled, email kept, password kept, one request.

Assistance is text, not a link: `Need password help? Contact your company administrator.` There is no reset endpoint. Do not draw a reset form.

Footer: `© {current year} HexaBill`.

### Copy

Keep: `Sign in`, `Email address`, `Password`, `Admin Portal`, `Platform administration`, `Access your company workspace.`, `Set your password`, `This invite works only on your company address and can be used once.`, `Set password`, `Back to sign in`, `Need password help? Contact your company administrator.`, `Company sign in`.

Remove: `A better way to run the day.`, `Invoices, sales, and stock stay on one record.`, `Company work stays on its own address.`, the bar graphic, and the second logo.

### States

| Case | Copy |
|---|---|
| `400` and `401` | `Incorrect email or password.` |
| `403` | `This account cannot sign in here.` |
| `429` | `Too many sign-in attempts. Try again in 15 minutes.` The button stays disabled. |
| `500` and other server failure | `Something went wrong. Try again.` |
| Network or timeout | `Unable to reach the server. Check your connection and try again.` Include `Retry`. |

One alert, `role="alert"`. Do not also toast the same sentence. No stack traces, tenant ids, JWT contents, or endpoint paths.

Success: store the session the way login already does, then route. `mustChangePassword` goes to `/profile?forcePassword=1`. Platform success goes to `/superadmin/dashboard`. Tenant success goes to `/dashboard`. No success toast.

Invite uses the same card. Heading `Set your password`. After success, replace to `/login`. Invalid, expired, used, or wrong host: `This invite is invalid or no longer available.`

No `Ctrl+L`. Tab order: email, password, visibility, submit. Enter submits. `prefers-reduced-motion`: no shake, no looping motion. A button spinner may stay.

### Bugs recorded, not fixed

| Item | Current | Expected | Severity | Location |
|---|---|---|---|---|
| Split panel | `BrandAside` is `lg:w-1/2` with a `28px` slogan | No second column | High | `frontend/hexabill-ui/src/auth/Login.jsx` |
| Bars | SVG rectangles at the bottom of the panel | No chart on login | High | same |
| Two marks | Card mark and panel logo | One mark, inside the card | Medium | same |
| Stale logo | Tenant login path spreads previous branding and does not clear `companyLogo` before the request or on failure | Clear name and logo before the request | Medium | `frontend/hexabill-ui/src/tenant/TenantBrandingContext.jsx` |
| Footer year | Literal `2026` | Current calendar year | Low | `Login.jsx` |

Same file still holds login, invite, and platform. Keep it that way. Do not add a file per line. Host checks in `AuthService` and invite rules in `AuthController` stay. Signup is not this focus.

## Dashboard (Focus 02)

Applies only to tenant `/dashboard` (`DashboardTally`). SuperAdmin `/superadmin/dashboard` is not this page. Do not copy the authentication background, grid, or card onto this route.

The dashboard answers, in order: what moved in the selected period, what needs a person, what to do next, then trend. It is not a second navigation system.

### Structure

One column inside `Layout` `main`. Same gutters as other tenant pages: `12px` below `768px`, `16px` from `768px`. Section gap `16px`. Do not give each section its own width. From `1440px` content width, cap the column at `1600px` and left-align it. `1280` and `1366` use the full main area (sidebar already consumed `240px`).

Order:

1. Title row. `Dashboard` at `20px` / `600`. Period control and refresh on the same row from `768px`. No second title inside a black panel. The shell already shows the tenant name. Do not repeat `Dashboard` there.
2. Setup checklist, only while incomplete and not dismissed. Same conditions as now (`isAdminOrOwner`, `getSetupStatus`, local dismiss key). Surface, `1px` border, compact checklist. Not a blue banner.
3. Four position metrics.
4. Needs attention.
5. Daily actions.
6. Sales trend, then top customers and top products.
7. Branch breakdown, only for Admin/Owner when the summary returns branches.

### Period

`Today`, `Week`, `Month`, `Custom`. One selected state: primary fill, white label. Unselected: surface, `1px` border, text color. Height `36px` from `768px`, `44px` below. Refresh is an icon button (`RefreshCw` `16px`) at the same height, not a fifth equal chip. Disabled while a request is in flight. Custom opens the two existing date inputs on the next row. Changing either date refetches and keeps the range. No second date control on the page.

Staff with more than one branch keep the existing branch select on this row. One option list. Do not add a branch filter for Admin/Owner; their summary is already company-wide.

Labels on the metrics follow the selected period (`Today`, `This week`, `This month`, or `Period`). Do not append the period word to every card title.

### Metrics to keep

Source is `GET /api/reports/summary` (`SummaryReportDto`). Display with `formatCurrency`. Do not hardcode a currency code. Do not recompute these on the client.

| Card | Field | Who | Click |
|---|---|---|---|
| Net sales | `netSalesToday` | Anyone `canShow('netSalesToday')` allows | No. Not a link. |
| Collections | `cashCollectionsTotal` | Same `canShow('cashCollections')` rule as now | No |
| Profit | `profitToday` | Admin or Owner, and `canShow('profitToday')`. Hidden for Staff. API already nulls Staff profit | No |
| Receivables | `pendingBillsAmount` | `canShow('pendingAmount')` | `/reports?tab=outstanding` for Admin or Owner only. Staff: show the number, no route they cannot open |

Net sales helper line, `12px` muted, not extra cards: gross `salesToday` and returns `returnsToday` (`returnsCountToday` in the same line). Collections helper: on-account `creditInvoicedTotal`. Profit helper: purchases `purchasesToday` and expenses `expensesToday` when that role already sees expenses. These helpers replace the Activity row.

Card: `1px` border, radius `8px`, padding `12px` below `768px` and `16px` from `768px`. No shadow. No left stripe. No tinted icon tile. Label `12px` / `500` muted. Value `24px` / `600`, `tabular-nums`. Helper `12px`. Icon `18px`, Lucide, stroke `2`, muted, one meaning per card (`DollarSign`, `Banknote`, `TrendingUp`, `Wallet`). A positive profit uses success text. A negative profit uses danger text. Other values stay text color. Color is not decoration.

Clickable cards: the whole card is the control (`button` or `role="button"`), hover `neutral-50`, visible focus ring, Enter and Space. No nested buttons. No lift, tilt, or shadow change.

### Metrics to remove as cards

Gross sales, return value, purchases, expenses, and on-account sales as their own cards. They are the helper lines above.

`invoicesToday`, `invoicesWeekly`, and `invoicesMonthly` are returned and not rendered. Leave them off the page.

### Needs attention

This block sits above the chart and above daily actions. One section heading `Needs attention` at `14px` / `600`. Rows, not large tiles. A row renders only when its count or amount is greater than zero, except the empty line `Nothing needs attention in this period.` when every row is zero.

| Row | Show | Tone | Action |
|---|---|---|---|
| Overdue | `overdueCustomersCount` and `overdueAmountTotal` in one row. `58 customers · {amount}` | Warning text and a `2px` warning left border. Not a full yellow card | `/reports?tab=overdue` |
| Unpaid bills | `pendingBills` and `pendingBillsAmount` in one row | Warning, same treatment | `/reports?tab=outstanding` |
| Low stock | Count of `lowStockProducts` | Danger only when count > 0 | `/products?tab=lowStock` |
| Damage | `damageLossToday` | Danger | No new route. Do not link this until a returns report exists. The number stays visible |
| VAT | `netVatPayablePeriod`, Owner only | Info, not a warning. Copy: `Estimate. File on VAT Return.` | `/vat-return` |

Do not send VAT to `/reports?tab=summary`. The VAT Return page is the filing surface. Pending amount must be clickable for Admin/Owner; it currently is not. Damage currently has no click; do not invent a destination.

Row height about `44px`. Amount `tabular-nums`. Trailing `ChevronRight` `16px` only when the row navigates.

Copy stays operational: Overdue, Unpaid bills, Low stock, Damage, VAT estimate. No insight, smart, or AI wording. No sparkle, wand, or robot icon.

### Daily actions

One row. Height `36px` from `768px`, `44px` below. Icons `16px`.

| Action | Style | Route | Shortcut label |
|---|---|---|---|
| New invoice | Primary. One primary in this section | `/pos` | `F3`, desktop only, `12px` muted |
| New purchase | Outline. Admin or Owner | `/purchases?action=create` | `F4` |
| Customer ledger | Outline | `/ledger` | `F10` |
| Expense | Outline. Label `Expenses` for Admin or Owner, `Add expense` for Staff | `/expenses` | Do not print `F5`. `F5` is the browser reload key |

Remove Backup from this row. Backup stays in the sidebar and on `Ctrl+B`. Remove the Sales Ledger and Expenses poster cards under the actions (`border-2`, indigo and purple). Those routes stay in the sidebar and in More.

### Navigation

Remove the right gateway (`lg:w-72`, Masters / Transactions / Reports / Utilities). It repeats `Layout` sidebar items, including Users, Backup, and Reports. Do not replace it with a compact duplicate list.

Mobile bottom nav stays Home, History, POS, Ledger, More. POS stays the center action. Dashboard does not add tabs. More stays the place for less frequent modules. Do not add a dashboard search.

### Charts and lists

Sales trend stays a bar chart, one series, `sales`. Height `160px` (`140px` below `768px`). No legend. Tooltip uses `formatCurrency` and one date format. Axes and bar use the theme tokens (`--text-tertiary`, `--border`, `--primary`). Do not hardcode `#3B82F6`, `#ffffff`, `#e5e7eb`, or `#6b7280`.

Empty or all-zero series: do not mount a tall empty chart. One line: `No sales in this period.` Primary text button `Create invoice` to `/pos` when the user can open POS.

Top customers and top products stay, capped as the API already returns them, two columns from `1024px`, stacked below that. Row click: customer to `/ledger?customerId=`, product to `/products?productId=`. Amounts right-aligned, `tabular-nums`. Hide a list when it is empty. Do not add a donut.

Branch breakdown stays for Admin or Owner when the list is non-empty. Render it as rows with the same type scale, not a second card language. Keep the existing note that branch expenses omit company-level expenses. Row click stays `/branches/{id}`.

### Layout by viewport

| Viewport | Metrics | Attention and actions | Chart |
|---|---|---|---|
| Desktop `1280`, `1366`, `1440`, `1920` | 4 columns | Attention as one row of items if they fit; actions one row | Trend full width of the column. Top lists beside each other |
| Laptop `1024×768`, `1280×800` | 4 columns, padding `12px` | Same, no extra section gap | Chart height `160px` |
| Tablet `768`, `820`, `834` | 2×2 | Attention stacked. Actions wrap to two columns, still `44px` tall | Chart full width. Top lists beside each other |
| Mobile `320`, `375`, `390`, `430` | 2 columns. Net sales and collections first. Profit and receivables on the next row, still visible, not dropped | Attention first after the four numbers. One full-width primary `New invoice`. Other actions as outline, full width | Chart after actions. Then top lists, one column |

No horizontal page scroll. Bottom nav must not cover the last row (`safe-area` padding already on the shell). Touch targets `44px`. Page title comes from the shell on small screens; do not add a second `20px` title under it.

### Type, icon, color, border, radius, surface

Use the tables at the top of this file. Inter only.

| Role | Size | Weight |
|---|---|---|
| Page title | `20px` | `600` |
| Section | `14px` | `600` |
| Metric label | `12px` | `500` |
| Metric value | `24px` | `600`, tabular |
| Helper, row meta | `12px` | `400` |
| Button | `14px` | `500` |

Do not uppercase section labels. Do not use `text-xl` on `Quick Actions`.

Icons: Lucide, stroke `2`. `16px` on buttons and rows, `18px` on metric cards, `20px` on the empty chart state. No emoji. No colored discs behind icons.

Color: primary for the selected period and New invoice only. Success, warning, and danger only for profit sign, overdue, unpaid, low stock, and damage. Remove `purple`, `orange`, `indigo`, `yellow-50`, `red-50`, `emerald-50`, and `blue-50` from this page. Borders `1px` `--border`. Radius `6px` on controls, `8px` on cards. Cards have no shadow. Motion `150ms` color only. `prefers-reduced-motion`: refresh icon does not spin.

Dark: use `[data-theme='dark']` / `.dark` in `tokens.css` (`--bg-base`, `--bg-raised`, `--text-primary`, `--border`, `--primary`). Do not use the authentication dark page. Do not hardcode chart colors. Semantic tokens stay `--success`, `--warning`, `--error`.

### Loading, error, empty

First load with no figures yet: skeleton bars on the four values only. Header, period, and actions stay usable.

Refresh and period change: keep the previous numbers on screen. Spin the refresh icon. Do not set the values to `opacity-0`. Do not blank the page.

Summary failure: one alert on the metric block, `Unable to load this period.` Button `Retry`. No toast. Do not put `error.message` on screen. Actions still navigate. Setup checklist is a separate request; its failure stays silent (already `.catch`).

`GET /api/reports/summary` currently returns `Success: true` and an empty DTO after an exception. The page then shows zeros and looks healthy. That is a defect. Expected: a failed response so this alert can show. Do not treat all-zero as an error when the request succeeded.

Custom with no dates yet: the page currently falls back to the last seven days. Keep that until the user picks dates. Do not fire a request with empty dates.

### Permissions

Keep server rules. Staff profit is null from the API. Do not show profit from another field. VAT row is Owner only, matching the current card. Purchases action and branch breakdown stay Admin or Owner. Staff branch select stays.

`canShow`: Owner bypasses. Empty `dashboardPermissions` still shows every permitted card (current legacy rule). Do not change that rule here.

### Tenant and dates

Summary cache key on the server already includes `tenantId`. Client response cache must not survive logout or a host change. Today it is cleared when branding reloads, not when `logout()` runs. Expected: clear the summary cache on logout so the next user on the same browser does not see the previous summary for up to 60 seconds.

Do not send `tenantId`. Do not read a tenant id for these figures.

Dates sent to the API must be the tenant-local calendar day `YYYY-MM-DD`, not UTC. `toISOString().split('T')[0]` is UTC and can be the previous day after local midnight in UTC+ timezones. The API then converts that civil date with the tenant timezone (`ConvertToUtc`, end date exclusive next midnight). Fix the client date string. Do not change the server day window in this focus.

Week is currently Sunday through today because `Date.getDay()` uses Sunday. Leave that until product picks Monday or Saturday. Record only.

Display dates with one formatter. The chart title must not print raw `YYYY-MM-DD` while rows use another pattern.

### Keyboard

Shortcuts live in `Layout.jsx`, not on this page. Skip them while focus is in a field. Do not add dashboard-only keys.

| Key | Action | Who |
|---|---|---|
| `F3` | `/pos` | Anyone |
| `F4` | `/purchases` | Admin or Owner |
| `F7` | `/reports?tab=sales` | Admin or Owner |
| `F8` | `/reports?tab=profit-loss` | Admin or Owner |
| `F9` | `/reports?tab=outstanding` | Admin or Owner |
| `F10` | `/ledger` | Anyone |
| `Ctrl+B` | `/backup` | Admin or Owner |
| `Ctrl+U` | `/users` | Admin or Owner |
| `Ctrl+S` | `/settings` | Admin or Owner |
| `Ctrl+\` | Collapse sidebar | Anyone, not while typing |

The New invoice shortcut caption is `F3`. Customer ledger is `F10`, matching `Layout.jsx`. The gateway that labeled Sales ledger `F10` is gone.

`F5` currently navigates to `/expenses` and calls `preventDefault`, which blocks browser reload. Do not add an `F5` caption. Changing that handler is shell work, not this page. `F1` to `/products` is the same class of global shortcut. Keep both as they are until a shell pass.

These keys are not a mobile interface.

### Accessibility

Period, refresh, actions, and attention rows are real buttons. Metric cards that navigate are buttons. Lists that navigate are buttons or links, not click-only `div`s. Visible focus uses `--focus-ring`. Section titles are `h2`. Status is text plus color (overdue, unpaid, low stock, damage), not color alone. Chart has an `aria-label` of the period and total. Decorative icons `aria-hidden`.

### Performance

One summary request per period change. The 60-second client throttle and the duplicate-request guard stay. Do not add a store. `getSetupStatus` runs once for Admin or Owner. The 2-minute visible poll and the `dataUpdated` refetch stay. Do not refetch on every render. Route is already `React.lazy`. Chart imports stay on this page only.

### Shared shell notes

- `F5` and `F1` in `Layout.jsx` still override browser defaults. Not changed.
- Logout clears the GET response cache, including `/api/reports/summary`.
- Failed summary still returns an empty success body from the API. Not changed. The page cannot tell that case from a real zero period.

### Bugs to preserve as records

| Item | Current | Expected |
|---|---|---|
| Period dates | Fixed on the dashboard. Local `YYYY-MM-DD` | Tenant-local calendar day |
| Summary exception | API still returns HTTP 200, `Success: true`, zeros | Failure the page can show as retry |
| Refresh | Fixed. Previous numbers stay. Refresh icon shows busy | Keep numbers, icon shows busy |
| Unpaid and damage | Fixed. Receivables and unpaid open outstanding when the role can. Damage is not a link | Unpaid navigates when allowed. Damage does not look clickable |
| VAT | Fixed. Owner row opens `/vat-return` | `/vat-return` |
| Ledger shortcut caption | Fixed. Caption is `F10` | `F10`, matching `Layout.jsx` |
| Logout cache | Fixed. `logout()` clears the GET cache | Cleared on logout |
| Setup status | Fixed. One request, not inside the summary fetch | Once |

Unresolved: which weekday starts `Week`. No returns-report route for damage. Do not add one here.

## Expenses (Focus 03)

Applies only to tenant `/expenses` (`ExpensesPage`). The tenant page follows this section. Do not copy the authentication background onto this route. No new tabs. One file stays the module.

The page answers, in order: what the period cost, which records need VAT, then the ledger. The chart is not the first screen.

### Structure

One column inside `Layout` `main`. One page scroll. The table may scroll horizontally inside itself. Dialogs scroll inside. Gutters match other tenant pages: `12px` below `768px`, `16px` from `768px`. Section gap `16px`. Cap the column at `1600px` from `1440px` content width and left-align it.

Order:

1. Title `Expenses` at `20px` / `600`. On small screens the shell already shows the page name; do not add a second title under it.
2. One primary action, Add expense. Everything else is secondary or in a menu.
3. One filter row.
4. One compact summary line.
5. Missing VAT row, only when the count is above zero.
6. Ledger.
7. Expense breakdown, after the ledger, only when period totals exist.

### Header actions

Primary: Add expense. Primary fill, height `36px` from `768px`, `44px` below. Icon `Plus` `16px`. Radius `6px`. One primary on the page.

| Action | Who | Treatment |
|---|---|---|
| Refresh | Anyone | Icon button `RefreshCw` `16px`. Same height as Add expense. Spins only while the list reloads. `prefers-reduced-motion`: no spin |
| Export | Admin or Owner | One menu. Items: CSV, PDF. Not two bordered buttons. Not green or rose |
| Category VAT | Admin or Owner | Same menu, or the menu’s second group. Not a peer of Add expense |
| Recurring | Admin or Owner | Same menu. Opens the existing recurring list |
| VAT Return | Admin or Owner who can open `/vat-return` | Text link, not a filled button. Staff do not see it |

Do not show six equal buttons. Do not color exports. Delete stays on the row and in the existing bulk action, not in the header.

### Filter and search

One row. Do not keep a second band of ten pills above a separate From / To / Apply block.

| Control | Behavior |
|---|---|
| Date preset | Existing presets, including FTA quarters Q1 Feb–Apr, Q2 May–Jul, Q3 Aug–Oct, Q4 Nov–Jan. Selecting a preset sets from and to and reloads. Selected preset uses primary fill. Others are surface and `1px` border |
| From, To | The two date inputs already on the page. Changing either reloads. Do not add a separate Apply control if the inputs already update the range. Invalid range (to before from): do not request; show `End date is before the start date.` under the fields |
| Branch | Existing branch filter. Staff with one assigned branch stay locked to it |
| VAT missing | Existing `No VAT data only` toggle. It filters the loaded rows. Admin or Owner |
| Search | Placeholder `Search this page`. Matches category name and note, the only fields `filterExpenses` checks. Debounce `300ms`. Clearing search restores that page. It does not clear the date range, branch, or VAT toggle |

The list API has no search parameter and the page size is `10`. Say so in the field helper: `Searches the rows on this page.` Do not invent server search.

Route stays a ledger column. Do not add a route filter unless the list request already accepts one. It does not.

Group by stays available as one select on this row (none, weekly, monthly, yearly). When a group is chosen, the existing aggregated table replaces the row ledger for that view. Do not show both at full height.

### Summary

One line, not five cards. Numbers from `GET /expenses/summary` (`formatCurrency`). Label `12px` / `500`. Value `14px` / `600`, `tabular-nums`.

| Figure | Source |
|---|---|
| Total | `totalAmount` |
| VAT | `totalVat` |
| Claimable VAT | `totalClaimableVat` |

Helper on the same line, `12px` muted: average per day (the existing day count) and top category only when it is computed from the same period summary, not from the current page. Until the chart totals are period-wide, omit top category. Do not color the three figures differently. Claimable uses success text only as the existing claimable meaning, not as decoration.

VAT readiness counts (eligible, petroleum, exempt, pending, rejected) stay one muted line under the summary when any count is above zero. They are not a second card block. Petroleum and exempt copy stays as it is: excluded or not claimable. Do not call it a readiness score.

### Missing VAT

When `noVatCount > 0` and the user is Admin or Owner:

`Missing VAT` · `{count} expenses need VAT` · button `Review`

Amber text, `2px` warning left border, height about `44px`. Review turns on the existing no-VAT filter. It does not open a new page. Zero count: the row is absent.

Bulk VAT stays the existing dialog, rate `0.05`, interpretations add-on-top and extract. Do not add another rate.

### Ledger

This is the work surface. Columns, in this order. Keep every one. Do not drop a column to shorten the table.

| Column | Align |
|---|---|
| Select | Center. Admin or Owner. The existing checkbox. Page rows only |
| Date | Left. One format, `dd/mm/yyyy` |
| Category | Left. Name. No color disc on every row |
| Note | Left. Truncate with the full note on hover |
| Branch | Left |
| Route | Left |
| Amount | Right, `tabular-nums` |
| VAT | Right, `tabular-nums`. Empty when VAT was not entered. Do not show `0` for missing |
| Claimable VAT | Right, `tabular-nums` |
| Total | Right, `tabular-nums`, `500` |
| VAT period | Left. Existing FTA quarter label |
| Status | Left. Pending warning, Approved success, Rejected danger. Text plus color |
| Actions | Right |

Row height about `40px`. Cell text `13px`. Header `12px` / `500`, muted. Row hover `neutral-50`. No vertical rule on every column. A `1px` line between rows is enough. Numbers do not wrap.

The whole row is not a link. The note and category are not a second click target.

Actions, icon only, `16px`, hit area `32px` from `768px` and `44px` below. Each has an accessible name.

| Action | Who | Result |
|---|---|---|
| Edit `Pencil` | Admin or Owner | Existing edit modal |
| Delete `Trash2` | Admin or Owner | Existing confirm, then delete. No undo. Disable the confirm while the request runs |
| Approve / Reject | Admin or Owner, status Pending | Existing actions. Do not add them for other statuses |

Staff do not get edit, delete, approve, or reject. A Staff row has no action icons. View is the row itself: the columns already show the record. Do not add a view modal.

Bulk delete stays for the selected rows, Admin or Owner, with the existing confirm. It cannot be undone.

Empty list: `No expenses in this period.` Admin or Owner who can add: text button `Add expense`. Staff with no assigned branch: `No expenses in your assigned branch(es) for this period.` Do not offer Add expense in that empty state if the create call would be rejected; Staff with a branch may still add.

Pagination stays previous / next and the current page. Page size stays `10`. Changing the date range or branch resets to page 1, because the result set changed. Search and the VAT toggle do not change the page, because they only filter the loaded rows. After save or delete, reload the current page and keep the date range.

Sort stays the API order: date descending. Do not add column sort. The list endpoint does not accept a sort field.

### Create and edit

Same modal and the same fields. Do not add fields.

| Field | Required | Notes |
|---|---|---|
| Date | Yes | Default today, local calendar day |
| Category | Yes | Existing list. New category stays the existing prompt, Admin or Owner |
| Amount | Yes | Greater than zero. Inline error under the field |
| Include VAT | No | Existing checkbox. When on: include or extract, tax type Standard / Petroleum / Exempt, claimable, entertainment, partial percent `0–100` |
| Branch | Yes for Staff | Company-level remains allowed for Admin or Owner when the form already allows an empty branch |
| Route | No | Only routes for the chosen branch |
| Note | No | Full width |

Desktop: date and category on one row, amount and VAT on the next, branch and route on the next, note full width. Below `768px`: one column. Control height `36px` from `768px`, `44px` below. Labels `12px` / `500`. Error `12px` under the field. One operational alert if the save fails. Text: `Could not save this expense.` Do not show `error.message`.

Tab order follows the field table. Enter submits the form. Save shows `Saving…` and disables the button. Success closes the modal, reloads the current page, and keeps the date range, branch, search, and VAT toggle. Do not jump to page 1 when the current page is still valid.

Edit opens the same form with the record’s values. Staff never see Edit.

### Recurring

The menu opens the existing list. Create uses the existing create call. Edit and delete buttons that toast “coming soon” come off the row. The API has list and create only. Do not design pause, resume, edit, or delete until those endpoints exist. Recurring is not a section above the ledger.

### Export

CSV and PDF use the current from, to, and branch. They do not include the page-only search text, because the export API has no search. Admin or Owner only, matching `[Authorize(Roles = "Admin,Owner,SystemAdmin")]`. While a file is requested, that menu item shows busy and a second click does nothing. Failure: `Could not export expenses.` Empty range still downloads whatever the API returns. Do not build a client-side file from the current page.

### Chart

After the ledger. One series question: how the period total splits by category. Use the period summary, not the ten rows on the page. Until category totals for the period exist on the summary, do not draw the chart. A page-sized pie is the current defect and must not ship as the visual.

When period categories exist: bar or donut, top categories plus Other if there are many. One neutral series plus primary for the largest. Do not paint each category from `ColorCode`. No legend if the labels are on the bars. No 3D.

No expenses in the period: do not mount a chart. `No expenses in this period.` and Add expense when the user can add.

### Layout

| Viewport | Behavior |
|---|---|
| Desktop `1280`, `1366`, `1440`, `1920` | Title and Add expense on one row. Filters one row. Summary one line. Ledger next, full width of the column. Chart below |
| Laptop `1024×768`, `1280×800` | Same. Filter wraps before the ledger is pushed down. Control height `36px` |
| Tablet `768`, `820`, `834` | Filters wrap. Ledger remains a table with inner horizontal scroll. Do not shrink type below `13px` |
| Mobile `320`, `375`, `390`, `430` | Add expense full width, `44px`. Search, then date, then branch and VAT. Summary one column of three figures. Then records. No chart before the records. No page-level horizontal scroll |

Below `768px` each expense is one block, not twelve squeezed columns: category, date, total, VAT or `VAT missing`, branch, status. Actions on the block, `44px`. The desktop table is `hidden` below `768px`. The card list is `hidden` from `768px`.

### Type, icon, color, surface

Inter. Tokens at the top of this file.

| Role | Size | Weight |
|---|---|---|
| Page title | `20px` | `600` |
| Section | `14px` | `600` |
| Body, buttons | `14px` | `400` / `500` |
| Table | `13px` | `400` |
| Summary value | `14px` | `600`, tabular |
| Label, helper | `12px` | `500` / `400` |

Lucide, stroke `2`. `16px` on buttons and row actions. `20px` on the empty chart. No emoji. No category color dots.

Primary on Add expense and the selected date preset only. Success, warning, and danger only for status, claimable, missing VAT, and delete. Borders `1px`. Radius `6px` controls, `8px` cards and the modal stays `12px`. No card shadow. Menu and modal use the existing overlay shadow. Page background is the ERP surface, not the sign-in page.

Dark: `[data-theme='dark']` / `.dark` in `tokens.css`. Table, inputs, menu, and dialog use `--bg-base`, `--bg-raised`, `--text-primary`, `--border`. Do not invert the light page.

### States

Initial load: the filter row stays usable. The ledger area shows skeleton rows. Do not replace the page with a full-screen loading card.

Date, branch, or refresh: keep the current rows until the new list arrives. The refresh icon shows busy.

Save and delete: the button shows busy. A second submit does nothing.

Export: only the export item is busy.

List failure: the ledger shows `Unable to load expenses.` and Retry. Summary failure does not clear a list that loaded. Chart failure hides the chart. Do not toast the server exception text.

`GET /expenses` currently returns `ex.Message` on failure. The page must not render that string. Expected copy is the sentence above.

### Permissions

| Action | Staff | Admin or Owner |
|---|---|---|
| List | Assigned branches only. No branches assigned: empty | Company, optional branch filter |
| Create | Yes. Saved as Pending | Yes. Saved as Approved |
| Edit, delete, approve, reject, export, category VAT, recurring, bulk VAT, bulk delete | No | Yes |

Backend role checks stay authoritative. Hiding a Staff button is not the security control.

### Tenant

`CurrentTenantId` on every expense call. The page does not send a tenant id. Categories, branches, routes, exports, and VAT figures come from that tenant. Do not hardcode a company name.

Date range and branch are stored in `localStorage` without a tenant key. A later session on the same browser can open with the previous tenant’s range and branch id. Record only. Do not redesign that storage in this focus.

### Dates

Preset from/to must be the local calendar day `YYYY-MM-DD`, not `toISOString().split('T')[0]`. The list query compares `Date >= from` and `Date <= to` as received. Summary uses the start of that day through the end of the to day. Those windows do not match, so the ledger can omit rows the cards include. Do not change either rule in this focus. Record the mismatch.

Display dates as `dd/mm/yyyy`. Do not print raw `YYYY-MM-DD` in the table.

### Accessibility

Filters, Add expense, row actions, Review, and pagination are buttons. Date fields have labels. Icon actions have accessible names. Status is a word, not only a color. Focus uses `--focus-ring`. `prefers-reduced-motion`: refresh does not spin.

### Performance

Keep one list fetch per page or filter change. Summary and VAT readiness stay separate calls, and a failure of one does not cancel the others. Do not add a store. Search stays on the rows already loaded. Page size stays `10`. Do not draw a chart from those ten rows.

### Bugs to preserve as records

| Item | Current | Expected |
|---|---|---|
| Search | Current page, category and note only | Stays page-local until the API has search. The field says so |
| Chart | Page no longer draws the pie | Period categories, or no chart |
| End date | List uses `Date <= to`. Summary uses the end of the to day | Same window. Not changed here |
| Preset dates | Page uses local `YYYY-MM-DD` | Local `YYYY-MM-DD` |
| List error | Page shows `Unable to load expenses.` and Retry | `Unable to load expenses.` |
| Recurring | Edit and delete buttons are off the list | Those buttons stay off. Create and list stay |
| Stored range | `localStorage` has no tenant key | Recorded. Not moved in this focus |
| VAT Return | Hidden from Staff on this page | Hidden when Staff cannot open the page |

Unresolved: no server search. No recurring update or delete endpoint. Bulk VAT rate stays `0.05`. List and summary date windows are not aligned. Do not invent a new tax rule.
