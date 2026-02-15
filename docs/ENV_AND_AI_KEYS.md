# Environment and AI API Keys

## Store your keys safely

1. Copy `frontend/hexabill-ui/.env.example` to `frontend/hexabill-ui/.env`.
2. Add your real values in `.env`. **Do not commit `.env`** (it should be in `.gitignore`).
3. Use AI keys only for optional features (smart CSV mapping, insights). Core logic (backup, import, calculations) does not depend on them.

## Keys you mentioned

- **Groq** (free): use for fast inference / text summary / column mapping suggestions.
- **Gemini**: use for insights or mapping (free tier available).
- **HuggingFace**: use for hosted models if needed.

Add them in `.env` as:

- `VITE_GROQ_API_KEY=your_groq_key`
- `VITE_GEMINI_API_KEY=your_gemini_key`
- `VITE_HUGGINGFACE_TOKEN=your_hf_token`

## Backup / Restore and Import (not AI)

Backup restore and CSV/Excel import can fail due to:

- **Schema mismatch** (SQLite vs PostgreSQL, or old vs new migrations).
- **Missing columns** (e.g. `AuditLogs.EntityId`).

**What we fixed:**

- **SQLite `AuditLogs` missing `EntityId`:** The DatabaseFixer now runs **AuditLogs** column adds **first**, so `EntityId`, `EntityType`, etc. are added before any code writes to `AuditLogs`. Error handling was tightened so only real “duplicate column” is ignored; other errors are logged.
- **After pulling:** Restart the backend so the fixer runs again. If you still see “table AuditLogs has no column named EntityId”, ensure you’re on SQLite (fixer is SQLite-only) and that the DB file is the one the app is using.

**Professional approach (for later):**

- **Backup:** Store `schemaVersion`, `databaseType`, `createdAt` in the backup payload; on restore, compare and run a transformer instead of raw dump.
- **Import:** Use a 3-layer pipeline: (1) schema detection / column mapping, (2) validation engine (required fields, types, duplicates), (3) dry-run preview then confirm.

## AI usage (optional)

Use LLMs for:

- Smart CSV column mapping suggestions.
- Auto profit / business insight text.
- Alerts and recommendations (e.g. margin, expiry).

Do **not** use LLMs for:

- Database restore.
- Financial calculations or core validation (keep these deterministic).
