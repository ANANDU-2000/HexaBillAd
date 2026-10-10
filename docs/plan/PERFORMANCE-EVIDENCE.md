# Performance evidence

8 October 2026. Local loopback PostgreSQL 17 / guarded synthetic API / Vite. No production performance or improvement claim. Existing feature flags OFF.

## Login measurements

Twenty real HTTP attempts through Vite before and twenty after scoped account lookup and stage instrumentation. Milliseconds; p95 uses nearest rank. Cold first-process/EF initialization is included in the all-attempt series.

| Series | Count | p50 | p95 | Maximum |
|---|---:|---:|---:|---:|
| Before | 20 | 157.311 | 521.272 | 979.548 |
| After, all | 20 | 150.768 | 532.816 | 1432.612 |
| After, first cold attempt excluded | 19 | 150.768 | 532.816 | 532.816 |

These small local series do not establish an improvement. BCrypt dominates warm requests; hash cost has not been reduced.

| After stage | p50 ms | p95 ms | Maximum ms |
|---|---:|---:|---:|
| Host resolution, both existing passes aggregated | .034 | .059 | 225.731 |
| Lockout check | 2.121 | 3.460 | 70.370 |
| User lookup | .844 | 1.412 | 128.537 |
| Fresh tenant status | .691 | 1.045 | 16.866 |
| BCrypt verification | 134.489 | 499.265 | 545.010 |
| Last login save | 1.858 | 2.939 | 79.523 |
| Session save | 1.312 | 1.823 | 24.762 |
| Company settings | .830 | 1.576 | 27.149 |
| Branch assignments | .620 | 1.251 | 11.908 |
| Route assignments | .519 | 1.088 | 6.883 |
| JWT generation | .179 | .243 | 19.398 |
| Lockout clear | .519 | 1.048 | 3.997 |

Fixed stage names, request-local storage, no password/token/body in timing output. Development-only Server-Timing header; Production/Staging header absence covered by tests. Structured server timings retain correlation and final resolved workspace. Other requests are not collected.

Actual browser form login to dashboard completed for GulfHarvest and Zayogya synthetic owners. Twenty browser click-to-dashboard timings, complete auth/role/lockout matrix and production navigation budgets remain NOT RUN.

## Remaining paths

Sale 1/10/50-line cash/credit/new/existing matrices, stage/query/save/PDF/reconciliation, durable retry identity and list/search representative-volume measurements remain OPEN. Static SaleService candidates: per-item product/stock reads, synchronous discarded PDF after commit, repeated balance recalculation. Measure before optimizing.

Local raw timing evidence: %TEMP%/hexabill-goal-20261008-evidence/login-measurements.json. Synthetic bridge reports migrationProof=false.
