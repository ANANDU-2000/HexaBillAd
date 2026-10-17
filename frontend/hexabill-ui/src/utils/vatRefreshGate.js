// Decides whether a passive trigger (tab focus, visibility, dataUpdated) may refetch the VAT return.
// Passive triggers must never start a request while one is running or right after the same period loaded.
export const VAT_BACKGROUND_MIN_INTERVAL_MS = 30000

export const shouldRunBackgroundRefresh = ({ inFlight, lastKey, lastAt, key, now, minIntervalMs = VAT_BACKGROUND_MIN_INTERVAL_MS }) => {
  if (inFlight) return false
  if (lastKey === key && Number.isFinite(lastAt) && now - lastAt < minIntervalMs) return false
  return true
}

export const vatPeriodKey = (from, to) => `${from}|${to}`
