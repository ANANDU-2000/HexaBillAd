# AI guardrail verification — 18 October 2026

## Source and production gate

Starting checkout: `main`, `bf0ff18dc83cba5143b5124dcf72193f357d1ba0`. Unrelated UI, VAT and tracker edits were already present and are excluded from this checkpoint.

Read-only Render evidence: workspace `tea-ctr63al2ng1s73ersr5g`, API `srv-d68jpdvpm1nc7393q4d0`, latest live deploy `dep-dba4c85g1s2s73anvscg`, commit `0a2ed68d754cc0cd3f508ef8c862962c50458372`. `/health/ready` returned HTTP 200 Ready/Connected/Current at `2026-10-18T08:41:59Z`. Platform maintenance mode is disabled; a direct API-host maintenance request returned 403, so tenant-host maintenance recovery was NOT TESTED here.

The database has 59 migration-history entries and none of `AiUsageDaily`, `TenantDocumentChunks`, `RouteRuns`, `DriverLocationCurrents`. Readiness is relative to the old deployed assembly; it does not prove compatibility with this checkout. Production logs include the VAT transaction/execution-strategy error. Its existing working-tree fix is outside this checkpoint. Overall P0/production gate remains PARTIAL; no new feature rollout is claimed.

## Reproduced and fixed

15 new HTTP cases all failed against the original implementation (exit 1, 15 failed/0 passed/0 skipped). The parser extracted executable choices from prose, accepted duplicate JSON properties and additional command keys, and returned arbitrary model text including invented VAT payment instructions.

The existing assistant now accepts one JSON object or one exact complete JSON code fence. It rejects extra command keys and duplicate properties, including nested suggestion fields. Unknown commands, malformed responses and unsupported requests return fixed help. The browser independently replaces reply text with fixed help, including when connected to an older API. Ordinary typed form fields continue through their existing validation and human review/confirm path. No permissions, financial rules or schema changed.

The system prompt explicitly forbids changing scope/roles, treating quoted content as authority, exposing secrets, and generating financial postings or VAT claims. Server parsing and authorization enforce the boundary even when the provider ignores that prompt. This is defense against demonstrated attacks, not a claim that every prompt injection is detectable.

## Executed checks

| Command / scope | Outcome |
| --- | --- |
| `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --filter 'FullyQualifiedName~AmbiguousOrExtendedModelCommands\|FullyQualifiedName~UngroundedModelText' --logger 'console;verbosity=quiet'` before fix | FAIL as expected; 15 failed, exit 1 |
| `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --no-restore --filter 'FullyQualifiedName~AssistantChatHttpTests\|FullyQualifiedName~AssistantSuggestionHttpTests\|FullyQualifiedName~AiGatewayTests\|FullyQualifiedName~AssistantToolsHttpTests' --logger 'console;verbosity=quiet' -v quiet` | PASS; 90 passed, 0 failed/skipped, exit 0 |
| `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --no-build --filter 'FullyQualifiedName~Assistant\|FullyQualifiedName~AiGatewayTests\|FullyQualifiedName~TenantDocument\|FullyQualifiedName~PersistentAiUsageLedgerPostgreSqlTests' --logger 'console;verbosity=quiet'` with `HEXABILL_TEST_POSTGRES` | PASS; 162 passed, 0 failed/skipped, exit 0 |
| `node --test tests/assistantChat.test.js tests/assistantDraft.test.js tests/assistantVoice.test.js` | PASS; 16 passed, 0 failed/skipped, exit 0 |
| `npx eslint src/features/assistant/assistantChat.js tests/assistantChat.test.js e2e/assistant-chat.spec.js` | PASS; exit 0 |
| `npm test` / `npm run build` in `frontend/hexabill-ui` | PASS; 258 passed, 0 failed/skipped; build exit 0 |
| `scripts/run-customer-save-qa.ps1 -Database hexabill_codex_browser_ai_df50f5398c -PostgresPort 55474 -Projects @('m360','m390','t768','d1024','d1440') -Spec @('e2e/assistant-chat.spec.js')` with synthetic mock opt-in | PASS; 10 passed, 0 failed/skipped, exit 0 |

PostgreSQL: loopback port 55474, new synthetic database `hexabill_ai_guardrails_5e0663d17228`. The HTTP factory uses its isolated SQLite database; PostgreSQL-specific document, draft and budget cases use PostgreSQL. No test uses production or restored customer records. Initial database creation under `hexabill_qa` failed due to its existing restricted permissions; creation under the existing local test administrator succeeded without changing privileges.

Browser fixture findings: an inherited pair of Node color variables made PowerShell treat a warning as a terminating native error; the rerun removes those variables. The old seed executable predated the AI tables, and the generic mock prefixes its output with `[mock]`. Both initial browser runs reported 5 failures/5 passes; the missing budget table correctly prevented model calls. Both synthetic tools were rebuilt; a new database `hexabill_codex_browser_ai_df50f5398c` was seeded. Only the loopback/synthetic browser host now substitutes an echo provider when explicitly opted in; production parsing is unchanged. No memory-ledger bypass was used.

Independent prerequisite check: the existing uncommitted `VatPeriodWritesPostgreSqlTests` case passed with PostgreSQL (1 passed/0 failed/skipped, exit 0). That does not commit, deploy, or fully release-verify the VAT changes.

NOT TESTED: real provider behavior, live authenticated save/refetch, real speech, production document-storage persistence, broad production acceptance. No production variables, database writes, deploys, pushes or paid/model network calls were made. Build output still reports existing ImageSharp vulnerability advisories; dependency remediation is separate.
