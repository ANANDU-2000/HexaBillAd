# Money colour and number style rollout

Rule source: `docs/uiux/DESIGN-SYSTEM.md` (amount-negative and amount-positive tokens). Code: `frontend/hexabill-ui/src/utils/moneyTone.js`.

| Meaning | Colour | Word beside it |
|---|---|---|
| Paid, received | green (success-fg) | none |
| Unpaid, owed, due | red (error-fg) | Due |
| Overdue | red (error-fg) | Overdue |
| Credit, advance (negative payable) | green, minus sign kept | Credit |
| Zero | quiet grey (neutral-500) | none |

Number style: Inter, tabular figures (`tabular-nums`), right aligned, two decimals, currency code after the amount. Ordinary invoice totals stay primary text colour, not green.

## Status
| Page | State |
|---|---|
| Suppliers (`features/purchases/SuppliersPage.jsx`) | DONE, helper + test + browser smoke |
| Customer Ledger | TODO, 19 hand-picked red/green classes |
| Reports | TODO, 22 |
| VAT Return | TODO, 15 |
| Expenses | TODO, 13 |
| Payments | TODO, 9 |
| Purchases | TODO, 7 |
| Sales Ledger | TODO, 6 |
| Remaining pages (Products, Billing History, Customers, Settings, alerts) | TODO, 2 to 4 each |

Method per page: replace hand-picked `text-red-*` / `text-green-*` on amounts with `moneyTone(kind, value)`, add `moneyWord` where a balance is coloured, keep one browser smoke check. Statuses (Paid, Partial, Unpaid) use `Badge` variants, not text colour.
