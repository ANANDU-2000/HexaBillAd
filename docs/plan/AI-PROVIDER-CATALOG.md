# HexaBill AI Provider, Multilingual Voice, Maps & Costs — Decision Record

Checked against publicly published provider documentation on **2026-10-10**. Quotas, model IDs, data-use terms and availability change frequently; reverify before implementing, store the source URL and verification date in code review evidence. All figures are illustrative account/tier information, not promises of free production access.

## Realistic provider assessment

| Provider | Practical role | Free tier and risks | Recommended treatment |
|---|---|---|---|
| **Direct Gemini API** | Text model, structured tool calls, realtime Gemini Live voice | Model-dependent free usage, quotas vary per project. Gemini pricing page marks some free API usage as usable to improve Google's products; check current privacy/processing agreement before any real customer data. Some Gemini Live preview versions are free-tier enabled but not production SLA. | Prototype with synthetic content; production only on approved provider/data terms and controlled plan. Use a voice-specific capability test for Malayalam/Hindi/Arabic. |
| **Direct GroqCloud** | Low-latency open-weight LLMs and Whisper multilingual STT | Free plan is per model/organization rate-limited by requests, tokens, audio seconds; 429s expected. Production model list and deprecations change. | Good speed option for read-only text/STT with throttling, quotas and consent. Test data policy. |
| **OpenRouter** | Multi-model aggregator and contingency provider | Pricing page lists free tier 50 requests/day at time of check, variable free models and provider conditions, no guaranteed SLA. Free-model rate-limits may depend on account credits. | Optional dev/small-load fallback, not primary guaranteed free production infrastructure; cache responsibly and enforce privacy policy. |
| **OmniRouter (`omnirouter.li`)** | OpenAI-compatible aggregator | Its docs say account creation is free but usage is **prepaid with no free trial credit**; first request without credit returns 402. Other similarly named providers may differ. | Optional paid adapter only after verifying exact domain/legal terms; DO NOT represent as free. |
| **LiveKit Agents + Cloud** | Real-time WebRTC media/session transport and agent framework; bridge to Gemini/STT/TTS | Open-source framework; cloud Build plan has caps, sample free session concurrency 5 and possible 10–20s cold starts. Audio inference/worker hosting can still cost money, even if room transport is within free limits. | MVP use push-to-talk; LiveKit for verified realtime need, with hosted worker budget and session quotas. |
| **OpenCode** | Local/terminal/IDE coding assistant | Open source application, NOT inference server or unlimited production API credits. Provider subscriptions/keys have separate terms. | Use for developing HexaBill if wanted, not as user-facing inference provider. |
| **Open weights self-hosted** | Private inference/STT/TTS where capacity exists | No API per-token fee, but GPU/CPU hosting, reliability, model license, security and language quality have ongoing costs. | Evaluate only if recurring volume justifies infrastructure and Malayalam accuracy is tested. |
| **Paid premium model** | Complex reasoning/ambiguity escalation, with opted-in budget | Metered and provider-specific data contracts, can be costly. | Allow only via explicit SuperAdmin policy + tenant opt-in, cost ceilings and task routing. |

## Official source pages (verify before implementing)
- OpenRouter pricing: https://openrouter.ai/pricing ; free limits: https://openrouter.ai/docs/api-reference/limits
- Gemini pricing/data-use: https://ai.google.dev/gemini-api/docs/pricing ; limits: https://ai.google.dev/gemini-api/docs/rate-limits ; Live language coverage: https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Groq limits: https://console.groq.com/docs/rate-limits ; speech-to-text: https://console.groq.com/docs/speech-to-text ; models/deprecations: https://console.groq.com/docs/models and https://console.groq.com/docs/deprecations
- LiveKit quotas: https://docs.livekit.io/deploy/admin/quotas-and-limits/ ; Gemini Live plugin: https://docs.livekit.io/agents/models/realtime/plugins/gemini/
- OmniRouter documentation: https://omnirouter.li/docs
- OpenCode documentation: https://docs.opencode.ai/docs/
- OSM tiles: https://operations.osmfoundation.org/policies/tiles/ ; Google Maps price reference: https://developers.google.com/maps/billing-and-pricing/pricing

## Recommended initial routing policy (prototype, not yet validated)

| Task | Deterministic first? | Primary candidate | Fallback | User-facing behavior |
|---|---|---|---|---|
| Exact price/stock/balance/VAT | YES; backend service | NONE | NONE | Show source amount and timestamp; never LLM arithmetic |
| Customer/SKU/invoice global search | YES; indexed backend query | NONE | NONE | Fast categorized results |
| Intent/entity parsing for search and draft | Rule/search first | Approved inexpensive Gemini/Groq model | Approved alternate low-cost | If parse uncertain, show matching options and let user select |
| Business insight explanation | YES to fetch facts | Approved inexpensive model | Another approved provider, NO paid by default | Source-based narrative with explicit date range |
| Malayalam-English voice push-to-talk | STT required | Test Groq Whisper or other locale-suitable STT | Type text / second approved STT | Editable transcript, no automatic posting |
| Natural speech two-way voice | No | Gemini Live + optional LiveKit | STT->LLM->TTS only if language tested | Ask permission, show voice minutes, capped sessions |
| OCR invoice/receipt | Validation rules after extraction | Approved multimodal model | Manual upload/form | Human review before any posting |
| Risky finance draft | Backend performs validation and data match | Model drafts textual intent only | Manual form | Readback and explicit approval, then deterministic API |
| Forecasting | Baseline seasonal naive | Offline model after evidence | Baseline | Prediction-only, never overwrite prices/taxes |

## SuperAdmin settings schema (design guidance, inspect existing tables first)
- `ProviderConfig(id,name,adapter,capabilities,enabled,environment,allowedRegions,dataPolicyApprovedAt,policyVersion,keySecretReference,createdBy,updatedAt)`.
- `ModelCatalog(providerId,modelId,capabilities,langs,structuredOutput,toolCalls,contextTokens,inputRate,outputRate,audioRate,verifiedAt,deprecatedAt)`.
- `AiPolicy(tenantId?,taskType,enabled,providerPriority,modelAllowlist,maxRequestTokens,maxResponseTokens,maxAudioSeconds,maxConcurrency,dailySpendCap,monthlySpendCap,paidFallbackAllowed,privacyApproved)`.
- `AiUsage(tenantId,userId,requestId,sessionId,taskType,modelId,providerId,modality,inputTokens,outputTokens,sttSeconds,ttsSeconds,realtimeSeconds,latencyMs,status,errorCategory,usdEstimated,usdFinalized,createdAt)`; transactional usage reservation/reconciliation to resist races. Never store raw prompts or customer messages in this ledger.
- `AiToolAudit(tenantId,userId,toolName,actionClass,sourceIdsRedacted,approvalId,resultCode,createdAt)`.
- `AiAlertRule(scope,metric,threshold,recipientRef,enabled,debounce,quietHours)` and notifications via verified existing service.
- Prefer existing settings/notification/audit systems; avoid introducing duplicate stores or premature tables. Use migrations only when reviewed.

## Routing gates and algorithm
```
user intent + UI context
  -> authenticated tenant/user/role/branch and feature flag
  -> deterministic backend answer possible? then return it
  -> classify task and risk: read | draft | confirm | post
  -> allowed provider/models for task, locale, privacy policy, region, tools
  -> budget reservation + concurrency and rate controls
  -> cost/latency/quality ranked healthy candidates
  -> execute tool-scoped model call with short context
  -> validate output schema, citations and tool authorization again
  -> redact -> return; record usage and cost; release/settle reservation
  -> fallback ONLY if same data-policy class and within approved budget
  -> otherwise manual/text fallback, no hidden paid spend
```

## Privacy/cost pitfalls to test
- A single provider key shared across tenants creates noisy-neighbor quotas; allocate per-tenant fair shares and tenant+user budgets. Quota is often **project/account** scoped, NOT per API key.
- Real-time voice cost equals audio inference + possible STT/TTS + transport + hosting + telemetry/storage; not just LLM text tokens.
- Set sensible max voice session length, automatic mic stop, foreground-only when expected, and 80/100% threshold warnings.
- Use tenant-safe cache keys: tenant, user permissions, model, task, exact source version, date/time zone, locale; no shared prompt transcript caches across tenants.
- Refresh model names/prices and capability tests on schedule; do not select preview/deprecated models blindly.
- Don't store or send confidential data to providers under data-improvement terms without valid customer consent and approved agreements.
- Use mock provider fixture and failure injectors for CI; real provider smoke tests on synthetic data only.

## Map stack economics (separate from voice/LLM)
- Existing map code uses Leaflet. OSM **map data** has permissive open license subject to attribution, but public OSMF tile hosting is not an unlimited commercial CDN. For production use a hosted OSM-derived tile service with a suitable plan or self-host at justified volume.
- Route geometry/optimization can use hosted GraphHopper/OSRM/Valhalla or appropriately provisioned services, with real request budgets and routing quality measured. Google Maps/Routes has SKU-based free monthly allowances and usage fees; verify billing region (UAE, not India default), geo/licensing rules, before using.
- Live GPS tracking requires driver consent, access scoping, short retention, freshness status, mobile background capability assessment and location usage disclosure.
