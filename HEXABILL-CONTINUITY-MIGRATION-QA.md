# HexaBill ERP — Continuity Migration QA & Acceptance

## Test Categories
1. **P0 Security Hotfix Verification**:
   - FrozenHub 2 (Tenant 23): Verify zero Starplus metrics, zero widgets, zero hardcoded values.
   - FrozenHub 1 (Tenant 20): Verify operational dashboard has NO hardcoded fallbacks.
2. **PostgreSQL Real Database Integration**:
   - Execute queries directly via Npgsql / EF Core without mocked HTTP intercepts.
   - Test `/api/legacy/*` endpoints with real PostgreSQL backend on Render.
3. **Browser Acceptance (Playwright)**:
   - Automated real browser tests on Desktop (1440x900), Tablet (768x1024), and Mobile (390x844).
   - Capture live screenshots of every workflow.
