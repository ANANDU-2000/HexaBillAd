/**
 * Security: In production, disable console output so logs and errors are not visible in the browser console.
 * This prevents exposure of internal errors, stack traces, and debug information.
 * Runs before any other app code (import this first in main.jsx).
 */
const noop = () => {}
const isProd = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD

if (isProd && typeof window !== 'undefined' && window.console) {
  const c = window.console
  try {
    c.log = noop
    c.info = noop
    c.warn = noop
    c.error = noop
    c.debug = noop
    c.trace = noop
    c.dir = noop
    c.dirxml = noop
    c.group = noop
    c.groupCollapsed = noop
    c.groupEnd = noop
    c.table = noop
    c.count = noop
    c.countReset = noop
    c.time = noop
    c.timeLog = noop
    c.timeEnd = noop
    c.assert = noop
    c.clear = noop
  } catch (_) {}
}
