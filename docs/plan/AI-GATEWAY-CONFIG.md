# AI gateway configuration (server side)

Status (2026-10-18): code present and tested against stub HTTP and scripted providers only. It is **off by default**. The only feature that calls it is the assistant chat (`POST /api/assistant/chat`, the Ask tab), which asks the model to choose one of two read-only lookups and never gives it company records. No real provider has been contacted, no key has been used, and no production environment variable has been changed. **Real provider connectivity is NOT TESTED**: it needs a key set by the owner in the Render dashboard; see `docs/operations/AI-PROVIDER-SETUP.md`.

## Rules the code enforces
- Master switch `Ai:Enabled` is false unless you set it. While false, every call returns "Disabled" and no provider is contacted.
- Keys are read only from server configuration. They are never accepted from a request, logged, or returned. Logs contain provider, company id, purpose, timing and token counts, never prompts, answers or keys.
- Customer data is refused unless `Ai:AllowCustomerData` is true. Set it only after you have approved that provider's data-use, retention and region terms.
- Daily limits per company: `Ai:DailyCallLimitPerTenant` (default 200) and `Ai:DailyTokenLimitPerTenant` (default 200000). The budget is kept in the database (table `AiUsageDaily`: company, UTC day, calls, tokens; counts only), so it survives restarts and is shared by every instance. The limit check and the increment are one atomic statement, verified on PostgreSQL with concurrent callers. If the table is missing the call is NOT made (Unavailable): the AI never runs unmetered. `Ai:UsageLedger=memory` keeps the old per-process ledger for hosts with no database. The migration `20261018160000_AddAiUsageDaily` is hand-written and not applied anywhere real.
- A failure, a timeout (`Ai:TimeoutSeconds`, default 20, enforced by the gateway itself) or a refused call returns "Unavailable" or "Refused", never an exception, so the normal ERP screens keep working.
- No silent paid fallback. `Ai:FallbackProvider` is used only when the first provider fails, and a provider marked `Paid` also needs `Ai:AllowPaidFallback=true`.
- Model names, base URLs and prices come only from configuration. The code contains none.
- Output is non-authoritative text. It must never be posted to the books without a person confirming it through the existing draft, review and confirm path.

## Where to put values
Set them on the server (Render dashboard, Environment), not in Git, not in chat. Double underscores map to the configuration hierarchy. Example names (values are yours; check each provider's current documentation for the base URL and model name):

```
Ai__Enabled=true
Ai__Provider=groq
Ai__FallbackProvider=
Ai__AllowCustomerData=false
Ai__AllowPaidFallback=false
Ai__DailyCallLimitPerTenant=200
Ai__DailyTokenLimitPerTenant=200000

Ai__Providers__groq__Kind=openai-compatible
Ai__Providers__groq__BaseUrl=<provider base URL ending before /chat/completions>
Ai__Providers__groq__Model=<model name from the provider>
Ai__Providers__groq__ApiKey=<secret, set in the dashboard only>
Ai__Providers__groq__Paid=false

Ai__Providers__gemini__Kind=gemini
Ai__Providers__gemini__BaseUrl=<Gemini API base URL>
Ai__Providers__gemini__Model=<model name>
Ai__Providers__gemini__ApiKey=<secret>
```

Kinds supported: `openai-compatible` (OpenAI, Groq, OpenRouter and other services that accept the OpenAI chat-completions format) and `gemini`. A provider counts as configured only when kind, base URL, model and key are all set. Changing environment variables restarts the service, so do it at a quiet time.

## What calls the gateway today
- `POST /api/assistant/chat` (company users, read-only). The model sees only the person's message (treated as customer data, because it can hold names and phone numbers) and a fixed instruction. It answers with one JSON object naming a tool and a search text. The server accepts only `find_customers` and `product_stock`, only for tools the caller's role may use, takes only the search text (never extra arguments), and runs the tool itself with the caller's own company scope. Anything else (unknown tool, array, bad JSON, huge text) becomes "no tool" and a capped plain-text reply labelled as unchecked. Nothing is written. The message is not stored in logs or the audit row (only mode, tool and provider).
- `GET /api/assistant/status` tells the screen whether to show the Ask tab: only when `Ai:Enabled`, a provider is configured, and `Ai:AllowCustomerData=true`. It reveals no provider names or settings.
- Platform administrators only: `GET /api/superadmin/ai/providers` (configured or missing, kind, model, paid, primary or fallback; never keys or base URLs) and `POST /api/superadmin/ai/providers/{key}/test` (fixed synthetic prompt "Reply with the single word OK.", no company data, no company budget used, works while `Ai:Enabled` is false, at most one test per provider every 5 seconds; the result is ok or a short failure category such as `HTTP 401`, a timeout or "not configured", never the provider's body or key).

## Before turning it on for real
1. Choose the provider and read its data-use and retention terms (customer data stays blocked until you do).
2. Decide the daily limits and who may use each feature.
3. Run a staged pilot with synthetic data first. Record latency, cost and language quality (Malayalam and English) in the tracker.
4. Set the variables in Render, then run the platform test for that provider and record provider, model, latency and result in the tracker. Then keep `Ai__AllowCustomerData=false` until the provider's terms are approved: with it false the Ask tab stays hidden and no message leaves the server.
