/** DEV-only POS interaction logger for deterministic debugging. */
export function posLog(event, payload = {}) {
  if (!import.meta.env.DEV) return
  try {
    console.log(`[POS] ${event}`, { t: performance.now().toFixed(1), ...payload })
  } catch {
    /* ignore */
  }
}
