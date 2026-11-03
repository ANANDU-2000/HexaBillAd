/**
 * Stale-bundle recovery helpers.
 *
 * After a deploy, a tab that still runs the previous index.html requests lazy route chunks
 * whose hashed names no longer exist. Vercel's SPA rewrite answers those requests with
 * index.html (200, text/html), so the dynamic import fails with a chunk-style error.
 * Reloading fetches the new index.html and fixes it, so the boundary reloads once automatically.
 */
export const STALE_CHUNK_PATTERN = /ChunkLoadError|Loading chunk .* failed|dynamically imported module|Importing a module script failed/i

export const STALE_CHUNK_RELOAD_KEY = 'hexabill:stale-chunk-reload-at'
export const STALE_CHUNK_RELOAD_WINDOW_MS = 60 * 1000

export function isStaleChunkError(error) {
  return STALE_CHUNK_PATTERN.test(String(error?.message || ''))
}

/**
 * Returns true at most once per window. Without storage (blocked or unavailable) it returns false,
 * so a broken chunk can never trigger a reload loop.
 */
export function shouldAutoReloadForStaleChunk(storage, now = Date.now()) {
  if (!storage) return false
  try {
    const last = Number(storage.getItem(STALE_CHUNK_RELOAD_KEY) || 0)
    if (last && now - last < STALE_CHUNK_RELOAD_WINDOW_MS) return false
    storage.setItem(STALE_CHUNK_RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}
