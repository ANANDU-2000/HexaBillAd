# Test Evidence
| Date | Command | Result | Artifact |
|------|---------|--------|----------|
| 2026-10-10 | dotnet test tests/HexaBill.Tests | 710 pass / 0 fail / 52 skip (PG not configured) | console |
| 2026-10-10 | dotnet test tests/HexaBill.Tests | 718 pass / 0 fail / 52 skip (PG) | console |
| 2026-10-10 | npm test (frontend) | 138/138; vite build OK | console |
| 2026-10-10 | dotnet test (x7 runs) | 719 pass / 52 skip; 2 of 7 runs had one intermittent failure (StatementForeignIdentityTests once, VATMGMT_EXPORTS once; both pass in isolation). Removed process-wide env mutation from VatReturnWorkflowTests. Remaining flake tracked as T-050. | console |
