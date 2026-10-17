# AI gateway configuration (server side)

Status: code present and tested against stub HTTP only. **Nothing in the application calls it yet and it is off by default.** No real provider has been contacted, no key has been used, and no production environment variable has been changed.

## Rules the code enforces
- Master switch `Ai:Enabled` is false unless you set it. While false, every call returns "Disabled" and no provider is contacted.
- Keys are read only from server configuration. They are never accepted from a request, logged, or returned. Logs contain provider, company id, purpose, timing and token counts, never prompts, answers or keys.
- Customer data is refused unless `Ai:AllowCustomerData` is true. Set it only after you have approved that provider's data-use, retention and region terms.
- Daily limits per company: `Ai:DailyCallLimitPerTenant` (default 200) and `Ai:DailyTokenLimitPerTenant` (default 200000). The ledger is in memory, so it is per server instance and resets on restart; a persistent ledger is needed before several instances share a budget.
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

## Before turning it on for real
1. Choose the provider and read its data-use and retention terms (customer data stays blocked until you do).
2. Decide the daily limits and who may use each feature.
3. Run a staged pilot with synthetic data first. Record latency, cost and language quality (Malayalam and English) in the tracker.
4. Add a feature that actually calls the gateway through the confirmed-draft path; none exists yet.
