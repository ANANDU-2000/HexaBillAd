-- Fix VatReturnPeriods datetime columns: migration created them as TEXT; PostgreSQL date_trunc() requires timestamp.
-- Run once on Render Postgres (e.g. via RunSql from PC with DATABASE_URL_EXTERNAL from .env).
-- Resolves: 42883 function date_trunc(unknown, text, unknown) does not exist

ALTER TABLE "VatReturnPeriods" ALTER COLUMN "PeriodStart" TYPE timestamp with time zone USING "PeriodStart"::timestamp with time zone;
ALTER TABLE "VatReturnPeriods" ALTER COLUMN "PeriodEnd" TYPE timestamp with time zone USING "PeriodEnd"::timestamp with time zone;
ALTER TABLE "VatReturnPeriods" ALTER COLUMN "DueDate" TYPE timestamp with time zone USING "DueDate"::timestamp with time zone;
ALTER TABLE "VatReturnPeriods" ALTER COLUMN "CalculatedAt" TYPE timestamp with time zone USING "CalculatedAt"::timestamp with time zone;
ALTER TABLE "VatReturnPeriods" ALTER COLUMN "SubmittedAt" TYPE timestamp with time zone USING "SubmittedAt"::timestamp with time zone;
ALTER TABLE "VatReturnPeriods" ALTER COLUMN "LockedAt" TYPE timestamp with time zone USING "LockedAt"::timestamp with time zone;
