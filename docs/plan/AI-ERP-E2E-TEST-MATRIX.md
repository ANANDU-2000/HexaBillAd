# HexaBill AI-native ERP — Test, edge cases and acceptance matrix

Test fixtures MUST be synthetic on isolated PostgreSQL. Use real API and UI testing with Playwright; mock providers only for deterministic tool failures; separately use approved synthetic provider smoke tests. Do NOT test with production customer transactions. Use explicit expected values and source IDs, no screenshot-only validation.

## Synthetic tenants / users
- T1 `GULF_TEST`: owner, admin, cashier, sales rep, accountant, driver; company logo and unique TRN/address/test customers.
- T2 `FROZEN_1_TEST`: owner1, sales1, separate stock/customer/price and SKU data; share an invented *synthetic* TRN with T3 solely for isolation testing.
- T3 `FROZEN_2_TEST`: owner2, staff2, own cash drawer/route, same synthetic TRN as T2, different owner/contact.
- T4 `FOURTH_TEST`: status pending/disabled variant to test tenant count/pagination/onboarding.
- System SuperAdmin: explicitly distinct identity; never infer from tenant ID null or job title.

## P0 production and money integrity
| ID | Scenario | Required result |
|---|---|---|
| INC-01 | Backend 503 while maintenance OFF | Service unavailable/retryable UI, NOT admin maintenance banner |
| INC-02 | Maintenance flag ON | Explicit maintenance UI, bypass restricted to permitted admin mechanisms |
| INC-03 | Server recovers without reload | Maintenance/outage overlay is cleared appropriately |
| INC-04 | DB schema pending | Health/readiness evidence and safe migration refusal, no false green |
| FIN-01 | Create POS with 2 items | persisted stock decrement, sale, ledger, VAT, dashboard and PDF reconcile |
| FIN-02 | Network timeout after sale commit | retry does not duplicate transaction using idempotency key |
| FIN-03 | Save purchase/expense with optional fields | field-by-field DB persistence after refresh and editing |
| FIN-04 | Multiple payments partial and overpayment | allocations and receivable/customer balance reconcile, no duplicate voucher |
| FIN-05 | Credit note/return/cancel | ledger, stock, VAT and summary corrected without history deletion |
| FIN-06 | Locked VAT date edit/import/bulk/return | authorized amend path only; guards operate within transactions |
| FIN-07 | Concurrent edit and lock | PG serialization works; no stale or silently accepted write |
| FIN-08 | Missing TRN and missing Form 201 source | no fabricated number or numeric zero; labelled incomplete |
| FIN-09 | Form 201 screen/PDF/XLSX/CSV | value and completeness-state parity, rounding controlled |
| FIN-10 | Shared TRN across tenants | no ledger/sale/cash/AI aggregation or automatic tax consolidation |
| BRAND-01 | Print tenant 1,2,3 same invoice number | correct legal name, logo, TRN, footer; no Starplus or other tenant data |
| BRAND-02 | Arabic/PDF/long table/print pagination | legible bidirectional text, rows, headings and totals, minimal ink |

## Staff, onboarding and last price
| ID | Scenario | Required result |
|---|---|---|
| AUTH-01 | Owner invite / first login / expired invite / password reset | authorized, secure and recoverable; no password disclosure |
| AUTH-02 | Staff role downgrade during session and AI voice session | next sensitive call denied and session permissions refreshed/revoked |
| AUTH-03 | Cashier opens VAT/staff roles page/API | deny even with forged frontend state |
| AUTH-04 | Owner toggles staff disabled | token and active streaming room invalidated as required |
| AUTH-05 | Staff last active >5min | offline indication does NOT claim absent from work |
| AUTH-06 | Four tenants / filter / status count | actual DB/API count and breakdown match UI |
| PRICE-01 | First sale ABC+Beef at AED 150 exclusive | memory stored after valid finalization |
| PRICE-02 | Next same tenant/customer/item/unit | AED 150 suggested, manual override possible |
| PRICE-03 | Switch customer | old price cleared/reloaded; no stale price leakage |
| PRICE-04 | Sale at different carton/KG unit | do not reuse incompatible unit price |
| PRICE-05 | Draft/void/return or editing older invoice | last valid chronological price recomputed correctly |
| PRICE-06 | Concurrent updates/duplicate clicks | deterministic last-price result, no duplicate sale |

## Cash / daily close / workflow UX
| ID | Scenario | Required result |
|---|---|---|
| CASH-01 | Opening 2000, cash in 5000+1500, cash out 800+1200 | expected closing 6500; if counted 6450, variance -50 |
| CASH-02 | Bank/card/credit invoice movement | excluded from physical cash equation |
| CASH-03 | Two cashiers/branches and reopen request | scoped independently; manager permission, audit, idempotent reopen |
| CASH-04 | Backdated cash-affecting posting after close | cannot silently change locked snapshot; authorized correction flow |
| UX-01 | Quick-create from 360px with virtual keyboard | always reachable, no overlay, correct permission, no duplicate submission |
| UX-02 | Ctrl/Cmd+K tenant search | accurate categorized results, bounded/permission filtered |
| UX-03 | Modal/table/sidebar on five widths | no unreadable text, blocked close, duplicate bars or unintended page overflow |
| UX-04 | Login branding on generic and tenant subdomain | no arbitrary tenant name from untrusted query; correct shell after auth |
| UX-05 | Offline/slow API/401/429/503 | visible recovery state, no lost form contents, no fake success |
| UX-06 | PWA install / sign-out / cache purge | no prior tenant financial data remains visible offline or in storage |

## Text assistant, provider and model router
| ID | Scenario | Required result |
|---|---|---|
| AI-01 | Owner asks today's sales in Malayalam | real backend total with date/currency, link/record source, translated answer |
| AI-02 | Staff lacking finance permission asks VAT/profit | deny before sensitive result is sent to model |
| AI-03 | T1 user requests T2 customer by exact invoice ID | no cross-tenant result, even through tool calling/prompt injection |
| AI-04 | User embeds “ignore permissions” in invoice description/PDF | tool permission unchanged, treat source as untrusted text |
| AI-05 | User requests product/item not found | clarify; never invent SKU or prior price |
| AI-06 | AI tool returns zero vs source unavailable | display correct distinct states and no hallucinated explanation |
| AI-07 | 429/402/401/timeout/5xx and cancelled request | correct fallback, no silent paid failover, no request storm |
| AI-08 | Free tier forbidden by privacy rule | provider blocked before sending data; manual workflow available |
| AI-09 | Provider key rotated, disabled or revoked | no leaked key, audit event, fail closed on disabled provider |
| AI-10 | Monthly cap reached concurrently across users | reservation ledger prevents overspend; owner/admin alerted |
| AI-11 | SuperAdmin budget + model changes | permission and audit enforced; owner cannot exceed platform cap |
| AI-12 | Output schema malformed/tool invocation invalid | no execution, safe error and trace without sensitive data |
| AI-13 | Retry/read caching | tenant+role+locale+record version cache separation; no PII leakage |
| AI-14 | Owner asks to post invoice via text | PREVIEW only then explicit confirmation and backend revalidation |
| AI-15 | AI optional off | financial ERP remains fully usable, navigation stable |
| AI-16 | Fraudulent role escalates via voice or JWT claim tampering | no elevation; fresh server-side auth |

## Voice and multilingual
| ID | Scenario | Required result |
|---|---|---|
| VO-01 | Malayalam “ഇന്ന് എത്ര സെയിൽസ്?” | STT correct enough, authorized total, Malayalam caption/optional audio |
| VO-02 | Code-switched “ABC-ന് five carton beef bill draft” | match customer/product or disambiguate; never autosave |
| VO-03 | Hindi and English with numbers | AED/currency/quantities readback, transcript review |
| VO-04 | Arabic RTL and mixed English SKU | correct bidi text and verified matched SKU |
| VO-05 | Unsupported language/model/voice | transparent choice, text fallback, no fake multilingual claim |
| VO-06 | Mic denied, headset disconnect, page background, poor network | state returns to usable text; session/mic cleans up |
| VO-07 | Interrupted speech, noise, model hallucinated “pay 1000” | no write without explicit confirmation and validations |
| VO-08 | Voice concurrency > allowed; trial credits exhausted | queue/reject correctly, cap usage; no hidden charge |
| VO-09 | Tenant logout/permission revocation midcall | server revokes authorized tool/session access |
| VO-10 | Transcript or recording retention disabled | recordings are not persistently stored; purge/delete tests |
| VO-11 | 60-second conversation cost/latency sample | measured with actual STT/LLM/TTS and LiveKit charges |
| VO-12 | Premium provider disabled and free provider fails | no silent premium spend, visible fallback |

## Route, maps, notification, ML
| ID | Scenario | Required result |
|---|---|---|
| MAP-01 | Assigned driver views route | only permitted stops, no other tenant or driver information |
| MAP-02 | Denied/stale GPS or no background tracking | clear status; route planning still works; no covert updates |
| MAP-03 | No hosted map quota/public OSM tiles blocked | graceful fallback list, no unlimited free assumption |
| MAP-04 | Visit/delivery/collection logged twice offline | idempotent, reconciliation correct |
| NOTIF-01 | Threshold alerts 50/80/100% | deduped, scoped, admin alerts no customer PII; correct provider cost |
| NOTIF-02 | Owner daily-close discrepancy | email only to authorized configured recipients; quiet hours respected |
| ML-01 | Insufficient sales history | use transparent baseline/no prediction; don't invent accuracy |
| ML-02 | Time leakage / seasonality drift | temporal holdout/backtest, measured baseline advantage |
| ML-03 | User rejects model suggestion | feedback logged as signal; no live unvalidated retrain |
| ML-04 | Noisy prediction recommends price change | NEVER changes historic or future invoice price automatically |

## Release gate checklist
- [ ] P0 access/maintenance/data contamination fixed and test verified.
- [ ] Migration rehearsed and PostgreSQL integration suite executed with no unexplained skips.
- [ ] Source commit matched to deployed staging backend and frontend.
- [ ] Read/draft tools deny cross-tenant data BEFORE reaching provider.
- [ ] Encrypted API credentials, quotas, privacy review, provider consent and alerts pass.
- [ ] Voice permission/caps/languages tested on representative actual devices and network quality.
- [ ] Mobile/tablet/desktop and print/financial parity regression green.
- [ ] Only after staging success: explicit separate approval for production migration/deploy and rollback.
