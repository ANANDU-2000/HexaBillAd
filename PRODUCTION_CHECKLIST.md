# HexaBil Production Readiness Checklist

---

# START HERE — What to do (step by step, no confusion)

Do the steps below in order. When you finish, you can say **Production ready**.

---

## PART 1 — Owner: Assign staff to branch and route

1. Log in as **Owner** (e.g. owner1@hexabill.com).
2. Click **Users** in the left menu.
3. Find a **Staff** user. Click the **Edit** (pencil) button for that user.
4. In the popup, click the **Assignments** tab.
5. Tick **one or more Branch** and **one or more Route**. Click **Save**.
6. Click **Branches & Routes** in the left menu. Click **one branch** (e.g. vatanappally).
7. On the branch page, click the **Staff** tab. You should see the staff you assigned, with route names. You can click **Assign staff** to add more or **Remove** to remove.
8. Go back to **Users**. In the table, the **Assigned (Branch / Route)** column should show branch and route names for that staff.

---

## PART 2 — Staff: Check POS, Ledger, Expenses

9. Log **out**. Log in as the **Staff** user you assigned in Part 1.
10. Click **POS**. You must **not** see "No branches or routes assigned". You should see branch/route or dropdowns.
11. Click **Customer Ledger**. Select branch and route in the filter. You should see customers; no "No branches or routes assigned".
12. Click **Expenses**. You should see **Add Expense**. You must **not** see **New Category** (only Owner sees that).

---

## PART 3 — Reports (Branch and Route, COGS)

13. Log in as **Owner** again. Click **Reports**.
14. Click the **Branch** tab. Table must show Sales, COGS, Expenses, Profit. You can expand a row to see routes.
15. Click the **Route** tab. List of all routes with Sales, COGS, Expenses, Profit.
16. **COGS** = product cost. So: in **Purchases**, add a purchase and fill **cost** for items. Then Branch and Route reports will show real COGS and profit. If you never enter cost in purchases, COGS will stay 0.

---

## PART 4 — Full app test (every page, every role)

17. As **Owner**: Open every item in the left menu (Dashboard, Products, Pricelist, Purchases, POS, Customer Ledger, Sales Ledger, Expenses, Reports, Branches, Routes, Users, Settings, Backup, Import, Profile, Subscription, Updates, Help, Feedback). Open every tab inside Reports. Each page must **load** (no blank screen). Press **F12** → Console tab: there must be **no red errors**.
18. As **Staff**: Log in as Staff. Open every page they can see. Same: each loads, no red errors in F12.
19. As **Super Admin**: Log in at the Super Admin login page. Open Dashboard, Tenants, one tenant detail, Impersonate, then other Super Admin pages. Same: each loads, no red errors.

---

## Your 4 questions (one-line answers)

- **How much errors?** → **Zero** red errors in F12 when you use the app. You check this in Part 4.
- **How many clients same time without errors?** → App does not set a number. Usually **10–50** users on one server is OK. Test with 2–3 browser tabs or 2–3 people.
- **Loading all OK?** → **Yes.** Every page must show loading then content. You check this in Part 4.
- **One always same? (consistent)?** → **Yes.** One login = one user. Staff always see only their branches/routes. Same COGS logic everywhere.

---

## When can you say Production ready?

When you have done **Part 1, Part 2, Part 3, and Part 4** and you see **no wrong calculations**, **no mixed data between tenants**, and **no red errors in the console** → then you can say **Production ready**. You can also tick the detailed checklist below and sign at the end.

---

## WHAT TO DO — Simple steps (short version)

Do these in order so you know the app works end-to-end.

### A. Owner flow (assign staff to branches/routes)

1. **Log in as Owner.**
2. Go to **Users** (sidebar).
3. Click **Edit** (pencil) on a Staff user (e.g. Anandu).
4. Open the **Assignments** tab. Tick at least one **Branch** and one **Route**. Click **Save**.
5. Go to **Branches & Routes** → click a branch (e.g. vatanappally).
6. Open the **Staff** tab. You should see that staff listed with their route names. Use **Assign staff** to add more, or **Remove** to unassign.
7. In **Users**, the table column **Assigned (Branch / Route)** should show branch and route names for that staff.

### B. Staff flow (after you assigned them)

1. **Log out.** Log in as **Staff** (the user you assigned in A).
2. Open **POS**. You should see branch/route (or dropdowns). You should **not** see “No branches or routes assigned” if you assigned them in A.
3. Open **Customer Ledger**. Choose branch and route in the filter; you should see only customers for that branch/route. No “No branches or routes assigned” if assigned.
4. Open **Expenses**. You should see “Add Expense” but **no** “New Category” (only Owner has that). Totals are for your assigned branch(es).

### C. Reports (COGS and profit)

1. Log in as **Owner**. Go to **Reports**.
2. Open **Branch** tab: table has Sales, COGS, Expenses, Profit. Expand a branch to see routes.
3. Open **Route** tab: flat list of all routes with Sales, COGS, Expenses, Profit.
4. **COGS comes from product cost.** So: go to **Purchases**, add a purchase with **cost** for products. Then Branch/Route reports will show real COGS and profit. If you never enter purchase cost, COGS stays 0.

### D. Full app test (then say Production ready)

1. **Owner:** Open **every** page in the sidebar (Dashboard, Products, Pricelist, Purchases, POS, Customer Ledger, Sales Ledger, Expenses, Reports with every tab, Branches, Branch detail tabs, Routes, Route detail, Users, Settings, Backup, Import, Profile, Subscription, Updates, Help, Feedback). Check: page loads, no blank screen, no red errors in browser console (F12).
2. **Staff:** Log in as Staff. Open every page they can see. Same: loads, no errors.
3. **Super Admin:** Log in as Super Admin. Open dashboard, Tenants, tenant detail, Impersonate, then other Super Admin pages. Same: loads, no errors.
4. When **all** of the checklist sections below are ticked → sign **Production ready** at the bottom.

---

## Your questions — Short answers

| Your question | Answer |
|---------------|--------|
| **How much errors?** | Aim for **zero** red errors in the browser console (F12) when you use the app normally. The checklist asks you to confirm “no errors” after testing. |
| **How many clients can use at same time without errors?** | The app does **not** limit this. It depends on your server. Often **10–50 people** at once is OK for one server. Test with 2–3 users (or 2–3 browser tabs) to be sure; for more users, do a load test on your host. |
| **Loading all OK?** | Yes. Every page should show a **loading** state (spinner) then content. No page should stay blank forever. The checklist has a row for this. |
| **One always same? (consistent)** | Yes. One login = one user; Staff always see only their assigned branches/routes everywhere (POS, Ledger, Expenses). Same COGS logic everywhere (product cost from purchases). So behaviour is consistent. |

---

## BROWSER TEST RUN (AI-executed)

*The AI opened the app in a browser and ran the following. Use this as a partial automated check; you still need to complete the full checklist and Staff/Super Admin flows yourself.*

| Step | What was done | Result |
|------|----------------|--------|
| 1 | Started frontend (Vite). Backend may already have been running. | Frontend on port 5174 (5173 was in use). |
| 2 | Opened **Login** (http://localhost:5174/login). | Page loaded; form visible. |
| 3 | Filled email `owner1@hexabill.com`, password `Owner1@123`, clicked **Sign in**. | **OK** — redirected to **Dashboard** (/dashboard). |
| 4 | Navigated to **Users** (/users). | **OK** — page loaded (title: tenant name). |
| 5 | Navigated to **Branches** (/branches). | **OK** — page loaded. |
| 6 | Navigated to **Reports – Branch** (/reports?tab=branch). | **OK** — URL and page loaded. |
| 7 | Navigated to **Reports – Route** (/reports?tab=route). | **OK** — Route report tab loaded. |
| 8 | Navigated to **POS** (/pos). | **OK** — POS page loaded. |

**Summary:** Owner login and key pages (Users, Branches, Reports Branch/Route, POS) **load without navigation errors**. Console/network were not fully inspected in this run. **You should:** (1) Manually do Owner flow A (Edit user → Assignments, Branch → Staff tab), (2) Log in as Staff and verify POS/Ledger/Expenses, (3) Open F12 and confirm no red errors on each page, (4) Run Super Admin login and pages. Then tick the checklist and sign **Production ready** below.

---

## 1. Concurrency & Load (No Errors Under Normal Use)

| # | Check | Done |
|---|--------|-----|
| 1.1 | **Concurrent users**: App has no hardcoded “max users” limit. Capacity depends on your server (CPU, RAM) and database (e.g. PostgreSQL max connections). | ☐ |
| 1.2 | **Typical range**: Single backend instance often handles **10–50 concurrent browser users** without errors if server is sized correctly. | ☐ |
| 1.3 | **Same user, multiple tabs**: One user with 2–3 tabs (e.g. POS + Reports) should work without errors or data mix-up. | ☐ |
| 1.4 | **Session**: One login = one session; no shared session between users (tenant + user isolation). | ☐ |

**Note:** For “how many clients at same time without errors,” run load tests (e.g. 5–10 users at once) on your staging/host; adjust server/DB if you need more.

---

## 2. Loading & Errors (App-Wide)

| # | Check | Done |
|---|--------|-----|
| 2.1 | Every page shows a **loading state** (spinner/skeleton) while data is fetched—no permanent blank screen. | ☐ |
| 2.2 | **Browser console**: No red errors or unhandled promise rejections during normal flows (login, navigate, save). | ☐ |
| 2.3 | **Network**: API calls return 2xx for success; 4xx/5xx show a user-friendly message (toast or inline), not a crash. | ☐ |
| 2.4 | **Offline / server down**: Connection status or error message is shown; app doesn’t hang forever. | ☐ |

---

## 3. Owner – Full App Page-by-Page Test

*Login as **Owner** (or Admin). Test every page and main action.*

| # | Page / Feature | Check | Done |
|---|----------------|--------|-----|
| 3.1 | **Login** | Login with owner credentials; redirect to dashboard. | ☐ |
| 3.2 | **Dashboard** | Loads; summary cards and charts show; no console errors. | ☐ |
| 3.3 | **Products** | List loads; add/edit product; search/filter works. | ☐ |
| 3.4 | **Pricelist** | Page loads; prices display correctly. | ☐ |
| 3.5 | **Purchases** | List loads; add purchase with cost; product cost/stock updates. | ☐ |
| 3.6 | **POS** | Open new invoice; select customer (branch/route show if set); add product; totals and VAT correct; complete sale. | ☐ |
| 3.7 | **Customer Ledger** | List loads; filter by branch/route; customer balance and transactions correct. | ☐ |
| 3.8 | **Sales Ledger** | List loads; filters and totals correct. | ☐ |
| 3.9 | **Expenses** | List loads; add expense (category, amount, branch); totals correct. | ☐ |
| 3.10 | **Reports – Summary** | Loads; numbers consistent with dashboard. | ☐ |
| 3.11 | **Reports – Sales** | Sales report loads; filters work. | ☐ |
| 3.12 | **Reports – Product** | Product report loads. | ☐ |
| 3.13 | **Reports – Customer** | Customer report loads. | ☐ |
| 3.14 | **Reports – Expenses** | Expenses report loads. | ☐ |
| 3.15 | **Reports – Branch** | Branch report loads; COGS/expenses/profit columns; expand routes. | ☐ |
| 3.16 | **Reports – Route** | Route report loads; all routes listed; Sales/COGS/Expenses/Profit. | ☐ |
| 3.17 | **Reports – Aging / Outstanding / Staff / etc.** | Each tab loads without error. | ☐ |
| 3.18 | **Branches** | List loads; add branch; open branch detail. | ☐ |
| 3.19 | **Branch detail – Overview** | Sales, COGS, expenses, profit, routes summary. | ☐ |
| 3.20 | **Branch detail – Routes** | Routes list and figures. | ☐ |
| 3.21 | **Branch detail – Staff** | Staff list; Assign staff; Remove staff; route names show. | ☐ |
| 3.22 | **Branch detail – Customers / Expenses / Report** | Each tab loads. | ☐ |
| 3.23 | **Routes** | List loads; open route detail. | ☐ |
| 3.24 | **Route detail** | Summary, customers, expenses, report. | ☐ |
| 3.25 | **Users** | List loads; Assigned (Branch/Route) column shows names; Edit user → Assignments (branches/routes) save correctly. | ☐ |
| 3.26 | **Settings** | Loads; save settings; no errors. | ☐ |
| 3.27 | **Backup & Restore** | Page loads; backup/restore if used. | ☐ |
| 3.28 | **Import data / Sales Ledger import** | Page loads; import flow if used. | ☐ |
| 3.29 | **Profile** | Load and update profile. | ☐ |
| 3.30 | **Subscription** | Page loads (if shown). | ☐ |
| 3.31 | **Updates** | Page loads. | ☐ |
| 3.32 | **Help / Feedback** | Pages load. | ☐ |
| 3.33 | **Logout** | Logout; redirect to login; no errors. | ☐ |

---

## 4. Staff – Full App Page-by-Page Test

*Login as **Staff** (with at least one branch and route assigned in Users).*

| # | Page / Feature | Check | Done |
|---|----------------|--------|-----|
| 4.1 | **Login** | Staff login; redirect to dashboard. | ☐ |
| 4.2 | **Sidebar** | Only Staff-visible items: Dashboard, Products, POS, Customer Ledger, Sales Ledger, Expenses (no Reports, Branches, Users, Settings, Backup, Import, Updates). | ☐ |
| 4.3 | **Dashboard** | Loads; data scoped to assigned branch/route if applicable. | ☐ |
| 4.4 | **Products** | List loads (tenant-scoped). | ☐ |
| 4.5 | **POS** | If staff has branches/routes assigned: branch/route show (from customer or assignment); complete sale. If no assignment: “No branches or routes assigned” message. | ☐ |
| 4.6 | **Customer Ledger** | If assigned: filter by branch/route; only customers in scope. If no assignment: “No branches or routes assigned.” | ☐ |
| 4.7 | **Sales Ledger** | List loads; data in scope. | ☐ |
| 4.8 | **Expenses** | List loads; Add Expense (no “New Category”); totals for assigned branch(es). | ☐ |
| 4.9 | **Direct URL to /reports or /users** | Redirect or access denied (no access to owner-only pages). | ☐ |
| 4.10 | **Profile** | Load and update own profile. | ☐ |
| 4.11 | **Logout** | Logout works. | ☐ |

---

## 5. Super Admin – Full App Check

*Login as **SystemAdmin** (Super Admin).*

| # | Page / Feature | Check | Done |
|---|----------------|--------|-----|
| 5.1 | **Super Admin login** | Use Super Admin login URL; reach Super Admin dashboard. | ☐ |
| 5.2 | **Super Admin dashboard** | Loads; tenant list or summary. | ☐ |
| 5.3 | **Tenants** | List tenants; open tenant detail. | ☐ |
| 5.4 | **Tenant detail** | Data for that tenant only; no cross-tenant data. | ☐ |
| 5.5 | **Impersonate** | Impersonate a tenant; see tenant app as that tenant; sidebar and data correct. | ☐ |
| 5.6 | **Exit impersonation** | Exit; back to Super Admin dashboard. | ☐ |
| 5.7 | **Demo requests** | Page loads. | ☐ |
| 5.8 | **Health** | Page loads. | ☐ |
| 5.9 | **Error logs** | Page loads. | ☐ |
| 5.10 | **Audit logs** | Page loads. | ☐ |
| 5.11 | **Subscriptions** | Page loads. | ☐ |
| 5.12 | **Super Admin settings** | Page loads. | ☐ |
| 5.13 | **Help / Feedback** | Pages load. | ☐ |
| 5.14 | **Logout** | Logout from Super Admin. | ☐ |

---

## 6. Data & Business Logic (No Wrong Calculations)

| # | Check | Done |
|---|--------|-----|
| 6.1 | **POS**: Invoice total = sum of line totals; VAT 5% correct; discount applied correctly. | ☐ |
| 6.2 | **Customer Ledger**: Balance and transaction list match. | ☐ |
| 6.3 | **Reports – Branch/Route**: COGS uses product cost (from purchases); profit = sales − COGS − expenses. | ☐ |
| 6.4 | **Expenses**: Branch-wise totals correct; Staff only see assigned branch expenses. | ☐ |
| 6.5 | **Multi-tenant**: Tenant A never sees Tenant B’s data (products, sales, customers, users). | ☐ |
| 6.6 | **Staff scope**: Staff only see customers/sales/expenses for assigned branches/routes. | ☐ |

---

## 7. Final Sign-Off

| # | Check | Done |
|---|--------|-----|
| 7.1 | All **Owner** page/feature checks (Section 3) done. | ☐ |
| 7.2 | All **Staff** checks (Section 4) done. | ☐ |
| 7.3 | All **Super Admin** checks (Section 5) done. | ☐ |
| 7.4 | Loading and errors (Section 2) and data/logic (Section 6) verified. | ☐ |
| 7.5 | Concurrency/load (Section 1) understood; load tested if required. | ☐ |

---

## Production ready?

When **every box above is ticked** and you have:

- No critical console/network errors during normal use  
- Correct calculations (POS, ledger, reports)  
- Correct access (Owner vs Staff vs Super Admin)  
- No data leakage between tenants or wrong scope for Staff  

you can sign off:

**Signed off as production ready:** _____________________  
**Date:** _____________________

---

*Last updated: Feb 2026. Adjust section numbers or rows if you add new pages or roles.*
