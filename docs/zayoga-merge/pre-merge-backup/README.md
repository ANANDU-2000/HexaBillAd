# Pre-merge backup note

**Time:** 2026-08-09  
**Database:** Render hexabill (`dpg-d68jhpk9c44c73ft047g-a`)

Render MCP `query_render_postgres` is **read-only** (no snapshot API). Before execute:

1. Logical backup of affected customer ids is in `customers_snapshot.json` (queried pre-merge).
2. Recommended: Render Dashboard → hexabill Postgres → **Backup / Point-in-time** if available on plan.
3. Merge tool uses DB transactions; failed groups roll back.

Pilot dry-run (HOUSE BOAT 60,15 → 36): **Predicted balance 414.77 AED** — OK.
