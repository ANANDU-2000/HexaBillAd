-- BranchStaff.AssignedAt was created as TEXT; model expects DateTime. Fixes "exception while iterating over the results" / 500.
-- Run once via RunSql (DATABASE_URL_EXTERNAL from .env).

ALTER TABLE "BranchStaff" ALTER COLUMN "AssignedAt" TYPE timestamp with time zone USING ("AssignedAt"::timestamp with time zone);
