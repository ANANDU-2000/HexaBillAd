/** DEV-only POS interaction logger for deterministic debugging. */
export function posLog(event, payload = {}) {
  if (!import.meta.env.DEV) return
  try {
    // eslint-disable-next-line no-console
    console.log(`[POS] ${event}`, { t: performance.now().toFixed(1), ...payload })
  } catch {
    /* ignore */
  }
}
