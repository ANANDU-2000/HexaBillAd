# UI Task Tracker

The plan has four phases:
- **0:** harness and documents
- **1:** design system
- **2:** application shell
- **3:** module passes
- **4:** PWA, accessibility, performance and cleanup

Status values are TODO, IN_PROGRESS, PASS, FAIL and BLOCKED. No row moves to PASS without evidence (spec name, screenshot, or command output).

This tracker supersedes T-030 (responsive pass) and T-040 (Playwright) in [../production/TASK-TRACKER.md](../production/TASK-TRACKER.md).

## Phases 0–2 (lead session, shared files)

| ID | Task | Status | Evidence |
|---|---|---|---|
| P0-1 | Inventory and audit documents (`docs/uiux/*`) | PASS | This folder |
| P0-2 | Playwright runner (`@playwright/test` 1.64, system Edge, 5 viewports) | PASS | `playwright.config.js` |
| P0-3 | Route sweep spec: 36 routes × 5 viewports × 3 tenants | BLOCKED | Needs the owner test password in `e2e/.env.local` |
| P0-4 | Baseline bundle | PASS | Main chunk 596.9 kB (158.0 kB gzip); BarChart 592 kB; PosPage 314 kB |
| P1-1 | Align Tailwind and tokens (h1–h3, content width), Arabic font, mobile 16px inputs, tabular-nums, neutral `.card` / `.table` / `.btn-secondary` | IN_PROGRESS | `vite build` OK; `npm test` 138/138 |
| P2-1 | Shell: single identity, white top bar, one account menu, sidebar footer removed, 18/20px icons, 44px rail targets | IN_PROGRESS | Code done; visual check pending P0-3 |
| P2-2 | Ctrl/Cmd+K command palette, `/` focus search, `?` shortcut help | IN_PROGRESS | Code done |
| P2-3 | Modal shows as a bottom sheet on phones; unique title ids | IN_PROGRESS | Code done |
| P2-4 | Bottom nav: flat Sale pill, 11px labels, md breakpoint | IN_PROGRESS | Code done |
| P2-5 | Branding copy: login footer, Help heading, alert title | PASS | login screenshots |
| P2-6 | Distinct sidebar icons (FileText was used 5 times, plus other duplicates) | IN_PROGRESS | `moreMenuConfig.js`, tests 138/138 |
| P2-7 | SuperAdminLayout alignment (UI-024) | TODO | |

## Phase 3: module passes

Each module covers desktop, tablet and mobile together. Once Phase 2 is merged, modules can run in parallel worktree sessions because they touch separate files.

| Module | Scope | Audit IDs | Status |
|---|---|---|---|
| A | Dashboard | UI-016 | TODO |
| B | POS, billing history, sales ledger, returns, delivery notes | UI-014 | TODO |
| C | Customers, ledger, payments | UI-012, UI-019 | TODO |
| D | Products, stock, price list | UI-013 | TODO |
| E | Purchases, suppliers, expenses | UI-015, UI-017, UI-020, UI-022 | TODO |
| F | Reports, VAT, daily close, worksheet | UI-013, UI-021, UI-025 | TODO |
| G | Documents, branches and routes | UI-021 | TODO |
| H | Settings, users, audit, backup, profile, help, onboarding | UI-018, UI-023 | TODO |
| I | SuperAdmin | UI-024 | TODO |

## Phase 4

| Task | Status |
|---|---|
| PWA: PNG icons and a shell-only service worker (UI-026) | TODO |
| axe accessibility pass inside Playwright | TODO |
| RTL smoke (reuse `scripts/phase7-rtl-shell-smoke.mjs`) | TODO |
| Lazy-load recharts and leaflet, then measure the bundle again | TODO |
| Remove unused components (DeleteConfirmModal, SupplierLedgerModal, QuickActionsPanel, PendingBillsPanel) after a grep confirms no imports | TODO |

## Decisions

- **2026-10-10:**
  - The desktop top bar shows no page title, because 45 pages already render their own `<h1>`. On mobile the shell shows the title and in-page titles are hidden below md.
  - Parallel work is split by module, not by device, so that no two sessions edit the same files.
  - Playwright runs on the installed Edge (`channel: msedge`) so no browser download is needed.
