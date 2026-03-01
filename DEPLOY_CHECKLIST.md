# Production deploy checklist

## Before pushing

1. **Database**  
   - If you see ErrorLogs 42703: In Render → Postgres → Connect → PSQL, run the ErrorLogs snippet below or full `backend/HexaBill.Api/Scripts/RUN_ON_RENDER_PSQL.sql`.
   - If GET `/api/expenses/categories` returns 500: Ensure `ExpenseCategories` has a `TenantId` column. Run the block in `backend/HexaBill.Api/Scripts/FIX_PRODUCTION_MIGRATIONS.sql` for ExpenseCategories (add column, backfill, index), or apply migration `20260225130000_AddExpenseCategoryTenantId`.
   ```sql
   ALTER TABLE "ErrorLogs" ADD COLUMN IF NOT EXISTS "ResolvedAt" timestamp with time zone NULL;
   CREATE INDEX IF NOT EXISTS "IX_ErrorLogs_ResolvedAt" ON "ErrorLogs" ("ResolvedAt");
   ```

2. **Local checks (already done)**  
   - Backend: `dotnet build` in `backend/HexaBill.Api` ✓  
   - Frontend: `npm run build` in `frontend/hexabill-ui` ✓  

## Deploy

3. **Commit and push**
   ```bash
   git add -A
   git status
   git commit -m "Dashboard: Today/Refresh live data; ErrorLogs 42703 resilient; deploy checklist"
   git push origin main
   ```

4. **Render**  
   If auto-deploy is on, the API and/or static site will deploy from `main`. Otherwise trigger a manual deploy in the Render dashboard.

## After deploy

5. **Smoke test**
   - Log in → Dashboard → select **Today** → click **Refresh**. Cards and chart should update.
   - If you’re SystemAdmin: open Error Logs / alert summary; they should load (or show empty if ResolvedAt wasn’t added yet).
