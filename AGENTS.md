# HexaBill ERP — Persistent engineering instructions (Claude/Codex/OpenCode)

## Mission and scope
Improve the EXISTING multi-tenant .NET + React + PostgreSQL HexaBill ERP for real small trading companies. Combine reliable accounting, premium fast UX (mobile/tablet/desktop), tenant-safe multilingual text and voice AI, maps/delivery, staff productivity, SuperAdmin observability, and measured AI/ML recommendations. Reliability and financial integrity outrank AI novelty. Do not rebuild what works.

## Safety and operating constraints
- Never infer current HEAD, installed providers, deployed state, production access, tenant count, or test success from chat. Inspect the active checkout, read-only infra and actual evidence.
- Start with production incident triage (unintended maintenance 503), account access, customer data leaks in prints, incorrect saves and financial transaction integrity. No feature work before P0 blockers are classified and mitigated.
- Use existing service/module boundaries, EF Core migrations and authorization patterns. Every data read/write, LLM function call, search, cache key, event, trace, export, vector index, saved conversation, websocket room and realtime audio session MUST bind to authenticated `tenantId`, userId and server-verified scope. Role and job title are separate. Staff never infer owner permissions by frontend flags.
- Treat any subdomain or user-supplied tenant identifier as untrusted until server-validated. Two tenants may share legal details/TRN and MUST remain operationally isolated; never consolidate tax or ledger data automatically. Test a forged tenant ID and non-member invoice ID.
- No passwords or API secrets in source, prompts, client JS, traces, PDF logs or frontend browser storage. SuperAdmin manages keys by server-side secret reference/envelope encryption backed by externally managed encryption keys; mask/reveal-never, permission-check, redact logs, rotate/revoke/test/connectivity audit.
- Never send sensitive customer, staff or financial data to free provider endpoints until data use, retention, region and provider processing terms are explicitly approved. Prefer aggregated/minimized service outputs. Offer opt-out from recording voice and storing transcript.
- No unsupported regulatory claims: UAE VAT figures come from tested deterministic backend services, with accountant-reviewed Form 201 assumptions and explicit missing-data states. No AI-authored ledger posting, VAT amounts, stock writes or price changes.
- Voice output is NON-AUTHORITATIVE. Never execute a consequential action based solely on an unconfirmed transcript; read back numbers, currency, product and customer, then render a confirmable form.
- Money changes: idempotency keys, transaction boundaries, server validation, no automatic ambiguous HTTP retries, unchanged audit trail and double-submit controls. Immutable finalized invoice history unless existing authorized amend/void path is used.
- Production: inspect read-only; test on disposable PostgreSQL + synthetic tenant data. Verified backup/restore drill + rollback + compatibility checks + explicit environment-specific approval before production migration/deployment. Never run `Down` on live data casually.
- Don't delete customer assets, migrations, historical audit records, tenant documents, reference folders or untracked files. Proposed cleanup must be verified against imports, routes, builds, tests and dynamic loading. Archive findings before removal; `git status` before/after.

## Execution discipline (economical and resumable)
1. Inspect `git status --short`, branch, HEAD, docs tracker; locate actual relevant code. Reconcile current code with screenshot ZIP and historical claims.
2. Pick ONE P0/P1 task; reproduce first (failing test where practical), identify root cause, propose narrowly scoped files, implement smallest fix, test targeted cases, update tracker.
3. Budget context: read named files/line ranges not full repo repeatedly; avoid full-stack parallel subagent sessions and duplicate skill invocations. Specialist subagent only for independent bounded reviews, concise results, no concurrent edits to same files; note added token cost.
4. Run .NET, React and PostgreSQL/Playwright tests as appropriate; full suites at milestone gates. Do not count skipped tests as passes. Capture exact commands/exit statuses.
5. Work follows the CONTINUOUS LOCAL EXECUTION POLICY below. Record progress in the tracker after each verified task, resume from the tracker rather than reconstructing from chat, and never bypass safeguards or claim PASS because builds succeeded.

## CONTINUOUS LOCAL EXECUTION POLICY
This policy replaces the earlier "one checkpoint, then stop" rule. It does not weaken any safety requirement in this file.

1. Execute approved local development tasks sequentially, one bounded task at a time.
2. After each task: run its targeted tests, record PASS/FAIL/BLOCKED with evidence in the tracker, and commit the verified checkpoint locally. Do not push.
3. Then continue to the next independent approved task. Do not ask permission after routine checkpoints, and do not ask "should I continue?".
4. Before any context reset or usage limit, persist progress: branch, last commit, current task ID, next failing test, blockers, and the exact next action in the tracker.
5. Do not repeat completed audits or plans. Read only what the current task needs.
6. Do not claim PASS without evidence. Report skipped or unrun tests as NOT TESTED, not PASS.

Stop and ask only for:
- Production deployment, production database changes, or production migrations.
- Paid external services or any paid API call.
- Missing essential credentials or configuration that cannot be read from the repository.
- Destructive operations (deleting live data, dropping tables, removing customer assets or migrations).
- Security-sensitive decisions (auth model, tenant isolation rules, key handling, data sharing with third parties).
- Genuine blockers that prevent the next task.
- Execution or usage limits.

Everything else is routine local work and proceeds without a stop.

## Architecture principles
- One authoritative ERP backend for financial rules and permissions; AI is an orchestrator, not source of truth.
- One AI Gateway (server-side adapter registry) with direct Gemini/Groq/OpenRouter and OPTIONAL verified OmniRouter adapter; premium paid models by approval, not silent fallback. OpenCode is a coding assistant, NOT free production LLM inference.
- One tool registry with versioned typed schemas, deterministic server-side tenant+role authorization before and after tool execution, bounded pagination, sensitive-field redaction and per-tool policy (read/draft/confirm/post).
- One text/voice session ownership contract: tenantId + userId + role permissions + feature flags + quotas + request/session ID + audit. Separate voice transport and realtime model selection; model router must check capabilities, health, limits, privacy, and cost.
- One observable provider usage ledger: provider/model/modality/token/audio duration/latency/error/fallback attempt/cost (estimated and reconciled)/tenant/user, no plaintext PII. Explicit caps and alerts; rate-limit without silent paid overage.
- One responsive UI design system; existing components, Tailwind tokens, lucide icons, motion accessibility. Business tasks and financial correctness first, zero duplicate headers/nav, predictable scrolling, minimal AI decorations.
- No unauthorized background mic or location tracking. GPS opt-in, foreground/session-bound unless a separately consented mobile solution exists; expiry, deletion and stale-location labels. OSM public map tile servers have usage policy, not an unlimited production free SLA.

## Required acceptance evidence
- Baseline source and deployment version mapped; P0 incident fixed and recovery UI tested (503 maintenance vs other 503) before expanding.
- 4 claimed tenants reconciled without guessing/copying; owner onboarding and staff permission/isolation tests.
- Invoice/customer-last-price flows incl void, old invoice edit, unit, tax, no accidental updates; daily cash close reconciles actual cash by branch/cashier with correct tender splits.
- Responsive 360/390/768/1024/1440, real create/edit/save/refetch, keyboard, printed tenant branding, Arabic display, PWA optional.
- Multilingual (Malayalam, English, Hindi, Arabic first; others after verification) voice: accent/code-switching/noisy speech/numbers/permission tests, latency and cost baseline, text fallback.
- AI text: tool grounding and sources, permission deny, prompt injection, redaction, provider outages, spent quota, no cross-tenant retrieval; drafting requires human confirmation and deterministic posting validation.
- Provider/key/usage/alerts/feature flags usable by SuperAdmin without exposing other tenants to staff/owners.
- No unverified finance outputs, zero data leakage, no unexplained skipped PostgreSQL tests at production gate.

## Working contract
Report `PASS / FAIL / BLOCKED / NOT TESTED` with evidence. Follow `docs/plan/HEXABILL-AI-ERP-MASTER-GOAL.md` milestones; do not start next milestone without recording gate status. An approval to plan or create test code is NOT an approval to modify production.

## Cloud Agent local runtime
Local services are started by the environment, not by production credentials.

- API: `http://127.0.0.1:5000` (`GET /health` is ok when PostgreSQL `hexabill_dev` is ready). UI: `http://demo-company-1.localhost:5173`.
- Sign-in is host-scoped. `localhost` is not a tenant. Use `demo-company-1.localhost` for owner1 and `demo-company-2.localhost` for owner2.
- Development passwords are generated on first boot into `/home/ubuntu/.hexabill-dev-credentials` (mode 600). Do not print, commit, or copy them. Emails: `admin@hexabill.com`, `owner1@hexabill.com`, `owner2@hexabill.com`.
- PostgreSQL 16 listens on `127.0.0.1:5432` with local trust for role `hexabill`. Integration tests: `HEXABILL_TEST_POSTGRES=Host=127.0.0.1;Port=5432;Database=hexabill_test;Username=hexabill`.
- An empty `hexabill_dev` is baselined from the EF model before the API starts. The migration chain cannot build that empty database by itself.
