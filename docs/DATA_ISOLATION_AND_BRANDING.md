# Data isolation and per-company branding

HexaBill is built so each **company** (internally “tenant”) has its own data and branding. No company can see another’s data. Super Admin has a separate role with audit capability.

---

## Per-company isolation

- **Dashboard and IDs:** Each company has its own dashboard and ID. Users in that company see only their company’s data (sales, customers, products, etc.). They do **not** see other companies’ lists, counts, or any data.
- **After login:** Users can use and update only within their company (their own dashboard, settings, logo, name). All API and DB access is scoped by company (tenant) ID so data does not leak across companies.
- **Backend:** Every query that returns user-visible data is filtered by `TenantId` (or equivalent). Super Admin routes use separate endpoints and are not mixed with company-scoped data.

---

## Per-company logo and name (no cross-company leak)

- **Settings:** Each company can update **Company name** and **Logo** in **Settings** (after login). Those values are stored per company in the database.
- **Where it shows:** That company’s name and logo are used only in **that** company’s context: dashboard header, tab title, login screen (when that user’s company is loaded), and favicon. They are **not** shown to other companies.
- **How it works:** The frontend loads branding from `/api/settings`, which returns data for the **currently logged-in user’s company** only. So each client sees only their own logo and name. No cross-company leak.

---

## Super Admin: logs and what they can see

- **Super Admin** can create companies and manage the platform. They can:
  - See **audit logs** and **platform-level logs** (e.g. in Super Admin dashboard / diagnostics) for operations and support.
  - See **per-company usage and metrics** (e.g. invoice count, users) in the company detail view, for billing and support.
- **Super Admin cannot** see other companies’ **business data** (e.g. individual invoices, customer names) unless they use an explicit “view as company” / impersonation feature that is logged. Data access remains controlled and auditable.

---

## Error handling and data leak prevention

- **Always lock by company:** Backend APIs that return or modify data must filter by the current user’s company (tenant) ID. Do not return rows for other companies.
- **Each page:** Lists, dashboards, and reports are loaded with the user’s company context. If an API fails or returns empty, the UI shows an error or empty state; it must never show another company’s data.
- **Prevent leakage:** Validate company ID on every request; reject or scope any request that would expose another company’s data. Keep this in mind when adding new pages or APIs.

---

## Summary

| Topic | Behavior |
|-------|----------|
| Company data | Each company sees only its own dashboard, IDs, and data. |
| Logo & name | Stored per company; shown only in that company’s app (dashboard, tab, login when loaded). Not shown to other companies. |
| Super Admin | Can create companies, see platform/audit logs and per-company metrics; no casual access to other companies’ business data. |
| Data leak prevention | All company-scoped APIs filter by tenant/company ID; new features must follow the same pattern. |
