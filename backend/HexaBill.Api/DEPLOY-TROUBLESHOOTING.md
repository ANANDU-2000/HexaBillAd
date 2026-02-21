# Render deploy troubleshooting

If deploy fails with **"Exited with status 1 while building your code"**:

1. **Get the real error**  
   Render Dashboard → your **hexabill-api** service → **Logs** → open the **failed deploy** → open the **Build** log. Scroll for the first line containing `error` (e.g. `error CS`, `error MSB`, `The type ... could not be found`, or NuGet/COPY errors).

2. **Service settings**  
   Ensure **Root Directory** is `backend/HexaBill.Api` (or leave blank if using blueprint). **Dockerfile Path**: `Dockerfile` when root is `backend/HexaBill.Api`, or `backend/HexaBill.Api/Dockerfile` when root is repo root.

3. **This repo**  
   - SeedData xlsx are optional (Condition in csproj); build works if they’re missing.  
   - `.dockerignore` keeps bin/obj/.git out of the Docker context.

Share the exact Build log error line to fix the failure.
