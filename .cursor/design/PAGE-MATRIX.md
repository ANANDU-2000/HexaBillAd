# Page matrix

Live routes only, from `src/app/App.jsx`. Status starts `todo`.

| Page | Route | Role | Layout | Tabs | Forms | Tables | Dialogs | Actions | Responsive | Problem | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Login | /login | Public / tenant host | Centered card, 400px | No | Yes | No | No | Sign in | One column at every width | One card. Empty submit shows field errors | verified |
| Platform login | /Admin26 | SystemAdmin | Same card | No | Yes | No | No | Sign in | Same card | Same card, Admin Portal | verified |
| Invite | /login?invite= | Public tenant | Same card | No | Yes | No | No | Set password | Same card | Same card on the company address. Empty submit asks for 8 characters. Password was not set | verified |
| Signup | /signup | Public | Centered card, 400px | Steps | Yes | No | No | Create account | One column | One card. Continue is the primary action | verified |
| Dashboard | /dashboard | Tenant | Layout | No | Period | No | No | Period, one primary | 4 metrics, attention, actions | Period stays in the address. Overdue and unpaid open outstanding. Net sales and receivables are the strong numbers | verified |
| POS | /pos | Tenant | Viewport | No | Cart | Cart lines | Payment, print | Checkout | Regions stack | Signed-in PosEnterprisePage opened. Empty cart. Save stays disabled until a line exists | verified |
| Sales ledger | /sales-ledger | Tenant | Viewport | Filters | Filters | Yes | Preview | Print, export | Inner scroll | Signed-in page opened with the current month, Show, and export actions | verified |
| Billing history | /billing-history | Tenant | Layout | No | Filters | Yes | Preview | Print | Table scroll | Signed-in page kept filters and showed one invoice | verified |
| Returns | /returns/create | Tenant | Layout | No | Yes | Lines | Confirm | Save return | Stack | Signed in. No invoice id stays on the page. | verified |
| Products | /products | Tenant | Layout | No | Filters | Yes | Product form | Add, import | Table/cards | Signed in. One product listed. | verified |
| Product detail | /products/:id | Tenant | Layout | No | Yes | Stock | Confirm | Save | Stack | Signed in. Product, prices, and stock movements opened. | verified |
| Price list | /pricelist | Tenant | Layout | No | No | Yes | No | Print | Table scroll | Owner can open it. One product price shown. | verified |
| Customers | /customers | Tenant | Layout | No | Filters | Yes | Customer form | Add | Table scroll | Signed in. Empty customer list. | verified |
| Customer detail | /customers/:id | Tenant | Layout | Yes | Yes | Ledger | Payment | Save | Stack | Signed in. Customer details opened. | verified |
| Customer ledger | /ledger | Tenant | Layout | No | Filters | Yes | Payment | Record | Table scroll | Signed in. Filters and cash customer line shown. | verified |
| Payments | uses ledger/modals | Tenant | Layout | No | Yes | Yes | Payment | Save | Modal scroll | Signed in. Payment form opened and closed without saving. | verified |
| Purchases | /purchases | Tenant | Layout | No | Yes | Yes | Confirm | Add | Table scroll | Ledger first. Filters and pay on the demo company at 1280 and 375. | verified |
| Suppliers | /suppliers | Tenant | Layout | No | Yes | Yes | Form | Add | Table, cards under 768px | Row opens detail. Search, overdue, and page stay in the URL. | verified |
| Supplier detail | /suppliers/:name | Tenant | Layout | Summary, Ledger, Bills, Paid | Payment | Ledger | Payment | Pay, statement PDF, share | Stack, tabs scroll | Statement PDF uses the applied date range. Back keeps the list query. | verified |
| Inventory | /stock-adjustments | Tenant | Layout | No | Yes | Yes | Adjust | Save | Table scroll | Signed in. Empty adjustment range. | verified |
| Expenses | /expenses | Tenant | Layout | No | Yes | Yes | Form | Add, export | Ledger then chart | Signed in. Empty period ledger and totals. | verified |
| Reports | /reports | Owner | Layout | Yes | Filters | Yes | No | Export | Charts stack | Signed in. Report tabs and filters opened. | verified |
| Outstanding | /reports/outstanding | Owner | Layout | Yes | Filters | Yes | No | Export | Same | Signed in. Same reports page on the outstanding route. | verified |
| VAT return | /vat-return | Owner | Layout | Yes | Yes | Yes | No | File | Stack | Signed in. Period selector opened. | verified |
| Worksheet | /worksheet | Owner | Layout | No | Yes | Yes | No | Save | Inner scroll | Signed in. Period totals shown. | verified |
| Branches | /branches | Owner | Layout | No | Yes | Yes | Confirm | Add | Cards | Signed in. Main branch listed. | verified |
| Branch detail | /branches/:id | Owner | Layout | Yes | Yes | Yes | Confirm | Add route | Stack | Signed in. Branch summary opened. | verified |
| Routes | /routes | Owner | Layout | No | Yes | Yes | No | Open | List | Signed in. Routes tab lists the route. | verified |
| Route detail | /routes/:id | Owner | Layout | Yes | Yes | Yes | Map | Save | Stack | Signed in. Route opened. | verified |
| Quotations | /quotations | Tenant | Layout | No | No | Yes | No | New | Table scroll | Signed in. One quotation listed. | verified |
| Quotation editor | /quotations/new, /:id | Tenant | Layout | No | Yes | Lines | No | Save, print | Stack | Signed in. New quotation form opened. | verified |
| Agreements | /agreements | Tenant | Layout | No | No | Yes | No | New | Table scroll | Signed in. One agreement listed. | verified |
| Agreement editor | /agreements/new, /:id | Tenant | Layout | No | Yes | No | No | Save, print | Stack | Signed in. New agreement form opened. | verified |
| Salary certificates | /salary-certificates | Tenant | Layout | No | No | Yes | No | New | Table scroll | Signed in. Empty list. | verified |
| Salary editor | /salary-certificates/new, /:id | Tenant | Layout | No | Yes | No | No | Save, print | Stack | Signed in. New certificate form opened. It was not saved. | verified |
| Delivery notes | /delivery-notes | Tenant | Layout | No | No | Yes | No | Open | Table scroll | Signed in. One delivery note listed. | verified |
| Delivery note | /delivery-notes/:saleId | Tenant | Layout | No | No | Lines | Print | Print | Stack | Signed in. Packing list opened. | verified |
| Settings | /settings | Owner | Layout | Yes | Yes | No | No | Save | Stack | Signed in. Company settings form opened. | verified |
| Users | /users | Admin | Layout | No | Yes | Yes | Invite | Add | Table scroll | Signed in. Owner row listed. | verified |
| Profile | /profile | Tenant | Layout | No | Yes | No | No | Save | Stack | Signed in. Profile form opened. | verified |
| Audit | /audit | Owner | Layout | No | Search, action, user, date | Yes | Activity detail | Refresh, View | Table / mobile cards | Admin and Owner only. No raw JSON in the table. Recovery is unavailable. Anonymous API calls return 401. Signed-in click-through was not completed because the local owner password does not match the development seed. | verified |
| Backup | /backup | Owner | Layout | No | Yes | Yes | Confirm | Backup now | Stack / history cards | Admin and Owner. Local PC backup is off until the tenant feature is enabled. Schedule, pairing, and restore confirmation are on the page. Backup was not run. | verified |
| More | /more | Tenant | Layout | No | No | No | No | Navigate | List | Only routes that are not already in the sidebar | verified |
| Help | /help | Any | Both | No | No | No | No | None | Stack | Signed in. Help page opened. | verified |
| Feedback | /feedback | Any | Both | No | Yes | No | No | Send | Stack | Signed in. Feedback form opened. It was not submitted. | verified |
| Onboarding | /onboarding | Owner | None | Steps | Yes | No | No | Next | Stack | Signed in. Company step opened. It was not submitted. | verified |
| App shell | tenant pages | Tenant | Layout | No | No | No | User menu, More | Nav, logout | Sidebar 240, tablet rail 80, mobile drawer | Groups: Main, Transactions, Masters, Operations, Reporting, System. Phone bottom nav stays under 768 | verified |
| Notifications | header bell | Tenant | Layout | No | No | No | Panel | Open | Dropdown | Signed in. Notifications panel opened. | verified |
| SuperAdmin dashboard | /superadmin/dashboard | SystemAdmin | Platform | No | No | No | No | Open | Cards | Platform session. Overview opened. | verified |
| Tenants | /superadmin/tenants | SystemAdmin | Platform | No | Filters | Yes | Create | Add | Table scroll | Platform session. Company list opened. | verified |
| Tenant detail | /superadmin/tenants/:id | SystemAdmin | Platform | Yes | Yes | Yes | Confirm | Save | Stack | Platform session. Company detail opened. | verified |
| Demo requests | /superadmin/demo-requests | SystemAdmin | Platform | No | No | Yes | No | Update | Table scroll | Platform session. Empty request list. | verified |
| Health | /superadmin/health | SystemAdmin | Platform | No | No | No | No | Refresh | Stack | Platform session. Database status opened. | verified |
| Error logs | /superadmin/error-logs | SystemAdmin | Platform | No | Filters | Yes | No | Refresh | Table scroll | Platform session. Error list opened. | verified |
| Audit logs | /superadmin/audit-logs | SystemAdmin | Platform | No | Filters | Yes | No | Refresh | Table scroll | Platform session. Platform activity opened. | verified |
| Platform settings | /superadmin/settings | SystemAdmin | Platform | Yes | Yes | No | No | Save | Stack | Platform session. Settings opened. Not saved. | verified |
| Search | /superadmin/search | SystemAdmin | Platform | No | Search | Yes | No | Open | Stack | Platform session. Search page opened. | verified |
| SQL console | /superadmin/sql-console | SystemAdmin | Platform | No | Yes | Result | No | Run | Stack | Platform session. Console opened. No query was run. | verified |

## Authentication entry (Focus 01)

Specified in [HEXABILL-DESIGN-SYSTEM.md](HEXABILL-DESIGN-SYSTEM.md). Application code was not changed.

Decision: one centered card, max width `400px`. No second column at any width. The built 50/50 blue panel, slogan, and bar graphic are not the spec.

| Route | Identity | Primary action |
|---|---|---|
| Tenant host `/login` | Name and logo from host-resolved `GET /api/public/tenant-context` only | Sign in, then `/dashboard` |
| `/login` on platform or marketing host | Platform mark. `Access your company workspace.` | Sign in |
| `/Admin26` | `Admin Portal`. No tenant branding | Sign in, then `/superadmin/dashboard` |
| `/login?invite=` | Same card. Set password and confirm | Replace to `/login` |

Wrong portal: platform account on a tenant host, and tenant account on the platform host, are rejected and logged out. Copy does not name the other organization. No tenant id in the UI. Errors are one alert. Dark page `#0B1220`, card `#121A22`. Signup is unchanged.

## Dashboard (Focus 02, Focus 06)

Specified in [HEXABILL-DESIGN-SYSTEM.md](HEXABILL-DESIGN-SYSTEM.md). The tenant dashboard page follows that section. Status is `verified`.

Decision: one work column. Four metrics (net sales, collections, profit, receivables). Net sales and receivables are larger. Needs attention sits above the chart, with the count on its own line. Overdue and unpaid bills open Reports outstanding. One primary action, New invoice. Period is stored on the dashboard address and per user in the browser session. SuperAdmin dashboard is a different route and was not part of this focus.

## Expenses (Focus 03)

Specified in [HEXABILL-DESIGN-SYSTEM.md](HEXABILL-DESIGN-SYSTEM.md). The tenant expenses page follows that section. Status is `implement`, not verified.

Decision: one page, no new tabs. Add expense is the only primary action. One filter row, one summary line, then the ledger. The breakdown chart sits under the ledger and uses period totals, or it is omitted. Export, Category VAT, and Recurring sit in one menu for Admin or Owner. Search stays on the loaded page. Recurring edit and delete are not specified, because those endpoints do not exist.

## App shell (Focus 04, Focus 06)

Tenant chrome is `Layout`. From 1024px the sidebar is 240px and collapses to icons. From 768px to 1023px it stays an 80px icon rail, and the phone header and bottom bar are hidden. Below 768px the header menu and More sheet are used. Navigation groups come from `moreMenuConfig.js`. Daily groups stay open. Operations, Reporting, and System collapse. Help, profile, and log out sit under the work list. F3, F4, F7, F8, F9, and F10 stay. F5 is left as browser refresh. Status is `verified`.

## Sales ledger

`/sales-ledger` keeps one summary line (sales, returns, net, received, unpaid, balance, VAT, invoice count, row count). Default from/to are the local calendar month, not a UTC date. PDF export failure says `Could not export the sales ledger.` Status is `verified`.
