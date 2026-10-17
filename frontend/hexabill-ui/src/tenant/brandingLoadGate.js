// Decides whether the tenant branding (logo + settings) may be requested now.
// Passive triggers (route change, tab visibility) are deduped; explicit ones (logo upload,
// impersonation, manual refresh) are forced. The platform host has no tenant branding of its own.
export const BRANDING_MIN_INTERVAL_MS = 60000

export const brandingLoadDecision = ({ hostMode, impersonatedTenantId, force = false, inFlight = false, lastAt = NaN, now = Date.now(), minIntervalMs = BRANDING_MIN_INTERVAL_MS }) => {
  if (hostMode === 'platform' && impersonatedTenantId == null) return { load: false, reason: 'platform-host' }
  if (force) return { load: true, reason: 'forced' }
  if (inFlight) return { load: false, reason: 'in-flight' }
  if (Number.isFinite(lastAt) && now - lastAt < minIntervalMs) return { load: false, reason: 'fresh' }
  return { load: true, reason: 'stale' }
}
