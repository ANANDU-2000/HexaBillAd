# Subscription lifecycle

How company status and subscription state work, and when the system blocks access.

---

## 1. Company (tenant) status

| Status    | Meaning |
|----------|--------|
| **Trial** | New company in trial period. `Tenant.TrialEndDate` set at creation. |
| **Active** | Paid and in good standing. Can use the app. |
| **Suspended** | Manually suspended by Super Admin. No access until activated. |
| **Expired** | Trial or subscription ended; not renewed. No access. |

Status is stored on **Tenant** (`Tenant.Status`). Subscription state (Trial/Active/Expired etc.) is stored on **Subscription** (`Subscription.Status`).

---

## 2. Subscription states

| State     | Meaning |
|----------|--------|
| **Trial** | In trial period. |
| **Active** | Paid (monthly or yearly). |
| **Expired** | Trial or paid period ended. |
| **Cancelled** | User cancelled. |
| **Suspended** | Admin suspended. |
| **PastDue** | Payment failed. |

`Subscription` has: `StartDate`, `EndDate`, `TrialEndDate`, `ExpiresAt`, `NextBillingDate`, `BillingCycle` (Monthly/Yearly).

---

## 3. When access is blocked

- **SubscriptionMiddleware** (backend) runs after auth (except for SystemAdmin and public endpoints).
- It loads the **current tenant’s** latest subscription (by `TenantId`, order by `CreatedAt` desc).
- If there is **no subscription** or subscription is **Expired/Cancelled/Suspended/PastDue**, the request is **blocked** (e.g. 403) and the user sees a subscription/expired message.
- **Trial** and **Active** subscriptions are allowed through.
- **Tenant.Status** (Suspended/Expired) is enforced separately (e.g. company detail suspend/activate). Middleware focuses on **subscription** state.

---

## 4. Where status is set

| Event | Where |
|-------|--------|
| New company created | Super Admin create-company: `Tenant.Status = Trial`, `TrialEndDate` set; optional `Subscription` created with Status = Trial. |
| Trial ends | **TrialExpiryCheckJob** (background): can set subscription to Expired and/or tenant to Expired when `TrialEndDate` has passed. |
| User pays | Subscription/checkout flow (or manual Super Admin action): set subscription to Active, set EndDate/NextBillingDate. |
| Super Admin suspends company | Company detail: Suspend → `Tenant.Status = Suspended`, optional subscription update. |
| Super Admin activates company | Company detail: Activate → `Tenant.Status = Active`. |

---

## 5. UI wording (Super Admin)

- Use **“Company”** in the UI (not “Tenant”).
- Use **“Active”** for paid/good standing.
- Use **“Trial”** only for companies in trial.
- Use **“Suspended”** and **“Expired”** as above.
- Avoid **“Operational”**; prefer **“Active”** or **“Active + Trial”** when you mean “can use the app”.

---

*Reference: Enterprise task plan – Phase 1.1.*
