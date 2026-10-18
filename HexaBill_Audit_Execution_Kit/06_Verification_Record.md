# Verification record

Audit date: 17 October 2026. Scope is the two uploaded archive snapshots. No authenticated production inspection was performed.

## Input identity

| Archive | Files | Approximate uncompressed size | SHA-256 |
| --- | --- | --- | --- |
| HexaBillAd-main (1).zip | 1,055 | 16.5 MiB | f50d25664a8a343ae60e0d3b065a498d8e14177d271ba66435d0269d7b52c165 |
| hexabill_al_uiuimages.zip | 309 PNGs | 34.9 MiB | 500de704f046b4a017ee53914135f1a5227563d77119edeb5921562037e6491c |

Both archives passed safe-path checks during extraction. Source originals were retained. The extracted source has no `.git` directory, so `git status --short` returns "not a git repository". A reported screenshot SHA is not a verified source/archive identity.

## Actual checks

| Check | Result | Interpretation |
| --- | --- | --- |
| Screenshot catalogue | Completed: 309 entries | Every image inspected through a contact sheet; selected critical images opened full size. This is visual analysis, not interactive QA. |
| OCR | Completed for 308 | S006 intentionally excluded because it contains a credential. OCR is supporting evidence and can misread text. |
| Targeted source review | Completed | Paths and anchors cited in audit. No claim of whole-repository security certification. |
| Exact duplicate content scan | Four groups found | Documentation/skill duplicates; not automatic deletion approval. |
| `node --test tests/*.test.js` in frontend app | Exit 1; runner reports 129 tests, 115 pass, 14 fail, 0 skipped | The 14 failing test-file loads report missing packages such as react, esbuild and react-hot-toast. They are environment-blocked, not 14 demonstrated application regressions. |
| `npm ci --ignore-scripts --no-audit --no-fund --offline` | Exit 1: ENOTCACHED | Required zustand archive was not cached. A dependency-complete test/build was not possible with this attempt. |
| .NET SDK discovery | `dotnet` not found on PATH | Backend tests/build were not run. |
| PostgreSQL integration/concurrency/migration tests | NOT TESTED | No disposable database/runtime configured in this audit. |
| Frontend production build/lint/browser E2E | NOT TESTED | Complete project dependencies unavailable; no running test API. |
| Production capacity, current DB size, real tenant count | NOT TESTED | Screenshots are time-specific observations, not live service measurements. |
| Voice recognition/output/provider costs | NOT TESTED | Architecture only; no paid or free model call was made. |
| Production data changes/deployment | None | No source fix, migration, restart, Git push or deployment performed. |

## Evidence quality

Confirmed visual failures include customer/product error toasts, the purchase error boundary, user activity failure and repeated admin logo errors. Their exact live causes need request/response and server correlation evidence. The purchase picker overlap and activity route mismatch have direct corresponding source evidence. VAT scrolling remains a user-reported behaviour with plausible refresh mechanisms, not a reproduced infinite loop.

The screenshot register distinguishes reference material, mobile layouts, tablet-like layouts and desktop admin pages. Some images include browser/developer surroundings or are cropped. Their pixel size must not be treated as a browser viewport specification.

Current root instructions include production safeguards and several historical docs contain older scope/tenant/test claims. This audit does not convert any historical PASS into a current PASS. The delivered goal requires reconciling them in the actual checkout.

## Required next evidence for production readiness

1. Actual Git SHA and deployed frontend/backend versions, with schema/migration status.
2. Real tenant list reconciled without exposing unnecessary personal data.
3. Customer/product save, purchase, activity and logo failures reproduced and repaired with targeted evidence.
4. PostgreSQL tenant, concurrency, replay and period-lock tests; zero unexplained skips.
5. Staging browser runs for owner/staff at phone/tablet/desktop sizes including keyboard, print and refetch.
6. R2 private object authorization/restart checks and separate DB/object recovery drills.
7. Capacity/load measurements, then a justified hosting decision.
8. AI and voice acceptance evidence before those features are enabled for a client.
