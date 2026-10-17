# Voice and live-location: consent and data-use design (PROPOSAL, nothing built)

Status: proposal for the owner to approve or change. No code, schema or provider was added for this. It follows `AGENTS.md`: no background microphone or location, no consequential action from an unconfirmed transcript, provider keys server-side, no silent paid fallback, tenant isolation on every object.

## A. Malayalam and English push-to-talk

### What the person experiences
1. Hold a microphone button in the assistant panel. Recording runs only while it is held (or until a short maximum, for example 30 seconds), with a visible recording indicator.
2. The first use in a browser asks for the operating system microphone permission and shows a one-screen notice: what is recorded, where it is sent, how long it is kept, and how to switch it off.
3. The transcript appears in an editable box with the detected language shown. Nothing happens until the person edits or accepts the text and presses a normal button.
4. Any action the text implies goes through the existing server-held draft, review and confirm path (hash-checked, expiring, idempotent). Numbers, currency, product and customer are shown back on the review screen. The transcript alone never creates or changes anything.
5. A plain text box is always available. If speech fails, is slow or is turned off, the text path and every normal screen work unchanged.

### Data rules (proposed defaults)
| Item | Default |
|---|---|
| Audio retention | Not stored. Streamed or uploaded for transcription and discarded. A company setting could enable storing audio for quality review, off by default. |
| Transcript retention | Kept only inside the draft that used it and deleted with the draft's expiry (15 minutes) unless the owner enables history. |
| Opt out | Each user can turn voice off; the owner can turn it off for the company. Turned off means no microphone button. |
| Who may use it | A company flag plus the existing role permissions; staff never gain owner abilities through speech. |
| Provider | Server-side only, chosen by the owner; no key in the browser; audio sent only to the provider the owner approved; customer or financial speech is blocked until `Ai:AllowCustomerData`-style approval exists for audio too. |
| Logging | Duration, language, provider, latency and cost; never audio, never transcript text. |
| Cost control | Per-company daily minutes cap and a hard stop; no silent paid fallback. |
| Prompt injection | Transcript is untrusted text. It cannot grant permission, select a tenant, call arbitrary tools or skip confirmation; tools stay the fixed, typed, read-only list plus confirmed drafts. |

### Evidence needed before enabling for real users
Accuracy on Malayalam, English and mixed speech with noise and numbers; latency; cost per minute; microphone permission behaviour on the actual tablets; a deny test (voice off); cross-tenant tests for any stored transcript; the provider's data-use, retention and region terms in writing.

### Open decisions for the owner
1. Which provider for speech-to-text, and is speech sent outside the UAE acceptable for these businesses?
2. Store nothing (proposed) or allow optional audio and transcript history?
3. Which roles may use voice first (proposed: Owner and Admin only, then staff after a pilot)?
4. Daily minutes cap per company.

## B. Live location for deliveries and visits

### Principles
Location is sensitive staff data. It is opt-in, tied to a trip the person starts, visible to them, and stops when the trip ends. No background tracking, no tracking outside working time, and nothing that implies surveillance of private time.

### Proposed behaviour
1. A driver or salesperson starts a trip and sees a consent screen: who can see the location (named roles), that sharing stops when the trip ends or the app is closed, and how long points are kept. Sharing begins only after they accept for that trip.
2. While the page is open and foreground, the browser reports position at a modest interval. Each point is tagged with trip id, user, company, time and accuracy. The map shows "last seen N minutes ago" and greys out stale points rather than showing them as current.
3. Ending the trip, closing the app, signing out or revoking permission stops reporting immediately.
4. Owners and admins see only active trips of their own company. Staff see only their own trip. Route and branch scope from the existing assignments apply.
5. Retention: raw points deleted after a short window (proposed 30 days, shorter if the owner prefers), a trip summary (distance, stops completed) kept longer. A person can see their own history.
6. Delivery state comes first and needs no GPS: a stop can be marked arrived, delivered, failed with a reason, or skipped, with a timestamp. This builds on the existing routes and customer visits.
7. Maps: use a licensed tile service or a self-hosted one, with attribution. The public OpenStreetMap tile servers are not an unlimited production service, so do not rely on them for daily use.

### Evidence needed before enabling for real users
Consent text reviewed by the owner and, if staff are covered, communicated to them; permission-denied and revoked paths; stale-label behaviour; retention job tested; tenant and role isolation tests (forged trip id, another company's trip, a staff member reading someone else's trip); battery and data use on a real phone; a decision on whether employment terms or local rules require anything further (not assessed here).

### Open decisions for the owner
1. Is live GPS wanted at all, or are delivery states enough for now (proposed: states first)?
2. Who may see live positions (proposed: Owner and Admin only)?
3. Retention period for raw points.
4. Map provider and budget.

## C. Forecasts (for completeness)
Only after a data-quality check shows enough clean history per company. Each forecast is compared with a simple baseline, shows its method and as-of date, and is labelled an estimate. No forecast changes prices, stock or ledgers. Nothing is built.
