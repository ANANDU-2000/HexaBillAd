# Maps and AI security

Starts after deterministic ERP workflows stabilize; existing primitives do not certify features.

- [ ] Optional saved customer stop, explicit current-location/picker action; no automatic GPS; separate stop/live points.
- [ ] Assigned ordered routes/stops/status/navigation/visit/payment/progress and driver scope.
- [ ] Explicit Start/EndTrip, visible tracking/freshness/sessionexpiry; denied/inaccurate/offline/duplicate/stale points.
- [ ] Tenant/role deterministic typed AI read tools, ERP citations, no generated SQL/finance arithmetic.
- [ ] Draft preview; posting permission/confirmation/validation/idempotency/audit.
- [ ] Provider abstraction/server secrets/tenant budget/usage/no silent paid fallback or cross-tenant retrieval.
- [ ] Backend flagsOFF/default, permission/isolation/rollback and negative browser matrix.

8Oct: NOT RUN; no maps/AI implementation introduced.

## Route Map (18 Oct 2026)
- The Route Map page draws a road-following line by sending only the stop coordinates (no names, amounts or company identifiers) from the user's browser to the public OSRM demo service, and loads map tiles from OpenStreetMap. Both are fair-use pilot services; replace with a paid or self-hosted provider before heavy use. If the routing service fails the page shows a straight line and says so.
- Assistant route tools (`route_overdue`, `route_unvisited`, `customers_without_pin`, `route_summary`) are read-only, take only a route name or "all" plus a limit, and answer from the caller's own routes. The model chooses the tool; it never sees customer data or amounts.
