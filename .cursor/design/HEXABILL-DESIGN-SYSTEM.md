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

## Tenant branding

Login and header show the resolved tenant name from `TenantBrandingContext`. Platform login shows platform identity. Never hardcode Surag, ZAYOGA, or HexaBill as a company name in tenant UI.
