/**
 * P-01 request control: last-response-wins + abort + "still loading" / timeout phases.
 * Pure (no React, no axios) so it is unit-testable. Read-only list fetches only; money POSTs never use this.
 */
export const SLOW_AFTER_MS = 3000
export const TIMEOUT_AFTER_MS = 15000

/** True for fetch AbortError, axios CanceledError (ERR_CANCELED) and axios timeouts (ECONNABORTED). */
export function isAbortLike(error) {
  if (!error) return false
  return error.name === 'AbortError' || error.name === 'CanceledError' ||
    error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED'
}

export function createRequestController({
  slowMs = SLOW_AFTER_MS,
  timeoutMs = TIMEOUT_AFTER_MS,
  onChange = () => {},
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
} = {}) {
  let seq = 0
  let active = null // { id, abort, slowTimer, timeoutTimer, interrupted }
  let phase = 'idle' // idle | loading | slow | timedOut | cancelled

  const setPhase = (next) => {
    if (phase === next) return
    phase = next
    onChange(next)
  }
  const clearTimers = (a) => {
    if (!a) return
    clearTimer(a.slowTimer)
    clearTimer(a.timeoutTimer)
  }
  const abortActive = () => {
    if (!active) return
    clearTimers(active)
    try { active.abort() } catch (_) { /* already aborted */ }
  }

  /** Begin a request. Any earlier request is aborted and can never apply its result. */
  function start() {
    abortActive()
    const id = ++seq
    const ac = new AbortController()
    const a = { id, abort: () => ac.abort(), slowTimer: null, timeoutTimer: null, interrupted: null }
    active = a
    a.slowTimer = setTimer(() => { if (active === a && !a.interrupted) setPhase('slow') }, slowMs)
    a.timeoutTimer = setTimer(() => {
      if (active !== a || a.interrupted) return
      a.interrupted = 'timedOut'
      setPhase('timedOut')
      try { ac.abort() } catch (_) { /* ignore */ }
    }, timeoutMs)
    setPhase('loading')
    return {
      id,
      signal: ac.signal,
      isCurrent: () => active === a,
      /** Call in a finally block: ends the loading phase only if this is still the latest request. */
      finish() {
        if (active !== a) return
        clearTimers(a)
        if (!a.interrupted) setPhase('idle')
      },
      /**
       * Classify a caught error: 'superseded' (ignore silently), 'timedOut', 'cancelled' (user pressed Cancel),
       * or 'error' (a real failure the page should report).
       */
      classify(error) {
        if (active !== a) return 'superseded'
        if (a.interrupted) return a.interrupted
        if (error && error.code === 'ECONNABORTED') {
          a.interrupted = 'timedOut'
          clearTimers(a)
          setPhase('timedOut')
          return 'timedOut'
        }
        return 'error'
      },
    }
  }

  /** The user pressed Cancel on the still-loading notice. */
  function cancel() {
    if (!active || active.interrupted) return
    active.interrupted = 'cancelled'
    abortActive()
    setPhase('cancelled')
  }

  /** Unmount: abort without changing visible state. */
  function dispose() {
    abortActive()
    active = null
  }

  return { start, cancel, dispose, getPhase: () => phase }
}
