# HexaBill Performance Audit — To-Do (31 rules, 3 viewports)

Status key: [x] done · [ ] todo · [~] partial. Update at session end (see AI-ERP-TASK-TRACKER.md).

## Ground rules
- Read-only on production. No test transactions, no saves, no deletes in live tenants.
- Logged-in pages are measured on LOCAL synthetic tenants (gulfharvest-test etc., see local QA harness). Production gets landing, login, and (if the owner supplies a read-only login via request_secret) dashboard + list pages, view only.
- Viewports for every page: mobile 390x844 (4x CPU throttle, Slow 3G), tablet 820x1180, desktop 1440x900.
- Per page record: LCP, INP (interaction < 100 ms target), CLS, TTFB, JS transferred, API calls count + slowest call, console errors, layout break (Y/N).
- Real route count is about 89 `<Route>` entries (not 300). Scope = all of them, grouped below.

## Phase 0 — Already fixed this session (uncommitted, needs browser verification)
- [x] Brotli/Gzip response compression (`Program.cs`)
- [x] Non-blocking Google Fonts + deferred favicon script (`index.html`)
- [x] Lazy/async product images, explicit size on product detail photo
- [x] Skeletons: Customers, Payments, Billing History
- [x] Browser verify: e2e/perf-pages-smoke.spec.js passed on local synthetic tenant (19 pages x m390/t768/d1440: 0 console errors, 0 overflow, 0 stuck skeletons, assistant opens/closes). Local dev data, not production timings; `npm test` 403/403
- [ ] Commit locally (NO push; push auto-deploys production)

## Phase 1 — Landing page (public, production)
- [ ] Lighthouse mobile + desktop on the production landing URL
- [ ] Check: hero image format/size/dimensions, font blocking, third-party scripts, CLS from late content, cache headers on `/assets/*`
- [ ] Check redirect chain (apex -> www -> tenant), TTFB cold vs warm (Render cold start)
- [ ] Findings list -> fix top 3

## Phase 2 — Login / Signup / public auth pages
- [ ] Login, Signup, forgot/reset (production, no credentials submitted)
- [ ] Bundle size on first paint (is the whole app pulled before login?), logo `<img>` sizes
- [ ] Login API latency, lockout behaviour (15-min lockout trap: do not hammer)
- [ ] Time from submit to dashboard interactive

## Phase 3 — Dashboard (`DashboardTally`, 1117 lines)
- [ ] API waterfall vs parallel, number of calls on first load
- [ ] Skeleton vs spinner, Recharts chunk cost, polling intervals
- [ ] Daily-close status card, alert polling

## Phase 4 — Client-data pages, in this order
Group A — Customers: Customers, Customer detail, Customer Ledger (5.8k lines, 63 states), Pending Bills
Group B — Sales: POS (enterprise + legacy), Sales Ledger, Billing History, Delivery Notes, Recurring, Sales Ledger Import, Returns
Group C — Money: Payments, Expenses, Daily Close, VAT Return
Group D — Products/Stock: Products, Product detail, Price List, Stock Adjustments
Group E — Purchases: Purchases, Suppliers, Supplier detail
Group F — Reports/Docs: Reports (3.9k lines), Worksheet, Quotations (+editor), Agreements, Salary Certificates, Documents
Group G — Branches/Routes: Branches, Branch detail, Route detail, Route map, Driver route
Group H — Admin: Settings, Users, Profile, Audit Log, Backup, Data Import, Subscription Plans, Updates, More, Help, Feedback
Group I — Assistant panel (rule 13: streaming)
Group J — SuperAdmin (lowest priority)

Per page checklist (rules): skeleton, debounce, pagination/virtualization (>50 rows), parallel fetches, request dedupe, re-render cost, image lazy, optimistic UI where a toggle/edit exists, mobile/tablet layout (no horizontal cut-off, 44 px touch targets).

## Phase 5 — Cross-cutting fixes (after findings)
- [x] #10 sequential awaits -> `Promise.all`: fixed Supplier detail + Expenses; scanned all pages, the rest already load in parallel (separate effects/callbacks)
- [x] Spinners -> skeletons: Customers, Payments, Billing History, Sales Ledger, Customer detail, Product detail, Products movements (rest are button/status icons)
- [ ] `manualChunks` for recharts / leaflet / zbar (needs production-build browser run; vite config notes TDZ history)
- [ ] Split CustomerLedgerPage / PosEnterprisePage / ReportsPage state (memo, leaf components)
- [x] Self-host fonts: variable Inter + Noto Sans Arabic woff2 (latin, latin-ext, arabic) in public/fonts, preload Inter latin, immutable cache; needs browser check
- [ ] WebP/AVIF for logos/product images, check upload pipeline
- [ ] Payments / legacy invoices `pageSize: 1000` -> paged
- [x] `/health` exists (Program.cs ~1311: DB check, 200/503, deployVersion). Still todo: list N+1 and missing-index review (EF query log)
- [ ] Optimistic UI for toggles (pin customer, mark paid) with rollback
- [ ] RUM: web-vitals reporting to existing logging endpoint (p75 LCP/INP/CLS/TTFB)
- [ ] OpenTelemetry (backend) — decision needed, adds dependency

## Rules judged N/A or deferred (state why, do not silently skip)
- #20 SSR/SSG: app is an authenticated SPA; only the landing page could benefit.
- #10 Redis, #18 OpenTelemetry, #19 region co-location: need infra access/decision; verify Render DB region vs service region read-only.
- #6 CDN: Vercel already serves assets from edge.

## Blockers / needs owner
- Production read-only login for logged-in production timings (supply via secret request, never in chat).
- Approval before any push/deploy.
