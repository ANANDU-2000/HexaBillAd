# Print Specification (supersedes docs/plan/PRINT-MATRIX.md)
Header: left English block (name, address, mobile, email, TRN, CR) | centered tenant logo (max ~22 mm high, stored BW asset preferred) | right Arabic RTL block. Missing fields omitted, never faked. "Tax Invoice" only when TRN configured.
Body: black on white, 0.5 pt borders, one type scale, Noto Sans Arabic, right-aligned numbers.
Footer: totals, signatures, terms, company line, page X/Y.
Identity source: authenticated tenant context only.
| Document | Gulf Harvest | FrozenHub1 | FrozenHub2 | Notes |
|----------|--------------|------------|------------|-------|
| Sales invoice A4/A5/80/58mm, combined, delivery note, receipt, pending bills, sales ledger, P&L, worksheet, expense register, quotation, agreement, salary certificate, VAT management, barcode labels | PASS (text identity test + PNG review of invoice, receipt, expense register) | not rendered | not rendered | GulfHarvestDocumentFamilyTests |
| Customer statement, supplier statement | PASS (shared letterhead, monochrome, PNG review) | not rendered | not rendered | T-010c |
| Credit note | own bilingual-aware header, not visually reviewed | | | |
Logo assets: Gulf Harvest BW = clients/documents of clents/Gulf_Harvest_Logo_BW.png. FrozenHub BW = MISSING.
