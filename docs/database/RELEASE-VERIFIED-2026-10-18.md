# Production release verification — 18 October 2026

Application release: `0a2ed68d754cc0cd3f508ef8c862962c50458372`. Owner requested latest push and production redeployment. Uncommitted work in other worktrees and local reference screenshots were preserved and excluded. No new application fix or production migration was made in this release checkpoint.

| Check | Status | Evidence |
|---|---|---|
| Push main | PASS | Non-force push advanced GitHub `main` from `4b85b22` to `0a2ed68`; subsequent `git ls-remote` matched |
| Render deployment | PASS | Owner-confirmed workspace `tea-ctr63al2ng1s73ersr5g`, service `srv-d68jpdvpm1nc7393q4d0`; final deploy `dep-dba4c85g1s2s73anvscg`, LIVE, exact release SHA, finished 2026-10-18T04:09:42Z (09:39:42 IST) |
| Replaced trigger | SUPERSEDED | Initial API deploy `dep-dba4c6rbc2fs73a15abg` was canceled when a manual deploy of the same commit started five seconds later. Followed the replacement; no duplicate retry |
| Vercel deployment | PASS | Auto-deploy `dpl_56EtwfwkUiVbZSRz6YgMopq4w9aL`, READY, exact release SHA, project `prj_GRooh8ebxo33R0uy5EspPoe5HmAo`, team `team_U8qgfcFQABNoNtJrAy5QyaZf`; existing wildcard and production aliases retained |
| Actual backend readiness | PASS | `/health/ready` at 2026-10-18T04:10:08Z: HTTP 200, `Ready`, `Connected`, `Current`, exact release SHA |
| Public clients after deployment | PASS | gulfharvest/frozenhub/frozenhub2/zayoga `.hexabill.company/login`: HTTP 200; each `/api/maintenance-check`: HTTP 200 / false |
| Migration history after restart | PASS | 59 rows; latest `20261018130000_BackfillCustomerOwnerId`, unchanged. Previously verified all 45 current-source migration IDs applied; no missing migrations invented or rerun |
| New serving instance error scan | PASS for bounded window | Instance `srv-d68jpdvpm1nc7393q4d0-wxmq6`, error/fatal scan from 04:09:43Z through 04:10:31Z returned zero entries, hasMore=false. This is not full authenticated workflow coverage |
| Rollout/background alert error | OPEN | Different instance `srv-d68jpdvpm1nc7393q4d0-wxhkv` at 04:09:42Z logged a failed OverdueInvoice alert save; PostgreSQL `22001`, value too long for varchar(500). First diagnostic page was truncated; exact affected column/root cause not yet established. Do not infer customer/product failure from this alert error or claim the whole release is error-free |
| Dependency warnings | OPEN | Render build reports known ImageSharp 3.1.11 vulnerability warnings. No package upgrade attempted during deployment |
| Authenticated product/customer create/edit/reload | NOT TESTED | Owner application sign-in and real UI acceptance still required; readiness/public login are not substitutes |
| Application test rerun | NOT TESTED | This push adds documentation only beyond the previously tested `80f1dfd` code checkpoint. Previous 985 backend passes/one documented skip, 220 frontend passes and 45 browser passes remain historical evidence |

Rollback reference: prior working backend deploy `dep-db9iamvavr4c73e6gpvg`, source `84c9e1ff83ef768c9206c891e890b5387c71ba46`. Earlier recovery verified that application version remained ready on the already expanded schema. Rollback was not needed or performed. A code rollback does not reverse database writes.

Exact commands included `git -c credential.username=ANANDU-2000 push origin main`, `git ls-remote origin refs/heads/main`, filtered Vercel project API via the existing CLI for the exact team/project, and guarded `Invoke-RestMethod` readiness assertion against the expected SHA. Commands exited 0. Git prompting was disabled; no secret was printed or changed. Render deployment/status/log operations and database reads used the authenticated connector. No customer data export, financial test transaction, production schema write, paid inference or permission change was performed.

Resume: application source release `0a2ed68`, branch `main`; this evidence is a subsequent local documentation-only checkpoint. Next task: owner-signed-in Gulf Harvest product/customer save/refetch acceptance. Separately reproduce and fix the varchar(500) background alert failure on disposable PostgreSQL, preserve other-worktree changes for reconciliation, and review dependency advisories. The broader all-features acceptance gate remains incomplete.
