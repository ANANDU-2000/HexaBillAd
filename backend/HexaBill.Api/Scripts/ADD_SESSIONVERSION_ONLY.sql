-- Add SessionVersion to Users (fixes 42703 login error)
-- Run on production PostgreSQL when migration hasn't applied.
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SessionVersion" integer NOT NULL DEFAULT 0;
