# Enterprise: Secure Custom Domain & Client Setup

For an enterprise app you want a **secure, private-feeling** setup: your own domain, HTTPS everywhere, and clear separation for client/tenant access. This guide covers how to set that up and connect it to your frontend and backend.

---

## Why a custom domain?

| Need | How custom domain helps |
|------|-------------------------|
| **Secure** | HTTPS (SSL) on your domain; no shared `*.onrender.com` / `*.vercel.app` in the URL. |
| **Private / professional** | Clients see `app.yourcompany.com` instead of `hexabill.onrender.com`. |
| **Client trust** | One consistent brand (e.g. `billing.yourcompany.com` or `clients.yourcompany.com`). |
| **Control** | You own the domain; you can add more subdomains or move hosting later. |

You don’t have to buy a new domain if you already have one (e.g. `yourcompany.com`). You can use a subdomain like `app.yourcompany.com` or `billing.yourcompany.com`.

---

## Overview: what you’ll connect

```
[Your domain]                    [Where it points]
─────────────────────────────────────────────────────
app.yourcompany.com      →       Vercel (frontend)
api.yourcompany.com      →       Render (backend API)
```

- **Frontend (Vercel):** users open `https://app.yourcompany.com` (or `https://yourcompany.com`).
- **Backend (Render):** frontend calls `https://api.yourcompany.com` for the API.
- **Clients:** all use the same app URL; your app’s multi-tenant/login separates client data (no need for a different domain per client unless you want white-label later).

---

## Step 1: Get a domain (if you don’t have one)

- **Registrars:** Namecheap, Google Domains, Cloudflare, GoDaddy, etc.
- **Buy** the domain (e.g. `yourcompany.com`).
- You’ll use the registrar’s **DNS** in the next steps (or move DNS to Cloudflare for free DNS + optional proxy).

---

## Step 2: Add custom domain on Vercel (frontend)

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your HexaBill frontend project.
2. **Settings** → **Domains**.
3. **Add** the domain you want for the app, e.g.:
   - `app.yourcompany.com`, or  
   - `yourcompany.com` and/or `www.yourcompany.com`.
4. Vercel will show **DNS instructions**, usually:
   - **CNAME** `app` (or `www`) → `cname.vercel-dns.com`, or  
   - **A** record → Vercel’s IP (if using root domain).
5. In your **domain registrar’s DNS** (or Cloudflare), create exactly those records.
6. Wait for DNS to propagate (minutes to 48 hours). Vercel will issue **free SSL (HTTPS)** for your domain.

Result: clients visit `https://app.yourcompany.com` (or your chosen hostname) and get the React app.

---

## Step 3: Add custom domain on Render (backend API)

1. Open [Render Dashboard](https://dashboard.render.com) → your **HexaBill** web service (backend).
2. **Settings** → **Custom Domains**.
3. **Add custom domain**, e.g. `api.yourcompany.com`.
4. Render will show what to add in DNS, usually:
   - **CNAME** `api` → `hexabill.onrender.com` (or the hostname Render shows).
5. In your **registrar/Cloudflare DNS**, add that CNAME.
6. Render will provision **free SSL** for `api.yourcompany.com`.

Result: the API is available at `https://api.yourcompany.com` (and still at `https://hexabill.onrender.com` until you remove it).

---

## Step 4: Tell the app to use your domain (env and CORS)

### Backend (Render) – allow your frontend domain

In Render → your backend service → **Environment**:

- Set **`ALLOWED_ORIGINS`** to the exact origins the browser will use (comma-separated, no spaces):

  ```
  https://app.yourcompany.com,https://yourcompany.com,https://www.yourcompany.com
  ```

  Add every URL where you’ll host the frontend (including `https://something.vercel.app` if you keep it).

### Frontend (Vercel) – point to your API domain

In Vercel → your frontend project → **Settings** → **Environment Variables**:

- Add **`VITE_API_BASE_URL`** = `https://api.yourcompany.com`  
  (no trailing slash; the app will append `/api` where needed).

Redeploy frontend and backend after changing env vars so the new URLs and CORS are used.

---

## Step 5: “Client things” – how it fits together

- **One app, many clients (tenants):**  
  All clients use the **same** URL, e.g. `https://app.yourcompany.com`.  
  Your app already uses tenants/users and login; that’s how you separate client data. No extra domain per client is required.

- **Optional – client-specific subdomains later (white-label):**  
  If later you want `client1.yourcompany.com`, `client2.yourcompany.com`:
  - Add each subdomain in Vercel (or route via a single app that reads subdomain and sets tenant).
  - Add each in **ALLOWED_ORIGINS** on Render, e.g.  
    `https://client1.yourcompany.com,https://client2.yourcompany.com`.

- **Private / secure:**  
  - Everything over **HTTPS** (Vercel + Render provide SSL).  
  - **JWT** and **strong `JwtSettings__SecretKey`** (already in your setup).  
  - **No secrets in git**; only in Render/Vercel env and local `.env`.

So: **secure domain** = your custom domain + HTTPS. **Client separation** = your existing tenant/login model; optional extra step = add client subdomains and list them in `ALLOWED_ORIGINS`.

---

## Checklist

| Step | Action |
|------|--------|
| 1 | Domain bought (or subdomain chosen on existing domain). |
| 2 | Vercel: add domain → add CNAME/A in DNS → wait for SSL. |
| 3 | Render: add custom domain (e.g. `api.yourcompany.com`) → add CNAME in DNS → wait for SSL. |
| 4 | Render env: `ALLOWED_ORIGINS` = `https://app.yourcompany.com,...` (all frontend origins). |
| 5 | Vercel env: `VITE_API_BASE_URL` = `https://api.yourcompany.com`. |
| 6 | Redeploy backend and frontend; test login and API from `https://app.yourcompany.com`. |

---

## DNS quick reference (example)

Assuming domain `yourcompany.com` and app on `app`, API on `api`:

| Type  | Name/Host | Value / Target              |
|-------|-----------|-----------------------------|
| CNAME | `app`     | `cname.vercel-dns.com`      |
| CNAME | `api`     | `hexabill.onrender.com`     |

(Use the exact targets Vercel and Render show in their dashboards.)

---

## Summary

- **Secure domain:** Use your own domain (e.g. `app.yourcompany.com` + `api.yourcompany.com`) with HTTPS on Vercel and Render.
- **Private / client:** Same app URL for all clients; tenant and login handle separation; optionally add client subdomains later and list them in `ALLOWED_ORIGINS`.
- **Setup:** Add domain in Vercel + Render → DNS (CNAME/A) → set `ALLOWED_ORIGINS` and `VITE_API_BASE_URL` → redeploy.

If you tell me your exact domain (e.g. `yourcompany.com`) and whether you want `app` / `api` or something else, I can spell out the exact DNS rows and env values.
