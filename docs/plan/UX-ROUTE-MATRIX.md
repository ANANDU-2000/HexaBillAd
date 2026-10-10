# UX route matrix

8 October 2026: App.jsx static map reconciles 61 unique route patterns against the existing manifest; see CURRENT-ARCHITECTURE-MAP.md. Runtime acceptance remains separate.

Screenshot inventory: 331 supplied PNGs in UI-SCREENSHOT-INVENTORY.csv. First 24 inspected through a contact sheet and grouped; remaining 307 NOT REVIEWED. Image dimensions are metadata, not verified browser viewports.

All routes/tabs/modals require the master five sizes, 200% zoom, keyboard, roles/second tenant, errors, refresh/back, console/network and applicable finance/print/reversal proof.

| Route | Fresh evidence | Status |
|---|---|---|
| /login | Real form login to dashboard for GulfHarvest and Zayogya synthetic owners; expired JWT after API restart redirected to login and new sign-in succeeded. | PARTIAL; role/failure/lockout/full-size acceptance OPEN |
| /vat-return | GulfHarvest overview 145 profit / 7.25 estimate, standard VAT 9.76; Profit Calculation tab and Refresh retained values. Zayogya overview standard 9.76, no profit card/tab. Four-tenant API comparison preserves all standard boxes. | PARTIAL; exports/print/permissions/invalid period/network/zoom/full transaction matrix OPEN |
| /ledger | Historical payment recovery/Bills fixes exist. | NOT REVALIDATED this slice |
| /payments | Static mobile/status/selection/retry findings PS-004/005/006. | OPEN |
| All other routes/states | No fresh complete proof. | NOT RUN |

VAT card screenshot/DOM geometry checks: 360x800, 390x900, 768x900, 1366x900, 1440x1000. Card fits each width; no document horizontal overflow. Existing summary table uses its own horizontal scrollbar on mobile. 360 and 1440 images actually inspected; other three captured with geometry checks, not full visual acceptance. These heights differ from the master exact-size matrix, which remains OPEN. Local evidence under %TEMP%/hexabill-goal-20261008-evidence/.

No route DONE. Shell/partial screenshots cannot certify complete workflows.
