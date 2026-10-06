# Isolated synthetic browser host

This development tool exposes the real API TestServer pipeline on loopback port 5078 for Chrome/Vite money journeys. It is not a production host or a migration rehearsal. The product initialization gate is unchanged. Only the test host completes its initialization status; `/health/ready` still detects pending migration history.

The host refuses anything except `ASPNETCORE_ENVIRONMENT=Development`, a loopback PostgreSQL connection, a database name beginning `hexabill_codex_browser_`, and exactly the four synthetic tenant slugs with all flags OFF. It removes hosted jobs, uses temporary local file storage, disables R2, and generates a process-only JWT signing key. Never point it at an existing client database.

1. Create a new empty database in a disposable loopback PostgreSQL cluster.
2. Build `tools/HexaBill.SyntheticSeed/HexaBill.SyntheticSeed.csproj` and this project.
3. In a dedicated PowerShell process, set `HEXABILL_TEST_POSTGRES`, `ASPNETCORE_ENVIRONMENT=Development`, and a newly generated runtime `HEXABILL_SYNTHETIC_PASSWORD` (at least 12 characters). Do not print, write, or pass the password as a command-line argument.
4. Run `node scripts/seed-dev-synthetic.mjs --local-money-fixtures`. The seed refuses nonempty fixture databases. It creates four owners, one platform admin, and a minimal money fixture for each tenant: three invoices totalling 205 AED, two independent 50 AED receipts, and 105 AED outstanding. This is not the complete acceptance data matrix.
5. Remove the password environment variable after seeding; retain it only in the controlling process memory if browser login is needed. Run this project's built DLL from the same process. Use the same process-only `Hosting__EdgeProxySecret` / `HEXABILL_EDGE_PROXY_SECRET` for the API and Vite, and set `HEXABILL_DEV_API_ORIGIN=http://127.0.0.1:5078` for Vite.
6. Start Vite on a separate available port; navigate Chrome to `http://gulfharvest-test.localhost:<port>/login`. Owner emails follow `owner@<slug>.hexabill.local`. Use browser stdin input for the runtime password so shell/CLI title output cannot expose it. Never save browser authentication state.
7. Finish by voiding posted fixture payments through the app, reconciling balances, clearing this synthetic origin's browser storage, closing the owned browser session, stopping only the owned API/Vite processes, stopping the exact disposable PostgreSQL cluster, and clearing runtime secrets.

If resuming a preserved fixture database, a newly generated runtime password can be applied with the seed tool's `--rotate-password` argument. It verifies the four synthetic tenants and exactly five expected synthetic accounts, updates only their password hashes, and preserves financial records. Feature-enabled or unexpected-account databases are refused. Do not use this mode as a general account recovery tool.

`/__synthetic-host` reports `syntheticOnly=true`, `migrationProof=false`, and flags OFF. Successful browser journeys here certify only the exercised application behavior. The broken migration chain, Production startup, complete page matrix, VAT approval, and compatible rollback remain separate release gates.
