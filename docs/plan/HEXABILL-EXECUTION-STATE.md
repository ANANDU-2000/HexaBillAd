# HexaBill execution state (resume from here)

Updated 2026-10-11. Branch `main`. Owner approved push + redeploy on 2026-10-11; code commits `0564c8e`, `6c8c28b`, `a560bc0` are pushed (origin/main `c9dc5e6`) and live.

## Local checkpoints this session
| Commit | Task | Evidence |
|---|---|---|
| `0564c8e` | LIVE-01: saves were silently blocked client-side after a network blip (`shouldAllowRequest` blocked every request, incl. POST/PUT/DELETE, with an error no page treats as handled, so pages showed only a generic "Failed to ..."). Only background reads are held back now. | `node --test tests/serviceErrors.test.js` 6/6; eslint 0 errors |
| `6c8c28b` | LIVE-02: A4 bilingual letterhead logo 140x100 -> 190x136 pt (compact receipts unchanged). | `LetterheadLogoSizeTests` + `GulfHarvestDocumentFamily` + `TenantHeaderParity` 9/9; PDF image measured 130-140 pt high, centred |
| `a560bc0` | SH-16 payments: date/search/method/status filter on the server before paging. | `PaymentListFiltersHttpTests` 8/8; frontend `paymentsUrl` + `receiptEligibility` 16/16 |

Backend tests are built with `--artifacts-path "$TEMP/hb-artifacts"` because a dev `HexaBill.Api.exe` (PID 42828) locks `backend/HexaBill.Api/bin`. Not run yet: full backend suite, full frontend suite, PostgreSQL, Playwright. NOT TESTED, not PASS.

## Live Gulf Harvest findings (tenant 22, read-only evidence)
- Render request log since the 06:41Z deploy: one `POST /api/products` = 201 (08:35:26Z) and one `POST /api/admin/logo/upload` = 200 (08:39:48Z). No `POST/PUT/DELETE /api/expenses` and no failed product POST reached the server, so the failing saves stop in the browser (LIVE-01 above is the identified cause; NOT confirmed live until redeployed and retried).
- Daily close shows "not enabled": the tenant `FeaturesJson` is `[]` (flag off by design). Enabling is an audited SuperAdmin change and needs owner approval.
- Login: owner login now works for the user (signed in as Owner in the screenshots). The earlier "Incorrect email or password" was not reproduced from code; the backend returns the same 400 for no-user, inactive, suspended tenant and bad password.
- SECURITY: `clients/Gulf Harvest .../details.txt` (gitignored, on OneDrive-synced disk) holds the owner and staff passwords in plain text. Rotate them and move the file out of the synced folder.

## Open, in priority order
1. LIVE-03 logo "lost after refresh" and expense receipt image not saved: upload returns 200 and is stored; cause of loss not yet found. Check which storage is active in production (R2 vs local disk, which is wiped on every deploy) and why the data-URI fallback is not used.
2. LIVE-04 Reports page layout (large filter card, gaps) and wasted space on other pages (SH-01, SH-15).
3. LIVE-05 Daily close: owner decision to enable the `daily_close` flag for tenant 22 after staging check.
4. Remaining logo sizes in the non-bilingual headers (`PdfService.cs` lines near 288, 691, 1309, 1799, 1961, 3126, 3344, 3510).
5. P0 items awaiting the approved defaults in the goal: ST-01 staff disable, RP-04/PY-09 staff API permissions, AG-02 aging cutoff, PS-05 cash default.
6. Release gate: commits above were deployed on owner approval (see Release record). Anything after `c9dc5e6` still needs a fresh go/no-go.

## Next exact action
Find the active production storage provider for tenant logos and expense attachments (read-only config check) and write a failing test for "logo survives a restart".

## Release record (2026-10-11, owner-approved)
- Push: `704f802..c9dc5e6` to origin/main. No migrations in the range (`git diff 704f802..HEAD -- backend/HexaBill.Api/Migrations` empty).
- Backend: Render `dep-db5lc6cs728c7387gmp0` (API-triggered, autoDeploy off) live; `/health/ready` = Ready, schema Current, deployVersion `c9dc5e6`. Rollback: `dep-db5iuhflot8c73f4mit0` (`704f802`).
- Frontend: Vercel `dpl_ASo1oPXfYXq6mXoL596AgZJ6d9U8` (`hexabill-2err37pup`), built from the push; bundle `index-DdioVnWh.js` matches the local build; live Products chunk contains the fix.
- ROOT CAUSE FOUND (Gulf Harvest only): `gulfharvest.hexabill.company` had an explicit alias pinned to `hexabill-2jrio3lr0` (2026-10-07), overriding `*.hexabill.company`, so that tenant ran a 4-day-old frontend that predates the Oct-7 "201 body loss through Vercel proxy" fix. Alias re-pointed to `hexabill-2err37pup`. Rollback: `vercel alias set hexabill-2jrio3lr0-anandukrishnapa2000-gmailcoms-projects.vercel.app gulfharvest.hexabill.company --scope team_U8qgfcFQABNoNtJrAy5QyaZf`.
- Checked after deploy (public, read-only): all four client domains `/login` 200, `/api/maintenance-check` false, same bundle. NOT TESTED: authenticated product/expense save, logo upload, print on the live tenant (needs the owner session).
