# Page matrix

Live routes only, from `src/app/App.jsx`. Status starts `todo`.

| Page | Route | Role | Layout | Tabs | Forms | Tables | Dialogs | Actions | Responsive | Problem | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Login | /login | Public tenant | None | No | Yes | No | No | Sign in | Centered | Inline font | done |
| Platform login | /Admin26 | SystemAdmin | None | No | Yes | No | No | Sign in | Centered | Same as login | done |
| Signup | /signup | Public | None | No | Yes | No | No | Create account | Stack | Page-local styles | done |
| Dashboard | /dashboard | Tenant | Layout | No | Filters | No | No | Date range | Cards stack | Dense cards vary | done |
| POS | /pos | Tenant | Viewport | No | Cart | Cart lines | Payment, print | Checkout | Regions stack | Two POS implementations | done |
| Sales ledger | /sales-ledger | Tenant | Viewport | Filters | Filters | Yes | Preview | Print, export | Inner scroll | Wide table | done |
| Billing history | /billing-history | Tenant | Layout | No | Filters | Yes | Preview | Print | Table scroll | Page-local styles | done |
| Returns | /returns/create | Tenant | Layout | No | Yes | Lines | Confirm | Save return | Stack | saleId gate | done |
| Products | /products | Tenant | Layout | No | Filters | Yes | Product form | Add, import | Table/cards | Page-local styles | done |
| Product detail | /products/:id | Tenant | Layout | No | Yes | Stock | Confirm | Save | Stack | Page-local styles | done |
| Price list | /pricelist | Tenant | Layout | No | No | Yes | No | Print | Table scroll | Page-local styles | done |
| Customers | /customers | Tenant | Layout | No | Filters | Yes | Customer form | Add | Table scroll | Page-local styles | done |
| Customer detail | /customers/:id | Tenant | Layout | Yes | Yes | Ledger | Payment | Save | Stack | Page-local styles | done |
| Customer ledger | /ledger | Tenant | Layout | No | Filters | Yes | Payment | Record | Table scroll | Wide | done |
| Payments | uses ledger/modals | Tenant | Layout | No | Yes | Yes | Payment | Save | Modal scroll | No standalone route | done |
| Purchases | /purchases | Tenant | Layout | No | Yes | Yes | Confirm | Add | Table scroll | Page-local styles | done |
| Suppliers | /suppliers | Tenant | Layout | No | Yes | Yes | Form | Add | Table scroll | Page-local styles | done |
| Supplier detail | /suppliers/:name | Tenant | Layout | No | Yes | Ledger | No | Save | Stack | Page-local styles | done |
| Inventory | /stock-adjustments | Tenant | Layout | No | Yes | Yes | Adjust | Save | Table scroll | Page-local styles | done |
| Expenses | /expenses | Tenant | Layout | Yes | Yes | Yes | Form | Add | Stack | Page-local styles | done |
| Reports | /reports | Owner | Layout | Yes | Filters | Yes | No | Export | Charts stack | Heavy | done |
| Outstanding | /reports/outstanding | Owner | Layout | Yes | Filters | Yes | No | Export | Same | Same page | done |
| VAT return | /vat-return | Owner | Layout | Yes | Yes | Yes | No | File | Stack | Page-local styles | done |
| Worksheet | /worksheet | Owner | Layout | No | Yes | Yes | No | Save | Inner scroll | Owner only | done |
| Branches | /branches | Owner | Layout | No | Yes | Yes | Confirm | Add | Cards | Staff redirected | done |
| Branch detail | /branches/:id | Owner | Layout | Yes | Yes | Yes | Confirm | Add route | Stack | Staff redirected | done |
| Routes | /routes | Owner | Layout | No | Yes | Yes | No | Open | List | Staff redirected | done |
| Route detail | /routes/:id | Owner | Layout | Yes | Yes | Yes | Map | Save | Stack | Staff redirected | done |
| Quotations | /quotations | Tenant | Layout | No | No | Yes | No | New | Table scroll | Page-local styles | done |
| Quotation editor | /quotations/new, /:id | Tenant | Layout | No | Yes | Lines | No | Save, print | Stack | Page-local styles | done |
| Agreements | /agreements | Tenant | Layout | No | No | Yes | No | New | Table scroll | Page-local styles | done |
| Agreement editor | /agreements/new, /:id | Tenant | Layout | No | Yes | No | No | Save, print | Stack | Page-local styles | done |
| Salary certificates | /salary-certificates | Tenant | Layout | No | No | Yes | No | New | Table scroll | Page-local styles | done |
| Salary editor | /salary-certificates/new, /:id | Tenant | Layout | No | Yes | No | No | Save, print | Stack | Page-local styles | done |
| Delivery notes | /delivery-notes | Tenant | Layout | No | No | Yes | No | Open | Table scroll | Page-local styles | done |
| Delivery note | /delivery-notes/:saleId | Tenant | Layout | No | No | Lines | Print | Print | Stack | Page-local styles | done |
| Settings | /settings | Owner | Layout | Yes | Yes | No | No | Save | Stack | Long form | done |
| Users | /users | Admin | Layout | No | Yes | Yes | Invite | Add | Table scroll | Page-local styles | done |
| Profile | /profile | Tenant | Layout | No | Yes | No | No | Save | Stack | Page-local styles | done |
| Audit | /audit | Owner | Layout | No | Filters | Yes | No | Refresh | Table scroll | Page-local styles | done |
| Backup | /backup | Owner | Layout | No | Yes | Yes | Confirm | Backup | Stack | Page-local styles | done |
| More | /more | Tenant | Layout | No | No | No | No | Navigate | List | Menu | done |
| Help | /help | Any | Both | No | No | No | No | None | Stack | Static | done |
| Feedback | /feedback | Any | Both | No | Yes | No | No | Send | Stack | Page-local styles | done |
| Onboarding | /onboarding | Owner | None | Steps | Yes | No | No | Next | Stack | Wizard | done |
| Notifications | header bell | Tenant | Layout | No | No | No | Panel | Open | Dropdown | In shell | done |
| SuperAdmin dashboard | /superadmin/dashboard | SystemAdmin | Platform | No | No | No | No | Open | Cards | Indigo shell | done |
| Tenants | /superadmin/tenants | SystemAdmin | Platform | No | Filters | Yes | Create | Add | Table scroll | Indigo shell | done |
| Tenant detail | /superadmin/tenants/:id | SystemAdmin | Platform | Yes | Yes | Yes | Confirm | Save | Stack | Indigo shell | done |
| Demo requests | /superadmin/demo-requests | SystemAdmin | Platform | No | No | Yes | No | Update | Table scroll | Indigo shell | done |
| Health | /superadmin/health | SystemAdmin | Platform | No | No | No | No | Refresh | Stack | Indigo shell | done |
| Error logs | /superadmin/error-logs | SystemAdmin | Platform | No | Filters | Yes | No | Refresh | Table scroll | Indigo shell | done |
| Audit logs | /superadmin/audit-logs | SystemAdmin | Platform | No | Filters | Yes | No | Refresh | Table scroll | Indigo shell | done |
| Platform settings | /superadmin/settings | SystemAdmin | Platform | Yes | Yes | No | No | Save | Stack | Indigo shell | done |
| Search | /superadmin/search | SystemAdmin | Platform | No | Search | Yes | No | Open | Stack | Indigo shell | done |
| SQL console | /superadmin/sql-console | SystemAdmin | Platform | No | Yes | Result | No | Run | Stack | Indigo shell | done |
