---
name: hexabill-pos-ux-phase
description: >-
  Run one HexaBill POS + Ledger UI/UX overhaul phase (0–4 / 3b) with scope lock,
  audit-first workflow, build verification, and CHANGE SUMMARY. Use when the user
  asks to run the next POS UX phase, Phase 0 audit, keyboard contract, product
  panel, density pass, totals layout, or mobile parity for HexaBill.
---

# HexaBill POS UX Phase Runner

## Input

Phase id: `0` | `1` | `2` | `3` | `3b` | `4` (and for Phase 3, which file).

## Before any edit

1. Read `.cursor/rules/hexabill-pos-ux-phases.mdc`.
2. Read `docs/pos-ux-audit.md` (required for phases ≥1).
3. Read the **named file(s) only** for this phase in full (or the sections the audit flags).
4. Self-diagnose in plain text: broken / root cause / minimal fix.

## Phase file scopes

| Phase | Touch only |
|-------|------------|
| 0 | Create/update `docs/pos-ux-audit.md` only (plus rule/skill if bootstrapping) |
| 1 | `frontend/hexabill-ui/src/pages/company/PosPage.jsx` |
| 2 | `PosPage.jsx` only; STOP before creating `ProductPickerPanel.jsx` without sign-off |
| 3 | One of: `SuppliersPage.jsx`, `SupplierDetailPage.jsx`, `SupplierLedgerModal.jsx`, `CustomerLedgerPage.jsx`, then `PosPage.jsx` cart widths — **one file per run** |
| 3b | `PosPage.jsx` only (Totals/Payment layout) |
| 4 | `PosPage.jsx` + Phase 3 files — fix only where touch/panel/OSK broken |

## Hard stops

- Need a second source file → stop and report.
- Want a new component file → stop and ask for sign-off.
- Data/VAT/payment logic would change → do not change; report.

## After edits

1. `npm run build` in `frontend/hexabill-ui`.
2. Deliver CHANGE SUMMARY + manual test script for the phase.
3. Do not start the next phase until the user confirms.

## Defaults (locked)

- Phase 1 shortcuts: always-visible compact hint bar.
- Phase 2: right sidebar / mobile sheet inside `PosPage.jsx`.
- Narrow Totals/Payment (3b): stack below cart.
---
