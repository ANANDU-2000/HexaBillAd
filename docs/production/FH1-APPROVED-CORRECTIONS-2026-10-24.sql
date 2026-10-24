-- SUPERSEDED (2026-10-24). No production SQL is needed for FrozenHub 1 header or invoice numbering.
-- Header: the app enforces the approved bilingual header for subdomain 'frozenhub' on read and on PDF
--   (SettingsService.GetOwnerSettingsAsync / RequiresFrozenHubMonochromeHeaderAsync).
-- Numbering: the owner sets "New invoice numbers start at" = 7000 in Settings > Billing (writes INVOICE_SERIES_START
--   for tenant 20 through the audited settings path, refused if invoices already exist in the series).
-- This file is kept as the record of what was reviewed. It intentionally contains no statements.
SELECT 1 WHERE false;
