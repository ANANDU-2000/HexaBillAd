# Connecting an AI provider (runbook)

Owner-run. Nothing here has been done: no key exists in this repository and no production variable was changed by the code work. Real provider connectivity is **NOT TESTED** until someone follows this and records the result.

## Where keys go (and where they must not)
- **Yes:** Render, backend API service, Environment (secret). Local work: process environment variables or .NET user-secrets.
- **No:** Vercel or any `VITE_*` variable (those are copied into the public browser bundle), Git, the database, screenshots, chat, logs.
- The `ANTHROPIC_*` values used by Claude Code or a local proxy do not configure HexaBill. Do not reuse them. If a real token was ever pasted into a chat or terminal log, revoke it.
- Coordinate environment changes with deployment. Saved values apply on an applicable deploy; Render also supports saving without deployment.

## Variables (names only; values come from the provider)
```
Ai__Enabled=false
Ai__Provider=gemini              # owner-selected primary
Ai__FallbackProvider=groq        # owner-selected fallback; paid fallback additionally needs approval and Ai__AllowPaidFallback=true
Ai__AllowCustomerData=false      # keep false until the provider's data-use, retention and region terms are approved
Ai__AllowPaidFallback=false
Ai__DailyCallLimitPerTenant=200
Ai__DailyTokenLimitPerTenant=200000
Ai__TimeoutSeconds=20
Ai__DataPolicyVersion=           # reviewed policy revision; empty keeps owner consent unavailable
Ai__DataPolicyNotice=            # reviewed retention, data-use and processing-location notice
Ai__Providers__<key>__Kind=openai-compatible   # or gemini
Ai__Providers__<key>__BaseUrl=<URL up to, not including, /chat/completions>
Ai__Providers__<key>__Model=<model id from the provider>
Ai__Providers__<key>__ApiKey=<secret>
Ai__Providers__<key>__Paid=false
Ai__Providers__<key>__MaxOutputTokens=512  # bounded to 64..2048 by the server
```
Confirm the current URL, model id, privacy terms, price and quota in the provider's own documentation first. Do not copy model names from old notes.

## Order of work
1. **Apply the migrations first** (approval, verified backup/restore and rehearsal required): the four in `docs/database/PENDING-MIGRATIONS-2026-10-18.sql` and `20261018180000_AddTenantAiConsent` in `AI-CONSENT-MIGRATION-2026-10-18.sql`. Without budget/consent storage no model request can proceed. Tables must be owned by the application database role.
2. Set the variables with `Ai__Enabled=false` and `Ai__AllowCustomerData=false`. Deploy.
3. As a platform administrator open the provider status (`GET /api/superadmin/ai/providers`): the provider should show `configured: true`, the model id and `paid` as you set them. No key is ever shown.
4. Run the provider test (`POST /api/superadmin/ai/providers/<key>/test`). It sends the fixed prompt "Reply with the single word OK." (no company data) and reports `ok`, latency and model, or a short failure such as `HTTP 401`. This works while `Ai__Enabled=false`. Record provider, model, latency and result in `docs/plan/AI-ERP-TASK-TRACKER.md`.
5. After provider terms/costs are approved, configure the reviewed policy version and notice, then enable the global switches. Each company's **Owner** must independently approve the displayed policy through **AI privacy** in the assistant panel. Staff/Admin cannot opt in. The Ask tab appears only after the current policy is approved and global configuration is available. Changed provider/model/policy requires fresh consent; key rotation preserves consent. Owner withdrawal disables subsequent requests. The panel itself remains behind its existing feature switch.
6. Smoke test with a synthetic company: ask for a customer and a product; check the answers come from the books; stop the provider (wrong key) and confirm the panel says it is not available and the Look up tab still works.

## What to watch
- Daily call and token counts per company are in `AiUsageDaily` (counts only). A company at its limit gets "The daily AI limit for this company is used up."
- Logs carry provider, company id, purpose and timing, never prompts, answers or keys.
- Per-provider output token caps are sent to the provider; reservations include the larger allowed answer cap. Daily token counts still use estimated input and provider-reported usage, and are not an exact bill or currency spend cap. Provider-side billing controls are also required; failed/timed-out attempts may incur charges that this ledger cannot reconcile.
- A provider outage, timeout or refusal never breaks the normal screens.
- Turn it off at once with `Ai__Enabled=false` (or by removing the provider key).

## Not covered here
Speech providers and voice (Stage 7), document search (Stage 6), and a SuperAdmin screen for usage, quotas and alerts (AI-03). Those are separate items in the tracker.
