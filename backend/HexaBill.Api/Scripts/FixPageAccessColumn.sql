-- Fix PageAccess column for SQLite
-- Run this if you get "no such column: u.PageAccess" error

-- For SQLite
ALTER TABLE Users ADD COLUMN PageAccess TEXT NULL;

-- For PostgreSQL (if needed)
-- ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PageAccess" character varying(500) NULL;
