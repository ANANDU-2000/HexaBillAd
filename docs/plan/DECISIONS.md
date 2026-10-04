# DECISIONS.md

Newest first. Date = approval day. Approver = Anandu unless noted.

## 2026-10-04 — Executor location: main repo (not Codex worktree)

**Decision:** Run Master Loop in `C:\Users\anand\OneDrive\Desktop\My StartUps Projects\HexaBilngApp` on branch off/`main`. Codex worktree at `.codex/worktrees/afa0` is **read-only**; its uncommitted WIP is inventoried in REVIEW-INBOX and ported into main.  
**Overrides:** MASTER-LOOP §0 kickoff path/branch (stale).  
**Approved by:** Anandu ("push to main all code").

## 2026-10-04 — Push / merge to main authorized

**Decision:** After each green Master Loop slice, commit and push to `origin/main`. Production Render/Vercel deploy still requires a separate explicit authorization.  
**Overrides:** MASTER-LOOP §0/§5 "no main" for this goal only.  
**Approved by:** Anandu.

## 2026-10-04 — Sample VAT TRN allowed in Production; never block on missing TRN

**Decision:** Missing VAT TRN must not block Tax Invoice. Assign per-tenant sample TRN (`SampleVatTrn.*`) and allow samples on Tax Invoice finalize/print in Production until the client enters a real TRN. Persistent owner/admin banner: "Sample TRN in use — update in Settings > Company". Shared-TRN warning remains informational.  
**Zayogya excluded:** no sample TRN, no VAT/print behavior change (D6).  
**Legal risk:** invoices may carry an invalid TRN; logged in REVIEW-INBOX.  
**Overrides:** MASTER-LOOP D8 (empty TRN blocks Tax Invoice) and prior T0-06 "Production rejects samples".  
**Approved by:** Anandu (AskQuestion option `prod_too`).

## 2026-10-04 — Client documents local-only

**Decision:** Read `clients/documents of clents/` (gitignored) for legal name / licence / CT TRN only. Write into local DB / gitignored `appsettings.Development.json`. Never copy PDFs, passwords, or certificates into the repo, evidence folders, or prompts. GulfHarvest `105543085200001` is Corporate Tax, never VAT.  
**Approved by:** Anandu ("use documents… sample TRN now, clients update later").

## Earlier Tier 0 (still in force unless overridden above)

- D1–D7, D9–D13 from MASTER-LOOP §3 remain in force.
- D5 profit×5% must not be shown as VAT.
- D6 Zayogya byte-for-byte tax/print unchanged + regression snapshot every slice.
