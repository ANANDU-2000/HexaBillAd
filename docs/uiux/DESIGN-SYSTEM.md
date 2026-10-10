# Design System

The goal is a restrained, dense ERP: a neutral surface, one brand colour for actions, and colour otherwise used only for status.

Values live in `frontend/hexabill-ui/src/styles/tokens.css`. `tailwind.config.js` mirrors them, and any Tailwind value that disagreed has been aligned with tokens.css. Component classes (`.card`, `.btn-*`, `.input`, `.table`, `.num`) are in `src/index.css`.

## Foundations

| Token | Value | Notes |
|---|---|---|
| Font | Inter, then Noto Sans Arabic, then the system font | Under `[dir=rtl]` and `:lang(ar)`, the Arabic-first stack is used with line-height 1.65 |
| Base size | 16px root on mobile, 14px root at 769px and wider | Body text uses 14px (`text-sm`) |
| Page title | 20–24px, weight 600 | Desktop: in-page `<h1>`. Mobile: the shell top bar shows the title instead (`mobilePageTitleClass` is `hidden md:block`) |
| Section title | 16–18px, weight 600 | |
| Numbers | `tabular-nums` | Applied automatically in `.table`; use `.num` / `.amount` elsewhere |
| Spacing | 4px scale (Tailwind default) | |
| Radius | 6px for controls, 8px for cards and dialogs | Avoid `rounded-2xl` and larger on surfaces |
| Border | `#E5E7EB` (`border-surface-border`) | Cards, tables and bars all use the same hairline |
| Shadow | none on cards, `shadow-lg` on overlays only | |
| Primary | `#2563EB` (primary-600) | Primary buttons, active navigation, focus ring |
| Status | success `#059669`, warning `#D97706`, error `#DC2626`, info `#3B82F6` | Always paired with text or an icon, never colour alone |
| Touch target | at least 44px | Rail navigation, top bars, bottom nav, menu items |
| Motion | 150ms colour/size transitions | `prefers-reduced-motion` turns them off globally |

## Icons

- Lucide only.
- 18px with stroke 1.75 in navigation and the top bar.
- 20px on the tablet rail and the mobile bars.
- Icon-only buttons always have an `aria-label`.

## Shell rules

1. **Single identity point.** The tenant logo and name appear only in the sidebar header (logo only when the sidebar is a rail). Desktop never shows a second logo or company name.
2. **Top bar (md and up).** White, 64px tall. It holds search (Ctrl/Cmd+K), alerts and one account menu (profile, settings, help, shortcuts, log out). There is no profile or logout in the sidebar.
3. **Sidebar.**
   - Rail at md (80px). Full width (240px) at lg and up unless collapsed (Ctrl+\).
   - There is one scroll area: a thin scrollbar that appears on hover, with no arrow buttons.
4. **Mobile (below md).**
   - The white top bar has: menu, page title, search.
   - The bottom nav has: Home, Sale, Ledger, More. The Sale tab is a flat pill, not a raised FAB, so it cannot cover labels or content.
5. **Breakpoints.** md is 768px and lg is 1024px. The JS `matchMedia(1024px)` in Layout matches lg.

## Components

| Need | Use |
|---|---|
| Dialog | `components/Modal.jsx`. On phones it is a bottom sheet (max 92dvh, safe-area padding); md and up get a centred dialog. Includes focus trap, Esc, unique `aria-labelledby` |
| Destructive confirmation | `ConfirmDangerModal`. State the consequence ("Deletes invoice INV-12 and reverses stock") |
| Form fields | `components/Form.jsx` (Input / Select / TextArea). Mobile inputs are forced to 16px |
| Buttons | `.btn` with `.btn-primary`, `.btn-secondary` (neutral outline) or `.btn-danger`. Use one primary per view; secondary actions go in an overflow menu |
| Tables | `.table`: neutral header, hairline rows, tabular numbers. Below md, show a card list instead of scrolling sideways |
| Global search | `CommandPalette` |
| Shortcut help | `ShortcutHelp` (opened with `?` or from the account menu) |

## Keyboard

| Key | Action | Notes |
|---|---|---|
| Ctrl/Cmd+K | Open search | Works even inside text fields |
| `/` | Focus page search | Ignored while typing in a field |
| `?` | Show shortcuts | Ignored while typing in a field |
| Ctrl+\ | Collapse or expand sidebar | |
| Esc | Close dialog or menu | |
| F3, F4, F7–F10 | Existing go-to keys | |
| POS keys | POS keyboard engine | Unchanged |
